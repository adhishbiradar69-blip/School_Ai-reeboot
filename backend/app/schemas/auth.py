from pydantic import BaseModel, field_validator
from typing import Optional


class UserCreate(BaseModel):
    email: str
    password: str
    # Allow self-registration only for admin-style roles. Other roles
    # (principal / class_teacher / chairperson / parent) are created
    # by the super_admin via /admin/accounts.
    role: str = "super_admin"
    full_name: Optional[str] = None
    school_id: Optional[int] = None
    assigned_class_id: Optional[int] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("super_admin", "school_admin"):
            raise ValueError("Self-registration is only allowed for super_admin / school_admin roles.")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    full_name: Optional[str] = None
    school_id: Optional[int] = None
    assigned_class_id: Optional[int] = None
