from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.user_school import UserSchool
from app.models.school import School
from app.models.class_ import Class
from app.models.student import Student
from app.models.mark import Mark
from app.models.exam import Exam
from app.dependencies import get_current_user, require_role

router = APIRouter(prefix="/chairperson", tags=["chairperson"])
_allowed = require_role("chairperson", "super_admin")


def _schools_of(user: User, db: Session):
    if user.role == "super_admin":
        return db.query(School).order_by(School.id).all()
    links = db.query(UserSchool).filter(UserSchool.user_id == user.id).all()
    ids = [l.school_id for l in links]
    if not ids:
        return []
    return db.query(School).filter(School.id.in_(ids)).order_by(School.id).all()


@router.get("/schools")
def my_schools(db: Session = Depends(get_db), user=Depends(_allowed)):
    schools = _schools_of(user, db)
    out = []
    for s in schools:
        classes = db.query(Class).filter(Class.school_id == s.id).all()
        class_ids = [c.id for c in classes]
        students = db.query(Student).filter(Student.class_id.in_(class_ids)).all() if class_ids else []
        marks = db.query(Mark).filter(Mark.student_id.in_([st.id for st in students])).all() if students else []
        exams = db.query(Exam).filter(Exam.school_id == s.id).all()
        pcts = []
        for m in marks:
            ex = next((e for e in exams if e.id == m.exam_id), None)
            if ex and ex.max_score:
                pcts.append((m.score / ex.max_score) * 100)
        avg = round(sum(pcts) / len(pcts), 1) if pcts else 0
        out.append({
            "id": s.id, "name": s.name, "classes": len(classes),
            "students": len(students), "average": avg,
        })
    return out


@router.get("/compare")
def compare(db: Session = Depends(get_db), user=Depends(_allowed)):
    schools = _schools_of(user, db)
    rows = []
    for s in schools:
        classes = db.query(Class).filter(Class.school_id == s.id).all()
        class_ids = [c.id for c in classes]
        students = db.query(Student).filter(Student.class_id.in_(class_ids)).all() if class_ids else []
        marks = db.query(Mark).filter(Mark.student_id.in_([st.id for st in students])).all() if students else []
        exams = db.query(Exam).filter(Exam.school_id == s.id).all()
        pcts = []
        for m in marks:
            ex = next((e for e in exams if e.id == m.exam_id), None)
            if ex and ex.max_score:
                pcts.append((m.score / ex.max_score) * 100)
        avg = round(sum(pcts) / len(pcts), 1) if pcts else 0
        rows.append({"id": s.id, "name": s.name, "classes": len(classes),
                     "students": len(students), "average": avg, "marks_count": len(marks)})
    # overall totals
    total_students = sum(r["students"] for r in rows)
    overall_avg = round(sum(r["average"] for r in rows) / len(rows), 1) if rows else 0
    best = max(rows, key=lambda r: r["average"]) if rows else None
    return {
        "schools": rows,
        "total_students": total_students,
        "overall_average": overall_avg,
        "best_school": best,
    }
