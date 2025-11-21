"""
Contract denormalization service
Extracts frequently-queried fields from final_data JSONB for efficient database operations
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from datetime import date, datetime
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


@dataclass
class DenormFields:
    """Denormalized contract fields for efficient querying"""
    # Original fields
    customer_name: Optional[str] = None
    customer_npwp: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    service_connectivity: int = 0
    service_non_connectivity: int = 0
    service_bundling: int = 0
    payment_method: Optional[str] = None
    termin_count: Optional[int] = None
    installation_cost: Decimal = Decimal('0.00')
    annual_subscription_cost: Decimal = Decimal('0.00')
    total_contract_value: Decimal = Decimal('0.00')

    # Extended fields - Customer & Representatives
    customer_address: Optional[str] = None
    rep_name: Optional[str] = None
    rep_title: Optional[str] = None
    customer_contact_name: Optional[str] = None
    customer_contact_title: Optional[str] = None
    customer_contact_email: Optional[str] = None
    customer_contact_phone: Optional[str] = None

    # Extended fields - Contract Period Raw
    period_start_raw: Optional[str] = None
    period_end_raw: Optional[str] = None

    # Extended fields - Telkom Contact
    telkom_contact_name: Optional[str] = None
    telkom_contact_title: Optional[str] = None
    telkom_contact_email: Optional[str] = None
    telkom_contact_phone: Optional[str] = None

    # Extended fields - Payment Details
    payment_description: Optional[str] = None
    termin_total_count: Optional[int] = None
    termin_total_amount: Optional[Decimal] = None
    payment_raw_text: Optional[str] = None
    termin_payments_raw: Optional[List[Dict[str, Any]]] = None

    # Extended fields - Recurring Payment Details
    recurring_monthly_amount: Decimal = Decimal('0.00')
    recurring_month_count: Optional[int] = None
    recurring_total_amount: Decimal = Decimal('0.00')

    # Extended fields - Extraction Metadata
    extraction_timestamp: Optional[datetime] = None
    contract_processing_time_sec: Optional[float] = None


def _safe_get(data: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    """
    Safely navigate nested dictionary with multiple keys
    Returns default if any key in path doesn't exist or value is None
    """
    current = data
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return current if current is not None else default


def _parse_decimal(value: Any, field_name: str = "field") -> Decimal:
    """
    Parse value to Decimal, return 0.00 on error
    Handles: int, float, str, Decimal
    """
    if value is None or value == '':
        return Decimal('0.00')

    try:
        # Handle already-decimal
        if isinstance(value, Decimal):
            return value

        # Handle numeric types
        if isinstance(value, (int, float)):
            return Decimal(str(value))

        # Handle string (strip whitespace and common formatting)
        if isinstance(value, str):
            # Remove common separators and whitespace
            cleaned = value.replace(',', '').replace(' ', '').strip()
            if not cleaned:
                return Decimal('0.00')
            return Decimal(cleaned)

        logger.warning(f"Unexpected type for {field_name}: {type(value)}, defaulting to 0.00")
        return Decimal('0.00')

    except (InvalidOperation, ValueError, ArithmeticError) as e:
        logger.warning(f"Failed to parse {field_name} value '{value}': {e}, defaulting to 0.00")
        return Decimal('0.00')


def _parse_date(value: Any, field_name: str = "date") -> Optional[date]:
    """
    Parse ISO date string (YYYY-MM-DD) to date object
    Returns None on error
    """
    if not value or not isinstance(value, str):
        return None

    try:
        # Parse ISO format YYYY-MM-DD
        parts = value.strip().split('-')
        if len(parts) != 3:
            logger.warning(f"Invalid date format for {field_name}: {value}")
            return None

        year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
        return date(year, month, day)

    except (ValueError, AttributeError) as e:
        logger.warning(f"Failed to parse {field_name} value '{value}': {e}")
        return None


def _normalize_payment_method(value: Any) -> Optional[str]:
    """
    Normalize payment method to one of: termin | recurring | one_time
    Case-insensitive mapping from various input formats
    """
    if not value or not isinstance(value, str):
        return None

    value_lower = value.lower().strip()

    # Mapping rules (case-insensitive)
    if value_lower == 'termin':
        return 'termin'
    elif value_lower == 'recurring':
        return 'recurring'
    elif 'one_time' in value_lower or 'onetime' in value_lower or value_lower == 'one time':
        return 'one_time'
    else:
        logger.warning(f"Unknown payment method type: {value}, returning None")
        return None


def _parse_timestamp(value: Any, field_name: str = "timestamp") -> Optional[datetime]:
    """
    Parse ISO timestamp string to datetime object with timezone
    Supports: ISO 8601 formats (YYYY-MM-DDTHH:MM:SS.ffffff+TZ)
    Returns None on error
    """
    if not value or not isinstance(value, str):
        return None

    try:
        # Try parsing ISO format with fromisoformat (Python 3.7+)
        # This handles: 2025-10-06T10:30:45.123456+07:00
        value_clean = value.strip()

        # Handle common variations
        if 'Z' in value_clean:
            # Replace 'Z' with '+00:00' for UTC
            value_clean = value_clean.replace('Z', '+00:00')

        return datetime.fromisoformat(value_clean)

    except (ValueError, AttributeError) as e:
        logger.warning(f"Failed to parse {field_name} value '{value}': {e}")
        return None


def _normalize_email(value: Any) -> Optional[str]:
    """
    Normalize email address: lowercase and strip whitespace
    Returns None for invalid/empty values
    """
    if not value or not isinstance(value, str):
        return None

    email = value.strip().lower()
    return email if email else None


def _normalize_phone(value: Any) -> Optional[str]:
    """
    Normalize phone number: strip whitespace and common formatting
    Preserves original format but removes excess whitespace
    Returns None for invalid/empty values
    """
    if not value or not isinstance(value, str):
        return None

    # Strip whitespace and common separators (but keep the number readable)
    phone = value.strip()
    return phone if phone else None


def _compute_termin_summary(termin_payments: List[Dict[str, Any]]) -> tuple[int, Decimal]:
    """
    Compute termin payment summary: count and total amount

    Args:
        termin_payments: List of termin payment entries

    Returns:
        Tuple of (count, total_amount)
    """
    if not termin_payments or not isinstance(termin_payments, list):
        return (0, Decimal('0.00'))

    count = len(termin_payments)
    total_amount = Decimal('0.00')

    for idx, payment in enumerate(termin_payments):
        if isinstance(payment, dict):
            amount = payment.get('amount')
            payment_amount = _parse_decimal(amount, f'termin_payments[{idx}].amount')
            total_amount += payment_amount

    return (count, total_amount)


def _diff_months_inclusive(start_date: date, end_date: date) -> int:
    """
    Calculate the number of months between two dates (inclusive)

    Args:
        start_date: Start date
        end_date: End date

    Returns:
        Number of months between the dates (inclusive)

    Example:
        _diff_months_inclusive(date(2025, 1, 15), date(2025, 3, 20)) -> 3
        (January, February, March = 3 months)
    """
    year_diff = end_date.year - start_date.year
    month_diff = end_date.month - start_date.month

    # Total months = (year difference * 12) + month difference + 1 (for inclusive count)
    total_months = (year_diff * 12) + month_diff + 1

    return total_months


def _compute_recurring_fields(
    payment_method: Optional[str],
    annual_subscription_cost: Decimal,
    period_start: Optional[date],
    period_end: Optional[date]
) -> tuple[Decimal, Optional[int], Decimal]:
    """
    Compute recurring payment fields

    Args:
        payment_method: Payment method type
        annual_subscription_cost: Annual subscription cost
        period_start: Contract start date
        period_end: Contract end date

    Returns:
        Tuple of (recurring_monthly_amount, recurring_month_count, recurring_total_amount)
    """
    # Guard clause: only compute for recurring payment method
    if payment_method != 'recurring':
        return (Decimal('0.00'), None, Decimal('0.00'))

    # Guard clause: annual_subscription_cost must be > 0
    if annual_subscription_cost <= 0:
        return (Decimal('0.00'), None, Decimal('0.00'))

    # Guard clause: both period dates must be present
    if not period_start or not period_end:
        return (Decimal('0.00'), None, Decimal('0.00'))

    # Calculate monthly amount: annual / 12
    # Use Decimal arithmetic to avoid float rounding issues
    recurring_monthly_amount = annual_subscription_cost / Decimal('12')

    # Calculate number of billing months (inclusive)
    recurring_month_count = _diff_months_inclusive(period_start, period_end)

    # Calculate total recurring amount
    recurring_total_amount = recurring_monthly_amount * Decimal(str(recurring_month_count))

    return (recurring_monthly_amount, recurring_month_count, recurring_total_amount)


def compute_denorm_fields(final_data: Dict[str, Any]) -> DenormFields:
    """
    Extract denormalized fields from final_data JSONB

    Args:
        final_data: Contract data in TelkomContractData format

    Returns:
        DenormFields with parsed values, using safe defaults on errors

    Schema mapping (based on Pydantic TelkomContractData):
        - customer_name: final_data->informasi_pelanggan->nama_pelanggan
        - customer_npwp: final_data->informasi_pelanggan->npwp
        - period_start: final_data->jangka_waktu->mulai (YYYY-MM-DD)
        - period_end: final_data->jangka_waktu->akhir (YYYY-MM-DD)
        - service_connectivity: final_data->layanan_utama->connectivity_telkom
        - service_non_connectivity: final_data->layanan_utama->non_connectivity_telkom
        - service_bundling: final_data->layanan_utama->bundling
        - payment_method: final_data->tata_cara_pembayaran->method_type (root level, normalized)
        - termin_count: final_data->tata_cara_pembayaran->total_termin_count (for termin payments)
        - installation_cost: SUM of all final_data->rincian_layanan[]->biaya_instalasi
        - annual_subscription_cost: SUM of all final_data->rincian_layanan[]->biaya_langganan_tahunan
        - total_contract_value: sum of installation + annual subscription
    """
    if not isinstance(final_data, dict):
        logger.error(f"Invalid final_data type: {type(final_data)}, expected dict")
        return DenormFields()

    # Extract customer information
    customer_name = _safe_get(final_data, 'informasi_pelanggan', 'nama_pelanggan')
    customer_npwp = _safe_get(final_data, 'informasi_pelanggan', 'npwp')

    # Extract contract period
    period_start_str = _safe_get(final_data, 'jangka_waktu', 'mulai')
    period_end_str = _safe_get(final_data, 'jangka_waktu', 'akhir')
    period_start = _parse_date(period_start_str, 'period_start')
    period_end = _parse_date(period_end_str, 'period_end')

    # Extract service counts from layanan_utama
    layanan_utama = _safe_get(final_data, 'layanan_utama', default={})
    service_connectivity = 0
    service_non_connectivity = 0
    service_bundling = 0

    if isinstance(layanan_utama, dict):
        service_connectivity = int(layanan_utama.get('connectivity_telkom', 0) or 0)
        service_non_connectivity = int(layanan_utama.get('non_connectivity_telkom', 0) or 0)
        service_bundling = int(layanan_utama.get('bundling', 0) or 0)

    # Extract payment method from ROOT-level tata_cara_pembayaran
    tata_cara = _safe_get(final_data, 'tata_cara_pembayaran', default={})
    payment_method = None
    termin_count = None

    if isinstance(tata_cara, dict):
        payment_method_raw = tata_cara.get('method_type')
        payment_method = _normalize_payment_method(payment_method_raw)

        # Extract termin count if payment method is termin
        if payment_method == 'termin':
            termin_count_raw = tata_cara.get('total_termin_count')
            if termin_count_raw is not None:
                try:
                    termin_count = int(termin_count_raw)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid termin_count value: {termin_count_raw}")

    # Extract financial data from rincian_layanan - SUM ALL ITEMS
    rincian_layanan = _safe_get(final_data, 'rincian_layanan', default=[])

    installation_cost = Decimal('0.00')
    annual_subscription_cost = Decimal('0.00')

    if isinstance(rincian_layanan, list):
        for idx, item in enumerate(rincian_layanan):
            if isinstance(item, dict):
                item_installation = _parse_decimal(item.get('biaya_instalasi'), f'rincian_layanan[{idx}].biaya_instalasi')
                item_subscription = _parse_decimal(item.get('biaya_langganan_tahunan'), f'rincian_layanan[{idx}].biaya_langganan_tahunan')

                installation_cost += item_installation
                annual_subscription_cost += item_subscription

    # Compute total contract value
    total_contract_value = installation_cost + annual_subscription_cost

    # === EXTENDED FIELDS EXTRACTION ===

    # A. Customer & Representatives (from informasi_pelanggan)
    customer_address = _safe_get(final_data, 'informasi_pelanggan', 'alamat')
    rep_name = _safe_get(final_data, 'informasi_pelanggan', 'perwakilan', 'nama')
    rep_title = _safe_get(final_data, 'informasi_pelanggan', 'perwakilan', 'jabatan')
    customer_contact_name = _safe_get(final_data, 'informasi_pelanggan', 'kontak_person', 'nama')
    customer_contact_title = _safe_get(final_data, 'informasi_pelanggan', 'kontak_person', 'jabatan')
    customer_contact_email_raw = _safe_get(final_data, 'informasi_pelanggan', 'kontak_person', 'email')
    customer_contact_phone_raw = _safe_get(final_data, 'informasi_pelanggan', 'kontak_person', 'telepon')
    customer_contact_email = _normalize_email(customer_contact_email_raw)
    customer_contact_phone = _normalize_phone(customer_contact_phone_raw)

    # B. Contract Period Raw (preserve original format)
    period_start_raw = period_start_str  # Already extracted above
    period_end_raw = period_end_str      # Already extracted above

    # C. Telkom Contact Person (from kontak_person_telkom)
    telkom_contact_name = _safe_get(final_data, 'kontak_person_telkom', 'nama')
    telkom_contact_title = _safe_get(final_data, 'kontak_person_telkom', 'jabatan')
    telkom_contact_email_raw = _safe_get(final_data, 'kontak_person_telkom', 'email')
    telkom_contact_phone_raw = _safe_get(final_data, 'kontak_person_telkom', 'telepon')
    telkom_contact_email = _normalize_email(telkom_contact_email_raw)
    telkom_contact_phone = _normalize_phone(telkom_contact_phone_raw)

    # D. Payment Details (from tata_cara_pembayaran)
    payment_description = _safe_get(final_data, 'tata_cara_pembayaran', 'description')
    payment_raw_text = _safe_get(final_data, 'tata_cara_pembayaran', 'raw_text')

    # Termin payments summary
    termin_payments_list = _safe_get(final_data, 'tata_cara_pembayaran', 'termin_payments', default=[])
    termin_total_count, termin_total_amount = _compute_termin_summary(termin_payments_list)

    # Store termin payments raw snapshot for detail inspection (only if it's a list)
    termin_payments_raw = termin_payments_list if isinstance(termin_payments_list, list) else None

    # E. Extraction Metadata
    extraction_timestamp_str = _safe_get(final_data, 'extraction_timestamp')
    extraction_timestamp = _parse_timestamp(extraction_timestamp_str, 'extraction_timestamp')

    # Processing time from final_data
    processing_time_raw = _safe_get(final_data, 'processing_time_seconds')
    contract_processing_time_sec = None
    if processing_time_raw is not None:
        try:
            contract_processing_time_sec = float(processing_time_raw)
        except (ValueError, TypeError):
            logger.warning(f"Invalid processing_time_seconds value: {processing_time_raw}")

    # F. Recurring Payment Fields (computed for payment_method="recurring")
    recurring_monthly_amount, recurring_month_count, recurring_total_amount = _compute_recurring_fields(
        payment_method=payment_method,
        annual_subscription_cost=annual_subscription_cost,
        period_start=period_start,
        period_end=period_end
    )

    # Log summary for debugging (only if values are present)
    if customer_name or payment_method:
        logger.info(
            f"Denormalized contract: customer={customer_name}, "
            f"services=(conn:{service_connectivity}, non-conn:{service_non_connectivity}, bundle:{service_bundling}), "
            f"payment_method={payment_method}, termin_count={termin_count}, termin_total_count={termin_total_count}, "
            f"recurring_month_count={recurring_month_count}, recurring_total={recurring_total_amount}, "
            f"total_value={total_contract_value}, extraction_ts={extraction_timestamp}"
        )

    return DenormFields(
        # Original fields
        customer_name=customer_name,
        customer_npwp=customer_npwp,
        period_start=period_start,
        period_end=period_end,
        service_connectivity=service_connectivity,
        service_non_connectivity=service_non_connectivity,
        service_bundling=service_bundling,
        payment_method=payment_method,
        termin_count=termin_count,
        installation_cost=installation_cost,
        annual_subscription_cost=annual_subscription_cost,
        total_contract_value=total_contract_value,
        # Extended fields - Customer & Representatives
        customer_address=customer_address,
        rep_name=rep_name,
        rep_title=rep_title,
        customer_contact_name=customer_contact_name,
        customer_contact_title=customer_contact_title,
        customer_contact_email=customer_contact_email,
        customer_contact_phone=customer_contact_phone,
        # Extended fields - Contract Period Raw
        period_start_raw=period_start_raw,
        period_end_raw=period_end_raw,
        # Extended fields - Telkom Contact
        telkom_contact_name=telkom_contact_name,
        telkom_contact_title=telkom_contact_title,
        telkom_contact_email=telkom_contact_email,
        telkom_contact_phone=telkom_contact_phone,
        # Extended fields - Payment Details
        payment_description=payment_description,
        termin_total_count=termin_total_count,
        termin_total_amount=termin_total_amount,
        payment_raw_text=payment_raw_text,
        termin_payments_raw=termin_payments_raw,
        # Extended fields - Recurring Payment Details
        recurring_monthly_amount=recurring_monthly_amount,
        recurring_month_count=recurring_month_count,
        recurring_total_amount=recurring_total_amount,
        # Extended fields - Extraction Metadata
        extraction_timestamp=extraction_timestamp,
        contract_processing_time_sec=contract_processing_time_sec,
    )
