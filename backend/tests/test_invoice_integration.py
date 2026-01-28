"""
Integration tests for Invoice Auto-Population on Contract Creation

Tests the automatic population of invoice management fields (invoice_number,
invoice_status, due_date) when term and recurring payments are created
during contract confirmation.

Phase 2.5: Invoice Field Auto-Population
"""

import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from unittest.mock import Mock, MagicMock, patch

from app.services.invoice_service import calculate_due_date, generate_invoice_number
from app.services.termin_sync import (
    sync_contract_terms_from_final_data,
    parse_indonesian_period,
)
from app.services.recurring_sync import (
    sync_contract_recurring_payments,
    iter_months_inclusive,
    format_period_label,
)
from app.models.database import (
    Contract,
    ContractTermPayment,
    ContractRecurringPayment,
    Account,
    User,
)

# Patch paths for mocking - these are imported inside functions
PATCH_TERMIN_STATUS = 'app.services.termin_status.update_termin_statuses'
PATCH_RECURRING_STATUS = 'app.services.termin_status.update_recurring_statuses'


# =============================================================================
# Test: calculate_due_date Helper Function
# =============================================================================

class TestCalculateDueDate:
    """Test calculate_due_date helper function"""

    def test_due_date_is_last_day_of_month(self):
        """Due date should be last day of the billing month"""
        result = calculate_due_date(2025, 3)
        assert result.day == 31  # March has 31 days
        assert result.month == 3
        assert result.year == 2025
        assert result.hour == 23
        assert result.minute == 59
        assert result.second == 59

    def test_due_date_has_utc_timezone(self):
        """Due date should have UTC timezone"""
        result = calculate_due_date(2025, 6)
        assert result.tzinfo == timezone.utc

    def test_due_date_january(self):
        """Test due date for January (31 days)"""
        result = calculate_due_date(2025, 1)
        assert result == datetime(2025, 1, 31, 23, 59, 59, tzinfo=timezone.utc)

    def test_due_date_december(self):
        """Test due date for December (31 days)"""
        result = calculate_due_date(2025, 12)
        assert result == datetime(2025, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

    def test_due_date_february_leap_year(self):
        """Test due date for February in leap year (29 days)"""
        result = calculate_due_date(2024, 2)  # 2024 is leap year
        assert result.day == 29
        assert result.month == 2
        assert result.year == 2024

    def test_due_date_february_non_leap_year(self):
        """Test due date for February in non-leap year (28 days)"""
        result = calculate_due_date(2025, 2)  # 2025 is not a leap year
        assert result.day == 28
        assert result.month == 2
        assert result.year == 2025

    def test_due_date_february_non_leap_year(self):
        """Test due date for February in non-leap year"""
        result = calculate_due_date(2025, 2)  # 2025 is not leap year
        assert result.day == 15
        assert result.month == 2
        assert result.year == 2025

    def test_due_date_time_is_midnight(self):
        """Due date time component should be midnight"""
        result = calculate_due_date(2025, 7)
        assert result.hour == 0
        assert result.minute == 0
        assert result.second == 0
        assert result.microsecond == 0


# =============================================================================
# Test: parse_indonesian_period Helper
# =============================================================================

class TestParseIndonesianPeriod:
    """Test Indonesian period parsing for termin sync"""

    def test_parse_maret_2025(self):
        """Parse 'Maret 2025' correctly"""
        year, month = parse_indonesian_period("Maret 2025")
        assert year == 2025
        assert month == 3

    def test_parse_januari_2026(self):
        """Parse 'Januari 2026' correctly"""
        year, month = parse_indonesian_period("Januari 2026")
        assert year == 2026
        assert month == 1

    def test_parse_desember_2025(self):
        """Parse 'Desember 2025' correctly"""
        year, month = parse_indonesian_period("Desember 2025")
        assert year == 2025
        assert month == 12

    def test_parse_lowercase(self):
        """Parse lowercase period string"""
        year, month = parse_indonesian_period("juni 2025")
        assert year == 2025
        assert month == 6

    def test_parse_uppercase(self):
        """Parse uppercase period string"""
        year, month = parse_indonesian_period("APRIL 2025")
        assert year == 2025
        assert month == 4

    def test_parse_no_space_format(self):
        """Parse period without space (MonthYYYY)"""
        year, month = parse_indonesian_period("Maret2025")
        assert year == 2025
        assert month == 3

    def test_parse_invalid_month_returns_none(self):
        """Invalid month name returns (None, None)"""
        year, month = parse_indonesian_period("InvalidMonth 2025")
        assert year is None
        assert month is None

    def test_parse_invalid_format_returns_none(self):
        """Invalid format returns (None, None)"""
        year, month = parse_indonesian_period("2025-03")
        assert year is None
        assert month is None


# =============================================================================
# Test: iter_months_inclusive Helper
# =============================================================================

class TestIterMonthsInclusive:
    """Test month iteration for recurring payment schedule generation"""

    def test_full_year_starting_first(self):
        """12 months from Jan 1 to Dec 31"""
        months = iter_months_inclusive(date(2025, 1, 1), date(2025, 12, 31))
        assert len(months) == 12
        assert months[0] == (2025, 1, 1)
        assert months[-1] == (2025, 12, 12)

    def test_partial_first_month_skipped(self):
        """Contract starting mid-month skips partial first month"""
        months = iter_months_inclusive(date(2024, 12, 6), date(2025, 12, 5))
        # Should start from January 2025 (December 2024 is partial)
        assert months[0] == (2025, 1, 1)
        assert len(months) == 12

    def test_start_on_first_includes_month(self):
        """Contract starting on 1st includes that month"""
        months = iter_months_inclusive(date(2025, 3, 1), date(2025, 6, 30))
        assert len(months) == 4
        assert months[0] == (2025, 3, 1)
        assert months[-1] == (2025, 6, 4)

    def test_cross_year_boundary(self):
        """Months spanning year boundary"""
        months = iter_months_inclusive(date(2024, 11, 1), date(2025, 2, 28))
        assert (2024, 11, 1) in months
        assert (2024, 12, 2) in months
        assert (2025, 1, 3) in months
        assert (2025, 2, 4) in months

    def test_empty_when_start_after_end(self):
        """Empty list when start > end"""
        months = iter_months_inclusive(date(2025, 6, 1), date(2025, 3, 1))
        assert months == []


# =============================================================================
# Test: format_period_label Helper
# =============================================================================

class TestFormatPeriodLabel:
    """Test period label formatting for recurring payments"""

    def test_format_januari(self):
        """Format January correctly"""
        assert format_period_label(2025, 1) == "Januari 2025"

    def test_format_desember(self):
        """Format December correctly"""
        assert format_period_label(2025, 12) == "Desember 2025"

    def test_format_all_months(self):
        """All 12 months format correctly"""
        expected = [
            "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ]
        for month_num, month_name in enumerate(expected, start=1):
            result = format_period_label(2025, month_num)
            assert result == f"{month_name} 2025"


# =============================================================================
# Test: Termin Payment Invoice Field Population
# =============================================================================

class TestTerminSyncInvoiceFields:
    """Test invoice field population during termin payment creation"""

    def _create_mock_db(self):
        """Create mock database session"""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        db.query.return_value.filter.return_value.first.return_value = None
        return db

    def _create_mock_contract(self, account_id=None, final_data=None):
        """Create mock contract with termin payment data"""
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = account_id
        contract.final_data = final_data or {
            "tata_cara_pembayaran": {
                "method_type": "termin",
                "termin_payments": [
                    {"termin_number": 1, "period": "Maret 2025", "amount": 5000000},
                    {"termin_number": 2, "period": "Juni 2025", "amount": 5000000},
                ]
            }
        }
        return contract

    def _create_mock_account(self, account_number="4997096"):
        """Create mock account"""
        account = Mock(spec=Account)
        account.id = 1
        account.account_number = account_number
        return account

    def _create_mock_user(self):
        """Create mock user"""
        user = Mock(spec=User)
        user.id = 1
        return user

    def test_invoice_fields_populated_on_create_with_account(self):
        """Invoice fields should be populated when creating term with account"""
        db = self._create_mock_db()
        account = self._create_mock_account()
        contract = self._create_mock_contract(account_id=account.id)
        user = self._create_mock_user()

        # Mock account query to return our account
        db.query.return_value.filter.return_value.first.return_value = account

        # Mock generate_invoice_number to return predictable value
        with patch('app.services.termin_sync.generate_invoice_number') as mock_gen_invoice:
            mock_gen_invoice.return_value = "4997096-000001-202503"

            # Patch update_termin_statuses to avoid side effects
            with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
                sync_contract_terms_from_final_data(db, contract, user)

        # Verify db.add was called for new term payments
        assert db.add.call_count == 2

        # Get the created term payments
        added_terms = [call[0][0] for call in db.add.call_args_list]

        # Verify invoice fields for first term
        term1 = added_terms[0]
        assert term1.invoice_status == "DRAFT"
        assert term1.due_date == datetime(2025, 3, 31, 23, 59, 59, tzinfo=timezone.utc)

        # Verify invoice fields for second term
        term2 = added_terms[1]
        assert term2.invoice_status == "DRAFT"
        assert term2.due_date == datetime(2025, 6, 30, 23, 59, 59, tzinfo=timezone.utc)

    def test_invoice_number_none_without_account(self):
        """Invoice number should be None when contract has no account"""
        db = self._create_mock_db()
        contract = self._create_mock_contract(account_id=None)
        user = self._create_mock_user()

        # Patch update_termin_statuses to avoid side effects
        with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_terms_from_final_data(db, contract, user)

        # Verify db.add was called
        assert db.add.call_count == 2

        # Get the created term payments
        added_terms = [call[0][0] for call in db.add.call_args_list]

        # Verify invoice_number is None (no account)
        for term in added_terms:
            assert term.invoice_number is None
            # But other invoice fields should still be populated
            assert term.invoice_status == "DRAFT"
            assert term.due_date is not None

    def test_invoice_number_none_when_account_not_found(self):
        """Invoice number should be None when account_id exists but account not found"""
        db = self._create_mock_db()
        contract = self._create_mock_contract(account_id=999)
        user = self._create_mock_user()

        # Mock account query to return None (account not found)
        db.query.return_value.filter.return_value.first.return_value = None

        # Patch update_termin_statuses to avoid side effects
        with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_terms_from_final_data(db, contract, user)

        # Verify invoice_number is None
        added_terms = [call[0][0] for call in db.add.call_args_list]
        for term in added_terms:
            assert term.invoice_number is None

    def test_invoice_generation_failure_continues_gracefully(self):
        """Invoice number generation failure should not stop term creation"""
        db = self._create_mock_db()
        account = self._create_mock_account()
        contract = self._create_mock_contract(account_id=account.id)
        user = self._create_mock_user()

        # Mock account query
        db.query.return_value.filter.return_value.first.return_value = account

        # Mock generate_invoice_number to raise exception
        with patch('app.services.termin_sync.generate_invoice_number') as mock_gen:
            mock_gen.side_effect = Exception("Database error")

            # Patch update_termin_statuses to avoid side effects
            with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
                # Should not raise
                sync_contract_terms_from_final_data(db, contract, user)

        # Terms should still be created
        assert db.add.call_count == 2

        # Invoice number should be None due to error
        added_terms = [call[0][0] for call in db.add.call_args_list]
        for term in added_terms:
            assert term.invoice_number is None
            # Other fields should still be set
            assert term.invoice_status == "DRAFT"
            assert term.due_date is not None

    def test_update_does_not_change_invoice_fields(self):
        """UPDATE path should not modify invoice fields"""
        db = self._create_mock_db()
        contract = self._create_mock_contract(account_id=1)
        user = self._create_mock_user()

        # Create existing term with invoice fields already set
        existing_term = Mock(spec=ContractTermPayment)
        existing_term.termin_number = 1
        existing_term.invoice_number = "4997096-000001-202503"
        existing_term.invoice_status = "SENT"  # Already sent
        existing_term.due_date = datetime(2025, 3, 31, 23, 59, 59, tzinfo=timezone.utc)

        # Mock to return existing term
        db.query.return_value.filter.return_value.all.return_value = [existing_term]

        # Patch update_termin_statuses to avoid side effects
        with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_terms_from_final_data(db, contract, user)

        # Verify invoice fields were NOT modified
        # The UPDATE block only updates: amount, period_label, period_year, period_month, updated_by_id
        # Invoice fields should be preserved
        assert existing_term.invoice_number == "4997096-000001-202503"
        assert existing_term.invoice_status == "SENT"


# =============================================================================
# Test: Recurring Payment Invoice Field Population
# =============================================================================

class TestRecurringSyncInvoiceFields:
    """Test invoice field population during recurring payment creation"""

    def _create_mock_db(self):
        """Create mock database session"""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        db.query.return_value.filter.return_value.first.return_value = None
        return db

    def _create_mock_recurring_contract(self, account_id=None):
        """Create mock contract for recurring payments"""
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = account_id
        contract.payment_method = "recurring"
        contract.recurring_monthly_amount = Decimal("5000000.00")
        contract.period_start = date(2025, 1, 1)
        contract.period_end = date(2025, 3, 31)  # 3 months
        return contract

    def _create_mock_account(self, account_number="4997096"):
        """Create mock account"""
        account = Mock(spec=Account)
        account.id = 1
        account.account_number = account_number
        return account

    def _create_mock_user(self):
        """Create mock user"""
        user = Mock(spec=User)
        user.id = 1
        return user

    def test_invoice_fields_populated_on_create_with_account(self):
        """Invoice fields should be populated when creating recurring payment with account"""
        db = self._create_mock_db()
        account = self._create_mock_account()
        contract = self._create_mock_recurring_contract(account_id=account.id)
        user = self._create_mock_user()

        # Mock account query
        db.query.return_value.filter.return_value.first.return_value = account

        # Mock generate_invoice_number
        with patch('app.services.recurring_sync.generate_invoice_number') as mock_gen:
            mock_gen.side_effect = lambda db, acc, y, m: f"4997096-000001-{y}{m:02d}"

            # Patch update_recurring_statuses to avoid side effects
            with patch(PATCH_RECURRING_STATUS, return_value={'updated': 0, 'details': []}):
                sync_contract_recurring_payments(db, contract, user)

        # Verify db.add was called for 3 months (Jan, Feb, Mar 2025)
        assert db.add.call_count == 3

        # Get the created recurring payments
        added_payments = [call[0][0] for call in db.add.call_args_list]

        # Verify invoice fields
        for i, payment in enumerate(added_payments):
            assert payment.invoice_status == "DRAFT"
            assert payment.due_date is not None
            # Due date should be last day of billing month
            expected_days = [31, 28, 31]  # Jan (31), Feb (28), Mar (31) for non-leap year
            assert payment.due_date.day == expected_days[i]
            assert payment.due_date.hour == 23
            assert payment.due_date.minute == 59
            assert payment.due_date.second == 59

    def test_invoice_number_none_without_account(self):
        """Invoice number should be None when contract has no account"""
        db = self._create_mock_db()
        contract = self._create_mock_recurring_contract(account_id=None)
        user = self._create_mock_user()

        # Patch update_recurring_statuses to avoid side effects
        with patch(PATCH_RECURRING_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_recurring_payments(db, contract, user)

        # Verify db.add was called
        assert db.add.call_count == 3

        # Get the created recurring payments
        added_payments = [call[0][0] for call in db.add.call_args_list]

        # Verify invoice_number is None (no account)
        for payment in added_payments:
            assert payment.invoice_number is None
            # But other invoice fields should still be populated
            assert payment.invoice_status == "DRAFT"
            assert payment.due_date is not None

    def test_due_date_correct_for_each_billing_month(self):
        """Due date should be last day of each billing month"""
        db = self._create_mock_db()
        contract = self._create_mock_recurring_contract(account_id=None)
        user = self._create_mock_user()

        # Patch update_recurring_statuses to avoid side effects
        with patch(PATCH_RECURRING_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_recurring_payments(db, contract, user)

        # Get the created recurring payments
        added_payments = [call[0][0] for call in db.add.call_args_list]

        # Expected due dates
        expected_due_dates = [
            datetime(2025, 1, 15, 0, 0, 0, tzinfo=timezone.utc),
            datetime(2025, 2, 15, 0, 0, 0, tzinfo=timezone.utc),
            datetime(2025, 3, 15, 0, 0, 0, tzinfo=timezone.utc),
        ]

        for payment, expected_due_date in zip(added_payments, expected_due_dates):
            assert payment.due_date == expected_due_date

    def test_invoice_generation_failure_continues_gracefully(self):
        """Invoice number generation failure should not stop payment creation"""
        db = self._create_mock_db()
        account = self._create_mock_account()
        contract = self._create_mock_recurring_contract(account_id=account.id)
        user = self._create_mock_user()

        # Mock account query
        db.query.return_value.filter.return_value.first.return_value = account

        # Mock generate_invoice_number to raise exception
        with patch('app.services.recurring_sync.generate_invoice_number') as mock_gen:
            mock_gen.side_effect = Exception("Database error")

            # Patch update_recurring_statuses to avoid side effects
            with patch(PATCH_RECURRING_STATUS, return_value={'updated': 0, 'details': []}):
                # Should not raise
                sync_contract_recurring_payments(db, contract, user)

        # Payments should still be created
        assert db.add.call_count == 3

        # Invoice number should be None due to error
        added_payments = [call[0][0] for call in db.add.call_args_list]
        for payment in added_payments:
            assert payment.invoice_number is None
            # Other fields should still be set
            assert payment.invoice_status == "DRAFT"
            assert payment.due_date is not None

    def test_update_does_not_change_invoice_fields(self):
        """UPDATE path should not modify invoice fields"""
        db = self._create_mock_db()
        contract = self._create_mock_recurring_contract(account_id=1)
        user = self._create_mock_user()

        # Create existing payment with invoice fields already set
        existing_payment = Mock(spec=ContractRecurringPayment)
        existing_payment.period_year = 2025
        existing_payment.period_month = 1
        existing_payment.invoice_number = "4997096-000001-202501"
        existing_payment.invoice_status = "SENT"  # Already sent
        existing_payment.due_date = datetime(2025, 1, 31, 23, 59, 59, tzinfo=timezone.utc)

        # Mock to return existing payment
        db.query.return_value.filter.return_value.all.return_value = [existing_payment]

        # Patch update_recurring_statuses to avoid side effects
        with patch(PATCH_RECURRING_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_recurring_payments(db, contract, user)

        # Verify invoice fields were NOT modified (UPDATE path)
        assert existing_payment.invoice_number == "4997096-000001-202501"
        assert existing_payment.invoice_status == "SENT"


# =============================================================================
# Test: Invoice Number Format Validation
# =============================================================================

class TestInvoiceNumberFormat:
    """Test invoice number format (AAAAAAA-NNNNNN-YYYYMM)"""

    def test_invoice_number_format_regex(self):
        """Invoice number should match expected format"""
        import re

        # Format: AAAAAAA-NNNNNN-YYYYMM
        # AAAAAAA = 7 digit account number
        # NNNNNN = 6 digit sequence number
        # YYYYMM = year and month
        pattern = r'^\d{7}-\d{6}-\d{6}$'

        valid_examples = [
            "4997096-000001-202503",
            "1234567-000012-202512",
            "9999999-999999-203001",
        ]

        for invoice_num in valid_examples:
            assert re.match(pattern, invoice_num), f"{invoice_num} should match format"

    def test_invoice_number_components(self):
        """Invoice number components should be extractable"""
        invoice_number = "4997096-000001-202503"
        parts = invoice_number.split("-")

        assert len(parts) == 3
        assert parts[0] == "4997096"  # Account number
        assert parts[1] == "000001"  # Sequence
        assert parts[2] == "202503"  # Year-month (March 2025)


# =============================================================================
# Test: Non-Termin/Non-Recurring Payment Methods
# =============================================================================

class TestNonTerminPaymentMethod:
    """Test that non-termin payment methods clear term payments"""

    def _create_mock_db(self):
        """Create mock database session"""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        db.query.return_value.filter.return_value.delete.return_value = 0
        return db

    def test_recurring_method_clears_termin_payments(self):
        """Contract with recurring method should not have termin payments"""
        db = self._create_mock_db()
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = None
        contract.final_data = {
            "tata_cara_pembayaran": {
                "method_type": "recurring",  # Not termin
            }
        }

        # Patch update_termin_statuses to avoid side effects
        with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_terms_from_final_data(db, contract, None)

        # Verify delete was called (existing terms cleared)
        db.query.return_value.filter.return_value.delete.assert_called()

        # No new terms should be added
        assert db.add.call_count == 0


class TestNonRecurringPaymentMethod:
    """Test that non-recurring payment methods clear recurring payments"""

    def _create_mock_db(self):
        """Create mock database session"""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        db.query.return_value.filter.return_value.delete.return_value = 0
        return db

    def test_termin_method_clears_recurring_payments(self):
        """Contract with termin method should not have recurring payments"""
        db = self._create_mock_db()
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = None
        contract.payment_method = "termin"  # Not recurring
        contract.recurring_monthly_amount = Decimal("0")

        sync_contract_recurring_payments(db, contract, None)

        # Verify delete was called (existing recurring payments cleared)
        db.query.return_value.filter.return_value.delete.assert_called()

        # No new payments should be added
        assert db.add.call_count == 0


# =============================================================================
# Test: Edge Cases
# =============================================================================

class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_contract_without_id_raises_error(self):
        """Sync should raise ValueError if contract.id is None"""
        db = MagicMock()
        contract = Mock(spec=Contract)
        contract.id = None

        with pytest.raises(ValueError) as exc_info:
            sync_contract_terms_from_final_data(db, contract, None)
        assert "Contract must have an ID" in str(exc_info.value)

        with pytest.raises(ValueError) as exc_info:
            sync_contract_recurring_payments(db, contract, None)
        assert "Contract must have an ID" in str(exc_info.value)

    def test_missing_final_data_clears_terms(self):
        """Contract with no final_data should clear existing terms"""
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = 0
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = None
        contract.final_data = None

        sync_contract_terms_from_final_data(db, contract, None)

        # Delete should be called
        db.query.return_value.filter.return_value.delete.assert_called()

    def test_empty_termin_payments_array(self):
        """Empty termin_payments array should clear existing terms"""
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = 0
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = None
        contract.final_data = {
            "tata_cara_pembayaran": {
                "method_type": "termin",
                "termin_payments": []  # Empty array
            }
        }

        sync_contract_terms_from_final_data(db, contract, None)

        # Delete should be called
        db.query.return_value.filter.return_value.delete.assert_called()
        # No adds
        assert db.add.call_count == 0

    def test_invalid_period_format_skipped(self):
        """Terms with invalid period format should be skipped"""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = None
        contract.final_data = {
            "tata_cara_pembayaran": {
                "method_type": "termin",
                "termin_payments": [
                    {"termin_number": 1, "period": "Invalid Format", "amount": 5000000},
                    {"termin_number": 2, "period": "Maret 2025", "amount": 5000000},
                ]
            }
        }

        # Patch update_termin_statuses to avoid side effects
        with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_terms_from_final_data(db, contract, None)

        # Only 1 term should be added (the valid one)
        assert db.add.call_count == 1

        # Verify it's the Maret 2025 one
        added_term = db.add.call_args_list[0][0][0]
        assert added_term.termin_number == 2
        assert added_term.period_label == "Maret 2025"


# =============================================================================
# Test: Audit Fields
# =============================================================================

class TestAuditFields:
    """Test audit field population (created_by_id, updated_by_id)"""

    def test_created_by_id_set_with_user(self):
        """created_by_id should be set when user is provided"""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = None
        contract.final_data = {
            "tata_cara_pembayaran": {
                "method_type": "termin",
                "termin_payments": [
                    {"termin_number": 1, "period": "Maret 2025", "amount": 5000000},
                ]
            }
        }
        user = Mock(spec=User)
        user.id = 42

        # Patch update_termin_statuses to avoid side effects
        with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_terms_from_final_data(db, contract, user)

        added_term = db.add.call_args_list[0][0][0]
        assert added_term.created_by_id == 42
        assert added_term.updated_by_id == 42

    def test_created_by_id_none_without_user(self):
        """created_by_id should be None when user is not provided"""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        contract = Mock(spec=Contract)
        contract.id = 1
        contract.account_id = None
        contract.final_data = {
            "tata_cara_pembayaran": {
                "method_type": "termin",
                "termin_payments": [
                    {"termin_number": 1, "period": "Maret 2025", "amount": 5000000},
                ]
            }
        }

        # Patch update_termin_statuses to avoid side effects
        with patch(PATCH_TERMIN_STATUS, return_value={'updated': 0, 'details': []}):
            sync_contract_terms_from_final_data(db, contract, None)

        added_term = db.add.call_args_list[0][0][0]
        assert added_term.created_by_id is None
        assert added_term.updated_by_id is None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
