"""Unified AI service for SchoolAI backend.

Strategy (in order):
1. **Groq** — if `GROQ_API_KEY` env var is set, call the Groq OpenAI-compatible
   chat-completions endpoint with `llama-3.3-70b-versatile` (falls back to
   `llama-3.1-8b-instant` if the model is unavailable).
2. **z-ai CLI** — invoke `/usr/local/bin/z-ai chat -p <prompt> -s <system>`
   via `asyncio.create_subprocess_exec`, parse the JSON it returns, and
   extract `choices[0].message.content`. This is the default in dev / when
   no Groq key is configured.
3. **Canned fallback** — build a minimal data-driven markdown response from
   `data_context` so the principal/chairperson still gets *something* useful.

Every call returns ``{"answer": str, "source": "groq"|"z-ai"|"fallback"}``.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Optional

import httpx

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_PRIMARY_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_FALLBACK_MODEL = "llama-3.1-8b-instant"
GROQ_TIMEOUT = 60.0  # seconds

Z_AI_BIN = os.environ.get("Z_AI_BIN", "/usr/local/bin/z-ai")
Z_AI_TIMEOUT = 60.0  # seconds


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────
async def ask_ai(
    question: str,
    system_prompt: str,
    data_context: str | dict | None = None,
) -> dict:
    """Ask the LLM a question, returning ``{"answer": str, "source": str}``.

    Tries Groq → z-ai CLI → canned fallback, in that order.
    """
    # Normalise data_context to a string
    if data_context is None:
        ctx_str = ""
    elif isinstance(data_context, (dict, list)):
        ctx_str = json.dumps(data_context, indent=2, default=str, ensure_ascii=False)
    else:
        ctx_str = str(data_context)

    user_content = question
    if ctx_str:
        user_content = f"{question}\n\n--- DATA CONTEXT ---\n{ctx_str}"

    # 1) Groq
    if GROQ_API_KEY:
        answer = await _call_groq(system_prompt, user_content)
        if answer:
            return {"answer": answer, "source": "groq"}

    # 2) z-ai CLI
    answer = await _call_z_ai(system_prompt, user_content)
    if answer:
        return {"answer": answer, "source": "z-ai"}

    # 3) Canned fallback — derived from the data context so it's still useful
    return {
        "answer": _canned_fallback(question, data_context),
        "source": "fallback",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Backend: Groq
# ─────────────────────────────────────────────────────────────────────────────
async def _call_groq(system_prompt: str, user_content: str) -> Optional[str]:
    """Call Groq's OpenAI-compatible chat completions API.

    Tries the primary model first, then a cheaper fallback model on any error.
    Returns the assistant message content or ``None`` on failure.
    """
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.7,
        "max_tokens": 1500,
    }
    async with httpx.AsyncClient(timeout=GROQ_TIMEOUT) as client:
        for model in (GROQ_PRIMARY_MODEL, GROQ_FALLBACK_MODEL):
            try:
                resp = await client.post(
                    GROQ_URL,
                    headers=headers,
                    json={**body, "model": model},
                )
                if resp.status_code != 200:
                    # Try the fallback model next
                    continue
                payload = resp.json()
                choices = payload.get("choices") or []
                if not choices:
                    continue
                content = choices[0].get("message", {}).get("content")
                if content and content.strip():
                    return content.strip()
            except Exception:
                continue
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Backend: z-ai CLI
# ─────────────────────────────────────────────────────────────────────────────
async def _call_z_ai(system_prompt: str, user_content: str) -> Optional[str]:
    """Invoke the z-ai CLI and return the assistant message content (or None)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            Z_AI_BIN, "chat",
            "-p", user_content,
            "-s", system_prompt,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _stderr = await asyncio.wait_for(
            proc.communicate(), timeout=Z_AI_TIMEOUT
        )
        if proc.returncode != 0:
            return None
        text = stdout.decode("utf-8", errors="replace").strip()
        # The CLI prints a banner + the JSON. Find the first `{` and parse from there.
        idx = text.find("{")
        if idx < 0:
            return None
        payload = json.loads(text[idx:])
        choices = payload.get("choices") or []
        if not choices:
            return None
        content = choices[0].get("message", {}).get("content")
        if content and content.strip():
            return content.strip()
        return None
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Canned fallback (last resort)
# ─────────────────────────────────────────────────────────────────────────────
def _canned_fallback(question: str, data_context) -> str:
    """Build a minimal markdown answer from the data_context dict (if any).

    The result is *not* pretty — it's the "AI is down" baseline so the user
    still walks away with real numbers.
    """
    lines = [
        "## ⚠️ AI service unavailable — showing data-driven snapshot",
        "",
        f"**Question:** {question}",
        "",
    ]
    if isinstance(data_context, dict):
        # School name?
        if "school_name" in data_context:
            lines.append(f"**School:** {data_context['school_name']}")
        if "totals" in data_context and isinstance(data_context["totals"], dict):
            t = data_context["totals"]
            lines.append(
                f"**Totals:** {t.get('students', '?')} students · "
                f"{t.get('classes', '?')} classes · {t.get('exams', '?')} exams"
            )
        if "school_average_pct" in data_context:
            lines.append(f"**School average:** {data_context['school_average_pct']}%")
        if "top_performer" in data_context and data_context["top_performer"]:
            tp = data_context["top_performer"]
            lines.append(
                f"**Top performer:** {tp.get('name', '?')} ({tp.get('average', '?')}%)"
            )
        # schools (chairperson case)
        if "schools" in data_context and isinstance(data_context["schools"], list):
            lines.append("")
            lines.append("### Schools")
            for s in data_context["schools"]:
                lines.append(
                    f"- **{s.get('name', '?')}** — avg {s.get('average_pct', '?')}%, "
                    f"{s.get('students', '?')} students"
                )
        if "grade_breakdown" in data_context and data_context["grade_breakdown"]:
            lines.append("")
            lines.append("### Grade breakdown")
            for g in data_context["grade_breakdown"]:
                lines.append(
                    f"- Grade {g.get('grade', '?')}: avg {g.get('average_pct', '?')}% "
                    f"· attendance {g.get('attendance_pct', '?')}%"
                )
        if "subject_breakdown" in data_context and data_context["subject_breakdown"]:
            lines.append("")
            lines.append("### Subject breakdown")
            for s in data_context["subject_breakdown"]:
                lines.append(
                    f"- {s.get('subject', '?')}: avg {s.get('average_pct', '?')}% "
                    f"· pass rate {s.get('pass_rate', '?')}%"
                )
    elif data_context:
        lines.append("")
        lines.append("```")
        lines.append(str(data_context)[:2000])
        lines.append("```")
    lines.append("")
    lines.append("_This answer was generated from real school data because the AI service is currently unavailable._")
    return "\n".join(lines)
