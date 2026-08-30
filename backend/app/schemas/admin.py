from pydantic import BaseModel
from typing import Optional, List


class SubjectCreate(BaseModel):
    name: str
    color: Optional[str] = "#6366f1"


class GradeSubjectAdd(BaseModel):
    school_id: int
    grade: int
    subject_id: int


class GradeSubjectRange(BaseModel):
    school_id: int
    grade_from: int
    grade_to: int
    subject_ids: List[int]


class ExamCreate(BaseModel):
    school_id: int
    grade: int
    name: str
    max_score: int
    term: Optional[str] = None


class ExamRange(BaseModel):
    school_id: int
    grade_from: int
    grade_to: int
    name: str
    max_score: int
    term: Optional[str] = None


class MarkItem(BaseModel):
    student_id: int
    subject_id: int
    score: float


class BulkMarksCreate(BaseModel):
    class_id: int
    exam_id: int
    marks: List[MarkItem]


class AccountCreate(BaseModel):
    """Admin creates a new account (no public registration)."""
    email: str
    password: str
    full_name: Optional[str] = None
    role: str                              # class_teacher | principal | chairperson | parent | school_admin
    school_id: Optional[int] = None        # for principal / school_admin
    assigned_class_id: Optional[int] = None  # for class_teacher
    school_ids: Optional[List[int]] = None  # for chairperson
    student_id: Optional[int] = None       # for parent (links to child)


class AssignBody(BaseModel):
    user_id: int
