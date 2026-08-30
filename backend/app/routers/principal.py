from __future__ import annotations

import json
import statistics
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.rate_limit import limiter
from app.models.attendance import Attendance
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.grade_subject import GradeSubject
from app.models.mark import Mark
from app.models.school import School
from app.models.student import Student
from app.models.subject import Subject
from app.models.user import User
from app.services.ai_service import ask_ai, ask_ai_agentic
from app.services.ai_tools import TOOLS as PRINCIPAL_TOOLS

router = APIRouter(prefix="/principal", tags=["principal"])
_allowed = require_role("principal", "super_admin", "school_admin")


# ─────────────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────────────
def _school_of(user: User, db: Session) -> School:
    """Return the school the principal/admin is acting on."""
    if user.role in ("super_admin", "school_admin"):
        if user.school_id:
            s = db.query(School).filter(School.id == user.school_id).first()
            if s:
                return s
        # super_admin with no school_id → pick the first school in the DB
        s = db.query(School).order_by(School.id).first()
        if not s:
            raise HTTPException(status_code=404, detail="No schools configured. Seed data first.")
        return s
    # principal
    if not user.school_id:
        raise HTTPException(status_code=400, detail="No school assigned to this principal.")
    s = db.query(School).filter(School.id == user.school_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="School not found.")
    return s


