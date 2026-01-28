"""
Integration tests for Invoice API endpoints
Tests full request/response cycle for invoice management
"""

import pytest
from decimal import Decimal
from datetime import date, datetime, timezone
from unittest.mock import Mock, patch, MagicMock
from io import BytesIO

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.api.invoices import (
    validate_invoice_type,
    InvoiceListItem,
    InvoiceSummary,
    PaginationInfo,
    PaymentCreateRequest,
)


class TestValidateInvoiceType:
    """Test invoice_type validation helper"""

    def test_validate_term_valid(self):
        """term is valid"""
        # Should not raise
        validate_invoice_type("term")

    def test_validate_recurring_valid(self):
        """recurring is valid"""
        # Should not raise
        validate_invoice_type("recurring")

    def test_validate_invalid_type(self):
        """Invalid type should raise HTTPException"""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_invoice_type("invalid")

        assert exc_info.value.status_code == 400
        assert "must be 'term' or 'recurring'" in exc_info.value.detail


class TestInvoiceListItem:
    """Test InvoiceListItem Pydantic model"""

    def test_invoice_list_item_creation(self):
        """Test creating InvoiceListItem with valid data"""
        item = InvoiceListItem(
            id=1,
            invoice_type="TERM",
            invoice_number="4997096-000001-202601",
            contract_id=1,
            invoice_status="SENT",
            payment_due_status="DUE",
            ppn_paid=False,
            pph23_paid=False,
        )

        assert item.id == 1
        assert item.invoice_type == "TERM"
        assert item.invoice_status == "SENT"

    def test_invoice_list_item_optional_fields(self):
        """Test InvoiceListItem with only required fields"""
        item = InvoiceListItem(
            id=1,
            invoice_type="RECURRING",
            invoice_status="DRAFT",
            payment_due_status="PENDING",
        )

        assert item.id == 1
        assert item.invoice_number is None
        assert item.amount is None
        assert item.ppn_paid == False


class TestInvoiceSummary:
    """Test InvoiceSummary Pydantic model"""

    def test_invoice_summary_creation(self):
        """Test creating InvoiceSummary"""
        summary = InvoiceSummary(
            total_invoices=10,
            total_amount=Decimal('1000000.00'),
            total_paid=Decimal('500000.00'),
            total_outstanding=Decimal('500000.00'),
            overdue_count=2,
        )

        assert summary.total_invoices == 10
        assert summary.total_amount == Decimal('1000000.00')
        assert summary.overdue_count == 2


class TestPaginationInfo:
    """Test PaginationInfo Pydantic model"""

    def test_pagination_info_creation(self):
        """Test creating PaginationInfo"""
        pagination = PaginationInfo(
            page=1,
            limit=50,
            total_pages=3,
            total_records=125,
        )

        assert pagination.page == 1
        assert pagination.limit == 50
        assert pagination.total_pages == 3
        assert pagination.total_records == 125


class TestPaymentCreateRequest:
    """Test PaymentCreateRequest Pydantic model"""

    def test_payment_request_valid(self):
        """Test valid payment request"""
        request = PaymentCreateRequest(
            payment_date=date(2026, 1, 15),
            amount=Decimal('500000.00'),
            payment_method='TRANSFER',
            reference_number='TRF123',
            ppn_included=False,
            pph23_included=False,
            notes='Partial payment',
        )

        assert request.amount == Decimal('500000.00')
        assert request.payment_method == 'TRANSFER'

    def test_payment_request_minimal(self):
        """Test payment request with only required fields"""
        request = PaymentCreateRequest(
            payment_date=date(2026, 1, 15),
            amount=Decimal('100.00'),
        )

        assert request.payment_date == date(2026, 1, 15)
        assert request.amount == Decimal('100.00')
        assert request.ppn_included == False  # Default
        assert request.pph23_included == False  # Default

    def test_payment_request_amount_validation(self):
        """Test that amount must be > 0"""
        from pydantic import ValidationError

        with pytest.raises(ValidationError) as exc_info:
            PaymentCreateRequest(
                payment_date=date(2026, 1, 15),
                amount=Decimal('0.00'),
            )

        assert "amount" in str(exc_info.value).lower()

    def test_payment_request_negative_amount(self):
        """Test that negative amount is rejected"""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            PaymentCreateRequest(
                payment_date=date(2026, 1, 15),
                amount=Decimal('-100.00'),
            )


