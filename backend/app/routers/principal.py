from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.school import School
from app.models.class_ import Class
from app.models.student import Student
from app.models.mark import Mark
from app.models.exam import Exam
from app.models.subject import Subject
from app.models.grade_subject import GradeSubject
from app.models.attendance import Attendance
from app.dependencies import get_current_user, require_role
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import shlex
import os

router = APIRouter(prefix="/principal", tags=["principal"])
_allowed = require_role("principal", "super_admin", "school_admin")

Z_AI_BIN = os.environ.get("Z_AI_BIN", "/usr/local/bin/z-ai")


# ──────────────────────────────────────────────────────────────
# helpers
# ──────────────────────────────────────────────────────────────
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


def _gather_school_data(school: School, db: Session) -> dict:
    """Pull a one-shot snapshot of the school's data — used by all
    dashboard endpoints so we don't re-issue dozens of queries."""
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

    # per-student stats
    student_stats = {
        sid: {"student_id": sid, "marks_pct": [], "attendance_total": 0, "attendance_present": 0}
        for sid in student_ids
    }
    for m in marks:
        ex = exam_by_id.get(m.exam_id)
        if not ex or not ex.max_score:
            continue
        pct = (m.score / ex.max_score) * 100
        st = student_stats.get(m.student_id)
        if st is None:
            continue
        st["marks_pct"].append((m.subject_id, pct, m.exam_id))

    for a in attendance:
        st = student_stats.get(a.student_id)
        if st is None:
            continue
        st["attendance_total"] += 1
        if a.status == "P":
            st["attendance_present"] += 1

    # aggregate
    all_pcts = [pct for st in student_stats.values() for (_sid, pct, _eid) in st["marks_pct"]]
    school_avg = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0.0

    # top performer
    top = None
    if student_stats:
        ranked = []
        for sid, st in student_stats.items():
            if st["marks_pct"]:
                avg = sum(p for (_s, p, _e) in st["marks_pct"]) / len(st["marks_pct"])
                ranked.append((sid, avg))
        if ranked:
            ranked.sort(key=lambda x: x[1], reverse=True)
            sid, avg = ranked[0]
            stu = student_by_id.get(sid)
            if stu:
                top = {"student_id": sid, "name": stu.name, "average": round(avg, 1)}

    # per-grade breakdown
    grades = {}
    for c in classes:
        g = c.grade
        grades.setdefault(g, {"grade": g, "classes": 0, "students": 0, "_pcts": [], "_att": [0, 0]})
        grades[g]["classes"] += 1
    for s in students:
        c = class_by_id.get(s.class_id)
        if not c:
            continue
        grades.setdefault(c.grade, {"grade": c.grade, "classes": 0, "students": 0, "_pcts": [], "_att": [0, 0]})
        grades[c.grade]["students"] += 1
    for m in marks:
        ex = exam_by_id.get(m.exam_id)
        stu = student_by_id.get(m.student_id)
        if not ex or not stu:
            continue
        c = class_by_id.get(stu.class_id)
        if not c or not ex.max_score:
            continue
        grades[c.grade]["_pcts"].append((m.score / ex.max_score) * 100)
    for sid, st in student_stats.items():
        stu = student_by_id.get(sid)
        if not stu:
            continue
        c = class_by_id.get(stu.class_id)
        if not c:
            continue
        grades[c.grade]["_att"][0] += st["attendance_present"]
        grades[c.grade]["_att"][1] += st["attendance_total"]

    grade_rows = []
    for g in sorted(grades.keys()):
        d = grades[g]
        avg = round(sum(d["_pcts"]) / len(d["_pcts"]), 1) if d["_pcts"] else 0.0
        att_rate = round((d["_att"][0] / d["_att"][1]) * 100, 1) if d["_att"][1] else 0.0
        grade_rows.append({
            "grade": d["grade"], "classes": d["classes"],
            "students": d["students"], "average": avg, "attendance_rate": att_rate,
        })

    # per-class breakdown
    class_rows = []
    for c in classes:
        cls_students = [s for s in students if s.class_id == c.id]
        cls_pcts = []
        cls_att_pres = 0
        cls_att_tot = 0
        for sid in [s.id for s in cls_students]:
            st = student_stats.get(sid, {})
            for (_subj, p, _e) in st.get("marks_pct", []):
                cls_pcts.append(p)
            cls_att_pres += st.get("attendance_present", 0)
            cls_att_tot += st.get("attendance_total", 0)
        cls_avg = round(sum(cls_pcts) / len(cls_pcts), 1) if cls_pcts else 0.0
        cls_att = round((cls_att_pres / cls_att_tot) * 100, 1) if cls_att_tot else 0.0
        class_rows.append({
            "class_id": c.id, "grade": c.grade, "section": c.section,
            "label": f"Grade {c.grade}-{c.section}",
            "students": len(cls_students),
            "average": cls_avg,
            "attendance_rate": cls_att,
        })

    # subject-wise averages
    subject_rows = []
    for sub in subjects:
        # only include subjects configured for this school's grades
        configured = (db.query(GradeSubject)
                     .filter(GradeSubject.school_id == school.id,
                             GradeSubject.subject_id == sub.id)
                     .first())
        if not configured:
            continue
        sub_pcts = []
        for st in student_stats.values():
            for (subj_id, p, _e) in st["marks_pct"]:
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

    # exam-wise averages (for trends line)
    exam_rows = []
    for ex in exams:
        ex_marks = [m for m in marks if m.exam_id == ex.id]
        ex_pcts = [(m.score / ex.max_score) * 100 for m in ex_marks if ex.max_score]
        ex_avg = round(sum(ex_pcts) / len(ex_pcts), 1) if ex_pcts else 0.0
        exam_rows.append({
            "exam_id": ex.id, "name": ex.name, "term": ex.term,
            "grade": ex.grade, "max_score": ex.max_score, "average": ex_avg,
        })

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
        "_marks": marks,
        "_students": students,
        "_classes": classes,
    }


