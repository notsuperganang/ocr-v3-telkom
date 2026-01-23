"""
Pydantic schemas for invoice management

This module defines request/response schemas for the invoice management system,
including payment transactions and document uploads.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# =============================================================================
# Invoice Base Schema
# =============================================================================

class InvoiceBase(BaseModel):
    """Base schema for invoice fields shared between term and recurring payments"""

    invoice_number: Optional[str] = None
    invoice_status: str = "DRAFT"  # DRAFT/SENT/PARTIALLY_PAID/PAID/PAID_PENDING_PPH23/etc
    due_date: Optional[datetime] = None

    # Tax breakdown (auto-calculated via trigger)
    base_amount: Optional[Decimal] = None  # DPP
    ppn_amount: Optional[Decimal] = None  # 11% PPN
    pph_amount: Optional[Decimal] = None  # 2% PPh 23 (withheld)
    net_payable_amount: Optional[Decimal] = None  # What customer actually pays
    paid_amount: Decimal = Decimal("0")

    # Tax status flags
    ppn_paid: bool = False
    pph23_paid: bool = False
    sent_date: Optional[datetime] = None

    class Config:
        from_attributes = True


# =============================================================================
# Payment Transaction Schemas
# =============================================================================

class PaymentTransactionCreate(BaseModel):
    """Schema for creating a new payment transaction"""

    payment_date: datetime
    amount: Decimal = Field(gt=0, description="Payment amount must be greater than 0")
    payment_method: Optional[str] = None  # TRANSFER, CASH, GIRO, CHECK, etc
    reference_number: Optional[str] = None  # Bank reference number
    ppn_included: bool = False  # PPN paid in this transaction?
    pph23_included: bool = False  # PPh 23 paid in this transaction?
    notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "payment_date": "2026-01-15T10:00:00Z",
                "amount": 880310160.00,
                "payment_method": "TRANSFER",
                "reference_number": "TRF123456789",
                "ppn_included": False,
                "pph23_included": False,
                "notes": "Pembayaran pertama (partial)"
            }
        }


class PaymentTransactionUpdate(BaseModel):
    """Schema for updating an existing payment transaction"""

    payment_date: Optional[datetime] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    ppn_included: Optional[bool] = None
    pph23_included: Optional[bool] = None
    notes: Optional[str] = None


class PaymentTransactionResponse(PaymentTransactionCreate):
    """Schema for payment transaction response"""

    id: int
    invoice_type: str  # 'TERM' or 'RECURRING'
    term_payment_id: Optional[int] = None
    recurring_payment_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Invoice Document Schemas
# =============================================================================

class InvoiceDocumentCreate(BaseModel):
    """Schema for creating a new invoice document"""

    document_type: str  # BUKTI_BAYAR, BUPOT_PPH23, FAKTUR_PAJAK, etc
    file_name: str
    file_path: str
    file_size: Optional[int] = Field(None, le=10485760, description="Max 10MB (10,485,760 bytes)")
    mime_type: Optional[str] = None  # application/pdf, image/jpeg, image/png
    payment_transaction_id: Optional[int] = None  # Optional link to specific payment
    notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "document_type": "BUKTI_BAYAR",
                "file_name": "transfer_proof.pdf",
                "file_path": "/uploads/invoices/term-1/transfer_proof.pdf",
                "file_size": 512000,
                "mime_type": "application/pdf",
                "payment_transaction_id": 1,
                "notes": "Bukti transfer bank"
            }
        }


class InvoiceDocumentUpdate(BaseModel):
    """Schema for updating an existing invoice document"""

    document_type: Optional[str] = None
    notes: Optional[str] = None


class InvoiceDocumentResponse(InvoiceDocumentCreate):
    """Schema for invoice document response"""

    id: int
    invoice_type: str  # 'TERM' or 'RECURRING'
    term_payment_id: Optional[int] = None
    recurring_payment_id: Optional[int] = None
    uploaded_by_id: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Invoice Detail Schemas (with nested relationships)
# =============================================================================

class InvoiceDetailResponse(InvoiceBase):
    """Schema for detailed invoice response with payments and documents"""

    id: int
    invoice_type: str  # 'TERM' or 'RECURRING'
    contract_id: int
    contract_number: Optional[str] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    npwp: Optional[str] = None

    # Billing period
    billing_month: int
    billing_year: int

    # Amounts
    original_amount: Decimal  # Immutable original amount
    amount: Decimal  # Mutable current amount
    outstanding_amount: Decimal

    # Payment due status (existing field)
    payment_due_status: str  # PENDING/DUE/OVERDUE/PAID/CANCELLED

    # Related data
    payments: List[PaymentTransactionResponse] = []
    documents: List[InvoiceDocumentResponse] = []

    class Config:
        from_attributes = True


# =============================================================================
# Invoice List/Summary Schemas
# =============================================================================

class InvoiceSummary(BaseModel):
    """Schema for invoice list item (summary view)"""

    id: int
    invoice_type: str
    invoice_number: Optional[str] = None
    invoice_status: str
    payment_due_status: str

    contract_id: int
    contract_number: Optional[str] = None
    customer_name: Optional[str] = None

    # Billing period
    billing_month: int
    billing_year: int

    # Amounts
    amount: Decimal
    net_payable_amount: Optional[Decimal] = None
    paid_amount: Decimal
    outstanding_amount: Optional[Decimal] = None
    payment_progress_pct: Optional[Decimal] = None

    # Dates
    due_date: Optional[datetime] = None
    sent_date: Optional[datetime] = None

    # Tax status
    ppn_paid: bool
    pph23_paid: bool

    class Config:
        from_attributes = True


class InvoiceListResponse(BaseModel):
    """Schema for paginated invoice list response"""

    invoices: List[InvoiceSummary]
    total_count: int
    page: int
    page_size: int
    total_pages: int

    # Summary statistics
    total_amount: Optional[Decimal] = None
    total_paid: Optional[Decimal] = None
    total_outstanding: Optional[Decimal] = None


# =============================================================================
# Invoice Status Update Schemas
# =============================================================================

class InvoiceStatusUpdate(BaseModel):
    """Schema for manually updating invoice status"""

    invoice_status: str  # SENT, CANCELLED, etc
    notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "invoice_status": "SENT",
                "notes": "Invoice sent via email to customer"
            }
        }


# =============================================================================
# Document Type Enum (for reference)
# =============================================================================

class DocumentType:
    """Document type constants"""

    BUKTI_BAYAR = "BUKTI_BAYAR"  # Proof of payment
    BUPOT_PPH23 = "BUPOT_PPH23"  # Bukti Potong PPh 23
    BUKTI_BAYAR_PPH = "BUKTI_BAYAR_PPH"  # PPh 23 payment proof
    BUKTI_BAYAR_PPN = "BUKTI_BAYAR_PPN"  # PPN payment proof
    INVOICE_PDF = "INVOICE_PDF"  # Generated invoice PDF
    FAKTUR_PAJAK = "FAKTUR_PAJAK"  # Tax invoice
    OTHER = "OTHER"  # Other supporting documents

    @classmethod
    def all(cls) -> List[str]:
        """Get all document types"""
        return [
            cls.BUKTI_BAYAR,
            cls.BUPOT_PPH23,
            cls.BUKTI_BAYAR_PPH,
            cls.BUKTI_BAYAR_PPN,
            cls.INVOICE_PDF,
            cls.FAKTUR_PAJAK,
            cls.OTHER,
        ]


# =============================================================================
# Invoice Status Enum (for reference)
# =============================================================================

class InvoiceStatus:
    """Invoice lifecycle status constants"""

    DRAFT = "DRAFT"  # Auto-generated, not sent yet
    SENT = "SENT"  # Sent to customer, awaiting payment
    PARTIALLY_PAID = "PARTIALLY_PAID"  # Partial payment received
    PAID = "PAID"  # Fully paid including all taxes
    PAID_PENDING_PPH23 = "PAID_PENDING_PPH23"  # Paid but PPh 23 pending
    PAID_PENDING_PPN = "PAID_PENDING_PPN"  # Paid but PPN pending
    OVERDUE = "OVERDUE"  # Past due date and not fully paid
    CANCELLED = "CANCELLED"  # Invoice cancelled

    @classmethod
    def all(cls) -> List[str]:
        """Get all invoice statuses"""
        return [
            cls.DRAFT,
            cls.SENT,
            cls.PARTIALLY_PAID,
            cls.PAID,
            cls.PAID_PENDING_PPH23,
            cls.PAID_PENDING_PPN,
            cls.OVERDUE,
            cls.CANCELLED,
        ]
