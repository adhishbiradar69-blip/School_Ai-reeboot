from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.database import engine, Base
from app.models import user, user_school, school, class_, student, attendance, task, mark, subject, grade_subject, exam
from app.routers import auth, admin, attendance, tasks, academics, principal, chairperson, parent

app = FastAPI(title="SchoolAI API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

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
