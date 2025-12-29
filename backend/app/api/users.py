"""
User Management API endpoints
Handles user CRUD operations with role-based access control
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, EmailStr, validator
from typing import List, Optional
from datetime import datetime

from app.api.dependencies import get_db_and_user, get_db_and_manager
from app.models.database import User, UserRole
from app.auth.utils import get_password_hash

router = APIRouter(prefix="/api/users", tags=["users"])

# Request/Response models
class CreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: str = "STAFF"  # Default to STAFF

    @validator('role')
    def validate_role(cls, v):
        if v not in ["STAFF", "MANAGER"]:
            raise ValueError('Role must be either STAFF or MANAGER')
        return v

    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        return v

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v

class UpdateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None

    @validator('role')
    def validate_role(cls, v):
        if v is not None and v not in ["STAFF", "MANAGER"]:
            raise ValueError('Role must be either STAFF or MANAGER')
        return v

class ChangePasswordRequest(BaseModel):
    new_password: str

    @validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True

class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    per_page: int
    total_pages: int

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: CreateUserRequest,
    db_and_user: tuple[Session, User] = Depends(get_db_and_manager)
):
    """
    Create a new user (MANAGER only).

    Creates a new user account with the specified role.
    Password is automatically hashed before storage.
    """
    db, current_user = db_and_user

    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists"
        )

    # Create new user
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=UserRole.STAFF if user_data.role == "STAFF" else UserRole.MANAGER,
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role.value,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        updated_at=new_user.updated_at,
        last_login_at=new_user.last_login_at
    )

@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search in username, email, or full name"),
    role_filter: Optional[str] = Query(None, description="Filter by role: STAFF or MANAGER"),
    active_only: bool = Query(True, description="Show only active users"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    List all users (both STAFF and MANAGER can view, read-only for STAFF).

    Supports pagination, search, and filtering by role and active status.
    """
    db, current_user = db_and_user

    # Build base query
    query = db.query(User)

    # Apply active filter
    if active_only:
        query = query.filter(User.is_active == True)

    # Apply role filter
    if role_filter:
        if role_filter not in ["STAFF", "MANAGER"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role filter. Must be STAFF or MANAGER"
            )
        role_enum = UserRole.STAFF if role_filter == "STAFF" else UserRole.MANAGER
        query = query.filter(User.role == role_enum)

    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_term)) |
            (User.email.ilike(search_term)) |
            (User.full_name.ilike(search_term))
        )

    # Get total count
    total = query.count()

    # Apply pagination and ordering
    users = (
        query
        .order_by(desc(User.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Build response
    user_responses = [
        UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login_at
        )
        for user in users
    ]

    total_pages = (total + per_page - 1) // per_page

    return UserListResponse(
        users=user_responses,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Get user details by ID (both STAFF and MANAGER can view).
    """
    db, current_user = db_and_user

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at
    )

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    update_data: UpdateUserRequest,
    db_and_user: tuple[Session, User] = Depends(get_db_and_manager)
):
    """
    Update user information (MANAGER only).

    Can update email, full_name, and role.
    Password changes use separate endpoint.
    """
    db, current_user = db_and_user

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields if provided
    if update_data.email is not None:
        # Check if email already exists for another user
        existing_email = db.query(User).filter(
            User.email == update_data.email,
            User.id != user_id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
        user.email = update_data.email

    if update_data.full_name is not None:
        user.full_name = update_data.full_name

    if update_data.role is not None:
        user.role = UserRole.STAFF if update_data.role == "STAFF" else UserRole.MANAGER

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at
    )

@router.post("/{user_id}/change-password", status_code=status.HTTP_200_OK)
async def change_user_password(
    user_id: int,
    password_data: ChangePasswordRequest,
    db_and_user: tuple[Session, User] = Depends(get_db_and_manager)
):
    """
    Change user password (MANAGER only).

    Allows MANAGER to reset any user's password.
    """
    db, current_user = db_and_user

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update password
    user.password_hash = get_password_hash(password_data.new_password)
    db.commit()

    return {
        "message": f"Password changed successfully for user {user.username}",
        "user_id": user_id
    }

@router.post("/{user_id}/deactivate", status_code=status.HTTP_200_OK)
async def deactivate_user(
    user_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_manager)
):
    """
    Deactivate a user account (MANAGER only).

    Prevents the user from logging in.
    MANAGER cannot deactivate their own account.
    """
    db, current_user = db_and_user

    # Prevent self-deactivation
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already deactivated"
        )

    user.is_active = False
    db.commit()

    return {
        "message": f"User {user.username} deactivated successfully",
        "user_id": user_id,
        "deactivated_by": current_user.username
    }

@router.post("/{user_id}/activate", status_code=status.HTTP_200_OK)
async def activate_user(
    user_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_manager)
):
    """
    Reactivate a deactivated user account (MANAGER only).

    Allows the user to log in again.
    """
    db, current_user = db_and_user

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already active"
        )

    user.is_active = True
    db.commit()

    return {
        "message": f"User {user.username} activated successfully",
        "user_id": user_id,
        "activated_by": current_user.username
    }
