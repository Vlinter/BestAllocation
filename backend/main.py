"""
Full-Stack Quant Portfolio Optimization API
============================================
Entry point for the application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi import Request
from pathlib import Path
from typing import Optional
import os
import uvicorn
import time
from collections import defaultdict

# Import API routes
from backend.app.api.routes import router as api_router

app = FastAPI(
    title="Quant Portfolio Optimizer",
    description="Institutional-grade Walk-Forward Analysis API",
    version="2.4.0"
)

# CORS Configuration — set ALLOWED_ORIGINS to your exact domain(s) in production.
# allow_credentials stays False: the API is stateless (no cookies/auth), and
# wildcard origins combined with credentials is forbidden by the CORS spec.
allowed_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Simple IP-based Rate Limiting
# ============================================================================
RATE_LIMIT_REQUESTS = 5   # max requests
RATE_LIMIT_WINDOW = 60    # per 60 seconds
RATE_LIMIT_MAX_IPS = 1000 # max tracked IPs to prevent memory leak
_rate_limit_store: dict = defaultdict(list)

# X-Forwarded-For is only trustworthy when a reverse proxy we control rewrites
# it. Reachable directly, any client can send an arbitrary value and get a fresh
# rate-limit bucket per request — which makes the limiter (the only thing between
# a stranger and the Tiingo quota + 3 CPU-bound threads per job) purely
# decorative. Opt in with TRUST_PROXY=1 on the platform that terminates TLS.
TRUST_PROXY = os.environ.get("TRUST_PROXY", "").strip().lower() in ("1", "true", "yes")

def _client_ip(request: Request) -> str:
    """
    Resolve the real client IP. Behind a reverse proxy (Render, nginx...) the
    socket peer is the proxy, so every user would share one rate-limit bucket:
    X-Forwarded-For's first entry is then the original client. Only honoured
    when TRUST_PROXY is set — see the note above.
    """
    if TRUST_PROXY:
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            first = xff.split(",")[0].strip()
            if first:
                return first
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Rate limit /api/compare/start to prevent abuse."""
    if request.url.path == "/api/compare/start" and request.method == "POST":
        client_ip = _client_ip(request)
        now = time.time()
        # Clean old entries for this IP
        _rate_limit_store[client_ip] = [
            t for t in _rate_limit_store[client_ip] if now - t < RATE_LIMIT_WINDOW
        ]
        # Evict stale IPs globally to prevent unbounded growth
        if len(_rate_limit_store) > RATE_LIMIT_MAX_IPS:
            stale_ips = [
                ip for ip, timestamps in _rate_limit_store.items()
                if not timestamps or now - max(timestamps) > RATE_LIMIT_WINDOW
            ]
            for ip in stale_ips:
                del _rate_limit_store[ip]
        if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded. Max {RATE_LIMIT_REQUESTS} requests per {RATE_LIMIT_WINDOW}s."}
            )
        _rate_limit_store[client_ip].append(now)
    return await call_next(request)

# Include API Router
# Prefix /api so we have clear valid namespace
app.include_router(api_router, prefix="/api", tags=["api"])

# Serve frontend static files
# Check if frontend/dist exists (production build)
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"


def resolve_spa_file(root: Path, full_path: str) -> Optional[Path]:
    """
    Map a request path to a file inside `root`, or None if it escapes.

    `full_path` comes straight from the URL and neither uvicorn nor Starlette
    normalises '..' segments (uvicorn even percent-decodes them first), so
    `root / full_path` can resolve anywhere on the filesystem: before this
    check, `GET /../../backend/.env` returned the Tiingo API key, and in the
    container — which used to run as root — the whole tree was readable.

    Resolving first and then asserting containment is the only reliable order:
    a prefix test on the raw string misses symlinks and encoded separators.
    """
    try:
        candidate = (root / full_path).resolve()
    except (OSError, ValueError):
        # Embedded NUL, path longer than the OS allows, unmappable characters...
        return None
    if not candidate.is_relative_to(root):
        return None
    try:
        return candidate if candidate.is_file() else None
    except OSError:
        return None


if FRONTEND_DIR.exists():
    FRONTEND_ROOT = FRONTEND_DIR.resolve()

    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=FRONTEND_ROOT / "assets"), name="assets")

    # Catch-all route for SPA - must be last!
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all non-API routes."""
        # APIs are handled above, so this catches everything else
        file_path = resolve_spa_file(FRONTEND_ROOT, full_path)
        if file_path is not None:
            return FileResponse(file_path)
        # Anything outside the build directory (or missing) falls back to the
        # SPA entry point — never an error that would confirm what exists.
        return FileResponse(FRONTEND_ROOT / "index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
