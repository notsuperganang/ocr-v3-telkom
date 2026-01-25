"""
Unit tests for invoice_service
Tests business logic for invoice operations, payments, and document handling
"""

import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from unittest.mock import Mock, MagicMock, patch, AsyncMock
from io import BytesIO

from app.services.invoice_service import (
    _get_invoice_model,
    _get_invoice_type_db_value,
    _parse_decimal_amount,
    _validate_payment_amount,
    _get_invoice_by_id,
    add_payment,
    send_invoice,
    get_invoice_documents,
)
from app.models.database import (
    ContractTermPayment,
    ContractRecurringPayment,
    PaymentTransaction,
    InvoiceDocument,
)


class TestGetInvoiceModel:
    """Test _get_invoice_model helper function"""

    def test_get_invoice_model_term(self):
        assert _get_invoice_model("term") == ContractTermPayment
        assert _get_invoice_model("TERM") == ContractTermPayment
        assert _get_invoice_model("Term") == ContractTermPayment

    def test_get_invoice_model_recurring(self):
        assert _get_invoice_model("recurring") == ContractRecurringPayment
        assert _get_invoice_model("RECURRING") == ContractRecurringPayment
        assert _get_invoice_model("Recurring") == ContractRecurringPayment

    def test_get_invoice_model_invalid(self):
        with pytest.raises(ValueError) as exc_info:
            _get_invoice_model("invalid")
        assert "Invalid invoice_type" in str(exc_info.value)

    def test_get_invoice_model_empty(self):
        with pytest.raises(ValueError):
            _get_invoice_model("")


class TestGetInvoiceTypeDbValue:
    """Test _get_invoice_type_db_value helper function"""

    def test_convert_term_to_uppercase(self):
        assert _get_invoice_type_db_value("term") == "TERM"

    def test_convert_recurring_to_uppercase(self):
        assert _get_invoice_type_db_value("recurring") == "RECURRING"

    def test_already_uppercase(self):
        assert _get_invoice_type_db_value("TERM") == "TERM"


class TestParseDecimalAmount:
    """Test _parse_decimal_amount helper function"""

    def test_parse_decimal_from_int(self):
        assert _parse_decimal_amount(100) == Decimal('100')

    def test_parse_decimal_from_float(self):
        assert _parse_decimal_amount(100.50) == Decimal('100.50')

    def test_parse_decimal_from_string(self):
        assert _parse_decimal_amount('1000.75') == Decimal('1000.75')

    def test_parse_decimal_with_separators(self):
        assert _parse_decimal_amount('1,000.50') == Decimal('1000.50')

    def test_parse_decimal_none(self):
        assert _parse_decimal_amount(None) == Decimal('0.00')

    def test_parse_decimal_empty_string(self):
        assert _parse_decimal_amount('') == Decimal('0.00')

    def test_parse_decimal_invalid_string(self):
        assert _parse_decimal_amount('not-a-number') == Decimal('0.00')

    def test_parse_decimal_already_decimal(self):
        value = Decimal('123.45')
        assert _parse_decimal_amount(value) == Decimal('123.45')


class TestValidatePaymentAmount:
    """Test _validate_payment_amount validation logic"""

    def test_valid_partial_payment(self):
        """Test valid partial payment"""
        invoice = Mock()
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('0.00')

        # Should not raise
        _validate_payment_amount(invoice, Decimal('500.00'))

    def test_valid_full_payment(self):
        """Test valid full payment"""
        invoice = Mock()
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('0.00')

        # Should not raise
        _validate_payment_amount(invoice, Decimal('1000.00'))

    def test_valid_remaining_payment(self):
        """Test paying remaining balance"""
        invoice = Mock()
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('600.00')

        # Should not raise - paying remaining 400
        _validate_payment_amount(invoice, Decimal('400.00'))

    def test_payment_exceeds_remaining(self):
        """Test payment exceeding remaining net payable"""
        invoice = Mock()
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('800.00')

        with pytest.raises(ValueError) as exc_info:
            _validate_payment_amount(invoice, Decimal('300.00'))
        assert "exceeds remaining net payable" in str(exc_info.value).lower()

    def test_negative_payment(self):
        """Test negative payment amount"""
        invoice = Mock()
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('0.00')

        with pytest.raises(ValueError) as exc_info:
            _validate_payment_amount(invoice, Decimal('-100.00'))
        assert "greater than 0" in str(exc_info.value).lower()

    def test_zero_payment(self):
        """Test zero payment amount"""
        invoice = Mock()
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('0.00')

        with pytest.raises(ValueError) as exc_info:
            _validate_payment_amount(invoice, Decimal('0.00'))
        assert "greater than 0" in str(exc_info.value).lower()

    def test_payment_validation_uses_net_payable_not_amount(self):
        """
        CRITICAL: Verify payment validation uses net_payable_amount not amount.
        This is critical because PPh 23 is withheld.
        """
        invoice = Mock()
        # amount = total invoice (including PPN)
        invoice.amount = Decimal('1000.00')
        # net_payable = what customer actually pays (amount - PPh 23)
        invoice.net_payable_amount = Decimal('980.00')  # 2% withheld
        invoice.paid_amount = Decimal('0.00')

        # Payment of 980 should be valid (equals net_payable)
        _validate_payment_amount(invoice, Decimal('980.00'))

        # Payment of 1000 should fail (exceeds net_payable)
        with pytest.raises(ValueError):
            _validate_payment_amount(invoice, Decimal('1000.00'))