# ──────────────────────────────────────────────────────────────
# endpoints
# ──────────────────────────────────────────────────────────────
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user=Depends(_allowed)):
    school = _school_of(user, db)
    data = _gather_school_data(school, db)
    # strip internal fields
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
    data = _gather_school_data(school, db)
    student_stats = data["_student_stats"]
    student_by_id = data["_student_by_id"]
    subject_by_id = data["_subject_by_id"]
    classes = data["_classes"]

    out = []
    for c in classes:
        cls_students = [s for s in student_by_id.values() if s.class_id == c.id]
        # subject averages within this class
        sub_pcts = {}
        for s in cls_students:
            st = student_stats.get(s.id, {})
            for (subj_id, p, _e) in st.get("marks_pct", []):
                sub_pcts.setdefault(subj_id, []).append(p)
        # class-wide average
        all_pcts = [p for lst in sub_pcts.values() for p in lst]
        cls_avg = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0.0
        # attendance
        att_pres = sum(student_stats.get(s.id, {}).get("attendance_present", 0) for s in cls_students)
        att_tot = sum(student_stats.get(s.id, {}).get("attendance_total", 0) for s in cls_students)
        att_rate = round((att_pres / att_tot) * 100, 1) if att_tot else 0.0
        # top student in class
        top = None
        ranked = []
        for s in cls_students:
            st = student_stats.get(s.id, {})
            if st.get("marks_pct"):
                avg = sum(p for (_a, p, _b) in st["marks_pct"]) / len(st["marks_pct"])
                ranked.append((s.id, s.name, avg))
        if ranked:
            ranked.sort(key=lambda x: x[2], reverse=True)
            top = {"student_id": ranked[0][0], "name": ranked[0][1],
                   "average": round(ranked[0][2], 1)}
        # weakest subject
        weakest = None
        if sub_pcts:
            sub_avgs = [(sid, sum(lst) / len(lst)) for sid, lst in sub_pcts.items()]
            sub_avgs.sort(key=lambda x: x[1])
            wsid, wsavg = sub_avgs[0]
            sub = subject_by_id.get(wsid)
            if sub:
                weakest = {"subject_id": sub.id, "name": sub.name, "color": sub.color,
                           "average": round(wsavg, 1)}
        out.append({
            "class_id": c.id, "grade": c.grade, "section": c.section,
            "label": f"Grade {c.grade}-{c.section}",
            "student_count": len(cls_students),
            "average_percentage": cls_avg,
            "attendance_rate": att_rate,
            "top_student": top,
            "weakest_subject": weakest,
        })
    return out


