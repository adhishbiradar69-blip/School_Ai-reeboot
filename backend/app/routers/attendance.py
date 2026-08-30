from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app.models.attendance import Attendance
from app.models.student import Student
from app.models.class_ import Class
from app.schemas.attendance import AttendanceBulkCreate
from app.dependencies import get_current_user, require_role

router = APIRouter(prefix="/attendance", tags=["attendance"])
_allowed = require_role("class_teacher", "super_admin", "school_admin")


@router.get("/teacher/classes")
def get_teacher_classes(db: Session = Depends(get_db), user=Depends(get_current_user)):
    classes = db.query(Class).filter(Class.class_teacher_id == user.id).all()
    if not classes:
        classes = db.query(Class).all()
    return [{"id": c.id, "grade": c.grade, "section": c.section,
             "label": f"Grade {c.grade}-{c.section}"} for c in classes]


@router.post("/mark")
def mark_attendance(data: AttendanceBulkCreate, db: Session = Depends(get_db), user=Depends(_allowed)):
    student_ids = [m.student_id for m in data.marks]
    students = db.query(Student).filter(Student.id.in_(student_ids), Student.class_id == data.class_id).all()
    if len(students) != len(student_ids):
        raise HTTPException(status_code=400, detail="Invalid student IDs for this class")

    for mark in data.marks:
        existing = db.query(Attendance).filter(
            Attendance.student_id == mark.student_id, Attendance.date == data.date
        ).first()
        if existing:
            existing.status = mark.status
            existing.marked_by = user.id
        else:
            db.add(Attendance(student_id=mark.student_id, date=data.date,
                              status=mark.status, marked_by=user.id))
    db.commit()
    return {"status": "saved", "date": str(data.date), "count": len(data.marks)}


@router.get("/class/{class_id}")
def get_class_attendance(class_id: int, date: date, db: Session = Depends(get_db),
                         user=Depends(get_current_user)):
    students = db.query(Student).filter(Student.class_id == class_id).all()
    records = db.query(Attendance).filter(
        Attendance.date == date,
        Attendance.student_id.in_([s.id for s in students])
    ).all()
    att_map = {a.student_id: a.status for a in records}
    return {
        "date": str(date),
        "students": [{"id": s.id, "name": s.name, "status": att_map.get(s.id, "Not Marked")}
                     for s in students]
    }


@router.get("/summary/{class_id}")
def get_attendance_summary(class_id: int, db: Session = Depends(get_db),
                          user=Depends(get_current_user)):
    students = db.query(Student).filter(Student.class_id == class_id).all()
    result = []
    for s in students:
        records = db.query(Attendance).filter(Attendance.student_id == s.id).all()
        total = len(records)
        present = len([r for r in records if r.status == 'P'])
        rate = round((present / total) * 100, 1) if total > 0 else 0
        result.append({
            "student_id": s.id, "name": s.name, "total_marked": total,
            "present_days": present, "attendance_rate": rate
        })
    return result
