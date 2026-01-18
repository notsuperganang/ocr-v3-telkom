"""
Witels CRUD API endpoints
Reference data for regional office (Witel) classification
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.api.dependencies import get_db_and_user
from app.models.database import Witel, User

router = APIRouter(prefix="/api/witels", tags=["witels"])


# === Pydantic Schemas ===

class WitelCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20, description="Witel code (must be unique, e.g., '901')")
    name: str = Field(..., min_length=1, max_length=100, description="Witel name (e.g., 'Aceh')")


class WitelUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=1, max_length=100)


class WitelResponse(BaseModel):
    id: int
    code: str
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WitelListResponse(BaseModel):
    witels: List[WitelResponse]
    total: int


# === API Endpoints ===

@router.get("", response_model=WitelListResponse)
async def list_witels(
    active_only: bool = Query(True, description="Show only active witels"),
    search: Optional[str] = Query(None, description="Search in code or name"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    List all witels.
    Both STAFF and MANAGER can view.
    """
    db, _ = db_and_user

    query = db.query(Witel)

    if active_only:
        query = query.filter(Witel.is_active == True)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Witel.code.ilike(search_term)) |
            (Witel.name.ilike(search_term))
        )

    witels = query.order_by(Witel.code).all()

    return WitelListResponse(
        witels=[WitelResponse.model_validate(w) for w in witels],
        total=len(witels)
    )


@router.get("/{witel_id}", response_model=WitelResponse)
async def get_witel(
    witel_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Get witel by ID."""
    db, _ = db_and_user

    witel = db.query(Witel).filter(Witel.id == witel_id).first()
    if not witel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Witel not found"
        )

    return WitelResponse.model_validate(witel)


@router.post("", response_model=WitelResponse, status_code=status.HTTP_201_CREATED)
async def create_witel(
    data: WitelCreate,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Create a new witel.
    Both STAFF and MANAGER can create.
    """
    db, _ = db_and_user

    # Check if code already exists
    existing = db.query(Witel).filter(Witel.code == data.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Witel code already exists"
        )

    witel = Witel(
        code=data.code,
        name=data.name,
        is_active=True
    )

    db.add(witel)
    db.commit()
    db.refresh(witel)

    return WitelResponse.model_validate(witel)


@router.patch("/{witel_id}", response_model=WitelResponse)
async def update_witel(
    witel_id: int,
    data: WitelUpdate,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Update a witel.
    Both STAFF and MANAGER can update.
    """
    db, _ = db_and_user

    witel = db.query(Witel).filter(Witel.id == witel_id).first()
    if not witel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Witel not found"
        )

    # Check for code uniqueness if updating code
    if data.code is not None and data.code != witel.code:
        existing = db.query(Witel).filter(
            Witel.code == data.code,
            Witel.id != witel_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Witel code already exists"
            )
        witel.code = data.code

    if data.name is not None:
        witel.name = data.name

    db.commit()
    db.refresh(witel)

    return WitelResponse.model_validate(witel)


@router.post("/{witel_id}/deactivate", response_model=WitelResponse)
async def deactivate_witel(
    witel_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Soft-delete a witel by setting is_active=False."""
    db, _ = db_and_user

    witel = db.query(Witel).filter(Witel.id == witel_id).first()
    if not witel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Witel not found"
        )

    if not witel.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Witel is already deactivated"
        )

    witel.is_active = False
    db.commit()
    db.refresh(witel)

    return WitelResponse.model_validate(witel)


@router.post("/{witel_id}/activate", response_model=WitelResponse)
async def activate_witel(
    witel_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Reactivate a deactivated witel."""
    db, _ = db_and_user

    witel = db.query(Witel).filter(Witel.id == witel_id).first()
    if not witel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Witel not found"
        )

    if witel.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Witel is already active"
        )

    witel.is_active = True
    db.commit()
    db.refresh(witel)

    return WitelResponse.model_validate(witel)
