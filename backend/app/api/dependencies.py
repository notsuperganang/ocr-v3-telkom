"""
API dependencies for Telkom Contract Extractor
Common dependencies used across API routes
"""

from typing import Generator
from sqlalchemy.orm import Session
from fastapi import Depends
from app.database import get_db
from app.auth.dependencies import get_current_user, require_manager
from app.models.database import User

def get_authenticated_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current authenticated user (returns User object, not string)"""
    return current_user

def get_db_and_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user)
) -> tuple[Session, User]:
    """Combined dependency for database session and authenticated user"""
    return db, current_user

def get_db_and_manager(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager)
) -> tuple[Session, User]:
    """
    Combined dependency for database session and MANAGER user.
    Use this for admin-only endpoints. Raises 403 if user is not MANAGER.
    """
    return db, current_user