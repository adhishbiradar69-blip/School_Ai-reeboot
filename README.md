# SchoolAI

A professional, AI-powered school management platform with multi-role access, rich analytics, and an AI assistant for principals and chairpersons.

## Stack
- **Frontend**: React 19 + Vite + framer-motion + recharts + lucide-react
- **Backend**: Python FastAPI + SQLAlchemy + SQLite (dev) / PostgreSQL (prod)
- **AI**: Groq API (llama-3.3-70b) with z-ai fallback

## Quick start (local)

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

### Bootstrap + seed
```bash
# 1. Register super_admin
curl -X POST http://127.0.0.1:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@schoolai.test","password":"admin123","role":"super_admin","full_name":"Super Admin"}'

# 2. Login (copy access_token from response)
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@schoolai.test","password":"admin123"}'

# 3. Seed full demo data (3 schools, 1125 students, 16500 marks)
curl -X POST http://127.0.0.1:8000/admin/seed-full \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or just log in at http://localhost:5173 and click "Seed Full Demo Data" on the Admin Dashboard.

## Demo accounts (after seed-full)
| Email | Password | Role |
|---|---|---|
| admin@schoolai.test | admin123 | Super Admin |
| greenwood@admin.test | school123 | School Admin (Greenwood) |
| principal@greenwood.test | principal123 | Principal |
| chairperson@schoolai.test | chair123 | Chairperson |

## AI configuration (optional)
The principal & chairperson AI assistants use Groq by default. Set a Groq API key:
```bash
export GROQ_API_KEY="your-groq-key"
```
If unset, falls back to the built-in z-ai LLM.

## Deployment

### Frontend (Vercel)
The `vercel.json` is preconfigured. Connect the repo to Vercel and deploy — it builds the frontend automatically.

### Backend
Deploy the FastAPI backend to Render, Railway, or any Python host. Set `GROQ_API_KEY` as an env var. Point the frontend's API URL via `VITE_API_URL` env var in Vercel.

## License
MIT
