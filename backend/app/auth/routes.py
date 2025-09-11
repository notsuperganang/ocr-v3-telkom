"""
Authentication routes - login and logout
"""

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from typing import Optional

from app.auth.utils import authenticate_user, create_auth_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

class UserInfo(BaseModel):
    username: str
    authenticated: bool

@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest):
    """
    Authenticate user and return JWT token
    """
    # Validate credentials
    if not authenticate_user(credentials.username, credentials.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = create_auth_token(credentials.username)
    
    return LoginResponse(
        access_token=access_token,
        username=credentials.username
    )

@router.post("/logout")
def logout():
    """
    Logout endpoint (client-side token removal)
    In a more complex system, you might maintain a token blacklist
    """
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserInfo)
def get_current_user_info(current_user: str = Depends(get_current_user)):
    """
    Get current authenticated user information
    """
    return UserInfo(
        username=current_user,
        authenticated=True
    )

@router.get("/health")
def auth_health():
    """
    Authentication service health check (unprotected)
    """
    return {"status": "ok", "service": "auth"}