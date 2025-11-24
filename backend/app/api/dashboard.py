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


class DashboardFinancialSummary(BaseModel):
    """Comprehensive financial KPIs for dashboard cards."""
    # Card 1: Total Termin Cost
    total_termin_cost: str
    total_termin_contracts: int
    termin_paid_amount: str
    termin_unpaid_amount: str

    # Card 2: Total Recurring Cost
    total_recurring_cost: str
    total_recurring_contracts: int
    recurring_monthly_avg: str
    recurring_active_cycles: int

    # Card 3: One-Time Charge Total
    total_one_time_cost: str
    total_one_time_contracts: int
    one_time_avg_per_contract: str

    # Card 4: 90-Day Projection
    projection_90_days: str
    projection_contracts_count: int
    projection_termin: str
    projection_recurring: str

    # Card 5: Collected This Month
    collected_this_month: str
    collected_count: int
    collected_termin: str
    collected_recurring: str
    collection_target: str

    # Card 6: Collection Rate
    collection_rate: float
    on_time_count: int
    late_count: int
    outstanding_count: int

    class Config:
        from_attributes = True


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


@router.get("/recurring-all", response_model=TerminUpcomingResponse)
async def get_recurring_all(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """
    Get all recurring payments (not just current month).

    Returns all recurring payments for contracts with payment_method='recurring'
    regardless of the period. Status is computed based on period date:
    - OVERDUE: Past periods that are not PAID or CANCELLED
    - DUE: Current month periods
    - PENDING: Future periods

    Returns:
        - total_contracts: Number of distinct contracts with recurring payments
        - total_amount: Sum of all recurring payment amounts
        - items: List of recurring payment details (reusing TerminUpcomingItem structure)
    """
    db, current_user = db_and_user

    today = date.today()
    current_year = today.year
    current_month = today.month

    # Query all recurring payments with contract join
    query = db.query(
        ContractRecurringPayment,
        Contract.customer_name,
        Contract.period_start,
        Contract.period_end
    ).join(
        Contract, ContractRecurringPayment.contract_id == Contract.id
    ).filter(
        Contract.payment_method == 'recurring',
        ContractRecurringPayment.status.notin_([
            TerminPaymentStatus.PAID.value,
            TerminPaymentStatus.CANCELLED.value
        ])
    )

    # Order by period (year, month) then customer name
    query = query.order_by(
        ContractRecurringPayment.period_year,
        ContractRecurringPayment.period_month,
        Contract.customer_name
    )

    results = query.all()

    # Process results
    items = []
    contract_ids = set()
    total_amount = Decimal('0')

    for recurring, customer_name, period_start, period_end in results:
        amount = Decimal(str(recurring.amount)) if recurring.amount else Decimal('0')
        total_amount += amount
        contract_ids.add(recurring.contract_id)

        # Reuse TerminUpcomingItem structure (it has the same fields we need)
        items.append(TerminUpcomingItem(
            contract_id=recurring.contract_id,
            customer_name=customer_name or "Unknown",
            period_start=period_start,
            period_end=period_end,
            termin_number=recurring.cycle_number,  # Map cycle_number to termin_number
            termin_period_label=recurring.period_label or f"{recurring.period_month}/{recurring.period_year}",
            termin_period_year=recurring.period_year,
            termin_period_month=recurring.period_month,
            amount=str(amount),
            status=recurring.status
        ))

    return TerminUpcomingResponse(
        total_contracts=len(contract_ids),
        total_amount=str(total_amount),
        items=items
    )


@router.get("/financial-summary", response_model=DashboardFinancialSummary)
async def get_financial_summary(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """
    Get comprehensive financial KPIs for dashboard cards.

    Aggregates financial data across termin, recurring, and one-time contracts:
    - Card 1: Total termin cost with paid/unpaid breakdown
    - Card 2: Total recurring cost with monthly average
    - Card 3: Total one-time charges with average per contract
    - Card 4: 90-day payment projection
    - Card 5: Collections this month with breakdown
    - Card 6: Collection rate with on-time/late/outstanding counts

    Returns:
        DashboardFinancialSummary with all financial KPIs
    """
    db, current_user = db_and_user

    today = date.today()
    current_year = today.year
    current_month = today.month

    # ==== CARD 1: Total Termin Cost ====
    termin_total = db.query(func.sum(ContractTermPayment.amount)).scalar() or Decimal('0')

    termin_paid = db.query(func.sum(ContractTermPayment.amount)).filter(
        ContractTermPayment.status == TerminPaymentStatus.PAID.value
    ).scalar() or Decimal('0')

    termin_unpaid = termin_total - termin_paid

    termin_contracts = db.query(
        func.count(func.distinct(ContractTermPayment.contract_id))
    ).scalar() or 0

    # ==== CARD 2: Total Recurring Cost ====
    recurring_total = db.query(func.sum(Contract.recurring_total_amount)).filter(
        Contract.payment_method == 'recurring'
    ).scalar() or Decimal('0')

    recurring_contracts = db.query(func.count(Contract.id)).filter(
        Contract.payment_method == 'recurring'
    ).scalar() or 0

    recurring_monthly_avg = (recurring_total / recurring_contracts) if recurring_contracts > 0 else Decimal('0')

    recurring_active_cycles = db.query(func.count(ContractRecurringPayment.id)).filter(
        ContractRecurringPayment.status.notin_([
            TerminPaymentStatus.PAID.value,
            TerminPaymentStatus.CANCELLED.value
        ])
    ).scalar() or 0

    # ==== CARD 3: One-Time Charge Total (annual subscription for one_time payment method) ====
    one_time_total = db.query(func.sum(Contract.annual_subscription_cost)).filter(
        Contract.payment_method == 'one_time'
    ).scalar() or Decimal('0')

    one_time_contracts = db.query(func.count(Contract.id)).filter(
        Contract.payment_method == 'one_time'
    ).scalar() or 0

    one_time_avg = (one_time_total / one_time_contracts) if one_time_contracts > 0 else Decimal('0')

    # ==== CARD 4: 90-Day Projection ====
    # Calculate termin projection (next 90 days, ~3 months from current month)
    projection_termin = db.query(func.sum(ContractTermPayment.amount)).filter(
        ContractTermPayment.status.notin_([
            TerminPaymentStatus.PAID.value,
            TerminPaymentStatus.CANCELLED.value
        ]),
        or_(
            and_(
                ContractTermPayment.period_year == current_year,
                ContractTermPayment.period_month <= current_month + 3
            ),
            and_(
                ContractTermPayment.period_year == current_year + 1,
                ContractTermPayment.period_month <= (current_month + 3 - 12) if current_month + 3 > 12 else 0
            )
        )
    ).scalar() or Decimal('0')

    # Calculate recurring projection (next 90 days, ~3 months)
    projection_recurring = db.query(func.sum(ContractRecurringPayment.amount)).filter(
        ContractRecurringPayment.status.notin_([
            TerminPaymentStatus.PAID.value,
            TerminPaymentStatus.CANCELLED.value
        ]),
        or_(
            and_(
                ContractRecurringPayment.period_year == current_year,
                ContractRecurringPayment.period_month <= current_month + 3
            ),
            and_(
                ContractRecurringPayment.period_year == current_year + 1,
                ContractRecurringPayment.period_month <= (current_month + 3 - 12) if current_month + 3 > 12 else 0
            )
        )
    ).scalar() or Decimal('0')

    projection_total = projection_termin + projection_recurring

    projection_contract_ids = set()
    # Count distinct contracts with upcoming payments
    termin_contract_ids = db.query(ContractTermPayment.contract_id).filter(
        ContractTermPayment.status.notin_([TerminPaymentStatus.PAID.value, TerminPaymentStatus.CANCELLED.value]),
        or_(
            and_(
                ContractTermPayment.period_year == current_year,
                ContractTermPayment.period_month <= current_month + 3
            ),
            and_(
                ContractTermPayment.period_year == current_year + 1,
                ContractTermPayment.period_month <= (current_month + 3 - 12) if current_month + 3 > 12 else 0
            )
        )
    ).distinct().all()

    recurring_contract_ids = db.query(ContractRecurringPayment.contract_id).filter(
        ContractRecurringPayment.status.notin_([TerminPaymentStatus.PAID.value, TerminPaymentStatus.CANCELLED.value]),
        or_(
            and_(
                ContractRecurringPayment.period_year == current_year,
                ContractRecurringPayment.period_month <= current_month + 3
            ),
            and_(
                ContractRecurringPayment.period_year == current_year + 1,
                ContractRecurringPayment.period_month <= (current_month + 3 - 12) if current_month + 3 > 12 else 0
            )
        )
    ).distinct().all()

    for (cid,) in termin_contract_ids:
        projection_contract_ids.add(cid)
    for (cid,) in recurring_contract_ids:
        projection_contract_ids.add(cid)

    # ==== CARD 5: Collected This Month ====
    collected_termin = db.query(func.sum(ContractTermPayment.amount)).filter(
        ContractTermPayment.status == TerminPaymentStatus.PAID.value,
        extract('year', ContractTermPayment.paid_at) == current_year,
        extract('month', ContractTermPayment.paid_at) == current_month
    ).scalar() or Decimal('0')

    collected_recurring = db.query(func.sum(ContractRecurringPayment.amount)).filter(
        ContractRecurringPayment.status == TerminPaymentStatus.PAID.value,
        extract('year', ContractRecurringPayment.paid_at) == current_year,
        extract('month', ContractRecurringPayment.paid_at) == current_month
    ).scalar() or Decimal('0')

    collected_total = collected_termin + collected_recurring

    collected_termin_count = db.query(func.count(ContractTermPayment.id)).filter(
        ContractTermPayment.status == TerminPaymentStatus.PAID.value,
        extract('year', ContractTermPayment.paid_at) == current_year,
        extract('month', ContractTermPayment.paid_at) == current_month
    ).scalar() or 0

    collected_recurring_count = db.query(func.count(ContractRecurringPayment.id)).filter(
        ContractRecurringPayment.status == TerminPaymentStatus.PAID.value,
        extract('year', ContractRecurringPayment.paid_at) == current_year,
        extract('month', ContractRecurringPayment.paid_at) == current_month
    ).scalar() or 0

    collected_count = collected_termin_count + collected_recurring_count

    # Calculate collection target (TOTAL that should be collected this month: PAID + DUE + OVERDUE)
    target_termin = db.query(func.sum(ContractTermPayment.amount)).filter(
        ContractTermPayment.status.in_([
            TerminPaymentStatus.PAID.value,
            TerminPaymentStatus.DUE.value,
            TerminPaymentStatus.OVERDUE.value
        ]),
        ContractTermPayment.period_year == current_year,
        ContractTermPayment.period_month == current_month
    ).scalar() or Decimal('0')

    target_recurring = db.query(func.sum(ContractRecurringPayment.amount)).filter(
        ContractRecurringPayment.status.in_([
            TerminPaymentStatus.PAID.value,
            TerminPaymentStatus.DUE.value,
            TerminPaymentStatus.OVERDUE.value
        ]),
        ContractRecurringPayment.period_year == current_year,
        ContractRecurringPayment.period_month == current_month
    ).scalar() or Decimal('0')

    collection_target = target_termin + target_recurring

    # ==== CARD 6: Collection Rate ====
    # Count on-time (paid on or before due date)
    # For simplicity, we'll count all PAID in current month as on-time
    on_time_count = collected_count

    # Count late (paid after due date) - for now, we'll use 0 as we don't track this distinction yet
    late_count = 0

    # Count outstanding (DUE + OVERDUE not paid)
    outstanding_termin = db.query(func.count(ContractTermPayment.id)).filter(
        ContractTermPayment.status.in_([TerminPaymentStatus.DUE.value, TerminPaymentStatus.OVERDUE.value])
    ).scalar() or 0

    outstanding_recurring = db.query(func.count(ContractRecurringPayment.id)).filter(
        ContractRecurringPayment.status.in_([TerminPaymentStatus.DUE.value, TerminPaymentStatus.OVERDUE.value])
    ).scalar() or 0

    outstanding_count = outstanding_termin + outstanding_recurring

    # Calculate collection rate (collected / target * 100)
    # Since collection_target now includes PAID + DUE + OVERDUE, it's the total target
    collection_rate = float((collected_total / collection_target * 100)) if collection_target > 0 else 0.0

    return DashboardFinancialSummary(
        # Card 1
        total_termin_cost=str(termin_total),
        total_termin_contracts=termin_contracts,
        termin_paid_amount=str(termin_paid),
        termin_unpaid_amount=str(termin_unpaid),
        # Card 2
        total_recurring_cost=str(recurring_total),
        total_recurring_contracts=recurring_contracts,
        recurring_monthly_avg=str(recurring_monthly_avg),
        recurring_active_cycles=recurring_active_cycles,
        # Card 3
        total_one_time_cost=str(one_time_total),
        total_one_time_contracts=one_time_contracts,
        one_time_avg_per_contract=str(one_time_avg),
        # Card 4
        projection_90_days=str(projection_total),
        projection_contracts_count=len(projection_contract_ids),
        projection_termin=str(projection_termin),
        projection_recurring=str(projection_recurring),
        # Card 5
        collected_this_month=str(collected_total),
        collected_count=collected_count,
        collected_termin=str(collected_termin),
        collected_recurring=str(collected_recurring),
        collection_target=str(collection_target),
        # Card 6
        collection_rate=round(collection_rate, 1),
        on_time_count=on_time_count,
        late_count=late_count,
        outstanding_count=outstanding_count,
    )
