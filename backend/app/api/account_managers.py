"""
Account Managers CRUD API endpoints
Telkom Account Managers (AM) for client relationships
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

from app.api.dependencies import get_db_and_user
from app.models.database import AccountManager, User

router = APIRouter(prefix="/api/account-managers", tags=["account-managers"])


# === Pydantic Schemas ===

class AccountManagerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Account Manager name")
    title: Optional[str] = Field(None, max_length=255, description="Position/title (e.g., 'Manager')")
    email: Optional[str] = Field(None, max_length=255, description="Email address")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")


class AccountManagerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    title: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)


class AccountManagerResponse(BaseModel):
    id: int
    name: str
    title: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AccountManagerListResponse(BaseModel):
    account_managers: List[AccountManagerResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


# === API Endpoints ===

@router.get("", response_model=AccountManagerListResponse)
async def list_account_managers(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    active_only: bool = Query(True, description="Show only active account managers"),
    search: Optional[str] = Query(None, description="Search in name, title, or email"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    List all account managers with pagination.
    Both STAFF and MANAGER can view.
    """
    db, _ = db_and_user

    query = db.query(AccountManager)

    if active_only:
        query = query.filter(AccountManager.is_active == True)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (AccountManager.name.ilike(search_term)) |
            (AccountManager.title.ilike(search_term)) |
            (AccountManager.email.ilike(search_term))
        )

    total = query.count()

    account_managers = (
        query
        .order_by(AccountManager.name)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    total_pages = (total + per_page - 1) // per_page

    return AccountManagerListResponse(
        account_managers=[AccountManagerResponse.model_validate(am) for am in account_managers],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get("/{am_id}", response_model=AccountManagerResponse)
async def get_account_manager(
    am_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Get account manager by ID."""
    db, _ = db_and_user

    am = db.query(AccountManager).filter(AccountManager.id == am_id).first()
    if not am:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account Manager not found"
        )

    return AccountManagerResponse.model_validate(am)


@router.post("", response_model=AccountManagerResponse, status_code=status.HTTP_201_CREATED)
async def create_account_manager(
    data: AccountManagerCreate,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Create a new account manager.
    Both STAFF and MANAGER can create.
    """
    db, _ = db_and_user

    am = AccountManager(
        name=data.name,
        title=data.title,
        email=data.email,
        phone=data.phone,
        is_active=True
    )

    db.add(am)
    db.commit()
    db.refresh(am)

    return AccountManagerResponse.model_validate(am)


@router.patch("/{am_id}", response_model=AccountManagerResponse)
async def update_account_manager(
    am_id: int,
    data: AccountManagerUpdate,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Update an account manager.
    Both STAFF and MANAGER can update.
    """
    db, _ = db_and_user

    am = db.query(AccountManager).filter(AccountManager.id == am_id).first()
    if not am:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account Manager not found"
        )

    if data.name is not None:
        am.name = data.name
    if data.title is not None:
        am.title = data.title
    if data.email is not None:
        am.email = data.email
    if data.phone is not None:
        am.phone = data.phone

    db.commit()
    db.refresh(am)

    return AccountManagerResponse.model_validate(am)


@router.post("/{am_id}/deactivate", response_model=AccountManagerResponse)
async def deactivate_account_manager(
    am_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Soft-delete an account manager by setting is_active=False."""
    db, _ = db_and_user

    am = db.query(AccountManager).filter(AccountManager.id == am_id).first()
    if not am:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account Manager not found"
        )

    if not am.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account Manager is already deactivated"
        )

    am.is_active = False
    db.commit()
    db.refresh(am)

    return AccountManagerResponse.model_validate(am)


@router.post("/{am_id}/activate", response_model=AccountManagerResponse)
async def activate_account_manager(
    am_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Reactivate a deactivated account manager."""
    db, _ = db_and_user

    am = db.query(AccountManager).filter(AccountManager.id == am_id).first()
    if not am:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account Manager not found"
        )

    if am.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account Manager is already active"
        )

    am.is_active = True
    db.commit()
    db.refresh(am)

    return AccountManagerResponse.model_validate(am)
