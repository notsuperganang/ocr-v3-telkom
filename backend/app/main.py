"""
Telkom Contract Extractor - FastAPI Application
Main application with database and authentication setup
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import init_database, get_db, engine
from app.auth.routes import router as auth_router
from app.auth.dependencies import get_current_user

# Import API route modules
from app.api.upload import router as upload_router
from app.api.processing import router as processing_router
from app.api.contracts import router as contracts_router
from app.api.admin import router as admin_router
from app.api.dashboard import router as dashboard_router
from app.api.users import router as users_router
from app.api.segments import router as segments_router
from app.api.witels import router as witels_router
from app.api.account_managers import router as account_managers_router
from app.api.accounts import router as accounts_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print(f"🚀 Starting {settings.app_name} v{settings.version}")
    
    # Initialize database
    init_database()
    
    # Initialize OCR service (singleton)
    from app.services.ocr_service import get_ocr_service
    try:
        ocr_service = get_ocr_service()
        print("✅ OCR service initialized successfully")
    except Exception as e:
        print(f"⚠️ OCR service initialization warning: {str(e)}")
        print("   (This is expected if dependencies are not fully installed)")
    
    yield
    
    # Shutdown
    print("👋 Shutting down application")

def check_database_health():
    """Check database connectivity and return status"""
    try:
        with engine.connect() as conn:
            # Test basic connection
            conn.execute(text("SELECT 1"))
            
            # Test if our tables exist
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('files', 'processing_jobs', 'contracts')
            """))
            tables = [row[0] for row in result.fetchall()]
            
            if len(tables) >= 3:
                return {"status": "healthy", "tables": tables}
            else:
                return {"status": "degraded", "message": "Some tables missing", "tables": tables}
                
    except SQLAlchemyError as e:
        return {"status": "unhealthy", "error": str(e)}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="AI-powered document processing with human validation workflow",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication routes
app.include_router(auth_router)

# Include API routes
app.include_router(upload_router)
app.include_router(processing_router)
app.include_router(contracts_router)
app.include_router(admin_router)
app.include_router(dashboard_router)
app.include_router(users_router)

# Reference data routes (backbone)
app.include_router(segments_router)
app.include_router(witels_router)
app.include_router(account_managers_router)
app.include_router(accounts_router)

# Health check endpoint (unprotected)
@app.get("/")
async def root():
    """Root endpoint - basic health check"""
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.version,
        "status": "ok"
    }

@app.get("/health")
async def health_check():
    """Detailed health check with database status"""
    db_health = check_database_health()
    
    return {
        "status": "healthy" if db_health["status"] == "healthy" else "degraded",
        "app_name": settings.app_name,
        "version": settings.version,
        "database": db_health,
        "authentication": "configured",
        "ocr_service": "available"
    }

# Protected endpoint example
@app.get("/api/protected")
async def protected_example(current_user: str = Depends(get_current_user)):
    """Example protected endpoint"""
    return {
        "message": f"Hello {current_user}! This is a protected endpoint.",
        "user": current_user
    }

# All API routes are now included above

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info"
    )