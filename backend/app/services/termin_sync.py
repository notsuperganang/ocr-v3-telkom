"""
Termin Payment Synchronization Service

Syncs termin payment data from contract.final_data (JSONB) to ContractTermPayment rows.
Keeps normalized table in sync with JSON source of truth while preserving operational data
(status, paid_at, notes).
"""

import logging
import re
from decimal import Decimal, InvalidOperation
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from app.models.database import Contract, ContractTermPayment, User

logger = logging.getLogger(__name__)

# Indonesian month name to number mapping
# Reused from data_extractor.py pattern
INDONESIAN_MONTHS = {
    "jan": 1, "januari": 1,
    "feb": 2, "februari": 2,
    "mar": 3, "maret": 3,
    "apr": 4, "april": 4,
    "mei": 5,
    "jun": 6, "juni": 6,
    "jul": 7, "juli": 7,
    "agu": 8, "agustus": 8,
    "sep": 9, "sept": 9, "september": 9,
    "okt": 10, "oktober": 10,
    "nov": 11, "november": 11,
    "des": 12, "desember": 12,
}


def parse_indonesian_period(period_str: str) -> Tuple[Optional[int], Optional[int]]:
    """
    Parse Indonesian period string to (year, month).

    Examples:
        "Maret 2025" -> (2025, 3)
        "Juni 2025" -> (2025, 6)
        "Maret2025" -> (2025, 3)  # No space
        "Januari 2026" -> (2026, 1)

    Args:
        period_str: Period label like "Maret 2025" or "Maret2025"

    Returns:
        Tuple of (year, month) or (None, None) if parsing fails
    """
    if not period_str or not isinstance(period_str, str):
        logger.warning(f"Invalid period string: {period_str}")
        return (None, None)

    # Normalize: strip, lowercase
    normalized = period_str.strip().lower()

    # Try pattern 1: "Month YYYY" (e.g., "Maret 2025")
    match = re.search(r'(\w+)\s+(\d{4})', normalized)

    # Try pattern 2: "MonthYYYY" (e.g., "Maret2025") - no space
    if not match:
        match = re.search(r'([a-z]+)(\d{4})', normalized)

    if not match:
        logger.warning(f"Could not parse period format '{period_str}' (expected 'Month YYYY' or 'MonthYYYY')")
        return (None, None)

    month_name = match.group(1)
    year_str = match.group(2)

    # Look up month
    month = INDONESIAN_MONTHS.get(month_name)
    if month is None:
        logger.warning(f"Unknown Indonesian month name '{month_name}' in period '{period_str}'")
        return (None, None)

    # Parse year
    try:
        year = int(year_str)
        if year < 2000 or year > 2100:
            logger.warning(f"Year {year} out of expected range (2000-2100) in period '{period_str}'")
            return (None, None)
    except ValueError:
        logger.warning(f"Could not parse year '{year_str}' in period '{period_str}'")
        return (None, None)

    return (year, month)


def _parse_decimal_amount(value: Any, context: str = "amount") -> Decimal:
    """
    Parse value to Decimal for database storage.
    Returns Decimal('0.00') on error (follows denorm.py pattern).

    Args:
        value: Amount value (int, float, str, or Decimal)
        context: Description for logging

    Returns:
        Decimal value, or Decimal('0.00') if parsing fails
    """
    if value is None:
        return Decimal('0.00')

    try:
        if isinstance(value, Decimal):
            return value

        if isinstance(value, (int, float)):
            return Decimal(str(value))

        if isinstance(value, str):
            # Clean string: remove commas, whitespace
            cleaned = value.replace(',', '').replace(' ', '').strip()
            if not cleaned:
                return Decimal('0.00')
            return Decimal(cleaned)

        logger.warning(f"Unexpected type for {context}: {type(value)}, value={value}")
        return Decimal('0.00')

    except (InvalidOperation, ValueError, ArithmeticError) as e:
        logger.warning(f"Failed to parse {context} '{value}': {e}")
        return Decimal('0.00')


