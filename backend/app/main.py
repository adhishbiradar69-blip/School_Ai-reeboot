import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import engine, Base, SessionLocal
from app.models import user, user_school, school, class_, student, attendance, task, mark, subject, grade_subject, exam
from app.routers import auth, admin, attendance, tasks, academics, principal, chairperson, parent
from app.rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

app = FastAPI(title="SchoolAI API", version="1.1.0")

# ─────────────────────────────────────────────────────────────────────────────
# Rate limiter (slowapi)
# ─────────────────────────────────────────────────────────────────────────────
# Slowapi reads ``request.state.limiter`` and the client IP from the route
# handler's ``Request`` param. The exception handler converts the raised
# ``RateLimitExceeded`` into a clean 429 response.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─────────────────────────────────────────────────────────────────────────────
# CORS — origins from env var (Task 7-bugs-security #7)
# ─────────────────────────────────────────────────────────────────────────────
_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
_allowed = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Security headers middleware (Task 7-bugs-security #7)
# ─────────────────────────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# ─────────────────────────────────────────────────────────────────────────────
# Startup: create tables + ensure root super_admin exists
# ─────────────────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# Provision the hardcoded super_admin if missing.
try:
    _db: Session = SessionLocal()
    try:
        auth.ensure_root_admin(_db)
        print("Root admin ensured: root.schoolai@nexus-secure.internal")
    finally:
        _db.close()
except Exception as exc:  # pragma: no cover — startup should not crash on this
    print(f"[warn] ensure_root_admin failed: {exc}")

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(attendance.router)
app.include_router(tasks.router)
app.include_router(academics.router)
app.include_router(principal.router)
app.include_router(chairperson.router)
app.include_router(parent.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error", "error": str(exc)})


@app.get("/")
def root():
    return {"status": "running", "name": "SchoolAI API"}