class TestAddPayment:
    """Test add_payment service function"""

    def test_add_payment_success(self):
        """Test successful payment addition"""
        # Setup mocks
        db = Mock()
        invoice = Mock()
        invoice.id = 1
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('0.00')
        invoice.ppn_paid = False
        invoice.pph23_paid = False

        user = Mock()
        user.id = 1

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=invoice):
            payment_data = {
                'payment_date': date(2026, 1, 15),
                'amount': Decimal('500.00'),
                'payment_method': 'TRANSFER',
                'reference_number': 'TRF123',
                'ppn_included': False,
                'pph23_included': False,
                'notes': 'Partial payment',
            }

            payment = add_payment(db, 'term', 1, payment_data, user)

            # Verify payment was added to session
            db.add.assert_called_once()

            # Verify invoice paid_amount was updated
            assert invoice.paid_amount == Decimal('500.00')

    def test_add_payment_updates_tax_flags(self):
        """Test that payment with tax flags updates invoice"""
        db = Mock()
        invoice = Mock()
        invoice.id = 1
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('0.00')
        invoice.ppn_paid = False
        invoice.pph23_paid = False

        user = Mock()
        user.id = 1

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=invoice):
            payment_data = {
                'payment_date': date(2026, 1, 15),
                'amount': Decimal('500.00'),
                'ppn_included': True,
                'pph23_included': True,
            }

            add_payment(db, 'term', 1, payment_data, user)

            # Verify tax flags were updated
            assert invoice.ppn_paid == True
            assert invoice.pph23_paid == True

    def test_add_payment_invoice_not_found(self):
        """Test payment to non-existent invoice"""
        db = Mock()
        user = Mock()

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=None):
            payment_data = {
                'payment_date': date(2026, 1, 15),
                'amount': Decimal('500.00'),
            }

            with pytest.raises(ValueError) as exc_info:
                add_payment(db, 'term', 999, payment_data, user)
            assert "not found" in str(exc_info.value).lower()

    def test_add_payment_exceeds_limit(self):
        """Test payment exceeding net_payable_amount"""
        db = Mock()
        invoice = Mock()
        invoice.id = 1
        invoice.net_payable_amount = Decimal('1000.00')
        invoice.paid_amount = Decimal('800.00')

        user = Mock()

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=invoice):
            payment_data = {
                'payment_date': date(2026, 1, 15),
                'amount': Decimal('500.00'),  # Only 200 remaining
            }

            with pytest.raises(ValueError) as exc_info:
                add_payment(db, 'term', 1, payment_data, user)
            assert "exceeds" in str(exc_info.value).lower()


class TestSendInvoice:
    """Test send_invoice service function"""

    def test_send_invoice_success(self):
        """Test successful invoice send"""
        db = Mock()
        invoice = Mock()
        invoice.id = 1
        invoice.invoice_status = 'DRAFT'
        invoice.sent_date = None

        user = Mock()
        user.id = 1

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=invoice):
            send_invoice(db, 'term', 1, user)

            # Verify status was updated
            assert invoice.invoice_status == 'SENT'
            assert invoice.sent_date is not None
            assert invoice.updated_by_id == 1

    def test_send_invoice_not_draft(self):
        """Test sending non-DRAFT invoice fails"""
        db = Mock()
        invoice = Mock()
        invoice.id = 1
        invoice.invoice_status = 'SENT'  # Already sent

        user = Mock()

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=invoice):
            with pytest.raises(ValueError) as exc_info:
                send_invoice(db, 'term', 1, user)
            assert "cannot be sent" in str(exc_info.value).lower()

    def test_send_invoice_not_found(self):
        """Test sending non-existent invoice"""
        db = Mock()
        user = Mock()

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=None):
            with pytest.raises(ValueError) as exc_info:
                send_invoice(db, 'term', 999, user)
            assert "not found" in str(exc_info.value).lower()