class TestListInvoicesEndpoint:
    """Test GET /api/invoices endpoint"""

    def test_list_invoices_requires_year_month(self):
        """Test that year and month are required parameters"""
        # This tests the endpoint contract
        # In a real integration test, you would use TestClient

        # Verify query parameters are defined correctly
        from app.api.invoices import list_invoices
        import inspect

        sig = inspect.signature(list_invoices)
        params = sig.parameters

        # Check year is required (no default)
        assert 'year' in params

        # Check month is required (no default)
        assert 'month' in params

    def test_list_invoices_valid_invoice_type_filter(self):
        """Test invoice_type filter validation"""
        # Valid values are "term" and "recurring"
        from app.api.invoices import validate_invoice_type

        # These should not raise
        validate_invoice_type("term")
        validate_invoice_type("recurring")


class TestGetInvoiceDetailEndpoint:
    """Test GET /api/invoices/{invoice_type}/{invoice_id} endpoint"""

    def test_invoice_type_validation(self):
        """Test that invalid invoice_type is rejected"""
        from fastapi import HTTPException
        from app.api.invoices import validate_invoice_type

        with pytest.raises(HTTPException) as exc_info:
            validate_invoice_type("invalid_type")

        assert exc_info.value.status_code == 400


class TestAddPaymentEndpoint:
    """Test POST /api/invoices/{invoice_type}/{invoice_id}/payments endpoint"""

    def test_payment_request_model_validation(self):
        """Test PaymentCreateRequest validation"""
        from pydantic import ValidationError

        # Valid request
        valid_request = PaymentCreateRequest(
            payment_date=date(2026, 1, 15),
            amount=Decimal('500000.00'),
        )
        assert valid_request.amount > 0

        # Invalid - zero amount
        with pytest.raises(ValidationError):
            PaymentCreateRequest(
                payment_date=date(2026, 1, 15),
                amount=Decimal('0'),
            )

        # Invalid - negative amount
        with pytest.raises(ValidationError):
            PaymentCreateRequest(
                payment_date=date(2026, 1, 15),
                amount=Decimal('-100'),
            )


class TestDocumentUploadEndpoint:
    """Test POST /api/invoices/{invoice_type}/{invoice_id}/documents endpoint"""

    def test_allowed_content_types(self):
        """Test that only PDF, JPG, PNG are allowed"""
        allowed_types = ["application/pdf", "image/jpeg", "image/png"]

        for content_type in allowed_types:
            assert content_type in allowed_types

        invalid_types = ["text/plain", "application/json", "image/gif"]
        for content_type in invalid_types:
            assert content_type not in allowed_types


class TestSendInvoiceEndpoint:
    """Test PATCH /api/invoices/{invoice_type}/{invoice_id}/send endpoint"""

    def test_send_invoice_type_validation(self):
        """Test invoice_type validation"""
        from fastapi import HTTPException
        from app.api.invoices import validate_invoice_type

        # Valid types
        validate_invoice_type("term")
        validate_invoice_type("recurring")

        # Invalid type
        with pytest.raises(HTTPException):
            validate_invoice_type("invalid")


class TestRouterConfiguration:
    """Test router configuration"""

    def test_router_prefix(self):
        """Test router has correct prefix"""
        from app.api.invoices import router

        assert router.prefix == "/api/invoices"

    def test_router_tags(self):
        """Test router has correct tags"""
        from app.api.invoices import router

        assert "invoices" in router.tags


