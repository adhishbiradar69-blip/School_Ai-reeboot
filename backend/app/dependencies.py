from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app import config

security = HTTPBearer()

# All admin-style roles. `super_admin` is the website owner (can manage
# schools + accounts), `school_admin` is a school-scoped admin.
ADMIN_ROLES = ("super_admin", "school_admin")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def require_role(*roles):
    """Dependency factory: allows access only to users whose role is in `roles`."""
    allowed = set(roles)

    def dependency(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_user

    return dependency


# Convenience: a super_admin-only dependency (website owner).
require_super_admin = require_role("super_admin")

# Convenience: any admin-style role (super_admin OR school_admin).
# school_admin will additionally need school-scope checks inside the route.
require_school_admin = require_role("super_admin", "school_admin")


def assert_school_access(user: User, school_id: int):
    """For `school_admin` users, verify they only touch their assigned school.
    `super_admin` can act on any school."""
    if user.role == "super_admin":
        return
    if user.role != "school_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to manage this school.",
        )
    if user.school_id is None or user.school_id != school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage your own school.",
        )
