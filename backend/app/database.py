"""
Database connection and session management
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from typing import Generator

from app.config import settings
from app.models.database import Base

# Create SQLAlchemy engine
engine = create_engine(
    settings.database_url,
    # PostgreSQL specific settings
    echo=False,  # Set to True for SQL query logging in development
    future=True,
    pool_pre_ping=True,  # Verify connections before use
)

# Create SessionLocal class
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)

def create_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)

def get_db() -> Generator[Session, None, None]:
    """
    Database session dependency for FastAPI
    
    Usage:
        @app.get("/api/example")
        def example_endpoint(db: Session = Depends(get_db)):
            # Use db session here
            pass
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """
    Initialize database - create tables if they don't exist
    Called during application startup
    """
    try:
        # Test database connection
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        # Create tables
        create_tables()
        
        print(f"✅ Database initialized successfully")
        print(f"📊 Connected to: {settings.database_url}")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {str(e)}")
        raise