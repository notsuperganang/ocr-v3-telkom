"""
Dashboard API endpoints for KPIs and overview data.
"""

from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, extract, and_, or_
from sqlalchemy.orm import Session

from app.api.dependencies import get_db_and_user
from app.models.database import Contract, ContractTermPayment, ContractRecurringPayment, TerminPaymentStatus

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# =============================================================================
# Response Models
# =============================================================================

class DashboardOverview(BaseModel):
    """KPI overview data for the dashboard."""
    total_contracts: int
    contracts_this_month: int
    contracts_last_month: int
    total_contract_value: str  # Decimal as string for JSON
    avg_contract_value: str  # Decimal as string
    avg_processing_time_sec: Optional[float]
    median_processing_time_sec: Optional[float]

    class Config:
        from_attributes = True


class TerminUpcomingItem(BaseModel):
    """Single termin payment item for upcoming due list."""
    contract_id: int
    customer_name: str
    period_start: Optional[date]
    period_end: Optional[date]
    termin_number: int
    termin_period_label: str
    termin_period_year: int
    termin_period_month: int
    amount: str  # Decimal as string
    status: str

    class Config:
        from_attributes = True


class TerminUpcomingResponse(BaseModel):
    """Response for upcoming termin list with summary."""
    total_contracts: int
    total_amount: str  # Decimal as string
    items: list[TerminUpcomingItem]


class RecurringCurrentMonthItem(BaseModel):
    """Single recurring payment item for current month dashboard."""
    contract_id: int
    customer_name: str
    period_start: Optional[date]
    period_end: Optional[date]
    cycle_number: int
    period_year: int
    period_month: int
    period_label: str
    amount: str  # Decimal as string
    status: str

    class Config:
        from_attributes = True