def _gather_school_data(db: Session, school: School) -> dict:
    """Pull a one-shot snapshot of the school's data — used by all
    dashboard endpoints so we don't re-issue dozens of queries.

    Computes:
      - per-student stats: average %, attendance rate, subject marks, rank
        in class, rank in grade, exam-by-exam averages, strongest/weakest
        subject, improvement trend (first exam → last exam).
      - per-class stats: avg, attendance, top/bottom student, subject
        averages, exam averages, at-risk count.
      - per-grade stats: list of sections (classes), avg, attendance, top
        student.
      - per-subject stats: avg, pass_rate (>=40%), student_count.
      - school-wide aggregates: school_average, top_performer, exam list.
    """
    classes = db.query(Class).filter(Class.school_id == school.id).all()
    class_by_id = {c.id: c for c in classes}
    class_ids = list(class_by_id.keys())

    students = db.query(Student).filter(Student.class_id.in_(class_ids)).all() if class_ids else []
    student_by_id = {s.id: s for s in students}
    student_ids = list(student_by_id.keys())

    exams = db.query(Exam).filter(Exam.school_id == school.id).all()
    exam_by_id = {e.id: e for e in exams}

    marks = (db.query(Mark).filter(Mark.student_id.in_(student_ids)).all()
             if student_ids else [])
    attendance = (db.query(Attendance).filter(Attendance.student_id.in_(student_ids)).all()
                  if student_ids else [])

    subjects = db.query(Subject).order_by(Subject.id).all()
    subject_by_id = {s.id: s for s in subjects}

    grade_subjects = db.query(GradeSubject).filter(GradeSubject.school_id == school.id).all()
    # Map grade → set of subject_ids that are configured for that grade
    grade_subject_map: dict[int, set[int]] = defaultdict(set)
    for gs in grade_subjects:
        grade_subject_map[gs.grade].add(gs.subject_id)

    # ─── per-student stats ────────────────────────────────────────────────
    # student_marks[sid] = list[(subject_id, pct, exam_id)]
    student_marks: dict[int, list[tuple[int, float, int]]] = defaultdict(list)
    # student_att[sid] = [present, total]
    student_att: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    # student_attendance_history[sid] = list[(date_str, status)]
    student_att_history: dict[int, list[tuple[str, str]]] = defaultdict(list)

    for m in marks:
        ex = exam_by_id.get(m.exam_id)
        if not ex or not ex.max_score:
            continue
        pct = (m.score / ex.max_score) * 100
        student_marks[m.student_id].append((m.subject_id, pct, m.exam_id))

    for a in attendance:
        bucket = student_att[a.student_id]
        bucket[1] += 1
        if a.status == "P":
            bucket[0] += 1
        student_att_history[a.student_id].append(
            (a.date.isoformat() if hasattr(a.date, "isoformat") else str(a.date), a.status)
        )
    # sort each student's attendance history by date
    for sid in student_att_history:
        student_att_history[sid].sort(key=lambda x: x[0])

    # exam ordering: each grade → ordered list of exam_ids (by id asc, a stable proxy for chronology)
    grade_exams: dict[int, list[int]] = defaultdict(list)
    for ex in exams:
        grade_exams[ex.grade].append(ex.id)
    for g in grade_exams:
        grade_exams[g].sort()

    # Compute per-student averages, attendance, ranks, etc.
    student_stats: dict[int, dict] = {}
    all_pcts: list[float] = []
    for sid, lst in student_marks.items():
        stu = student_by_id.get(sid)
        if not stu:
            continue
        c = class_by_id.get(stu.class_id)
        if not c:
            continue
        avg = sum(p for (_a, p, _b) in lst) / len(lst) if lst else 0.0

        # subject averages for this student
        per_subject: dict[int, list[float]] = defaultdict(list)
        per_exam: dict[int, list[float]] = defaultdict(list)
        for (subj_id, p, exam_id) in lst:
            per_subject[subj_id].append(p)
            per_exam[exam_id].append(p)

        subject_avgs = {
            sid2: round(sum(v) / len(v), 1) for sid2, v in per_subject.items()
        }
        exam_avgs = {
            eid: round(sum(v) / len(v), 1) for eid, v in per_exam.items()
        }

        # strongest / weakest subject
        strongest = None
        weakest = None
        if subject_avgs:
            sorted_subs = sorted(subject_avgs.items(), key=lambda kv: kv[1], reverse=True)
            best_sid, best_avg = sorted_subs[0]
            weak_sid, weak_avg = sorted_subs[-1]
            bsub = subject_by_id.get(best_sid)
            wsub = subject_by_id.get(weak_sid)
            if bsub:
                strongest = {"subject_id": bsub.id, "name": bsub.name,
                             "color": bsub.color, "average": best_avg}
            if wsub:
                weakest = {"subject_id": wsub.id, "name": wsub.name,
                           "color": wsub.color, "average": weak_avg}

        # attendance rate
        att_pres, att_tot = student_att.get(sid, [0, 0])
        att_rate = (att_pres / att_tot * 100) if att_tot else 100.0

        # improvement trend: compare avg in first exam vs last exam (chronologically)
        ordered_exam_ids = grade_exams.get(c.grade, [])
        first_exam_avg = None
        last_exam_avg = None
        if ordered_exam_ids:
            first_eid = ordered_exam_ids[0]
            last_eid = ordered_exam_ids[-1]
            if first_eid in exam_avgs:
                first_exam_avg = exam_avgs[first_eid]
            if last_eid in exam_avgs:
                last_exam_avg = exam_avgs[last_eid]

        improvement_delta = None
        if first_exam_avg is not None and last_exam_avg is not None:
            improvement_delta = round(last_exam_avg - first_exam_avg, 1)

        # variance for consistency
        variance = None
        if len(lst) > 1:
            variance = round(statistics.pvariance([p for (_a, p, _b) in lst]), 2)

        student_stats[sid] = {
            "student_id": sid,
            "name": stu.name,
            "roll_no": stu.roll_no,
            "class_id": c.id,
            "class_label": f"Grade {c.grade}-{c.section}",
            "grade": c.grade,
            "section": c.section,
            "average": round(avg, 1),
            "attendance_rate": round(att_rate, 1),
            "subject_averages": subject_avgs,
            "exam_averages": exam_avgs,
            "strongest_subject": strongest,
            "weakest_subject": weakest,
            "first_exam_average": first_exam_avg,
            "last_exam_average": last_exam_avg,
            "improvement_delta": improvement_delta,
            "variance": variance,
            "attendance_history": student_att_history.get(sid, []),
            "_marks": lst,  # internal
        }
        all_pcts.extend(p for (_a, p, _b) in lst)

    school_avg = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0.0

    # ─── rank computation ────────────────────────────────────────────────
    # Rank within class
    classes_with_students: dict[int, list[int]] = defaultdict(list)
    for sid, st in student_stats.items():
        classes_with_students[st["class_id"]].append(sid)
    for cid, sids in classes_with_students.items():
        sids.sort(key=lambda x: student_stats[x]["average"], reverse=True)
        for rank, sid in enumerate(sids, start=1):
            student_stats[sid]["rank_in_class"] = rank
            student_stats[sid]["class_size"] = len(sids)

    # Rank within grade
    grade_with_students: dict[int, list[int]] = defaultdict(list)
    for sid, st in student_stats.items():
        grade_with_students[st["grade"]].append(sid)
    for grade, sids in grade_with_students.items():
        sids.sort(key=lambda x: student_stats[x]["average"], reverse=True)
        for rank, sid in enumerate(sids, start=1):
            student_stats[sid]["rank_in_grade"] = rank
            student_stats[sid]["grade_size"] = len(sids)

    # ─── per-class stats ─────────────────────────────────────────────────
    class_rows = []
    for c in classes:
        cls_students = [student_stats[sid] for sid in classes_with_students.get(c.id, [])]
        cls_pcts = [p for st in cls_students for (_a, p, _b) in st["_marks"]]
        cls_avg = round(sum(cls_pcts) / len(cls_pcts), 1) if cls_pcts else 0.0
        att_pres = sum(student_att.get(st["student_id"], [0, 0])[0] for st in cls_students)
        att_tot = sum(student_att.get(st["student_id"], [0, 0])[1] for st in cls_students)
        att_rate = round((att_pres / att_tot) * 100, 1) if att_tot else 0.0
        # subject averages within this class
        sub_pcts: dict[int, list[float]] = defaultdict(list)
        for st in cls_students:
            for (subj_id, p, _e) in st["_marks"]:
                sub_pcts[subj_id].append(p)
        sub_avgs = []
        for subj_id, pcts in sub_pcts.items():
            sub = subject_by_id.get(subj_id)
            if not sub:
                continue
            sub_avgs.append({
                "subject_id": subj_id, "name": sub.name, "color": sub.color,
                "average": round(sum(pcts) / len(pcts), 1),
                "pass_rate": round(sum(1 for p in pcts if p >= 40) / len(pcts) * 100, 1) if pcts else 0.0,
            })
        sub_avgs.sort(key=lambda x: x["average"], reverse=True)
        # top / bottom student in class
        top = None
        bottom = None
        if cls_students:
            sorted_cls = sorted(cls_students, key=lambda x: x["average"], reverse=True)
            top = {"student_id": sorted_cls[0]["student_id"],
                   "name": sorted_cls[0]["name"],
                   "average": sorted_cls[0]["average"]}
            bottom = {"student_id": sorted_cls[-1]["student_id"],
                      "name": sorted_cls[-1]["name"],
                      "average": sorted_cls[-1]["average"]}
        # at-risk count
        at_risk_count = sum(1 for st in cls_students if st["average"] < 50 or st["attendance_rate"] < 60)
        # exam averages within class
        exam_pcts: dict[int, list[float]] = defaultdict(list)
        for st in cls_students:
            for (subj_id, p, exam_id) in st["_marks"]:
                exam_pcts[exam_id].append(p)
        exam_rows = []
        for ex in exams:
            if ex.grade != c.grade:
                continue
            pcts = exam_pcts.get(ex.id, [])
            exam_rows.append({
                "exam_id": ex.id, "name": ex.name, "term": ex.term,
                "max_score": ex.max_score,
                "average": round(sum(pcts) / len(pcts), 1) if pcts else 0.0,
                "student_count": len(pcts),
            })
        class_rows.append({
            "class_id": c.id, "grade": c.grade, "section": c.section,
            "label": f"Grade {c.grade}-{c.section}",
            "students": len(cls_students),
            "average": cls_avg,
            "attendance_rate": att_rate,
            "top_student": top,
            "bottom_student": bottom,
            "weakest_subject": sub_avgs[-1] if sub_avgs else None,
            "strongest_subject": sub_avgs[0] if sub_avgs else None,
            "at_risk_count": at_risk_count,
            "subject_averages": sub_avgs,
            "exam_averages": exam_rows,
        })

    # ─── per-grade stats ────────────────────────────────────────────────
    grade_rows = []
    grades_dict: dict[int, dict] = {}
    for c in classes:
        grades_dict.setdefault(c.grade, {"grade": c.grade, "class_ids": [], "sections": []})
        grades_dict[c.grade]["class_ids"].append(c.id)
        grades_dict[c.grade]["sections"].append(c.section)
    for grade in sorted(grades_dict.keys()):
        g_students = [student_stats[sid] for sid in grade_with_students.get(grade, [])]
        g_pcts = [p for st in g_students for (_a, p, _b) in st["_marks"]]
        g_avg = round(sum(g_pcts) / len(g_pcts), 1) if g_pcts else 0.0
        g_att_pres = sum(student_att.get(st["student_id"], [0, 0])[0] for st in g_students)
        g_att_tot = sum(student_att.get(st["student_id"], [0, 0])[1] for st in g_students)
        g_att = round((g_att_pres / g_att_tot) * 100, 1) if g_att_tot else 0.0
        # subject averages across the grade
        g_sub_pcts: dict[int, list[float]] = defaultdict(list)
        for st in g_students:
            for (subj_id, p, _e) in st["_marks"]:
                g_sub_pcts[subj_id].append(p)
        g_sub_avgs = []
        for subj_id in grade_subject_map.get(grade, []):
            sub = subject_by_id.get(subj_id)
            if not sub:
                continue
            pcts = g_sub_pcts.get(subj_id, [])
            g_sub_avgs.append({
                "subject_id": subj_id, "name": sub.name, "color": sub.color,
                "average": round(sum(pcts) / len(pcts), 1) if pcts else 0.0,
                "pass_rate": round(sum(1 for p in pcts if p >= 40) / len(pcts) * 100, 1) if pcts else 0.0,
                "student_count": len(pcts),
            })
        g_sub_avgs.sort(key=lambda x: x["average"], reverse=True)
        # top student in grade
        g_top = None
        if g_students:
            sorted_g = sorted(g_students, key=lambda x: x["average"], reverse=True)
            g_top = {"student_id": sorted_g[0]["student_id"],
                     "name": sorted_g[0]["name"],
                     "average": sorted_g[0]["average"]}
        grade_rows.append({
            "grade": grade,
            "classes": len(grades_dict[grade]["class_ids"]),
            "sections": sorted(set(grades_dict[grade]["sections"])),
            "students": len(g_students),
            "average": g_avg,
            "attendance_rate": g_att,
            "top_student": g_top,
            "subject_averages": g_sub_avgs,
        })

    # ─── per-subject stats ──────────────────────────────────────────────
    subject_rows = []
    for sub in subjects:
        configured = any(sub.id in grade_subject_map.get(g, set()) for g in grades_dict)
        if not configured:
            continue
        sub_pcts = []
        for sid, st in student_stats.items():
            for (subj_id, p, _e) in st["_marks"]:
                if subj_id == sub.id:
                    sub_pcts.append(p)
        avg = round(sum(sub_pcts) / len(sub_pcts), 1) if sub_pcts else 0.0
        pass_count = len([p for p in sub_pcts if p >= 40])
        pass_rate = round((pass_count / len(sub_pcts)) * 100, 1) if sub_pcts else 0.0
        subject_rows.append({
            "subject_id": sub.id, "name": sub.name, "color": sub.color,
            "average": avg, "student_count": len(sub_pcts),
            "pass_rate": pass_rate,
        })

    # ─── exam-wise stats ────────────────────────────────────────────────
    exam_rows = []
    for ex in exams:
        ex_marks = [m for m in marks if m.exam_id == ex.id]
        ex_pcts = [(m.score / ex.max_score) * 100 for m in ex_marks if ex.max_score]
        ex_avg = round(sum(ex_pcts) / len(ex_pcts), 1) if ex_pcts else 0.0
        exam_rows.append({
            "exam_id": ex.id, "name": ex.name, "term": ex.term,
            "grade": ex.grade, "max_score": ex.max_score, "average": ex_avg,
            "student_count": len(ex_pcts),
        })

    # ─── top performer ──────────────────────────────────────────────────
    top = None
    if student_stats:
        ranked = sorted(student_stats.values(), key=lambda x: x["average"], reverse=True)
        if ranked:
            t = ranked[0]
            top = {"student_id": t["student_id"], "name": t["name"],
                   "average": t["average"], "class_label": t["class_label"]}

    return {
        "school": {"id": school.id, "name": school.name},
        "total_students": len(students),
        "total_classes": len(classes),
        "total_exams": len(exams),
        "school_average": school_avg,
        "top_performer": top,
        "grades": grade_rows,
        "classes": class_rows,
        "subjects": subject_rows,
        "exams": exam_rows,
        # internal
        "_student_stats": student_stats,
        "_student_by_id": student_by_id,
        "_class_by_id": class_by_id,
        "_exam_by_id": exam_by_id,
        "_subject_by_id": subject_by_id,
        "_grade_subject_map": grade_subject_map,
        "_grade_exams": grade_exams,
        "_marks": marks,
        "_students": students,
        "_classes": classes,
        "_grade_rows": grade_rows,
        "_class_rows": class_rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# existing endpoints (kept + lightly enhanced)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user=Depends(_allowed)):
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    return {
        "school": data["school"],
        "total_students": data["total_students"],
        "total_classes": data["total_classes"],
        "total_exams": data["total_exams"],
        "school_average": data["school_average"],
        "top_performer": data["top_performer"],
        "grades": data["grades"],
        "classes": data["classes"],
        "subjects": data["subjects"],
    }


@router.get("/classes/compare")
def classes_compare(db: Session = Depends(get_db), user=Depends(_allowed)):
    """Per-class rollup with top_student + weakest_subject."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    out = []
    for c in data["_class_rows"]:
        out.append({
            "class_id": c["class_id"], "grade": c["grade"], "section": c["section"],
            "label": c["label"],
            "student_count": c["students"],
            "average_percentage": c["average"],
            "attendance_rate": c["attendance_rate"],
            "top_student": c["top_student"],
            "weakest_subject": c["weakest_subject"],
        })
    return out


@router.get("/subjects/breakdown")
def subjects_breakdown(db: Session = Depends(get_db), user=Depends(_allowed)):
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    return data["subjects"]


@router.get("/at-risk")
def at_risk(db: Session = Depends(get_db), user=Depends(_allowed)):
    """Students whose avg < 50% OR attendance < 60%."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    student_stats = data["_student_stats"]
    out = []
    for sid, st in student_stats.items():
        if st["average"] < 50 or st["attendance_rate"] < 60:
            out.append({
                "student_id": sid, "name": st["name"], "roll_no": st["roll_no"],
                "class_label": st["class_label"],
                "average": st["average"],
                "attendance_rate": st["attendance_rate"],
                "weakest_subject": st["weakest_subject"],
                "rank_in_class": st.get("rank_in_class"),
            })
    out.sort(key=lambda x: x["average"])
    return out[:20]


@router.get("/trends")
def trends(db: Session = Depends(get_db), user=Depends(_allowed)):
    """Grade-wise averages (bar) and exam-wise averages (line)."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    return {
        "by_grade": [{"grade": g["grade"], "average": g["average"],
                      "students": g["students"], "classes": g["classes"]}
                     for g in data["grades"]],
        "by_exam": [{"exam_id": e["exam_id"], "name": e["name"], "term": e["term"],
                     "grade": e["grade"], "max_score": e["max_score"],
                     "average": e["average"]} for e in data["exams"]],
    }


# ─────────────────────────────────────────────────────────────────────────────
# NEW: grade inspect & section compare
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/grades/{grade}/inspect")
def grade_inspect(grade: int, db: Session = Depends(get_db), user=Depends(_allowed)):
    """Deep dive into one grade: all sections/classes with full stats, the
    grade's overall avg, and section-vs-section subject comparison."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    grade_row = next((g for g in data["_grade_rows"] if g["grade"] == grade), None)
    if not grade_row:
        raise HTTPException(status_code=404, detail=f"No data for grade {grade} in this school.")

    # All classes (sections) of this grade with full per-class stats
    sections = [c for c in data["_class_rows"] if c["grade"] == grade]
    sections.sort(key=lambda c: c["section"])

    # Subject comparison across sections
    subject_comparison = []
    subjects_in_grade = grade_row["subject_averages"]
    for sub in subjects_in_grade:
        row = {
            "subject_id": sub["subject_id"], "name": sub["name"], "color": sub["color"],
            "grade_average": sub["average"],
            "sections": {},
            "best_section": None,
            "worst_section": None,
        }
        per_section = []
        for sec in sections:
            sa = next((s for s in sec["subject_averages"] if s["subject_id"] == sub["subject_id"]), None)
            avg_val = sa["average"] if sa else None
            row["sections"][sec["section"]] = avg_val
            if avg_val is not None:
                per_section.append((sec["section"], avg_val))
        if per_section:
            per_section.sort(key=lambda x: x[1], reverse=True)
            row["best_section"] = {"section": per_section[0][0], "average": per_section[0][1]}
            row["worst_section"] = {"section": per_section[-1][0], "average": per_section[-1][1]}
        subject_comparison.append(row)

    # top + bottom students in grade
    grade_students = sorted(
        (st for st in data["_student_stats"].values() if st["grade"] == grade),
        key=lambda x: x["average"], reverse=True
    )
    top_students = [{"student_id": s["student_id"], "name": s["name"],
                     "average": s["average"], "class_label": s["class_label"]}
                    for s in grade_students[:5]]
    bottom_students = [{"student_id": s["student_id"], "name": s["name"],
                        "average": s["average"], "class_label": s["class_label"]}
                       for s in grade_students[-5:][::-1]] if grade_students else []

    return {
        "grade": grade,
        "school": data["school"],
        "grade_average": grade_row["average"],
        "attendance_rate": grade_row["attendance_rate"],
        "total_students": grade_row["students"],
        "sections_count": len(sections),
        "sections": sections,
        "subject_averages": grade_row["subject_averages"],
        "subject_comparison": subject_comparison,
        "top_students": top_students,
        "bottom_students": bottom_students,
        "top_student": grade_row["top_student"],
    }


@router.get("/grades/{grade}/sections/compare")
def grade_sections_compare(grade: int, db: Session = Depends(get_db), user=Depends(_allowed)):
    """Compare all sections of a grade side-by-side. Chart-ready matrix."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    grade_row = next((g for g in data["_grade_rows"] if g["grade"] == grade), None)
    if not grade_row:
        raise HTTPException(status_code=404, detail=f"No data for grade {grade} in this school.")
    sections = sorted((c for c in data["_class_rows"] if c["grade"] == grade), key=lambda c: c["section"])
    subjects_in_grade = grade_row["subject_averages"]
    matrix_rows = []
    for sec in sections:
        row = {
            "class_id": sec["class_id"], "section": sec["section"],
            "label": sec["label"], "students": sec["students"],
            "average": sec["average"],
            "attendance_rate": sec["attendance_rate"],
            "top_student": sec["top_student"],
            "at_risk_count": sec["at_risk_count"],
            "subject_averages": {s["subject_id"]: s["average"]
                                 for s in sec["subject_averages"]},
        }
        matrix_rows.append(row)
    # subject list (for chart axis)
    subject_axis = [{"subject_id": s["subject_id"], "name": s["name"], "color": s["color"]}
                    for s in subjects_in_grade]
    # Best section overall
    best_section = max(matrix_rows, key=lambda r: r["average"]) if matrix_rows else None
    return {
        "grade": grade,
        "subjects": subject_axis,
        "sections": matrix_rows,
        "best_section": best_section,
        "grade_average": grade_row["average"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# NEW: class & student deep dives
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/classes/{class_id}/inspect")
def class_inspect(class_id: int, db: Session = Depends(get_db), user=Depends(_allowed)):
    """Deep dive into one class: all students with their marks per subject
    per exam, averages, attendance, rank, grade. Plus class-level subject
    averages."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    class_row = next((c for c in data["_class_rows"] if c["class_id"] == class_id), None)
    if not class_row:
        raise HTTPException(status_code=404, detail=f"Class {class_id} not found in your school.")
    exam_by_id = data["_exam_by_id"]
    subject_by_id = data["_subject_by_id"]
    grade_exams = data["_grade_exams"].get(class_row["grade"], [])

    # Build the student×subject×exam grid
    students_full = []
    for st in data["_student_stats"].values():
        if st["class_id"] != class_id:
            continue
        # marks grid: {subject_id: {exam_id: pct}}
        grid: dict[int, dict[int, float]] = defaultdict(dict)
        for (subj_id, p, exam_id) in st["_marks"]:
            grid[subj_id][exam_id] = round(p, 1)
        students_full.append({
            "student_id": st["student_id"], "name": st["name"], "roll_no": st["roll_no"],
            "average": st["average"], "attendance_rate": st["attendance_rate"],
            "rank_in_class": st.get("rank_in_class"),
            "rank_in_grade": st.get("rank_in_grade"),
            "class_size": st.get("class_size"),
            "grade_size": st.get("grade_size"),
            "strongest_subject": st["strongest_subject"],
            "weakest_subject": st["weakest_subject"],
            "improvement_delta": st["improvement_delta"],
            "marks_grid": {str(subj_id): {str(eid): p for eid, p in d.items()}
                           for subj_id, d in grid.items()},
        })
    students_full.sort(key=lambda x: x["rank_in_class"] or 9999)

    # Subject list for this class
    subjects_in_class = class_row["subject_averages"]
    # Exam list for this class
    exams_in_class = []
    for eid in grade_exams:
        ex = exam_by_id.get(eid)
        if ex:
            exams_in_class.append({
                "exam_id": ex.id, "name": ex.name, "term": ex.term,
                "max_score": ex.max_score,
            })

    return {
        "class_id": class_id,
        "label": class_row["label"],
        "grade": class_row["grade"],
        "section": class_row["section"],
        "school": data["school"],
        "students_count": class_row["students"],
        "class_average": class_row["average"],
        "attendance_rate": class_row["attendance_rate"],
        "top_student": class_row["top_student"],
        "bottom_student": class_row["bottom_student"],
        "at_risk_count": class_row["at_risk_count"],
        "subject_averages": subjects_in_class,
        "exam_averages": class_row["exam_averages"],
        "exams": exams_in_class,
        "students": students_full,
    }


@router.get("/students/{student_id}/profile")
def student_profile(student_id: int, db: Session = Depends(get_db), user=Depends(_allowed)):
    """One student's full profile."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    st = data["_student_stats"].get(student_id)
    if not st:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found in your school.")
    subject_by_id = data["_subject_by_id"]
    exam_by_id = data["_exam_by_id"]

    # Subject×exam grid for this student (with full labels)
    grid: dict[int, dict[int, float]] = defaultdict(dict)
    for (subj_id, p, exam_id) in st["_marks"]:
        grid[subj_id][exam_id] = round(p, 1)
    grid_out = []
    for subj_id, exam_map in grid.items():
        sub = subject_by_id.get(subj_id)
        if not sub:
            continue
        row = {
            "subject_id": subj_id, "name": sub.name, "color": sub.color,
            "scores": [],
            "average": st["subject_averages"].get(subj_id, 0.0),
        }
        for eid, pct in exam_map.items():
            ex = exam_by_id.get(eid)
            row["scores"].append({
                "exam_id": eid, "exam_name": ex.name if ex else "?",
                "term": ex.term if ex else None, "max_score": ex.max_score if ex else None,
                "percentage": pct,
            })
        row["scores"].sort(key=lambda x: x["exam_id"])
        grid_out.append(row)
    grid_out.sort(key=lambda x: x["name"])

    # Improvement trend
    trend = None
    if st["first_exam_average"] is not None and st["last_exam_average"] is not None:
        delta = st["improvement_delta"]
        if delta is None:
            direction = "stable"
        elif delta > 1.5:
            direction = "improving"
        elif delta < -1.5:
            direction = "declining"
        else:
            direction = "stable"
        trend = {
            "first_exam_average": st["first_exam_average"],
            "last_exam_average": st["last_exam_average"],
            "delta": delta,
            "direction": direction,
        }

    # Attendance history (chronological)
    att_history = [{"date": d, "status": s} for (d, s) in st["attendance_history"]]

    return {
        "student_id": st["student_id"],
        "name": st["name"],
        "roll_no": st["roll_no"],
        "class_label": st["class_label"],
        "class_id": st["class_id"],
        "grade": st["grade"],
        "section": st["section"],
        "school": data["school"],
        "average": st["average"],
        "attendance_rate": st["attendance_rate"],
        "rank_in_class": st.get("rank_in_class"),
        "class_size": st.get("class_size"),
        "rank_in_grade": st.get("rank_in_grade"),
        "grade_size": st.get("grade_size"),
        "strongest_subject": st["strongest_subject"],
        "weakest_subject": st["weakest_subject"],
        "improvement_trend": trend,
        "variance": st["variance"],
        "subject_exam_grid": grid_out,
        "attendance_history": att_history,
    }


# ─────────────────────────────────────────────────────────────────────────────
# NEW: rankings
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/rankings")
def rankings(db: Session = Depends(get_db), user=Depends(_allowed)):
    """School-wide rankings: top 10, bottom 10, most improved, most consistent."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    students = list(data["_student_stats"].values())

    # Top 10
    top10 = sorted(students, key=lambda x: x["average"], reverse=True)[:10]
    top10_out = [{"student_id": s["student_id"], "name": s["name"],
                  "average": s["average"], "class_label": s["class_label"],
                  "grade": s["grade"], "attendance_rate": s["attendance_rate"]}
                 for s in top10]

    # Bottom 10 (at-risk)
    bottom10 = sorted(students, key=lambda x: x["average"])[:10]
    bottom10_out = [{"student_id": s["student_id"], "name": s["name"],
                     "average": s["average"], "class_label": s["class_label"],
                     "grade": s["grade"], "attendance_rate": s["attendance_rate"],
                     "weakest_subject": s["weakest_subject"]}
                    for s in bottom10]

    # Most improved — biggest positive delta between first and last exam
    improved = [s for s in students if s["improvement_delta"] is not None]
    improved.sort(key=lambda x: x["improvement_delta"], reverse=True)
    most_improved_out = [{"student_id": s["student_id"], "name": s["name"],
                         "class_label": s["class_label"], "grade": s["grade"],
                         "first_exam_average": s["first_exam_average"],
                         "last_exam_average": s["last_exam_average"],
                         "improvement_delta": s["improvement_delta"]}
                        for s in improved[:10]]

    # Most consistent — lowest variance
    consistent = [s for s in students if s["variance"] is not None]
    consistent.sort(key=lambda x: x["variance"])
    most_consistent_out = [{"student_id": s["student_id"], "name": s["name"],
                           "class_label": s["class_label"], "grade": s["grade"],
                           "average": s["average"], "variance": s["variance"]}
                          for s in consistent[:10]]

    return {
        "top_10": top10_out,
        "bottom_10": bottom10_out,
        "most_improved": most_improved_out,
        "most_consistent": most_consistent_out,
    }


# ─────────────────────────────────────────────────────────────────────────────
# NEW: insights
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights")
def insights(db: Session = Depends(get_db), user=Depends(_allowed)):
    """Algorithmic insights: improvement index, consistency score, subject
    gap, attendance impact, grade trajectory."""
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    out: list[dict] = []

    # 1) Improvement index per class (avg first exam vs avg last exam)
    for c in data["_class_rows"]:
        exams_sorted = sorted(c["exam_averages"], key=lambda e: e["exam_id"])
        if len(exams_sorted) < 2:
            continue
        first_avg = exams_sorted[0]["average"]
        last_avg = exams_sorted[-1]["average"]
        delta = round(last_avg - first_avg, 1)
        severity = "good" if delta > 1.5 else ("critical" if delta < -1.5 else "warning")
        out.append({
            "type": "class_improvement",
            "title": f"Class {c['label']} improvement",
            "value": delta,
            "detail": (f"{c['label']} moved from {first_avg}% in '{exams_sorted[0]['name']}' "
                       f"to {last_avg}% in '{exams_sorted[-1]['name']}' "
                       f"({delta:+}% across {len(exams_sorted)} exams)."),
            "severity": severity,
            "class_id": c["class_id"],
        })

    # 2) Consistency score per class (std-dev of student averages; lower = more consistent)
    for c in data["_class_rows"]:
        cls_students = [st for st in data["_student_stats"].values() if st["class_id"] == c["class_id"]]
        avgs = [s["average"] for s in cls_students]
        if len(avgs) < 2:
            continue
        sd = round(statistics.pstdev(avgs), 2)
        severity = "good" if sd < 8 else ("warning" if sd < 14 else "critical")
        out.append({
            "type": "class_consistency",
            "title": f"Class {c['label']} consistency",
            "value": sd,
            "detail": (f"Student-average spread in {c['label']} is σ={sd} percentage points "
                       f"({len(avgs)} students). Lower means more uniform performance — "
                       f"high σ suggests uneven teaching/learning."),
            "severity": severity,
            "class_id": c["class_id"],
        })

    # 3) Subject gap — biggest performance gap between best and worst class, per subject
    for sub in data["subjects"]:
        per_class_avgs = []
        for c in data["_class_rows"]:
            sa = next((s for s in c["subject_averages"] if s["subject_id"] == sub["subject_id"]), None)
            if sa and sa["average"] is not None:
                per_class_avgs.append((c["label"], sa["average"]))
        if len(per_class_avgs) < 2:
            continue
        per_class_avgs.sort(key=lambda x: x[1])
        worst = per_class_avgs[0]
        best = per_class_avgs[-1]
        gap = round(best[1] - worst[1], 1)
        if gap < 5:  # ignore negligible gaps
            continue
        severity = "warning" if gap < 15 else "critical"
        out.append({
            "type": "subject_gap",
            "title": f"{sub['name']} gap = {gap}%",
            "value": gap,
            "detail": (f"{sub['name']} ranges from {worst[0]} ({worst[1]}%) to "
                       f"{best[0]} ({best[1]}%) — a {gap} percentage-point gap."),
            "severity": severity,
            "subject_id": sub["subject_id"],
        })

    # 4) Attendance impact — correlation between attendance rate and average score
    pairs = [(st["attendance_rate"], st["average"]) for st in data["_student_stats"].values()]
    corr = _pearson(pairs)
    if corr is not None:
        severity = "good" if corr >= 0.3 else ("warning" if corr >= 0.1 else "critical")
        out.append({
            "type": "attendance_impact",
            "title": "Attendance ↔ Performance correlation",
            "value": round(corr, 3),
            "detail": (f"Across {len(pairs)} students, Pearson r = {corr:.3f} between attendance "
                       f"rate and average score. "
                       + ("Strong positive — attendance clearly matters." if corr >= 0.3 else
                          "Weak positive — attendance isn't the main driver." if corr >= 0.1 else
                          "Negligible — performance is driven by something else.")),
            "severity": severity,
        })

    # 5) Grade trajectory — does performance rise or fall from grade 1 to 10?
    grade_avgs = [(g["grade"], g["average"]) for g in data["grades"] if g["students"] > 0]
    grade_avgs.sort(key=lambda x: x[0])
    if len(grade_avgs) >= 2:
        first_grade, first_avg = grade_avgs[0]
        last_grade, last_avg = grade_avgs[-1]
        delta = round(last_avg - first_avg, 1)
        trajectory = ("rising" if delta > 1 else "falling" if delta < -1 else "flat")
        severity = "good" if delta > 1 else ("critical" if delta < -1 else "warning")
        out.append({
            "type": "grade_trajectory",
            "title": f"Grade {first_grade} → {last_grade} trajectory",
            "value": delta,
            "detail": (f"School-wide average moves from {first_avg}% in Grade {first_grade} "
                       f"to {last_avg}% in Grade {last_grade} ({trajectory}, {delta:+}%)."),
            "severity": severity,
        })

    return out


def _pearson(pairs: list[tuple[float, float]]) -> Optional[float]:
    """Pearson correlation; returns None if not enough variance."""
    n = len(pairs)
    if n < 3:
        return None
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in pairs)
    denom_x = sum((x - mx) ** 2 for x in xs) ** 0.5
    denom_y = sum((y - my) ** 2 for y in ys) ** 0.5
    if denom_x == 0 or denom_y == 0:
        return None
    return num / (denom_x * denom_y)