class TestGetInvoiceDocuments:
    """Test get_invoice_documents service function"""

    def test_get_documents_success(self):
        """Test fetching invoice documents"""
        db = Mock()

        # Mock invoice
        invoice = Mock()
        invoice.id = 1

        # Mock documents
        doc1 = Mock()
        doc1.id = 1
        doc1.document_type = 'BUKTI_BAYAR'
        doc1.file_name = 'test1.pdf'
        doc1.file_path = '/storage/invoices/term/1/test1.pdf'
        doc1.file_size = 1024
        doc1.mime_type = 'application/pdf'
        doc1.payment_transaction_id = None
        doc1.uploaded_by_id = 1
        doc1.uploaded_at = datetime.now(timezone.utc)
        doc1.notes = None

        doc2 = Mock()
        doc2.id = 2
        doc2.document_type = 'BUPOT_PPH23'
        doc2.file_name = 'bupot.pdf'
        doc2.file_path = '/storage/invoices/term/1/bupot.pdf'
        doc2.file_size = 2048
        doc2.mime_type = 'application/pdf'
        doc2.payment_transaction_id = None
        doc2.uploaded_by_id = 1
        doc2.uploaded_at = datetime.now(timezone.utc)
        doc2.notes = 'BUPOT document'

        # Setup query mock
        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.order_by.return_value = query_mock
        query_mock.all.return_value = [doc1, doc2]

        db.query.return_value = query_mock

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=invoice):
            documents = get_invoice_documents(db, 'term', 1)

            assert len(documents) == 2
            assert documents[0]['document_type'] == 'BUKTI_BAYAR'
            assert documents[1]['document_type'] == 'BUPOT_PPH23'

    def test_get_documents_with_filter(self):
        """Test fetching documents with type filter"""
        db = Mock()
        invoice = Mock()
        invoice.id = 1

        doc = Mock()
        doc.id = 1
        doc.document_type = 'BUKTI_BAYAR'
        doc.file_name = 'test.pdf'
        doc.file_path = '/storage/test.pdf'
        doc.file_size = 1024
        doc.mime_type = 'application/pdf'
        doc.payment_transaction_id = None
        doc.uploaded_by_id = 1
        doc.uploaded_at = datetime.now(timezone.utc)
        doc.notes = None

        query_mock = Mock()
        query_mock.filter.return_value = query_mock
        query_mock.order_by.return_value = query_mock
        query_mock.all.return_value = [doc]

        db.query.return_value = query_mock

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=invoice):
            documents = get_invoice_documents(db, 'term', 1, document_type='BUKTI_BAYAR')

            assert len(documents) == 1
            # Verify filter was called twice (once for invoice_id, once for document_type)
            assert query_mock.filter.call_count == 2

    def test_get_documents_invoice_not_found(self):
        """Test fetching documents for non-existent invoice"""
        db = Mock()

        with patch('app.services.invoice_service._get_invoice_by_id', return_value=None):
            with pytest.raises(ValueError) as exc_info:
                get_invoice_documents(db, 'term', 999)
            assert "not found" in str(exc_info.value).lower()


class TestFileValidation:
    """Test file validation constants and logic"""

    def test_allowed_mime_types(self):
        """Verify allowed MIME types"""
        from app.services.invoice_service import ALLOWED_MIME_TYPES

        assert 'application/pdf' in ALLOWED_MIME_TYPES
        assert 'image/jpeg' in ALLOWED_MIME_TYPES
        assert 'image/png' in ALLOWED_MIME_TYPES
        assert 'text/plain' not in ALLOWED_MIME_TYPES

    def test_allowed_extensions(self):
        """Verify allowed file extensions"""
        from app.services.invoice_service import ALLOWED_EXTENSIONS

        assert '.pdf' in ALLOWED_EXTENSIONS
        assert '.jpg' in ALLOWED_EXTENSIONS
        assert '.jpeg' in ALLOWED_EXTENSIONS
        assert '.png' in ALLOWED_EXTENSIONS
        assert '.doc' not in ALLOWED_EXTENSIONS

    def test_max_file_size(self):
        """Verify max file size is 10MB"""
        from app.services.invoice_service import MAX_FILE_SIZE

        assert MAX_FILE_SIZE == 10 * 1024 * 1024  # 10MB


class TestDocumentTypes:
    """Test document type validation"""

    def test_valid_document_types(self):
        """Verify valid document types"""
        from app.services.invoice_service import VALID_DOCUMENT_TYPES

        assert 'BUKTI_BAYAR' in VALID_DOCUMENT_TYPES
        assert 'BUPOT_PPH23' in VALID_DOCUMENT_TYPES
        assert 'BUKTI_BAYAR_PPH' in VALID_DOCUMENT_TYPES
        assert 'BUKTI_BAYAR_PPN' in VALID_DOCUMENT_TYPES
        assert 'INVOICE_PDF' in VALID_DOCUMENT_TYPES
        assert 'FAKTUR_PAJAK' in VALID_DOCUMENT_TYPES
        assert 'OTHER' in VALID_DOCUMENT_TYPES
        assert 'INVALID_TYPE' not in VALID_DOCUMENT_TYPES


class TestPaymentMethods:
    """Test payment method constants"""

    def test_valid_payment_methods(self):
        """Verify valid payment methods"""
        from app.services.invoice_service import VALID_PAYMENT_METHODS

        assert 'TRANSFER' in VALID_PAYMENT_METHODS
        assert 'CASH' in VALID_PAYMENT_METHODS
        assert 'GIRO' in VALID_PAYMENT_METHODS
        assert 'CHECK' in VALID_PAYMENT_METHODS
        assert 'VIRTUAL_ACCOUNT' in VALID_PAYMENT_METHODS
        assert 'OTHER' in VALID_PAYMENT_METHODS


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