class RecurringCurrentMonthResponse(BaseModel):
    """Response for recurring payments in current/specified month."""
    year: int
    month: int
    total_contracts: int
    total_amount: str  # Decimal as string
    items: list[RecurringCurrentMonthItem]


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/overview", response_model=DashboardOverview)
async def get_dashboard_overview(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """
    Get dashboard KPI overview data.

    Returns:
        - total_contracts: Total number of confirmed contracts
        - contracts_this_month: Contracts confirmed this month
        - contracts_last_month: Contracts confirmed last month (for comparison)
        - total_contract_value: Sum of all contract values
        - avg_contract_value: Average value per contract
        - avg_processing_time_sec: Average processing time
        - median_processing_time_sec: Median processing time (placeholder)
    """
    db, current_user = db_and_user

    now = datetime.now(timezone.utc)
    current_year = now.year
    current_month = now.month

    # Calculate last month
    if current_month == 1:
        last_month = 12
        last_month_year = current_year - 1
    else:
        last_month = current_month - 1
        last_month_year = current_year

    # Total contracts
    total_contracts = db.query(func.count(Contract.id)).scalar() or 0

    # Contracts this month (by created_at)
    contracts_this_month = db.query(func.count(Contract.id)).filter(
        extract('year', Contract.created_at) == current_year,
        extract('month', Contract.created_at) == current_month
    ).scalar() or 0

    # Contracts last month
    contracts_last_month = db.query(func.count(Contract.id)).filter(
        extract('year', Contract.created_at) == last_month_year,
        extract('month', Contract.created_at) == last_month
    ).scalar() or 0

    # Total contract value
    total_value_result = db.query(func.sum(Contract.total_contract_value)).scalar()
    total_contract_value = Decimal(total_value_result) if total_value_result else Decimal('0')

    # Average contract value
    if total_contracts > 0:
        avg_contract_value = total_contract_value / total_contracts
    else:
        avg_contract_value = Decimal('0')

    # Average processing time
    # Note: We need to check if this field exists in the Contract model
    # For now, we'll use a placeholder approach
    avg_processing_time_sec = None
    median_processing_time_sec = None

    # Try to get processing time from processing_jobs if available
    # This is a simplified version - in production you might want to join with processing_jobs
    try:
        from app.models.database import ProcessingJob
        avg_time_result = db.query(func.avg(ProcessingJob.processing_time_seconds)).filter(
            ProcessingJob.processing_time_seconds.isnot(None)
        ).scalar()
        avg_processing_time_sec = float(avg_time_result) if avg_time_result else None

        # For median, we'd need a more complex query or fetch all and compute
        # For now, use a rough estimate (placeholder)
        if avg_processing_time_sec:
            median_processing_time_sec = avg_processing_time_sec * 0.85  # Rough estimate
    except Exception:
        pass

    return DashboardOverview(
        total_contracts=total_contracts,
        contracts_this_month=contracts_this_month,
        contracts_last_month=contracts_last_month,
        total_contract_value=str(total_contract_value),
        avg_contract_value=str(avg_contract_value),
        avg_processing_time_sec=avg_processing_time_sec,
        median_processing_time_sec=median_processing_time_sec
    )


@router.get("/termin-upcoming", response_model=TerminUpcomingResponse)
async def get_termin_upcoming(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to look ahead"),
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """
    Get upcoming termin payments due within the specified number of days.

    Only includes termin where:
    - Contract payment_method is 'termin'
    - Status is NOT PAID or CANCELLED
    - Due date (first of termin month) is within the window

    Args:
        days: Number of days to look ahead (default 30)

    Returns:
        - total_contracts: Number of distinct contracts with upcoming termin
        - total_amount: Sum of upcoming termin amounts
        - items: List of termin payment details
    """
    db, current_user = db_and_user

    today = date.today()
    target_date = today + timedelta(days=days)

    # We need to filter termin that are due within the window
    # Due date is conceptually the first day of the termin month
    # We'll filter by period_year and period_month

    # Calculate the month range
    start_year = today.year
    start_month = today.month
    end_year = target_date.year
    end_month = target_date.month

    # Query termin payments with contract join
    query = db.query(
        ContractTermPayment,
        Contract.customer_name,
        Contract.period_start,
        Contract.period_end
    ).join(
        Contract, ContractTermPayment.contract_id == Contract.id
    ).filter(
        Contract.payment_method == 'termin',
        ContractTermPayment.status.notin_([
            TerminPaymentStatus.PAID.value,
            TerminPaymentStatus.CANCELLED.value
        ])
    )

    # Filter by date range
    # Include:
    # 1. All OVERDUE termins (past months, not paid)
    # 2. DUE termins (current month)
    # 3. PENDING termins (future months within the window)

    # Create conditions for:
    # - Past periods (OVERDUE) - any period before current month
    # - Current and future periods up to target date
    if start_year == end_year:
        # Same year
        query = query.filter(
            or_(
                # Past months in current year (OVERDUE)
                and_(
                    ContractTermPayment.period_year == start_year,
                    ContractTermPayment.period_month < start_month
                ),
                # Past years (OVERDUE)
                ContractTermPayment.period_year < start_year,
                # Current month up to target (DUE and PENDING)
                and_(
                    ContractTermPayment.period_year == start_year,
                    ContractTermPayment.period_month >= start_month,
                    ContractTermPayment.period_month <= end_month
                )
            )
        )
    else:
        # Spans multiple years
        query = query.filter(
            or_(
                # Past years (OVERDUE)
                ContractTermPayment.period_year < start_year,
                # Past months in current year (OVERDUE)
                and_(
                    ContractTermPayment.period_year == start_year,
                    ContractTermPayment.period_month < start_month
                ),
                # Current year from start_month onwards
                and_(
                    ContractTermPayment.period_year == start_year,
                    ContractTermPayment.period_month >= start_month
                ),
                # Next year up to end_month
                and_(
                    ContractTermPayment.period_year == end_year,
                    ContractTermPayment.period_month <= end_month
                )
            )
        )

    # Order by due date (year, month) then customer name
    query = query.order_by(
        ContractTermPayment.period_year,
        ContractTermPayment.period_month,
        Contract.customer_name
    )

    results = query.all()

    # Process results
    items = []
    contract_ids = set()
    total_amount = Decimal('0')

    for termin, customer_name, period_start, period_end in results:
        amount = Decimal(str(termin.amount)) if termin.amount else Decimal('0')
        total_amount += amount
        contract_ids.add(termin.contract_id)

        items.append(TerminUpcomingItem(
            contract_id=termin.contract_id,
            customer_name=customer_name or "Unknown",
            period_start=period_start,
            period_end=period_end,
            termin_number=termin.termin_number,
            termin_period_label=termin.period_label or f"{termin.period_month}/{termin.period_year}",
            termin_period_year=termin.period_year,
            termin_period_month=termin.period_month,
            amount=str(amount),
            status=termin.status
        ))

    return TerminUpcomingResponse(
        total_contracts=len(contract_ids),
        total_amount=str(total_amount),
        items=items
    )

@router.get("/recurring-current-month", response_model=RecurringCurrentMonthResponse)
async def get_recurring_current_month(
    year: Optional[int] = Query(default=None, description="Target year (defaults to current year)"),
    month: Optional[int] = Query(default=None, ge=1, le=12, description="Target month 1-12 (defaults to current month)"),
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """
    Get recurring payments for a specific month (defaults to current month).

    Returns all recurring payments for contracts with payment_method='recurring'
    for the specified year and month.

    Args:
        year: Target year (defaults to current year)
        month: Target month 1-12 (defaults to current month)

    Returns:
        - year: The queried year
        - month: The queried month
        - total_contracts: Number of distinct contracts with recurring payments
        - total_amount: Sum of recurring payment amounts for the month
        - items: List of recurring payment details with contract info
    """
    db, current_user = db_and_user

    # Default to current year/month if not provided
    today = date.today()
    target_year = year if year is not None else today.year
    target_month = month if month is not None else today.month

    # Query recurring payments with contract join
    query = db.query(
        ContractRecurringPayment,
        Contract.customer_name,
        Contract.period_start,
        Contract.period_end
    ).join(
        Contract, ContractRecurringPayment.contract_id == Contract.id
    ).filter(
        Contract.payment_method == 'recurring',
        ContractRecurringPayment.period_year == target_year,
        ContractRecurringPayment.period_month == target_month
    )

    # Order by customer name for consistent display
    query = query.order_by(Contract.customer_name)

    results = query.all()

    # Process results
    items = []
    contract_ids = set()
    total_amount = Decimal('0')

    for recurring, customer_name, period_start, period_end in results:
        amount = Decimal(str(recurring.amount)) if recurring.amount else Decimal('0')
        total_amount += amount
        contract_ids.add(recurring.contract_id)

        items.append(RecurringCurrentMonthItem(
            contract_id=recurring.contract_id,
            customer_name=customer_name or "Unknown",
            period_start=period_start,
            period_end=period_end,
            cycle_number=recurring.cycle_number,
            period_year=recurring.period_year,
            period_month=recurring.period_month,
            period_label=recurring.period_label or f"{recurring.period_month}/{recurring.period_year}",
            amount=str(amount),
            status=recurring.status
        ))

    return RecurringCurrentMonthResponse(
        year=target_year,
        month=target_month,
        total_contracts=len(contract_ids),
        total_amount=str(total_amount),
        items=items
    )
