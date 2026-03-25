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

# CORS Configuration — use ALLOWED_ORIGINS env var in production
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Simple IP-based Rate Limiting
# ============================================================================
RATE_LIMIT_REQUESTS = 5   # max requests
RATE_LIMIT_WINDOW = 60    # per 60 seconds
_rate_limit_store: dict = defaultdict(list)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Rate limit /api/compare/start to prevent abuse."""
    if request.url.path == "/api/compare/start" and request.method == "POST":
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        # Clean old entries
        _rate_limit_store[client_ip] = [
            t for t in _rate_limit_store[client_ip] if now - t < RATE_LIMIT_WINDOW
        ]
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
# Legacy support: include router at root for compatibility with existing frontend 
# until frontend is fully updated to /api
app.include_router(api_router, tags=["legacy"])

# Serve frontend static files
# Check if frontend/dist exists (production build)
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    
    # Catch-all route for SPA - must be last!
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all non-API routes."""
        # APIs are handled above, so this catches everything else
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Return index.html for SPA routing
        return FileResponse(FRONTEND_DIR / "index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