@router.get("/subjects/breakdown")
def subjects_breakdown(db: Session = Depends(get_db), user=Depends(_allowed)):
    school = _school_of(user, db)
    data = _gather_school_data(school, db)
    return data["subjects"]


@router.get("/at-risk")
def at_risk(db: Session = Depends(get_db), user=Depends(_allowed)):
    """Students whose avg < 50% OR attendance < 60%."""
    school = _school_of(user, db)
    data = _gather_school_data(school, db)
    student_stats = data["_student_stats"]
    student_by_id = data["_student_by_id"]
    class_by_id = data["_class_by_id"]
    subject_by_id = data["_subject_by_id"]

    at_risk = []
    for sid, st in student_stats.items():
        stu = student_by_id.get(sid)
        if not stu:
            continue
        avg = (sum(p for (_a, p, _b) in st["marks_pct"]) / len(st["marks_pct"])
               if st["marks_pct"] else 0.0)
        att_tot = st["attendance_total"]
        att_rate = (st["attendance_present"] / att_tot * 100) if att_tot else 100.0
        if avg < 50 or att_rate < 60:
            # weakest subject for this student
            sub_pcts = {}
            for (subj_id, p, _e) in st["marks_pct"]:
                sub_pcts.setdefault(subj_id, []).append(p)
            weakest = None
            if sub_pcts:
                ranked = sorted(((sum(v) / len(v), k) for k, v in sub_pcts.items()))
                wsavg, wsid = ranked[0]
                sub = subject_by_id.get(wsid)
                if sub:
                    weakest = {"subject_id": sub.id, "name": sub.name,
                               "color": sub.color, "average": round(wsavg, 1)}
            c = class_by_id.get(stu.class_id)
            at_risk.append({
                "student_id": sid, "name": stu.name, "roll_no": stu.roll_no,
                "class_label": f"Grade {c.grade}-{c.section}" if c else "—",
                "average": round(avg, 1), "attendance_rate": round(att_rate, 1),
                "weakest_subject": weakest,
            })
    at_risk.sort(key=lambda x: x["average"])
    return at_risk[:20]


@router.get("/trends")
def trends(db: Session = Depends(get_db), user=Depends(_allowed)):
    """Grade-wise averages (bar) and exam-wise averages (line)."""
    school = _school_of(user, db)
    data = _gather_school_data(school, db)
    return {
        "by_grade": [{"grade": g["grade"], "average": g["average"],
                      "students": g["students"], "classes": g["classes"]}
                     for g in data["grades"]],
        "by_exam": [{"exam_id": e["exam_id"], "name": e["name"], "term": e["term"],
                     "grade": e["grade"], "max_score": e["max_score"],
                     "average": e["average"]} for e in data["exams"]],
    }


# ──────────────────────────────────────────────────────────────
# AI ANALYZE — real LLM via z-ai CLI
# ──────────────────────────────────────────────────────────────
class AnalyzeBody(BaseModel):
    question: str


def _build_data_snapshot(data: dict) -> dict:
    """Compact snapshot for the AI prompt."""
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
            {"grade": g["grade"], "students": g["students"], "average_pct": g["average"],
             "attendance_pct": g["attendance_rate"]} for g in data["grades"]
        ],
        "subject_breakdown": [
            {"subject": s["name"], "average_pct": s["average"],
             "student_count": s["student_count"], "pass_rate": s["pass_rate"]}
            for s in data["subjects"]
        ],
    }