# ─────────────────────────────────────────────────────────────────────────────
# AI ANALYZE — Agentic (tool-calling) Groq → z-ai → fallback
# ─────────────────────────────────────────────────────────────────────────────
class AnalyzeBody(BaseModel):
    question: str


SYSTEM_PROMPT = (
    "You are an AI assistant for a school principal. You have access to real, "
    "live school data via tools. When you need specific info (a student's "
    "details, a grade comparison, the at-risk list, etc.), call a tool by "
    "responding with ONLY: {\"tool\":\"tool_name\",\"args\":{...}}. After "
    "getting the tool result, give a detailed markdown answer with specific "
    "names, numbers, and actionable recommendations. Use ## headers, "
    "**bold**, and - bullet lists."
)


def _build_data_snapshot(data: dict) -> dict:
    """Rich JSON snapshot built from `_gather_school_data` for the AI prompt."""
    # Top performers (top 5)
    student_stats = data["_student_stats"]
    ranked = sorted(student_stats.values(), key=lambda x: x["average"], reverse=True)
    top_performers = [{"name": s["name"], "average": s["average"],
                       "class_label": s["class_label"]} for s in ranked[:5]]
    # At-risk students (bottom 5)
    at_risk = sorted(student_stats.values(), key=lambda x: x["average"])[:5]
    at_risk_out = [{"name": s["name"], "average": s["average"],
                    "attendance_rate": s["attendance_rate"],
                    "class_label": s["class_label"],
                    "weakest_subject": s["weakest_subject"]["name"] if s["weakest_subject"] else None}
                   for s in at_risk]
    return {
        "school_name": data["school"]["name"],
        "totals": {
            "students": data["total_students"],
            "classes": data["total_classes"],
            "exams": data["total_exams"],
        },
        "school_average_pct": data["school_average"],
        "top_performer": data["top_performer"],
        "grade_breakdown": [
            {"grade": g["grade"], "students": g["students"],
             "average_pct": g["average"], "attendance_pct": g["attendance_rate"]}
            for g in data["grades"]
        ],
        "class_breakdown": [
            {"label": c["label"], "students": c["students"],
             "average_pct": c["average"], "attendance_pct": c["attendance_rate"],
             "top_student": c["top_student"]["name"] if c["top_student"] else None,
             "weakest_subject": c["weakest_subject"]["name"] if c["weakest_subject"] else None,
             "at_risk_count": c["at_risk_count"]}
            for c in data["classes"]
        ],
        "subject_breakdown": [
            {"subject": s["name"], "average_pct": s["average"],
             "student_count": s["student_count"], "pass_rate": s["pass_rate"]}
            for s in data["subjects"]
        ],
        "top_performers": top_performers,
        "at_risk_students": at_risk_out,
        "insights": _build_insights_summary(data),
    }


