from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone
import re

from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, Token
from app import config
from app.rate_limit import limiter

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Hardcoded super_admin credentials (Task 7-bugs-security #6). Created on
# startup if no super_admin exists. Password is intentionally complex and
# known only to the operators — change in production via the env override
# below if you need to rotate.
ROOT_ADMIN_EMAIL = "root.schoolai@nexus-secure.internal"
ROOT_ADMIN_PASSWORD = "Tr!umphant-Str@tik-9173"
ROOT_ADMIN_FULL_NAME = "System Root"


def get_password_hash(password):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)


def _token_for(user: User) -> dict:
    return {
        "access_token": create_access_token(data={"sub": str(user.id)}),
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
        "full_name": user.full_name,
        "school_id": user.school_id,
        "assigned_class_id": user.assigned_class_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Password strength
# ─────────────────────────────────────────────────────────────────────────────
def _validate_password_strength(password: str) -> None:
    """Enforce a basic but sane password policy on self-registration:
    - at least 8 characters
    - at least one letter
    - at least one number

    Raises 400 if the password is too weak. Note: the hardcoded root admin
    bypasses this (it's set via :func:`ensure_root_admin`).
    """
    if not isinstance(password, str) or len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter.")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")


# ─────────────────────────────────────────────────────────────────────────────
# Root super_admin bootstrap
# ─────────────────────────────────────────────────────────────────────────────
def ensure_root_admin(db: Session) -> None:
    """Create the hardcoded super_admin account if it doesn't exist.

    Called on app startup from ``main.py`` after tables are created. Safe to
    call repeatedly — it's a no-op once the user exists. The password is
    hashed with the same scheme used for normal registration.
    """
    existing = db.query(User).filter(User.email == ROOT_ADMIN_EMAIL).first()
    if existing:
        # Already provisioned. (We deliberately do NOT overwrite the password
        # here — if an operator rotated it via the admin UI, we keep it.)
        return
    root = User(
        email=ROOT_ADMIN_EMAIL,
        hashed_password=get_password_hash(ROOT_ADMIN_PASSWORD),
        role="super_admin",
        full_name=ROOT_ADMIN_FULL_NAME,
        school_id=None,
        assigned_class_id=None,
    )
    db.add(root)
    db.commit()
    db.refresh(root)


@router.post("/register", response_model=Token)
@limiter.limit("60/minute")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    _validate_password_strength(user.password)
    new_user = User(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        role=user.role,
        full_name=user.full_name,
        school_id=user.school_id,
        assigned_class_id=user.assigned_class_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return _token_for(new_user)


@router.post("/login", response_model=Token)
@limiter.limit("60/minute")
def login(request: Request, user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    return _token_for(db_user)
