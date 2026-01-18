"""
Segments CRUD API endpoints
Reference data for client classification (Regional 1-7, Enterprise, Government, SME)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.api.dependencies import get_db_and_user
from app.models.database import Segment, User

router = APIRouter(prefix="/api/segments", tags=["segments"])


# === Pydantic Schemas ===

class SegmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Segment name (must be unique)")
    code: Optional[str] = Field(None, max_length=50, description="Optional segment code")


class SegmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=50)


class SegmentResponse(BaseModel):
    id: int
    name: str
    code: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SegmentListResponse(BaseModel):
    segments: List[SegmentResponse]
    total: int


# === API Endpoints ===

@router.get("", response_model=SegmentListResponse)
async def list_segments(
    active_only: bool = Query(True, description="Show only active segments"),
    search: Optional[str] = Query(None, description="Search in name or code"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    List all segments.
    Both STAFF and MANAGER can view.
    """
    db, _ = db_and_user

    query = db.query(Segment)

    if active_only:
        query = query.filter(Segment.is_active == True)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Segment.name.ilike(search_term)) |
            (Segment.code.ilike(search_term))
        )

    segments = query.order_by(Segment.name).all()

    return SegmentListResponse(
        segments=[SegmentResponse.model_validate(s) for s in segments],
        total=len(segments)
    )


@router.get("/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    segment_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Get segment by ID."""
    db, _ = db_and_user

    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segment not found"
        )

    return SegmentResponse.model_validate(segment)


@router.post("", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
async def create_segment(
    data: SegmentCreate,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Create a new segment.
    Both STAFF and MANAGER can create.
    """
    db, _ = db_and_user

    # Check if name already exists
    existing = db.query(Segment).filter(Segment.name == data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Segment name already exists"
        )

    segment = Segment(
        name=data.name,
        code=data.code,
        is_active=True
    )

    db.add(segment)
    db.commit()
    db.refresh(segment)

    return SegmentResponse.model_validate(segment)


@router.patch("/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    segment_id: int,
    data: SegmentUpdate,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Update a segment.
    Both STAFF and MANAGER can update.
    """
    db, _ = db_and_user

    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segment not found"
        )

    # Check for name uniqueness if updating name
    if data.name is not None and data.name != segment.name:
        existing = db.query(Segment).filter(
            Segment.name == data.name,
            Segment.id != segment_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Segment name already exists"
            )
        segment.name = data.name

    if data.code is not None:
        segment.code = data.code

    db.commit()
    db.refresh(segment)

    return SegmentResponse.model_validate(segment)


@router.post("/{segment_id}/deactivate", response_model=SegmentResponse)
async def deactivate_segment(
    segment_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Soft-delete a segment by setting is_active=False."""
    db, _ = db_and_user

    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segment not found"
        )

    if not segment.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Segment is already deactivated"
        )

    segment.is_active = False
    db.commit()
    db.refresh(segment)

    return SegmentResponse.model_validate(segment)


@router.post("/{segment_id}/activate", response_model=SegmentResponse)
async def activate_segment(
    segment_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Reactivate a deactivated segment."""
    db, _ = db_and_user

    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segment not found"
        )

    if segment.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Segment is already active"
        )

    segment.is_active = True
    db.commit()
    db.refresh(segment)

    return SegmentResponse.model_validate(segment)