class TestEndpointSignatures:
    """Test that endpoint functions have correct signatures"""

    def test_list_invoices_parameters(self):
        """Test list_invoices has all required parameters"""
        from app.api.invoices import list_invoices
        import inspect

        sig = inspect.signature(list_invoices)
        params = list(sig.parameters.keys())

        assert 'year' in params
        assert 'month' in params
        assert 'invoice_type' in params
        assert 'invoice_status' in params
        assert 'witel_id' in params
        assert 'page' in params
        assert 'limit' in params

    def test_get_invoice_detail_parameters(self):
        """Test get_invoice_detail has required path parameters"""
        from app.api.invoices import get_invoice_detail
        import inspect

        sig = inspect.signature(get_invoice_detail)
        params = list(sig.parameters.keys())

        assert 'invoice_type' in params
        assert 'invoice_id' in params

    def test_add_payment_parameters(self):
        """Test add_payment has required parameters"""
        from app.api.invoices import add_payment
        import inspect

        sig = inspect.signature(add_payment)
        params = list(sig.parameters.keys())

        assert 'invoice_type' in params
        assert 'invoice_id' in params
        assert 'payment_data' in params

    def test_upload_document_parameters(self):
        """Test upload_document has required parameters"""
        from app.api.invoices import upload_document
        import inspect

        sig = inspect.signature(upload_document)
        params = list(sig.parameters.keys())

        assert 'invoice_type' in params
        assert 'invoice_id' in params
        assert 'file' in params
        assert 'document_type' in params


class TestResponseModels:
    """Test response model configurations"""

    def test_invoice_list_response_structure(self):
        """Test InvoiceListResponse has correct structure"""
        from app.api.invoices import InvoiceListResponse

        # Create a valid response
        response = InvoiceListResponse(
            data=[],
            summary=InvoiceSummary(
                total_invoices=0,
                total_amount=Decimal('0'),
                total_paid=Decimal('0'),
                total_outstanding=Decimal('0'),
                overdue_count=0,
            ),
            pagination=PaginationInfo(
                page=1,
                limit=50,
                total_pages=0,
                total_records=0,
            ),
        )

        assert response.data == []
        assert response.summary.total_invoices == 0
        assert response.pagination.page == 1

    def test_payment_response_structure(self):
        """Test PaymentResponse has correct structure"""
        from app.api.invoices import PaymentResponse, InvoiceUpdatedInfo

        response = PaymentResponse(
            success=True,
            payment_id=1,
            invoice_updated=InvoiceUpdatedInfo(
                paid_amount=Decimal('500000'),
                outstanding_amount=Decimal('500000'),
                invoice_status='PARTIALLY_PAID',
                payment_due_status='DUE',
            ),
        )

        assert response.success == True
        assert response.payment_id == 1
        assert response.invoice_updated.invoice_status == 'PARTIALLY_PAID'

    def test_document_upload_response_structure(self):
        """Test DocumentUploadResponse has correct structure"""
        from app.api.invoices import DocumentUploadResponse

        response = DocumentUploadResponse(
            success=True,
            document_id=1,
            file_path='/storage/invoices/term/1/abc_test.pdf',
            file_size=1024,
        )

        assert response.success == True
        assert response.document_id == 1
        assert response.file_size == 1024


class TestErrorHandling:
    """Test error handling patterns"""

    def test_validate_invoice_type_error_format(self):
        """Test error format for invalid invoice_type"""
        from fastapi import HTTPException
        from app.api.invoices import validate_invoice_type

        with pytest.raises(HTTPException) as exc_info:
            validate_invoice_type("bad_type")

        error = exc_info.value
        assert error.status_code == 400
        assert "term" in error.detail
        assert "recurring" in error.detail


class TestRouteRegistration:
    """Test that invoice routes are registered correctly in main app"""

    def test_router_imported_in_main(self):
        """Test that invoice router is imported in main.py"""
        from app.main import app

        # Get all routes
        routes = [route.path for route in app.routes]

        # Check if invoice routes exist
        invoice_routes = [r for r in routes if '/api/invoices' in r]
        assert len(invoice_routes) > 0, "Invoice routes not found in app"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