async def _call_z_ai(system_prompt: str, user_prompt: str) -> Optional[str]:
    """Invoke the z-ai CLI and return the assistant message content (or None)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            Z_AI_BIN, "chat",
            "-p", user_prompt,
            "-s", system_prompt,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        if proc.returncode != 0:
            return None
        text = stdout.decode("utf-8", errors="replace").strip()
        # The CLI prints a banner + the JSON. Find the first `{` and parse from there.
        idx = text.find("{")
        if idx < 0:
            return None
        payload = json.loads(text[idx:])
        choices = payload.get("choices") or []
        if not choices:
            return None
        return choices[0].get("message", {}).get("content")
    except Exception:
        return None


def _fallback_answer(question: str, data: dict, snapshot: dict) -> str:
    """Canned data-driven answer if the LLM call fails."""
    school_name = snapshot["school_name"]
    avg = snapshot["school_average_pct"]
    top = snapshot.get("top_performer") or {}
    top_name = top.get("name", "N/A")
    top_avg = top.get("average", "N/A")
    weak_subj = min(snapshot["subject_breakdown"], key=lambda x: x["average_pct"]) \
        if snapshot["subject_breakdown"] else None
    strong_subj = max(snapshot["subject_breakdown"], key=lambda x: x["average_pct"]) \
        if snapshot["subject_breakdown"] else None
    weak_grade = min(snapshot["grade_breakdown"], key=lambda x: x["average_pct"]) \
        if snapshot["grade_breakdown"] else None
    lines = [
        f"# {school_name} — Quick Snapshot",
        "",
        f"- **School average:** {avg}%",
        f"- **Total students:** {snapshot['totals']['students']} across {snapshot['totals']['classes']} classes",
        f"- **Top performer:** {top_name} ({top_avg}%)",
    ]
    if strong_subj:
        lines.append(f"- **Strongest subject:** {strong_subj['subject']} ({strong_subj['average_pct']}%)")
    if weak_subj:
        lines.append(f"- **Weakest subject:** {weak_subj['subject']} ({weak_subj['average_pct']}%)")
    if weak_grade:
        lines.append(f"- **Grade needing attention:** Grade {weak_grade['grade']} (avg {weak_grade['average_pct']}%)")
    lines += [
        "",
        f"_(AI assistant unavailable — showing data-driven snapshot. Question was: '{question}')_",
    ]
    return "\n".join(lines)


@router.post("/ai/analyze")
async def ai_analyze(body: AnalyzeBody, db: Session = Depends(get_db), user=Depends(_allowed)):
    question = (body.question or "").strip()
    school = _school_of(user, db)
    data = _gather_school_data(school, db)
    snapshot = _build_data_snapshot(data)

    if not question:
        return {"answer": "Ask me about school performance, top performers, or grade comparisons.",
                "data_snapshot": snapshot}

    system_prompt = (
        "You are an AI assistant for a school principal. You have access to real school "
        "data which is provided below. Answer the principal's question in a detailed, "
        "actionable way. Highlight improvements needed. Be specific with numbers and names. "
        "Use markdown formatting with headers and bullet points."
    )
    user_prompt = (
        f"Principal's question: {question}\n\n"
        f"Here is the real school data snapshot (JSON):\n"
        f"```json\n{json.dumps(snapshot, indent=2)}\n```\n\n"
        f"Provide a thorough, specific answer."
    )

    answer = await _call_z_ai(system_prompt, user_prompt)
    if not answer:
        answer = _fallback_answer(question, data, snapshot)
        return {"answer": answer, "data_snapshot": snapshot, "ai_source": "fallback"}

    return {"answer": answer, "data_snapshot": snapshot, "ai_source": "z-ai"}