def sync_contract_terms_from_final_data(
    db: Session,
    contract: Contract,
    acting_user: Optional[User] = None,
) -> None:
    """
    Sync termin payment data from contract.final_data to ContractTermPayment rows.

    This function:
    1. Reads termin_payments array from final_data->tata_cara_pembayaran
    2. Matches existing DB rows by termin_number
    3. Preserves status/paid_at/notes for existing terms
    4. Creates new terms with status=PENDING
    5. Deletes terms no longer in JSON
    6. Handles non-termin payment methods by clearing all terms

    Transaction: Does NOT commit. Caller must commit to persist changes.
    Idempotency: Safe to call multiple times with same final_data.

    Args:
        db: SQLAlchemy database session
        contract: Contract instance (must have contract.id available)
        acting_user: User object for created_by_id/updated_by_id audit fields

    Raises:
        ValueError: If contract.id is None (call db.flush() first)
    """
    if contract.id is None:
        raise ValueError("Contract must have an ID (call db.flush() before sync)")

    logger.info(f"Syncing termin payments for contract {contract.id}")

    # Extract payment method data from final_data
    final_data = contract.final_data or {}
    tata_cara_pembayaran = final_data.get("tata_cara_pembayaran")

    # Edge case: missing payment data
    if not tata_cara_pembayaran or not isinstance(tata_cara_pembayaran, dict):
        logger.info(f"Contract {contract.id}: No payment data, deleting existing termin records")
        # Delete all existing terms
        db.query(ContractTermPayment).filter(
            ContractTermPayment.contract_id == contract.id
        ).delete(synchronize_session=False)
        return

    # Check payment method type
    method_type = tata_cara_pembayaran.get("method_type")

    # Edge case: not a termin payment method
    if method_type != "termin":
        logger.info(
            f"Contract {contract.id}: Payment method is '{method_type}' (not termin), "
            f"deleting existing termin records"
        )
        # Delete all existing terms
        db.query(ContractTermPayment).filter(
            ContractTermPayment.contract_id == contract.id
        ).delete(synchronize_session=False)
        return

    # Extract termin_payments array
    termin_payments_json = tata_cara_pembayaran.get("termin_payments")

    # Edge case: missing or empty termin_payments
    if not termin_payments_json or not isinstance(termin_payments_json, list):
        logger.info(
            f"Contract {contract.id}: No termin_payments array, "
            f"deleting existing termin records"
        )
        # Delete all existing terms
        db.query(ContractTermPayment).filter(
            ContractTermPayment.contract_id == contract.id
        ).delete(synchronize_session=False)
        return

    # Build map of new termin data from JSON
    new_termins_map: Dict[int, Dict[str, Any]] = {}

    for item in termin_payments_json:
        if not isinstance(item, dict):
            logger.warning(f"Skipping non-dict termin payment item: {item}")
            continue

        # Extract termin_number
        termin_number = item.get("termin_number")
        if termin_number is None:
            logger.warning(f"Skipping termin payment item without termin_number: {item}")
            continue

        try:
            termin_number = int(termin_number)
        except (ValueError, TypeError):
            logger.warning(f"Invalid termin_number '{termin_number}': {item}")
            continue

        # Extract period label
        period_label = item.get("period")
        if not period_label:
            logger.warning(f"Termin {termin_number} missing period label")
            period_label = "Unknown"

        # Parse period to year/month
        period_year, period_month = parse_indonesian_period(period_label)
        if period_year is None or period_month is None:
            logger.error(
                f"Failed to parse period '{period_label}' for termin {termin_number}. "
                f"Cannot create/update term payment record."
            )
            continue

        # Extract and parse amount
        amount_value = item.get("amount", 0)
        amount = _parse_decimal_amount(amount_value, f"termin {termin_number} amount")

        # Store parsed data
        new_termins_map[termin_number] = {
            "termin_number": termin_number,
            "period_label": str(period_label),
            "period_year": period_year,
            "period_month": period_month,
            "amount": amount,
        }

    if not new_termins_map:
        logger.info(
            f"Contract {contract.id}: No valid termin payments in JSON, "
            f"deleting existing termin records"
        )
        # Delete all existing terms
        db.query(ContractTermPayment).filter(
            ContractTermPayment.contract_id == contract.id
        ).delete(synchronize_session=False)
        return

    # Fetch existing DB rows
    existing_terms = db.query(ContractTermPayment).filter(
        ContractTermPayment.contract_id == contract.id
    ).all()

    existing_by_number = {term.termin_number: term for term in existing_terms}

    logger.info(
        f"Contract {contract.id}: Found {len(existing_by_number)} existing terms, "
        f"{len(new_termins_map)} terms in JSON"
    )

    # Track changes for logging
    created_count = 0
    updated_count = 0
    deleted_count = 0

    # Process each termin from JSON
    for termin_number, new_data in new_termins_map.items():
        existing_term = existing_by_number.get(termin_number)

        if existing_term:
            # UPDATE existing term
            # Preserve: status, paid_at, notes, original_amount
            # Update: amount, period fields, updated_by

            # Update amount (current working value)
            existing_term.amount = new_data["amount"]

            # Update period fields (in case period was edited)
            existing_term.period_label = new_data["period_label"]
            existing_term.period_year = new_data["period_year"]
            existing_term.period_month = new_data["period_month"]

            # Update audit field
            if acting_user:
                existing_term.updated_by_id = acting_user.id

            logger.debug(
                f"Updated termin {termin_number} for contract {contract.id}: "
                f"amount={new_data['amount']}, period={new_data['period_label']}"
            )
            updated_count += 1

        else:
            # CREATE new term
            new_term = ContractTermPayment(
                contract_id=contract.id,
                termin_number=new_data["termin_number"],
                period_label=new_data["period_label"],
                period_year=new_data["period_year"],
                period_month=new_data["period_month"],
                original_amount=new_data["amount"],  # Set baseline
                amount=new_data["amount"],  # Set current value
                status="PENDING",  # New terms start as PENDING
                paid_at=None,
                notes=None,
                created_by_id=acting_user.id if acting_user else None,
                updated_by_id=acting_user.id if acting_user else None,
            )
            db.add(new_term)

            logger.debug(
                f"Created new termin {termin_number} for contract {contract.id}: "
                f"amount={new_data['amount']}, period={new_data['period_label']}"
            )
            created_count += 1

    # Delete terms that are no longer in JSON
    for termin_number, existing_term in existing_by_number.items():
        if termin_number not in new_termins_map:
            logger.debug(
                f"Deleting termin {termin_number} for contract {contract.id} "
                f"(no longer in JSON)"
            )
            db.delete(existing_term)
            deleted_count += 1

    logger.info(
        f"Termin sync completed for contract {contract.id}: "
        f"created={created_count}, updated={updated_count}, deleted={deleted_count}"
    )

    # Auto-update statuses after sync completes
    from app.services.termin_status import update_termin_statuses

    status_result = update_termin_statuses(db=db, contract_id=contract.id, dry_run=False)

    if status_result["updated"] > 0:
        logger.info(
            f"Auto-updated {status_result['updated']} termin statuses "
            f"during sync for contract {contract.id}"
        )
