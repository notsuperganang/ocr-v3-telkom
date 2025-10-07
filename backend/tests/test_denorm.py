"""
Unit tests for denormalization service
Tests compute_denorm_fields function with various input scenarios
"""

import pytest
from decimal import Decimal
from datetime import date, datetime, timezone

from app.services.denorm import (
    compute_denorm_fields,
    _parse_decimal,
    _parse_date,
    _normalize_payment_method,
    _parse_timestamp,
    _normalize_email,
    _normalize_phone,
    _compute_termin_summary,
    _safe_get
)


class TestSafeGet:
    """Test _safe_get helper function"""

    def test_safe_get_success(self):
        data = {'a': {'b': {'c': 'value'}}}
        assert _safe_get(data, 'a', 'b', 'c') == 'value'

    def test_safe_get_missing_key(self):
        data = {'a': {'b': {}}}
        assert _safe_get(data, 'a', 'b', 'c', default='default') == 'default'

    def test_safe_get_none_value(self):
        data = {'a': {'b': None}}
        assert _safe_get(data, 'a', 'b', 'c', default='default') == 'default'

    def test_safe_get_non_dict(self):
        data = {'a': 'string'}
        assert _safe_get(data, 'a', 'b', default='default') == 'default'


class TestParseDecimal:
    """Test _parse_decimal helper function"""

    def test_parse_decimal_from_int(self):
        assert _parse_decimal(100) == Decimal('100.00')

    def test_parse_decimal_from_float(self):
        assert _parse_decimal(100.50) == Decimal('100.50')

    def test_parse_decimal_from_string(self):
        assert _parse_decimal('1000.75') == Decimal('1000.75')

    def test_parse_decimal_with_separators(self):
        assert _parse_decimal('1,000.50') == Decimal('1000.50')

    def test_parse_decimal_none(self):
        assert _parse_decimal(None) == Decimal('0.00')

    def test_parse_decimal_empty_string(self):
        assert _parse_decimal('') == Decimal('0.00')

    def test_parse_decimal_invalid_string(self):
        assert _parse_decimal('not-a-number') == Decimal('0.00')

    def test_parse_decimal_already_decimal(self):
        value = Decimal('123.45')
        assert _parse_decimal(value) == Decimal('123.45')


class TestParseDate:
    """Test _parse_date helper function"""

    def test_parse_date_valid_iso(self):
        result = _parse_date('2025-03-15')
        assert result == date(2025, 3, 15)

    def test_parse_date_invalid_format(self):
        assert _parse_date('15-03-2025') is None

    def test_parse_date_invalid_month(self):
        assert _parse_date('2025-13-01') is None

    def test_parse_date_invalid_day(self):
        assert _parse_date('2025-02-30') is None

    def test_parse_date_none(self):
        assert _parse_date(None) is None

    def test_parse_date_empty_string(self):
        assert _parse_date('') is None

    def test_parse_date_non_string(self):
        assert _parse_date(12345) is None


class TestNormalizePaymentMethod:
    """Test _normalize_payment_method helper function"""

    def test_normalize_termin(self):
        assert _normalize_payment_method('termin') == 'termin'
        assert _normalize_payment_method('TERMIN') == 'termin'
        assert _normalize_payment_method('Termin') == 'termin'

    def test_normalize_recurring(self):
        assert _normalize_payment_method('recurring') == 'recurring'
        assert _normalize_payment_method('RECURRING') == 'recurring'

    def test_normalize_one_time(self):
        assert _normalize_payment_method('one_time') == 'one_time'
        assert _normalize_payment_method('one time') == 'one_time'
        assert _normalize_payment_method('onetime') == 'one_time'
        assert _normalize_payment_method('one_time_charge') == 'one_time'

    def test_normalize_unknown(self):
        assert _normalize_payment_method('unknown_method') is None

    def test_normalize_none(self):
        assert _normalize_payment_method(None) is None

    def test_normalize_empty_string(self):
        assert _normalize_payment_method('') is None


class TestParseTimestamp:
    """Test _parse_timestamp helper function"""

    def test_parse_timestamp_iso_format(self):
        # ISO 8601 with timezone
        result = _parse_timestamp('2025-10-06T10:30:45.123456+07:00')
        assert result is not None
        assert result.year == 2025
        assert result.month == 10
        assert result.day == 6

    def test_parse_timestamp_utc_z(self):
        # UTC with Z suffix
        result = _parse_timestamp('2025-10-06T10:30:45Z')
        assert result is not None
        assert result.year == 2025

    def test_parse_timestamp_invalid_format(self):
        assert _parse_timestamp('not-a-timestamp') is None

    def test_parse_timestamp_none(self):
        assert _parse_timestamp(None) is None

    def test_parse_timestamp_empty_string(self):
        assert _parse_timestamp('') is None

    def test_parse_timestamp_non_string(self):
        assert _parse_timestamp(12345) is None


