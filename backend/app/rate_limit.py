"""Slowapi rate-limiter singleton.

A single ``Limiter`` instance shared across the app. Routers import ``limiter``
and decorate endpoints with ``@limiter.limit("60/minute")`` — the route handler
must accept ``request: fastapi.Request`` as a parameter so slowapi can read
the client IP.

Wired into the FastAPI app in ``app/main.py`` (``app.state.limiter = limiter``
plus the ``RateLimitExceeded`` exception handler).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# One limiter per process. ``key_func`` decides how a "client" is identified —
# we use the remote IP, which is the standard choice and works behind most
# proxies once ``X-Forwarded-For`` is trusted (uvicorn sets it by default).
limiter = Limiter(key_func=get_remote_address)
