"""
Accounts CRUD API endpoints
Master client entity - manually managed via CRUD by staff
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from app.api.dependencies import get_db_and_user
from app.models.database import Account, Segment, Witel, AccountManager, User, Contract

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


# === Pydantic Schemas ===

class AccountCreate(BaseModel):
    account_number: Optional[str] = Field(None, max_length=50, description="Telkom internal account ID (unique)")
    name: str = Field(..., min_length=1, max_length=500, description="Customer name")
    nipnas: Optional[str] = Field(None, max_length=50, description="Customer identifier (NIPNAS)")
    bus_area: Optional[str] = Field(None, max_length=50, description="Business area")
    segment_id: Optional[int] = Field(None, description="Segment FK")
    witel_id: Optional[int] = Field(None, description="Witel FK")
    account_manager_id: Optional[int] = Field(None, description="Account Manager FK")
    assigned_officer_id: Optional[int] = Field(None, description="Assigned Paycol Officer FK")
    notes: Optional[str] = Field(None, description="Additional notes")


class AccountUpdate(BaseModel):
    account_number: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    nipnas: Optional[str] = Field(None, max_length=50)
    bus_area: Optional[str] = Field(None, max_length=50)
    segment_id: Optional[int] = None
    witel_id: Optional[int] = None
    account_manager_id: Optional[int] = None
    assigned_officer_id: Optional[int] = None
    notes: Optional[str] = None


# Nested response schemas for related entities
class SegmentBrief(BaseModel):
    id: int
    name: str
    code: Optional[str]

    class Config:
        from_attributes = True


class WitelBrief(BaseModel):
    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


class AccountManagerBrief(BaseModel):
    id: int
    name: str
    title: Optional[str]

    class Config:
        from_attributes = True


class UserBrief(BaseModel):
    id: int
    username: str
    full_name: Optional[str]

    class Config:
        from_attributes = True


class AccountContractBrief(BaseModel):
    """Brief contract information for account history"""
    id: int
    contract_year: int
    contract_number: Optional[str]
    customer_name: Optional[str]
    period_start: Optional[str]
    period_end: Optional[str]
    payment_method: Optional[str]
    total_contract_value: str  # Decimal converted to string for JSON
    created_at: datetime

    class Config:
        from_attributes = True


class AccountContractsResponse(BaseModel):
    """Response for account contracts listing"""
    account_id: int
    account_name: str
    contracts: List[AccountContractBrief]
    total: int
    page: int
    per_page: int


class AccountResponse(BaseModel):
    id: int
    account_number: Optional[str]
    name: str
    nipnas: Optional[str]
    bus_area: Optional[str]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Related entities (populated if loaded)
    segment: Optional[SegmentBrief] = None
    witel: Optional[WitelBrief] = None
    account_manager: Optional[AccountManagerBrief] = None
    assigned_officer: Optional[UserBrief] = None
    creator: Optional[UserBrief] = None

    # Contract count for summary
    contract_count: Optional[int] = None

    class Config:
        from_attributes = True


class AccountListResponse(BaseModel):
    accounts: List[AccountResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


# === Helper Functions ===

def build_account_response(account: Account, contract_count: int = None) -> AccountResponse:
    """Convert Account model to response with related entities."""
    return AccountResponse(
        id=account.id,
        account_number=account.account_number,
        name=account.name,
        nipnas=account.nipnas,
        bus_area=account.bus_area,
        is_active=account.is_active,
        notes=account.notes,
        created_at=account.created_at,
        updated_at=account.updated_at,
        segment=SegmentBrief.model_validate(account.segment) if account.segment else None,
        witel=WitelBrief.model_validate(account.witel) if account.witel else None,
        account_manager=AccountManagerBrief.model_validate(account.account_manager) if account.account_manager else None,
        assigned_officer=UserBrief.model_validate(account.assigned_officer) if account.assigned_officer else None,
        creator=UserBrief.model_validate(account.creator) if account.creator else None,
        contract_count=contract_count
    )


# === API Endpoints ===

@router.get("", response_model=AccountListResponse)
async def list_accounts(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    active_only: bool = Query(True, description="Show only active accounts"),
    search: Optional[str] = Query(None, description="Search in name, account_number, or nipnas"),
    segment_id: Optional[int] = Query(None, description="Filter by segment"),
    witel_id: Optional[int] = Query(None, description="Filter by witel"),
    account_manager_id: Optional[int] = Query(None, description="Filter by account manager"),
    assigned_officer_id: Optional[int] = Query(None, description="Filter by assigned officer"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    List all accounts with pagination and filtering.
    Both STAFF and MANAGER can view.
    """
    db, _ = db_and_user

    query = db.query(Account).options(
        joinedload(Account.segment),
        joinedload(Account.witel),
        joinedload(Account.account_manager),
        joinedload(Account.assigned_officer),
        joinedload(Account.creator),
        joinedload(Account.contracts)  # Load contracts for counting
    )

    if active_only:
        query = query.filter(Account.is_active == True)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Account.name.ilike(search_term)) |
            (Account.account_number.ilike(search_term)) |
            (Account.nipnas.ilike(search_term))
        )

    if segment_id is not None:
        query = query.filter(Account.segment_id == segment_id)

    if witel_id is not None:
        query = query.filter(Account.witel_id == witel_id)

    if account_manager_id is not None:
        query = query.filter(Account.account_manager_id == account_manager_id)

    if assigned_officer_id is not None:
        query = query.filter(Account.assigned_officer_id == assigned_officer_id)

    total = query.count()

    accounts = (
        query
        .order_by(desc(Account.updated_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    total_pages = (total + per_page - 1) // per_page

    return AccountListResponse(
        accounts=[
            build_account_response(acc, contract_count=len(acc.contracts) if acc.contracts else 0)
            for acc in accounts
        ],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Get account by ID with related entities and contract count."""
    db, _ = db_and_user

    account = (
        db.query(Account)
        .options(
            joinedload(Account.segment),
            joinedload(Account.witel),
            joinedload(Account.account_manager),
            joinedload(Account.assigned_officer),
            joinedload(Account.creator)
        )
        .filter(Account.id == account_id)
        .first()
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Get contract count
    contract_count = len(account.contracts) if account.contracts else 0

    return build_account_response(account, contract_count)


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Create a new account.
    Both STAFF and MANAGER can create.
    """
    db, current_user = db_and_user

    # Check if account_number already exists (if provided)
    if data.account_number:
        existing = db.query(Account).filter(Account.account_number == data.account_number).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account number already exists"
            )

    # Validate FK references
    if data.segment_id:
        segment = db.query(Segment).filter(Segment.id == data.segment_id, Segment.is_active == True).first()
        if not segment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid segment_id or segment is inactive"
            )

    if data.witel_id:
        witel = db.query(Witel).filter(Witel.id == data.witel_id, Witel.is_active == True).first()
        if not witel:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid witel_id or witel is inactive"
            )

    if data.account_manager_id:
        am = db.query(AccountManager).filter(AccountManager.id == data.account_manager_id, AccountManager.is_active == True).first()
        if not am:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid account_manager_id or account manager is inactive"
            )

    if data.assigned_officer_id:
        officer = db.query(User).filter(User.id == data.assigned_officer_id, User.is_active == True).first()
        if not officer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid assigned_officer_id or user is inactive"
            )

    account = Account(
        account_number=data.account_number,
        name=data.name,
        nipnas=data.nipnas,
        bus_area=data.bus_area,
        segment_id=data.segment_id,
        witel_id=data.witel_id,
        account_manager_id=data.account_manager_id,
        assigned_officer_id=data.assigned_officer_id,
        notes=data.notes,
        is_active=True,
        created_by_id=current_user.id
    )

    db.add(account)
    db.commit()
    db.refresh(account)

    # Reload with relationships
    account = (
        db.query(Account)
        .options(
            joinedload(Account.segment),
            joinedload(Account.witel),
            joinedload(Account.account_manager),
            joinedload(Account.assigned_officer),
            joinedload(Account.creator)
        )
        .filter(Account.id == account.id)
        .first()
    )

    return build_account_response(account)


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    data: AccountUpdate,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Update an account.
    Both STAFF and MANAGER can update.
    """
    db, _ = db_and_user

    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Check for account_number uniqueness if updating
    if data.account_number is not None and data.account_number != account.account_number:
        if data.account_number:  # Only check if not empty
            existing = db.query(Account).filter(
                Account.account_number == data.account_number,
                Account.id != account_id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Account number already exists"
                )
        account.account_number = data.account_number

    if data.name is not None:
        account.name = data.name
    if data.nipnas is not None:
        account.nipnas = data.nipnas
    if data.bus_area is not None:
        account.bus_area = data.bus_area
    if data.notes is not None:
        account.notes = data.notes

    # Validate and update FK references
    if data.segment_id is not None:
        if data.segment_id == 0:  # Allow clearing
            account.segment_id = None
        else:
            segment = db.query(Segment).filter(Segment.id == data.segment_id, Segment.is_active == True).first()
            if not segment:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid segment_id or segment is inactive"
                )
            account.segment_id = data.segment_id

    if data.witel_id is not None:
        if data.witel_id == 0:
            account.witel_id = None
        else:
            witel = db.query(Witel).filter(Witel.id == data.witel_id, Witel.is_active == True).first()
            if not witel:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid witel_id or witel is inactive"
                )
            account.witel_id = data.witel_id

    if data.account_manager_id is not None:
        if data.account_manager_id == 0:
            account.account_manager_id = None
        else:
            am = db.query(AccountManager).filter(AccountManager.id == data.account_manager_id, AccountManager.is_active == True).first()
            if not am:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid account_manager_id or account manager is inactive"
                )
            account.account_manager_id = data.account_manager_id

    if data.assigned_officer_id is not None:
        if data.assigned_officer_id == 0:
            account.assigned_officer_id = None
        else:
            officer = db.query(User).filter(User.id == data.assigned_officer_id, User.is_active == True).first()
            if not officer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid assigned_officer_id or user is inactive"
                )
            account.assigned_officer_id = data.assigned_officer_id

    db.commit()
    db.refresh(account)

    # Reload with relationships
    account = (
        db.query(Account)
        .options(
            joinedload(Account.segment),
            joinedload(Account.witel),
            joinedload(Account.account_manager),
            joinedload(Account.assigned_officer),
            joinedload(Account.creator)
        )
        .filter(Account.id == account.id)
        .first()
    )

    return build_account_response(account)


@router.post("/{account_id}/deactivate", response_model=AccountResponse)
async def deactivate_account(
    account_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Soft-delete an account by setting is_active=False."""
    db, _ = db_and_user

    account = (
        db.query(Account)
        .options(
            joinedload(Account.segment),
            joinedload(Account.witel),
            joinedload(Account.account_manager),
            joinedload(Account.assigned_officer),
            joinedload(Account.creator)
        )
        .filter(Account.id == account_id)
        .first()
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is already deactivated"
        )

    account.is_active = False
    db.commit()
    db.refresh(account)

    return build_account_response(account)


