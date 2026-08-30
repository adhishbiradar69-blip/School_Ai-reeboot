from pydantic import BaseModel, field_validator
from typing import Optional


class SchoolCreate(BaseModel):
    name: str


class ClassCreate(BaseModel):
    school_id: int
    grade: int
    section: str

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, v):
        if v < 1 or v > 10:
            raise ValueError("Grade must be between 1 and 10")
        return v


class StudentCreate(BaseModel):
    name: str
    roll_no: Optional[str] = None
    class_id: int
    parent_user_id: Optional[int] = None
