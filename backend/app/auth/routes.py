"""
Authentication routes - login and logout
"""

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.auth.utils import authenticate_user, create_auth_token
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.database import User

router = APIRouter(prefix="/auth", tags=["authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str  # "STAFF" or "MANAGER"
    user_id: int

class UserInfo(BaseModel):
    user_id: int
    username: str
    email: str
    full_name: Optional[str]
    role: str  # "STAFF" or "MANAGER"
    is_active: bool
    authenticated: bool

@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token with role and user_id
    """
    # Validate credentials against database
    user = authenticate_user(db, credentials.username, credentials.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token with user_id, username, and role
    access_token = create_auth_token(user)

    return LoginResponse(
        access_token=access_token,
        username=user.username,
        role=user.role.value,
        user_id=user.id
    )

@router.post("/logout")
def logout():
    """
    Logout endpoint (client-side token removal)
    In a more complex system, you might maintain a token blacklist
    """
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserInfo)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information from database
    """
    return UserInfo(
        user_id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        is_active=current_user.is_active,
        authenticated=True
    )

@router.get("/health")
def auth_health():
    """
    Authentication service health check (unprotected)
    """
    return {"status": "ok", "service": "auth"}