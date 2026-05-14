from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .database import init_db
from .models import ticket as ticket_models  # ensure tables are registered
from .models import user as user_models  # ensure users table is registered
from .models import system as system_models  # ensure system tables are registered
from .api import tickets, sources, templates, auth as auth_router, admin as admin_router
import uvicorn
import os

limiter = Limiter(key_func=get_remote_address, default_limits=[])

app = FastAPI(
    title="Bet Analysis API",
    description="API for betting data analysis",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()

app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(tickets.router, prefix="/api/tickets", tags=["tickets"])
app.include_router(sources.router, prefix="/api/sources", tags=["sources"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(admin_router.router, prefix="/api/admin", tags=["admin"])

@app.get("/")
async def root():
    return {"message": "Bet Analysis API is running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# Serve static frontend files if they exist (production build)
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    # Serve static assets
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    # Catch-all for SPA routes - serve index.html
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Skip API routes
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"detail": "Frontend not built"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
