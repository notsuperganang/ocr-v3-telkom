"""
Termin Payment Status Auto-Update Service

Automatically computes and updates status (PENDING/DUE/OVERDUE) based on period_year/month.
Preserves manual statuses (PAID/CANCELLED) and handles concurrent edits safely.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.database import ContractTermPayment

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
    if current_date is None:
        current_date = datetime.now(timezone.utc)

    # Build query
    query = db.query(ContractTermPayment)

    # Apply filters
    if contract_id is not None:
        query = query.filter(ContractTermPayment.contract_id == contract_id)

    if termin_ids is not None:
        query = query.filter(ContractTermPayment.id.in_(termin_ids))

    # Lock rows for update (prevent concurrent modifications)
    # Only lock if not dry_run
    if not dry_run:
        query = query.with_for_update()

    termins = query.all()

    # Statistics
    checked = 0
    updated = 0
    skipped_manual = 0
    changes = []

    for termin in termins:
        checked += 1

        # Skip manual statuses
        if termin.status in MANUAL_STATUSES:
            skipped_manual += 1
            continue

        # Compute new status
        new_status = compute_termin_status(
            termin.period_year,
            termin.period_month,
            current_date
        )

        # Only update if changed (minimize writes)
        if termin.status != new_status:
            old_status = termin.status

            if not dry_run:
                termin.status = new_status
                termin.updated_at = current_date
                # Note: updated_by is not set (this is automatic update)

            changes.append({
                "id": termin.id,
                "contract_id": termin.contract_id,
                "termin_number": termin.termin_number,
                "period_label": termin.period_label,
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