def _build_insights_summary(data: dict) -> dict:
    """Lightweight insights summary embedded in the AI snapshot."""
    # grade trajectory
    grade_avgs = [(g["grade"], g["average"]) for g in data["grades"] if g["students"] > 0]
    grade_avgs.sort()
    trajectory = None
    if len(grade_avgs) >= 2:
        first_grade, first_avg = grade_avgs[0]
        last_grade, last_avg = grade_avgs[-1]
        trajectory = {"from_grade": first_grade, "to_grade": last_grade,
                      "from_avg": first_avg, "to_avg": last_avg,
                      "delta": round(last_avg - first_avg, 1)}
    # subject gap (largest)
    largest_gap = None
    for sub in data["subjects"]:
        per_class_avgs = []
        for c in data["classes"]:
            sa = next((s for s in c["subject_averages"] if s["subject_id"] == sub["subject_id"]), None)
            if sa:
                per_class_avgs.append((c["label"], sa["average"]))
        if len(per_class_avgs) < 2:
            continue
        per_class_avgs.sort(key=lambda x: x[1])
        gap = round(per_class_avgs[-1][1] - per_class_avgs[0][1], 1)
        if largest_gap is None or gap > largest_gap["gap"]:
            largest_gap = {"subject": sub["name"], "gap": gap,
                           "worst_class": per_class_avgs[0][0],
                           "best_class": per_class_avgs[-1][0]}
    return {
        "grade_trajectory": trajectory,
        "largest_subject_gap": largest_gap,
        "weakest_subject": min(data["subjects"], key=lambda s: s["average"])["name"] if data["subjects"] else None,
        "strongest_subject": max(data["subjects"], key=lambda s: s["average"])["name"] if data["subjects"] else None,
    }


