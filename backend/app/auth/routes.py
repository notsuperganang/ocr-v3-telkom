"""
Authentication routes - login and logout
"""

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.orm import Session

from app.auth.utils import authenticate_user, create_auth_token, verify_password, get_password_hash
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

class UpdateProfileRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None

class UpdateProfileResponse(BaseModel):
    message: str
    user: UserInfo

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ChangePasswordResponse(BaseModel):
    message: str

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

@router.patch("/update-profile", response_model=UpdateProfileResponse)
def update_own_profile(
    profile_data: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Self-service profile update for authenticated users.
    Users can update their own email and full_name (username cannot be changed).
    """
    # Check if at least one field is provided
    if profile_data.email is None and profile_data.full_name is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field (email or full_name) must be provided"
        )

    # Update email if provided
    if profile_data.email is not None:
        # Check if email already exists for another user
        existing_email = db.query(User).filter(
            User.email == profile_data.email,
            User.id != current_user.id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        current_user.email = profile_data.email

    # Update full_name if provided
    if profile_data.full_name is not None:
        current_user.full_name = profile_data.full_name if profile_data.full_name.strip() else None

    db.commit()
    db.refresh(current_user)

    return UpdateProfileResponse(
        message="Profile updated successfully",
        user=UserInfo(
            user_id=current_user.id,
            username=current_user.username,
            email=current_user.email,
            full_name=current_user.full_name,
            role=current_user.role.value,
            is_active=current_user.is_active,
            authenticated=True
        )
    )

@router.post("/change-password", response_model=ChangePasswordResponse)
def change_own_password(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Self-service password change for authenticated users.
    Requires current password verification for security.
    """
    # Verify current password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    # Validate new password (minimum 8 characters)
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long"
        )

    # Update password
    current_user.password_hash = get_password_hash(password_data.new_password)
    db.commit()

    return ChangePasswordResponse(message="Password changed successfully")

@router.get("/health")
def auth_health():
    """
    Authentication service health check (unprotected)
    """
    return {"status": "ok", "service": "auth"}