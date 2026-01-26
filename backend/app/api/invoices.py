"""
Invoice Management API endpoints
Handles invoice listing, payment tracking, and document management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal

from app.api.dependencies import get_db_and_user
from app.models.database import User
from app.services import invoice_service

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


# === Pydantic Schemas ===

class InvoiceListItem(BaseModel):
    """Single invoice in list view."""
    id: int
    invoice_type: str  # "TERM" or "RECURRING"
    invoice_number: Optional[str] = None
    contract_id: Optional[int] = None
    contract_number: Optional[str] = None
    customer_name: Optional[str] = None
    witel_id: Optional[int] = None
    witel_name: Optional[str] = None
    segment_id: Optional[int] = None
    invoice_status: str
    payment_due_status: str  # from 'status' field
    original_amount: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    base_amount: Optional[Decimal] = None
    ppn_amount: Optional[Decimal] = None
    pph_amount: Optional[Decimal] = None
    net_payable_amount: Optional[Decimal] = None
    paid_amount: Optional[Decimal] = None
    outstanding_amount: Optional[Decimal] = None
    payment_progress_pct: Optional[Decimal] = None
    due_date: Optional[datetime] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    period_label: Optional[str] = None
    ppn_paid: bool = False
    pph23_paid: bool = False
    sent_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # New account-related fields
    account_number: Optional[str] = None
    bus_area: Optional[str] = None
    nipnas: Optional[str] = None
    segment_name: Optional[str] = None
    account_manager_name: Optional[str] = None
    assigned_officer_name: Optional[str] = None
    account_notes: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceSummary(BaseModel):
    """Summary statistics for invoice list."""
    total_invoices: int
    total_amount: Decimal
    total_paid: Decimal
    total_outstanding: Decimal
    overdue_count: int


class PaginationInfo(BaseModel):
    """Pagination metadata."""
    page: int
    limit: int
    total_pages: int
    total_records: int


class InvoiceListResponse(BaseModel):
    """Paginated list of invoices with summary."""
    data: List[InvoiceListItem]
    summary: InvoiceSummary
    pagination: PaginationInfo


class PaymentTransactionBrief(BaseModel):
    """Payment transaction in invoice detail."""
    id: int
    payment_date: Optional[datetime] = None
    amount: Optional[Decimal] = None
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    ppn_included: bool = False
    pph23_included: bool = False
    notes: Optional[str] = None
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InvoiceDocumentBrief(BaseModel):
    """Document in invoice detail."""
    id: int
    document_type: str
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    payment_transaction_id: Optional[int] = None
    uploaded_by_id: Optional[int] = None
    uploaded_at: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class ContractBrief(BaseModel):
    """Contract info for invoice detail."""
    id: int
    customer_name: Optional[str] = None
    customer_npwp: Optional[str] = None
    customer_address: Optional[str] = None
    contract_number: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceDetail(BaseModel):
    """Full invoice information."""
    id: int
    invoice_type: str
    invoice_number: Optional[str] = None
    contract_id: Optional[int] = None
    invoice_status: str
    payment_due_status: str
    original_amount: Optional[Decimal] = None
    amount: Optional[Decimal] = None
    base_amount: Optional[Decimal] = None
    ppn_amount: Optional[Decimal] = None
    pph_amount: Optional[Decimal] = None
    net_payable_amount: Optional[Decimal] = None
    paid_amount: Optional[Decimal] = None
    outstanding_amount: Optional[Decimal] = None
    payment_progress_pct: Optional[Decimal] = None
    due_date: Optional[datetime] = None
    period_label: Optional[str] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    termin_number: Optional[int] = None
    cycle_number: Optional[int] = None
    ppn_paid: bool = False
    pph23_paid: bool = False
    sent_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InvoiceDetailResponse(BaseModel):
    """Full invoice detail with relationships."""
    invoice: InvoiceDetail
    payments: List[PaymentTransactionBrief]
    documents: List[InvoiceDocumentBrief]
    contract: Optional[ContractBrief] = None


class PaymentCreateRequest(BaseModel):
    """Request to add payment."""
    payment_date: date = Field(..., description="Date of payment")
    amount: Decimal = Field(..., gt=0, description="Payment amount (must be > 0)")
    payment_method: Optional[str] = Field(None, description="TRANSFER, CASH, GIRO, etc")
    reference_number: Optional[str] = Field(None, max_length=100)
    ppn_included: bool = Field(False, description="PPN paid in this payment?")
    pph23_included: bool = Field(False, description="PPh 23 paid in this payment?")
    notes: Optional[str] = None


class InvoiceUpdatedInfo(BaseModel):
    """Invoice state after update."""
    paid_amount: Decimal
    outstanding_amount: Decimal
    invoice_status: str
    payment_due_status: str


class PaymentResponse(BaseModel):
    """Response after adding payment."""
    success: bool
    payment_id: int
    invoice_updated: InvoiceUpdatedInfo


class DocumentUploadResponse(BaseModel):
    """Response after uploading document."""
    success: bool
    document_id: int
    file_path: str
    file_size: int


class InvoiceSendResponse(BaseModel):
    """Response after sending invoice."""
    success: bool
    invoice: Dict[str, Any]


class DocumentListResponse(BaseModel):
    """Response for document listing."""
    documents: List[InvoiceDocumentBrief]


# === Helper Functions ===

def validate_invoice_type(invoice_type: str) -> None:
    """Validate invoice_type parameter."""
    if invoice_type not in ["term", "recurring"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invoice_type must be 'term' or 'recurring'"
        )


# === API Endpoints ===

@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    year: int = Query(..., description="Billing year"),
    month: int = Query(..., ge=1, le=12, description="Billing month (1-12)"),
    invoice_type: Optional[str] = Query(None, description="Filter: term or recurring"),
    invoice_status: Optional[str] = Query(None, alias="status", description="Comma-separated invoice statuses"),
    witel_id: Optional[int] = Query(None),
    segment_id: Optional[int] = Query(None),
    customer_name: Optional[str] = Query(None, description="Search by customer name"),
    contract_number: Optional[str] = Query(None, description="Search by contract number"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user),
):
    """
    Get list of invoices with filters and summary.

    Filters by billing period (year/month) and optional additional filters.
    Returns paginated results with summary statistics.
    """
    db, current_user = db_and_user

    # Validate invoice_type if provided
    if invoice_type and invoice_type not in ["term", "recurring"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invoice_type must be 'term' or 'recurring'"
        )

    # Parse comma-separated status
    status_list = invoice_status.split(",") if invoice_status else None

    try:
        result = invoice_service.get_invoices_by_period(
            db=db,
            year=year,
            month=month,
            invoice_type=invoice_type,
            status_list=status_list,
            witel_id=witel_id,
            segment_id=segment_id,
            customer_name=customer_name,
            contract_number=contract_number,
            page=page,
            limit=limit,
        )

        return InvoiceListResponse(
            data=[InvoiceListItem(**inv) for inv in result["data"]],
            summary=InvoiceSummary(**result["summary"]),
            pagination=PaginationInfo(**result["pagination"]),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch invoices: {str(e)}"
        )


@router.get("/{invoice_type}/{invoice_id}", response_model=InvoiceDetailResponse)
async def get_invoice_detail(
    invoice_type: str,
    invoice_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user),
):
    """
    Get invoice detail with payments and documents.

    Returns full invoice information including payment history and attached documents.
    """
    db, current_user = db_and_user

    validate_invoice_type(invoice_type)

    try:
        result = invoice_service.get_invoice_detail(db, invoice_type, invoice_id)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice not found: {invoice_type}/{invoice_id}"
            )

        return InvoiceDetailResponse(
            invoice=InvoiceDetail(**result["invoice"]),
            payments=[PaymentTransactionBrief(**p) for p in result["payments"]],
            documents=[InvoiceDocumentBrief(**d) for d in result["documents"]],
            contract=ContractBrief(**result["contract"]) if result["contract"] else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch invoice detail: {str(e)}"
        )


@router.post("/{invoice_type}/{invoice_id}/payments", response_model=PaymentResponse)
async def add_payment(
    invoice_type: str,
    invoice_id: int,
    payment_data: PaymentCreateRequest,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user),
):
    """
    Add payment to invoice.

    Creates a new payment transaction and updates the invoice paid_amount.
    Validates that payment doesn't exceed net_payable_amount.
    """
    db, current_user = db_and_user

    validate_invoice_type(invoice_type)

    try:
        payment = invoice_service.add_payment(
            db=db,
            invoice_type=invoice_type,
            invoice_id=invoice_id,
            payment_data=payment_data.model_dump(),
            acting_user=current_user,
        )

        db.commit()
        db.refresh(payment)

        # Get updated invoice data
        invoice = invoice_service._get_invoice_by_id(db, invoice_type, invoice_id)

        paid_amount = invoice_service._parse_decimal_amount(invoice.paid_amount)
        net_payable = invoice_service._parse_decimal_amount(invoice.net_payable_amount)
        outstanding = net_payable - paid_amount

        return PaymentResponse(
            success=True,
            payment_id=payment.id,
            invoice_updated=InvoiceUpdatedInfo(
                paid_amount=paid_amount,
                outstanding_amount=outstanding,
                invoice_status=invoice.invoice_status,
                payment_due_status=invoice.status,
            )
        )

    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add payment: {str(e)}"
        )


@router.post("/{invoice_type}/{invoice_id}/documents", response_model=DocumentUploadResponse)
async def upload_document(
    invoice_type: str,
    invoice_id: int,
    file: UploadFile = File(...),
    document_type: str = Form(..., description="BUKTI_BAYAR, BUPOT_PPH23, etc"),
    payment_transaction_id: Optional[int] = Form(None, description="Link to specific payment"),
    notes: Optional[str] = Form(None),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user),
):
    """
    Upload document for invoice.

    Supports PDF, JPG, PNG files up to 10MB.
    Optionally links document to a specific payment transaction.
    """
    db, current_user = db_and_user

    validate_invoice_type(invoice_type)

    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: PDF, JPG, PNG"
        )

    try:
        document = await invoice_service.upload_document(
            db=db,
            invoice_type=invoice_type,
            invoice_id=invoice_id,
            file=file,
            document_type=document_type,
            payment_transaction_id=payment_transaction_id,
            notes=notes,
            acting_user=current_user,
        )

        db.commit()
        db.refresh(document)

        return DocumentUploadResponse(
            success=True,
            document_id=document.id,
            file_path=document.file_path,
            file_size=document.file_size,
        )

    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.patch("/{invoice_type}/{invoice_id}/send", response_model=InvoiceSendResponse)
async def send_invoice(
    invoice_type: str,
    invoice_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user),
):
    """
    Mark invoice as sent.

    Updates invoice_status from DRAFT to SENT and sets sent_date.
    Only DRAFT invoices can be sent.
    """
    db, current_user = db_and_user

    validate_invoice_type(invoice_type)

    try:
        invoice_service.send_invoice(db, invoice_type, invoice_id, current_user)
        db.commit()

        invoice = invoice_service._get_invoice_by_id(db, invoice_type, invoice_id)

        return InvoiceSendResponse(
            success=True,
            invoice={
                "id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "invoice_status": invoice.invoice_status,
                "sent_date": invoice.sent_date.isoformat() if invoice.sent_date else None,
            }
        )

    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send invoice: {str(e)}"
        )


@router.get("/{invoice_type}/{invoice_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    invoice_type: str,
    invoice_id: int,
    document_type: Optional[str] = Query(None, description="Filter by document type"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user),
):
    """
    List all documents for an invoice.

    Optionally filter by document type.
    """
    db, current_user = db_and_user

    validate_invoice_type(invoice_type)

    try:
        documents = invoice_service.get_invoice_documents(
            db=db,
            invoice_type=invoice_type,
            invoice_id=invoice_id,
            document_type=document_type,
        )

        return DocumentListResponse(
            documents=[InvoiceDocumentBrief(**d) for d in documents]
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch documents: {str(e)}"
        )


@router.patch("/{invoice_type}/{invoice_id}/amount")
async def update_invoice_amount(
    invoice_type: str,
    invoice_id: int,
    amount: Decimal = Query(..., gt=0, description="New invoice amount"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user),
):
    """
    Update invoice amount.

    Database trigger automatically recalculates tax breakdown (base_amount, ppn, pph, net_payable).
    """
    db, current_user = db_and_user

    validate_invoice_type(invoice_type)

    try:
        invoice_service.update_invoice_amount(
            db=db,
            invoice_type=invoice_type,
            invoice_id=invoice_id,
            new_amount=amount,
            acting_user=current_user,
        )

        db.commit()

        invoice = invoice_service._get_invoice_by_id(db, invoice_type, invoice_id)

        return {
            "success": True,
            "invoice": {
                "id": invoice.id,
                "amount": str(invoice.amount),
                "base_amount": str(invoice.base_amount) if invoice.base_amount else None,
                "ppn_amount": str(invoice.ppn_amount) if invoice.ppn_amount else None,
                "pph_amount": str(invoice.pph_amount) if invoice.pph_amount else None,
                "net_payable_amount": str(invoice.net_payable_amount) if invoice.net_payable_amount else None,
            }
        }

    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update amount: {str(e)}"
        )
