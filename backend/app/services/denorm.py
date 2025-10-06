"""
Contract denormalization service
Extracts frequently-queried fields from final_data JSONB for efficient database operations
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from datetime import date
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class DenormFields:
    """Denormalized contract fields for efficient querying"""
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

    # Log summary for debugging (only if values are present)
    if customer_name or payment_method:
        logger.info(
            f"Denormalized contract: customer={customer_name}, "
            f"services=(conn:{service_connectivity}, non-conn:{service_non_connectivity}, bundle:{service_bundling}), "
            f"payment_method={payment_method}, termin_count={termin_count}, "
            f"total_value={total_contract_value}"
        )

    return DenormFields(
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
    )
