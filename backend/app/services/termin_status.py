"""
Termin Payment Status Auto-Update Service

Automatically computes and updates status (PENDING/DUE/OVERDUE) based on period_year/month.
Preserves manual statuses (PAID/CANCELLED) and handles concurrent edits safely.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Type
from sqlalchemy.orm import Session

from app.models.database import ContractTermPayment, ContractRecurringPayment

logger = logging.getLogger(__name__)

# Status categories
MANUAL_STATUSES = {"PAID", "CANCELLED"}  # Never auto-update these
AUTO_STATUSES = {"PENDING", "DUE", "OVERDUE"}  # Can be auto-updated


def compute_termin_status(
    period_year: int,
    period_month: int,
    current_date: Optional[datetime] = None
) -> str:
    """
    Compute termin payment status based on period and current date.

    Logic:
    - PENDING: Payment due in future months
    - DUE: Payment due in current month
    - OVERDUE: Payment was due in past months

    Args:
        period_year: Payment period year (e.g., 2025)
        period_month: Payment period month (1-12)
        current_date: Reference date (defaults to now UTC)

    Returns:
        Status string: "PENDING", "DUE", or "OVERDUE"
    """
    if current_date is None:
        current_date = datetime.now(timezone.utc)

    current_year = current_date.year
    current_month = current_date.month

    # Compare (year, month) tuples for chronological ordering
    if (period_year, period_month) > (current_year, current_month):
        return "PENDING"
    elif (period_year, period_month) == (current_year, current_month):
        return "DUE"
    else:
        return "OVERDUE"


def _update_payment_statuses_generic(
    db: Session,
    table_model: Type,
    contract_id: Optional[int] = None,
    payment_ids: Optional[List[int]] = None,
    current_date: Optional[datetime] = None,
    dry_run: bool = False,
    payment_number_field: str = "termin_number"
) -> Dict[str, Any]:
    """
    Generic payment status updater (internal use only).

    Works with any payment table that has: id, contract_id, period_year, period_month, status.

    This function:
    1. Selects payments with auto-updatable status (PENDING/DUE/OVERDUE)
    2. Computes new status from period_year/month
    3. Only updates if status actually changed (minimize writes)
    4. Preserves PAID/CANCELLED statuses (manual-only)
    5. Uses row-level locking to prevent race conditions

    Transaction: Does NOT commit. Caller must commit to persist changes.

    Args:
        db: SQLAlchemy database session
        table_model: SQLAlchemy model class (ContractTermPayment or ContractRecurringPayment)
        contract_id: Optional contract_id filter (update only one contract's payments)
        payment_ids: Optional list of payment IDs to update (specific payments only)
        current_date: Reference date (defaults to now UTC)
        dry_run: If True, only return what would be updated without writing
        payment_number_field: Field name for payment number (termin_number or cycle_number)

    Returns:
        dict with update statistics:
        {
            "checked": int,  # Number of payments evaluated
            "updated": int,  # Number actually updated
            "skipped_manual": int,  # Number with PAID/CANCELLED
            "changes": [{"id": int, "old_status": str, "new_status": str}, ...]
        }
    """
    if current_date is None:
        current_date = datetime.now(timezone.utc)

    # Build query
    query = db.query(table_model)

    # Apply filters
    if contract_id is not None:
        query = query.filter(table_model.contract_id == contract_id)

    if payment_ids is not None:
        query = query.filter(table_model.id.in_(payment_ids))

    # Lock rows for update (prevent concurrent modifications)
    # Only lock if not dry_run
    if not dry_run:
        query = query.with_for_update()

    payments = query.all()

    # Statistics
    checked = 0
    updated = 0
    skipped_manual = 0
    changes = []

    for payment in payments:
        checked += 1

        # Skip manual statuses
        if payment.status in MANUAL_STATUSES:
            skipped_manual += 1
            continue

        # Compute new status
        new_status = compute_termin_status(
            payment.period_year,
            payment.period_month,
            current_date
        )

        # Only update if changed (minimize writes)
        if payment.status != new_status:
            old_status = payment.status

            if not dry_run:
                payment.status = new_status
                payment.updated_at = current_date
                # Note: updated_by is not set (this is automatic update)

            # Get payment number dynamically
            payment_number = getattr(payment, payment_number_field, None)

            changes.append({
                "id": payment.id,
                "contract_id": payment.contract_id,
                payment_number_field: payment_number,
                "period_label": payment.period_label,
                "old_status": old_status,
                "new_status": new_status
            })
            updated += 1

    return {
        "checked": checked,
        "updated": updated,
        "skipped_manual": skipped_manual,
        "changes": changes
    }


def update_termin_statuses(
    db: Session,
    contract_id: Optional[int] = None,
    termin_ids: Optional[List[int]] = None,
    current_date: Optional[datetime] = None,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Update termin payment statuses based on current date.

    This function:
    1. Selects termins with auto-updatable status (PENDING/DUE/OVERDUE)
    2. Computes new status from period_year/month
    3. Only updates if status actually changed (minimize writes)
    4. Preserves PAID/CANCELLED statuses (manual-only)
    5. Uses row-level locking to prevent race conditions

    Transaction: Does NOT commit. Caller must commit to persist changes.

    Args:
        db: SQLAlchemy database session
        contract_id: Optional contract_id filter (update only one contract's termins)
        termin_ids: Optional list of termin IDs to update (specific termins only)
        current_date: Reference date (defaults to now UTC)
        dry_run: If True, only return what would be updated without writing

    Returns:
        dict with update statistics:
        {
            "checked": int,  # Number of termins evaluated
            "updated": int,  # Number actually updated
            "skipped_manual": int,  # Number with PAID/CANCELLED
            "changes": [{"id": int, "old_status": str, "new_status": str}, ...]
        }
    """
    return _update_payment_statuses_generic(
        db=db,
        table_model=ContractTermPayment,
        contract_id=contract_id,
        payment_ids=termin_ids,
        current_date=current_date,
        dry_run=dry_run,
        payment_number_field="termin_number"
    )


def update_recurring_statuses(
    db: Session,
    contract_id: Optional[int] = None,
    recurring_ids: Optional[List[int]] = None,
    current_date: Optional[datetime] = None,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Update recurring payment statuses based on current date.

    This function:
    1. Selects recurring payments with auto-updatable status (PENDING/DUE/OVERDUE)
    2. Computes new status from period_year/month
    3. Only updates if status actually changed (minimize writes)
    4. Preserves PAID/CANCELLED statuses (manual-only)
    5. Uses row-level locking to prevent race conditions

    Transaction: Does NOT commit. Caller must commit to persist changes.

    Args:
        db: SQLAlchemy database session
        contract_id: Optional contract_id filter (update only one contract's recurring payments)
        recurring_ids: Optional list of recurring payment IDs to update (specific payments only)
        current_date: Reference date (defaults to now UTC)
        dry_run: If True, only return what would be updated without writing

    Returns:
        dict with update statistics:
        {
            "checked": int,  # Number of recurring payments evaluated
            "updated": int,  # Number actually updated
            "skipped_manual": int,  # Number with PAID/CANCELLED
            "changes": [{"id": int, "old_status": str, "new_status": str}, ...]
        }
    """
    return _update_payment_statuses_generic(
        db=db,
        table_model=ContractRecurringPayment,
        contract_id=contract_id,
        payment_ids=recurring_ids,
        current_date=current_date,
        dry_run=dry_run,
        payment_number_field="cycle_number"
    )
