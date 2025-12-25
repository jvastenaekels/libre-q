import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import submissions, logs
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.errors import global_exception_handler
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.limiter import limiter

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Open-Q API")

# Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, global_exception_handler)

# Security Headers (Pure ASGI)
app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration
origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173,http://0.0.0.0:5173")
origins = [o.strip() for o in origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(submissions.router, prefix="/api", tags=["submissions"])
app.include_router(logs.router, prefix="/api", tags=["logs"])

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve Frontend in Production
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Correct path relative to where uvicorn is run (backend dir)
# We assume uvicorn is run from 'backend/' so we go up one level to 'frontend/dist'
# OR if we use absolute paths based on __file__
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # backend/
ROOT_DIR = os.path.dirname(BASE_DIR) # root/
FRONTEND_DIST = os.path.join(ROOT_DIR, "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    # Mount assets (JS/CSS)
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
    
    # Catch-all for SPA
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Check if a specific file is requested (e.g., favicon.ico, manifest.json)
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
             return FileResponse(file_path)
        # Otherwise serve index.html
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def read_root():
        return {"Hello": "Frontend build not found. API is running."}