def _compact_school_summary(data: dict) -> str:
    """One-paragraph text snapshot the agentic LLM uses as background context
    (so it knows the school's shape without having to call a tool first)."""
    weak = min(data["subjects"], key=lambda s: s["average"])["name"] if data["subjects"] else "?"
    strong = max(data["subjects"], key=lambda s: s["average"])["name"] if data["subjects"] else "?"
    top = data.get("top_performer") or {}
    at_risk_count = sum(1 for st in data["_student_stats"].values()
                        if st["average"] < 50 or st["attendance_rate"] < 60)
    grade_summary = ", ".join(
        f"Grade {g['grade']}: avg {g['average']}% ({g['students']} students)"
        for g in data["grades"]
    )
    subject_summary = ", ".join(
        f"{s['name']}: {s['average']}%" for s in data["subjects"]
    )
    return (
        f"School: {data['school']['name']} — "
        f"{data['total_students']} students, {data['total_classes']} classes, "
        f"{data['total_exams']} exams. "
        f"School average: {data['school_average']}%. "
        f"At-risk students: {at_risk_count}. "
        f"Top performer: {top.get('name', '?')} ({top.get('average', '?')}%). "
        f"Strongest subject: {strong}. Weakest subject: {weak}. "
        f"Grades — {grade_summary}. "
        f"Subjects — {subject_summary}."
    )


@router.post("/ai/analyze")
@limiter.limit("30/minute")
async def ai_analyze(request: Request, body: AnalyzeBody, db: Session = Depends(get_db), user=Depends(_allowed)):
    question = (body.question or "").strip()
    school = _school_of(user, db)
    data = _gather_school_data(db, school)
    snapshot = _build_data_snapshot(data)

    if not question:
        return {
            "answer": "Ask me about school performance, top performers, or grade comparisons.",
            "source": "fallback",
            "data_snapshot": snapshot,
            "tools_used": [],
        }

    # Agentic loop: give the LLM the principal's tool set + the pre-computed
    # school snapshot so it can answer with specific names and numbers.
    result = await ask_ai_agentic(
        question=question,
        system_prompt=SYSTEM_PROMPT,
        db=db,
        tools=PRINCIPAL_TOOLS,
        context_summary=_compact_school_summary(data),
        ctx={"school": school, "_data": data},
    )
    return {
        "answer": result["answer"],
        "source": result["source"],
        "tools_used": result.get("tools_used", []),
        "data_snapshot": snapshot,
    }
