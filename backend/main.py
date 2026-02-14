"""
Full-Stack Quant Portfolio Optimization API
============================================
Entry point for the application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os
import uvicorn

# Import API routes
from backend.app.api.routes import router as api_router

app = FastAPI(
    title="Quant Portfolio Optimizer",
    description="Institutional-grade Walk-Forward Analysis API",
    version="2.4.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, strict this to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