class TestNormalizeEmail:
    """Test _normalize_email helper function"""

    def test_normalize_email_lowercase(self):
        assert _normalize_email('TEST@EXAMPLE.COM') == 'test@example.com'

    def test_normalize_email_trim_whitespace(self):
        assert _normalize_email('  test@example.com  ') == 'test@example.com'

    def test_normalize_email_none(self):
        assert _normalize_email(None) is None

    def test_normalize_email_empty_string(self):
        assert _normalize_email('') is None

    def test_normalize_email_non_string(self):
        assert _normalize_email(12345) is None


class TestNormalizePhone:
    """Test _normalize_phone helper function"""

    def test_normalize_phone_trim_whitespace(self):
        assert _normalize_phone('  +62 812 3456 7890  ') == '+62 812 3456 7890'

    def test_normalize_phone_preserve_format(self):
        assert _normalize_phone('+62-812-3456-7890') == '+62-812-3456-7890'

    def test_normalize_phone_none(self):
        assert _normalize_phone(None) is None

    def test_normalize_phone_empty_string(self):
        assert _normalize_phone('') is None

    def test_normalize_phone_non_string(self):
        assert _normalize_phone(12345) is None


class TestComputeTerminSummary:
    """Test _compute_termin_summary helper function"""

    def test_compute_termin_summary_valid_list(self):
        termin_payments = [
            {'termin_number': 1, 'period': 'Maret 2025', 'amount': 5000000},
            {'termin_number': 2, 'period': 'Juni 2025', 'amount': 5000000},
            {'termin_number': 3, 'period': 'September 2025', 'amount': 5000000},
        ]
        count, total = _compute_termin_summary(termin_payments)
        assert count == 3
        assert total == Decimal('15000000.00')

    def test_compute_termin_summary_empty_list(self):
        count, total = _compute_termin_summary([])
        assert count == 0
        assert total == Decimal('0.00')

    def test_compute_termin_summary_none(self):
        count, total = _compute_termin_summary(None)
        assert count == 0
        assert total == Decimal('0.00')

    def test_compute_termin_summary_non_list(self):
        count, total = _compute_termin_summary('not-a-list')
        assert count == 0
        assert total == Decimal('0.00')

    def test_compute_termin_summary_partial_amounts(self):
        termin_payments = [
            {'termin_number': 1, 'amount': 1000000},
            {'termin_number': 2},  # Missing amount
            {'termin_number': 3, 'amount': 2000000},
        ]
        count, total = _compute_termin_summary(termin_payments)
        assert count == 3
        assert total == Decimal('3000000.00')

    def test_compute_termin_summary_invalid_amounts(self):
        termin_payments = [
            {'termin_number': 1, 'amount': 'invalid'},
            {'termin_number': 2, 'amount': 1000000},
        ]
        count, total = _compute_termin_summary(termin_payments)
        assert count == 2
        assert total == Decimal('1000000.00')  # Only valid amount counted