@router.post("/{account_id}/activate", response_model=AccountResponse)
async def activate_account(
    account_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Reactivate a deactivated account."""
    db, _ = db_and_user

    account = (
        db.query(Account)
        .options(
            joinedload(Account.segment),
            joinedload(Account.witel),
            joinedload(Account.account_manager),
            joinedload(Account.assigned_officer),
            joinedload(Account.creator)
        )
        .filter(Account.id == account_id)
        .first()
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    if account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is already active"
        )

    account.is_active = True
    db.commit()
    db.refresh(account)

    return build_account_response(account)


@router.get("/{account_id}/contracts", response_model=AccountContractsResponse)
async def get_account_contracts(
    account_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("contract_year", description="Sort by field (contract_year, created_at, total_contract_value)"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Fetch contracts for a specific account with pagination and sorting.
    Returns contract history ordered by year (descending by default).
    """
    db, _ = db_and_user

    # Verify account exists
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Build query
    query = db.query(Contract).filter(Contract.account_id == account_id)

    # Apply sorting
    if sort_by == "contract_year":
        order_col = Contract.contract_year
    elif sort_by == "created_at":
        order_col = Contract.created_at
    elif sort_by == "total_contract_value":
        order_col = Contract.total_contract_value
    else:
        # Default to contract_year if invalid sort_by
        order_col = Contract.contract_year

    if sort_order == "desc":
        query = query.order_by(desc(order_col))
    else:
        query = query.order_by(order_col)

    # Get total count
    total = query.count()

    # Paginate
    contracts = query.offset((page - 1) * per_page).limit(per_page).all()

    # Build response
    contract_briefs = []
    for contract in contracts:
        contract_briefs.append(AccountContractBrief(
            id=contract.id,
            contract_year=contract.contract_year,
            contract_number=contract.contract_number,
            customer_name=contract.customer_name,
            period_start=contract.period_start.isoformat() if contract.period_start else None,
            period_end=contract.period_end.isoformat() if contract.period_end else None,
            payment_method=contract.payment_method,
            total_contract_value=str(contract.total_contract_value) if contract.total_contract_value else "0",
            created_at=contract.created_at
        ))

    return AccountContractsResponse(
        account_id=account.id,
        account_name=account.name,
        contracts=contract_briefs,
        total=total,
        page=page,
        per_page=per_page
    )
