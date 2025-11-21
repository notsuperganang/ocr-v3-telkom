"""
Recurring Payment Synchronization Service

Syncs recurring payment schedule from contract denormalized fields to ContractRecurringPayment rows.
Generates monthly billing schedule automatically from period_start to period_end.
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session

from app.models.database import Contract, ContractRecurringPayment

logger = logging.getLogger(__name__)

# Indonesian month names for period labels
MONTH_NAMES_ID = [
    None,  # Index 0 (months are 1-indexed)
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]


def iter_months_inclusive(start_date: date, end_date: date) -> List[Tuple[int, int, int]]:
    """
    Generate list of (year, month, cycle_number) for all months between dates (inclusive).

    Args:
        start_date: Contract start date
        end_date: Contract end date

    Returns:
        List of tuples: [(year, month, cycle_number), ...]
        Example: [(2025, 1, 1), (2025, 2, 2), (2025, 3, 3), ...]

    Example:
        iter_months_inclusive(date(2025, 1, 15), date(2025, 3, 20))
        -> [(2025, 1, 1), (2025, 2, 2), (2025, 3, 3)]
    """
    if start_date > end_date:
        logger.warning(f"Start date {start_date} is after end date {end_date}")
        return []

    months = []
    year = start_date.year
    month = start_date.month
    cycle_number = 1

    while (year, month) <= (end_date.year, end_date.month):
        months.append((year, month, cycle_number))

        # Increment month/year
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1

        cycle_number += 1

    return months


def format_period_label(year: int, month: int) -> str:
    """
    Format period label in Indonesian format.

    Args:
        year: Year (e.g., 2025)
        month: Month (1-12)

    Returns:
        Formatted period label (e.g., "Januari 2025")
    """
    if month < 1 or month > 12:
        logger.warning(f"Invalid month {month}, using 'Unknown'")
        return f"Unknown {year}"

    month_name = MONTH_NAMES_ID[month]
    return f"{month_name} {year}"


def sync_contract_recurring_payments(
    db: Session,
    contract: Contract,
    acting_user: Optional[str] = None,
) -> None:
    """
    Sync recurring payment schedule from contract fields to ContractRecurringPayment rows.

    This function:
    1. Checks if payment_method == "recurring" and recurring_monthly_amount > 0
    2. Generates billing schedule from period_start to period_end (monthly)
    3. Matches existing DB rows by (period_year, period_month)
    4. Preserves status/paid_at/notes for existing payments
    5. Creates new payments with status=PENDING
    6. Deletes payments no longer in period range
    7. Handles non-recurring payment methods by clearing all payments

    Transaction: Does NOT commit. Caller must commit to persist changes.
    Idempotency: Safe to call multiple times with same contract data.

    Args:
        db: SQLAlchemy database session
        contract: Contract instance (must have contract.id available)
        acting_user: Username for created_by/updated_by audit fields

    Raises:
        ValueError: If contract.id is None (call db.flush() first)
    """
    if contract.id is None:
        raise ValueError("Contract must have an ID (call db.flush() before sync)")

    logger.info(f"Syncing recurring payments for contract {contract.id}")

    # === GUARD CLAUSE: Check if recurring applies ===

    # Check payment method
    if contract.payment_method != "recurring":
        logger.info(
            f"Contract {contract.id}: Payment method is '{contract.payment_method}' (not recurring), "
            f"deleting existing recurring payment records"
        )
        # Delete all existing recurring payments
        db.query(ContractRecurringPayment).filter(
            ContractRecurringPayment.contract_id == contract.id
        ).delete(synchronize_session=False)
        return

    # Check recurring_monthly_amount
    if not contract.recurring_monthly_amount or contract.recurring_monthly_amount <= 0:
        logger.info(
            f"Contract {contract.id}: recurring_monthly_amount is {contract.recurring_monthly_amount} (<= 0), "
            f"deleting existing recurring payment records"
        )
        # Delete all existing recurring payments
        db.query(ContractRecurringPayment).filter(
            ContractRecurringPayment.contract_id == contract.id
        ).delete(synchronize_session=False)
        return

    # Check period dates
    if not contract.period_start or not contract.period_end:
        logger.info(
            f"Contract {contract.id}: Missing period dates "
            f"(start={contract.period_start}, end={contract.period_end}), "
            f"deleting existing recurring payment records"
        )
        # Delete all existing recurring payments
        db.query(ContractRecurringPayment).filter(
            ContractRecurringPayment.contract_id == contract.id
        ).delete(synchronize_session=False)
        return

    # === GENERATE BILLING SCHEDULE ===

    # Generate list of (year, month, cycle_number) for all billing months
    expected_months = iter_months_inclusive(contract.period_start, contract.period_end)

    if not expected_months:
        logger.warning(
            f"Contract {contract.id}: No billing months generated "
            f"(period_start={contract.period_start}, period_end={contract.period_end})"
        )
        # Delete all existing recurring payments
        db.query(ContractRecurringPayment).filter(
            ContractRecurringPayment.contract_id == contract.id
        ).delete(synchronize_session=False)
        return

    logger.info(
        f"Contract {contract.id}: Generated {len(expected_months)} billing months "
        f"from {contract.period_start} to {contract.period_end}"
    )

    # === MATCH EXISTING ROWS ===

    # Fetch existing DB rows
    existing_payments = db.query(ContractRecurringPayment).filter(
        ContractRecurringPayment.contract_id == contract.id
    ).all()

    # Build map keyed by (period_year, period_month)
    existing_by_period = {
        (payment.period_year, payment.period_month): payment
        for payment in existing_payments
    }

    logger.info(
        f"Contract {contract.id}: Found {len(existing_by_period)} existing recurring payments"
    )

    # Track changes for logging
    created_count = 0
    updated_count = 0
    deleted_count = 0

    # Build set of expected (year, month) tuples for deletion check
    expected_periods = {(year, month) for year, month, _ in expected_months}

    # === PROCESS EACH BILLING MONTH ===

    for year, month, cycle_number in expected_months:
        period_key = (year, month)
        existing_payment = existing_by_period.get(period_key)

        # Generate period label
        period_label = format_period_label(year, month)

        if existing_payment:
            # UPDATE existing payment
            # Preserve: status, paid_at, notes, original_amount
            # Update: cycle_number, period_label, amount, updated_by

            # Update cycle_number (in case period range changed)
            existing_payment.cycle_number = cycle_number

            # Update period_label (in case format changed)
            existing_payment.period_label = period_label

            # Update amount (current working value)
            existing_payment.amount = contract.recurring_monthly_amount

            # Update audit field
            if acting_user:
                existing_payment.updated_by = acting_user

            logger.debug(
                f"Updated recurring payment for contract {contract.id}: "
                f"cycle={cycle_number}, period={period_label}, amount={contract.recurring_monthly_amount}"
            )
            updated_count += 1

        else:
            # CREATE new payment
            new_payment = ContractRecurringPayment(
                contract_id=contract.id,
                cycle_number=cycle_number,
                period_label=period_label,
                period_year=year,
                period_month=month,
                original_amount=contract.recurring_monthly_amount,  # Set baseline
                amount=contract.recurring_monthly_amount,  # Set current value
                status="PENDING",  # New payments start as PENDING
                paid_at=None,
                notes=None,
                created_by=acting_user,
                updated_by=acting_user,
            )
            db.add(new_payment)

            logger.debug(
                f"Created new recurring payment for contract {contract.id}: "
                f"cycle={cycle_number}, period={period_label}, amount={contract.recurring_monthly_amount}"
            )
            created_count += 1

    # === DELETE ORPHANED ROWS ===

    # Delete payments that are no longer in the period range
    for period_key, existing_payment in existing_by_period.items():
        if period_key not in expected_periods:
            logger.debug(
                f"Deleting recurring payment for contract {contract.id} "
                f"period={period_key} (no longer in period range)"
            )
            db.delete(existing_payment)
            deleted_count += 1

    logger.info(
        f"Recurring payment sync completed for contract {contract.id}: "
        f"created={created_count}, updated={updated_count}, deleted={deleted_count}"
    )

    # === AUTO-UPDATE STATUSES ===

    # Reuse termin status update logic (same status enum)
    from app.services.termin_status import update_termin_statuses

    # Note: update_termin_statuses works on any table with period_year/period_month/status
    # However, it's specifically designed for ContractTermPayment
    # We need to manually update recurring payment statuses here

    # For now, we'll let the status be updated on the next GET request
    # The termin_status.py service can be extended to support both tables
    # But that's outside the scope of this backend-only implementation

    logger.debug(
        f"Status auto-update for recurring payments deferred "
        f"(will be computed on next GET request)"
    )