class TestComputeDenormFields:
    """Test compute_denorm_fields main function"""

    def test_complete_valid_data(self):
        """Test with complete, valid contract data"""
        final_data = {
            'informasi_pelanggan': {
                'nama_pelanggan': 'SMK Test School',
                'npwp': '12.345.678.9-012.345'
            },
            'jangka_waktu': {
                'mulai': '2025-01-01',
                'akhir': '2025-12-31'
            },
            'layanan_utama': {
                'connectivity_telkom': 10,
                'non_connectivity_telkom': 5,
                'bundling': 3
            },
            'tata_cara_pembayaran': {
                'method_type': 'termin',
                'total_termin_count': 4
            },
            'rincian_layanan': [
                {
                    'biaya_instalasi': 5000000.00,
                    'biaya_langganan_tahunan': 12000000.00
                }
            ]
        }

        result = compute_denorm_fields(final_data)

        assert result.customer_name == 'SMK Test School'
        assert result.customer_npwp == '12.345.678.9-012.345'
        assert result.period_start == date(2025, 1, 1)
        assert result.period_end == date(2025, 12, 31)
        assert result.service_connectivity == 10
        assert result.service_non_connectivity == 5
        assert result.service_bundling == 3
        assert result.payment_method == 'termin'
        assert result.termin_count == 4
        assert result.installation_cost == Decimal('5000000.00')
        assert result.annual_subscription_cost == Decimal('12000000.00')
        assert result.total_contract_value == Decimal('17000000.00')

    def test_multiple_rincian_layanan_summed(self):
        """Test that multiple service items are summed correctly"""
        final_data = {
            'rincian_layanan': [
                {
                    'biaya_instalasi': 2000000,
                    'biaya_langganan_tahunan': 5000000
                },
                {
                    'biaya_instalasi': 3000000,
                    'biaya_langganan_tahunan': 7000000
                }
            ]
        }

        result = compute_denorm_fields(final_data)

        assert result.installation_cost == Decimal('5000000.00')
        assert result.annual_subscription_cost == Decimal('12000000.00')
        assert result.total_contract_value == Decimal('17000000.00')

    def test_missing_customer_info(self):
        """Test with missing customer information"""
        final_data = {}

        result = compute_denorm_fields(final_data)

        assert result.customer_name is None
        assert result.customer_npwp is None

    def test_invalid_date_format(self):
        """Test with invalid date format"""
        final_data = {
            'jangka_waktu': {
                'mulai': '01/01/2025',  # Wrong format
                'akhir': 'invalid-date'
            }
        }

        result = compute_denorm_fields(final_data)

        assert result.period_start is None
        assert result.period_end is None

    def test_missing_layanan_utama(self):
        """Test with missing service counts"""
        final_data = {}

        result = compute_denorm_fields(final_data)

        assert result.service_connectivity == 0
        assert result.service_non_connectivity == 0
        assert result.service_bundling == 0

    def test_payment_method_one_time(self):
        """Test one_time payment method normalization"""
        final_data = {
            'tata_cara_pembayaran': {
                'method_type': 'one_time_charge'
            }
        }

        result = compute_denorm_fields(final_data)

        assert result.payment_method == 'one_time'
        assert result.termin_count is None  # Not a termin payment

    def test_payment_method_recurring(self):
        """Test recurring payment method"""
        final_data = {
            'tata_cara_pembayaran': {
                'method_type': 'recurring'
            }
        }

        result = compute_denorm_fields(final_data)

        assert result.payment_method == 'recurring'
        assert result.termin_count is None

    def test_empty_rincian_layanan(self):
        """Test with empty service details array"""
        final_data = {
            'rincian_layanan': []
        }

        result = compute_denorm_fields(final_data)

        assert result.installation_cost == Decimal('0.00')
        assert result.annual_subscription_cost == Decimal('0.00')
        assert result.total_contract_value == Decimal('0.00')

    def test_invalid_final_data_type(self):
        """Test with invalid final_data type"""
        final_data = "not a dict"

        result = compute_denorm_fields(final_data)

        # Should return defaults
        assert result.customer_name is None
        assert result.total_contract_value == Decimal('0.00')

    def test_null_service_counts(self):
        """Test with null service counts"""
        final_data = {
            'layanan_utama': {
                'connectivity_telkom': None,
                'non_connectivity_telkom': None,
                'bundling': None
            }
        }

        result = compute_denorm_fields(final_data)

        assert result.service_connectivity == 0
        assert result.service_non_connectivity == 0
        assert result.service_bundling == 0

    def test_partial_rincian_layanan_costs(self):
        """Test with partial cost data (missing some fields)"""
        final_data = {
            'rincian_layanan': [
                {
                    'biaya_instalasi': 1000000
                    # biaya_langganan_tahunan missing
                }
            ]
        }

        result = compute_denorm_fields(final_data)

        assert result.installation_cost == Decimal('1000000.00')
        assert result.annual_subscription_cost == Decimal('0.00')
        assert result.total_contract_value == Decimal('1000000.00')

    def test_invalid_termin_count(self):
        """Test with invalid termin_count value"""
        final_data = {
            'tata_cara_pembayaran': {
                'method_type': 'termin',
                'total_termin_count': 'not-a-number'
            }
        }

        result = compute_denorm_fields(final_data)

        assert result.payment_method == 'termin'
        assert result.termin_count is None  # Should handle gracefully

    def test_extended_fields_complete(self):
        """Test all extended denormalized fields with complete data"""
        final_data = {
            'informasi_pelanggan': {
                'nama_pelanggan': 'SMK Negeri 1 Jakarta',
                'npwp': '01.234.567.8-901.000',
                'alamat': 'Jl. Sudirman No. 123, Jakarta Pusat',
                'perwakilan': {
                    'nama': 'Budi Santoso',
                    'jabatan': 'Kepala Sekolah'
                },
                'kontak_person': {
                    'nama': 'Ahmad Wijaya',
                    'jabatan': 'Wakil Kepala',
                    'email': '  AHMAD.WIJAYA@SCHOOL.COM  ',
                    'telepon': '  +62 21 5555 1234  '
                }
            },
            'jangka_waktu': {
                'mulai': '2025-01-01',
                'akhir': '2025-12-31'
            },
            'kontak_person_telkom': {
                'nama': 'Siti Rahayu',
                'jabatan': 'Account Manager',
                'email': '  SITI.RAHAYU@TELKOM.CO.ID  ',
                'telepon': '  +62 811 9999 8888  '
            },
            'tata_cara_pembayaran': {
                'method_type': 'termin',
                'description': 'Pembayaran dengan 3 termin',
                'raw_text': 'Termin: Maret, Juni, September @ Rp 5.000.000',
                'termin_payments': [
                    {'termin_number': 1, 'period': 'Maret 2025', 'amount': 5000000},
                    {'termin_number': 2, 'period': 'Juni 2025', 'amount': 5000000},
                    {'termin_number': 3, 'period': 'September 2025', 'amount': 5000000}
                ]
            },
            'extraction_timestamp': '2025-10-06T10:30:45.123456+07:00',
            'processing_time_seconds': 12.345
        }

        result = compute_denorm_fields(final_data)

        # Extended fields - Customer & Representatives
        assert result.customer_address == 'Jl. Sudirman No. 123, Jakarta Pusat'
        assert result.rep_name == 'Budi Santoso'
        assert result.rep_title == 'Kepala Sekolah'
        assert result.customer_contact_name == 'Ahmad Wijaya'
        assert result.customer_contact_title == 'Wakil Kepala'
        assert result.customer_contact_email == 'ahmad.wijaya@school.com'  # Normalized
        assert result.customer_contact_phone == '+62 21 5555 1234'  # Trimmed

        # Extended fields - Contract Period Raw
        assert result.period_start_raw == '2025-01-01'
        assert result.period_end_raw == '2025-12-31'

        # Extended fields - Telkom Contact
        assert result.telkom_contact_name == 'Siti Rahayu'
        assert result.telkom_contact_title == 'Account Manager'
        assert result.telkom_contact_email == 'siti.rahayu@telkom.co.id'  # Normalized
        assert result.telkom_contact_phone == '+62 811 9999 8888'  # Trimmed

        # Extended fields - Payment Details
        assert result.payment_description == 'Pembayaran dengan 3 termin'
        assert result.termin_total_count == 3
        assert result.termin_total_amount == Decimal('15000000.00')
        assert result.payment_raw_text == 'Termin: Maret, Juni, September @ Rp 5.000.000'
        assert result.termin_payments_json is not None
        assert len(result.termin_payments_json) == 3

        # Extended fields - Extraction Metadata
        assert result.extraction_timestamp is not None
        assert result.extraction_timestamp.year == 2025
        assert result.extraction_timestamp.month == 10
        assert result.contract_processing_time_sec == 12.345

    def test_extended_fields_missing_data(self):
        """Test extended fields with missing/incomplete data"""
        final_data = {
            'informasi_pelanggan': {
                'nama_pelanggan': 'SMK Test'
                # Missing perwakilan, kontak_person, alamat
            },
            # Missing kontak_person_telkom, tata_cara_pembayaran, timestamps
        }

        result = compute_denorm_fields(final_data)

        # Should handle missing data gracefully
        assert result.customer_address is None
        assert result.rep_name is None
        assert result.customer_contact_email is None
        assert result.telkom_contact_name is None
        assert result.payment_description is None
        assert result.termin_total_count == 0
        assert result.termin_total_amount == Decimal('0.00')
        assert result.termin_payments_json == []  # Empty list when missing (default from _safe_get)
        assert result.extraction_timestamp is None
        assert result.contract_processing_time_sec is None

    def test_termin_payments_json_non_list(self):
        """Test termin_payments_json when input is not a list"""
        final_data = {
            'tata_cara_pembayaran': {
                'method_type': 'termin',
                'termin_payments': 'not-a-list'  # Invalid type
            }
        }

        result = compute_denorm_fields(final_data)

        assert result.termin_payments_json is None
        assert result.termin_total_count == 0
        assert result.termin_total_amount == Decimal('0.00')


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
