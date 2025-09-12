"""
API dependencies for Telkom Contract Extractor
Common dependencies used across API routes
"""

from typing import Generator
from sqlalchemy.orm import Session
from fastapi import Depends
from app.database import get_db
from app.auth.dependencies import get_current_user

def get_authenticated_user(current_user: str = Depends(get_current_user)) -> str:
    """Get current authenticated user"""
    return current_user

def get_db_and_user(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_authenticated_user)
) -> tuple[Session, str]:
    """Combined dependency for database session and authenticated user"""
    return db, current_user