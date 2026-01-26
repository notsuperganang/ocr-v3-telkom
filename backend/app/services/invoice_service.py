"""
Invoice Management Service

Handles invoice operations, payment tracking, and document management for term and recurring payments.
Following functional service pattern (no session creation, no commits).
"""

import logging
import uuid
from datetime import datetime, date, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional, Dict, Any, List, Type, Union

from fastapi import UploadFile
from sqlalchemy import text, func
from sqlalchemy.orm import Session, joinedload

from app.models.database import (
    ContractTermPayment,
    ContractRecurringPayment,
    PaymentTransaction,
    InvoiceDocument,
    User,
    Contract,
)

logger = logging.getLogger(__name__)

# === Constants ===

ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

VALID_DOCUMENT_TYPES = {
    "BUKTI_BAYAR",
    "BUPOT_PPH23",
    "BUKTI_BAYAR_PPH",
    "BUKTI_BAYAR_PPN",
    "INVOICE_PDF",
    "FAKTUR_PAJAK",
    "OTHER",
}

VALID_PAYMENT_METHODS = {
    "TRANSFER",
    "CASH",
    "GIRO",
    "CHECK",
    "VIRTUAL_ACCOUNT",
    "OTHER",
}


# === Helper Functions ===

def _get_invoice_model(invoice_type: str) -> Type[Union[ContractTermPayment, ContractRecurringPayment]]:
    """
    Get model class for invoice type. Accepts lowercase from API.

    Args:
        invoice_type: "term" or "recurring" (case-insensitive)

    Returns:
        ContractTermPayment or ContractRecurringPayment model class

    Raises:
        ValueError: If invoice_type is invalid
    """
    invoice_type_normalized = invoice_type.lower()
    if invoice_type_normalized == "term":
        return ContractTermPayment
    elif invoice_type_normalized == "recurring":
        return ContractRecurringPayment
    else:
        raise ValueError(f"Invalid invoice_type: {invoice_type}. Must be 'term' or 'recurring'")


def _get_invoice_type_db_value(invoice_type: str) -> str:
    """
    Convert API invoice_type (lowercase) to database value (uppercase).

    Args:
        invoice_type: "term" or "recurring"

    Returns:
        "TERM" or "RECURRING"
    """
    return invoice_type.upper()


def _parse_decimal_amount(value: Any, context: str = "amount") -> Decimal:
    """
    Parse value to Decimal, defaulting to 0.00 on error.

    Args:
        value: Value to parse (can be Decimal, int, float, str, or None)
        context: Description for error logging

    Returns:
        Decimal value, defaults to Decimal('0.00') on error
    """
    if value is None:
        return Decimal('0.00')
    try:
        if isinstance(value, Decimal):
            return value
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        if isinstance(value, str):
            cleaned = value.replace(',', '').replace(' ', '').strip()
            if not cleaned:
                return Decimal('0.00')
            return Decimal(cleaned)
        logger.warning(f"Unexpected type for {context}: {type(value)}")
        return Decimal('0.00')
    except (InvalidOperation, ValueError, ArithmeticError) as e:
        logger.warning(f"Failed to parse {context} '{value}': {e}")
        return Decimal('0.00')


def _get_invoice_by_id(
    db: Session,
    invoice_type: str,
    invoice_id: int,
) -> Optional[Union[ContractTermPayment, ContractRecurringPayment]]:
    """
    Get invoice by ID and type.

    Args:
        db: Database session
        invoice_type: "term" or "recurring"
        invoice_id: Invoice ID

    Returns:
        Invoice model instance or None if not found
    """
    model = _get_invoice_model(invoice_type)
    return db.query(model).filter(model.id == invoice_id).first()


def _validate_payment_amount(
    invoice: Union[ContractTermPayment, ContractRecurringPayment],
    payment_amount: Decimal,
) -> None:
    """
    Validate payment doesn't exceed net_payable_amount.

    CRITICAL: Uses net_payable_amount (not amount!) because PPh 23 is withheld.

    Args:
        invoice: Invoice model instance
        payment_amount: Amount being paid

    Raises:
        ValueError: If payment exceeds remaining net payable amount
    """
    net_payable = _parse_decimal_amount(invoice.net_payable_amount, "net_payable_amount")
    paid = _parse_decimal_amount(invoice.paid_amount, "paid_amount")
    remaining = net_payable - paid

    if payment_amount <= 0:
        raise ValueError("Payment amount must be greater than 0")

    if payment_amount > remaining:
        raise ValueError(
            f"Payment amount ({payment_amount}) exceeds remaining net payable amount ({remaining}). "
            f"Net payable: {net_payable}, Already paid: {paid}"
        )


def calculate_due_date(period_year: int, period_month: int) -> datetime:
    """
    Calculate invoice due date as the 15th of the billing month.

    This follows typical Indonesian billing cycles where invoices are
    due on the 15th of the billing period month.

    Args:
        period_year: Billing year (e.g., 2025)
        period_month: Billing month (1-12)

    Returns:
        Datetime with timezone set to UTC

    Example:
        >>> calculate_due_date(2025, 3)
        datetime(2025, 3, 15, 0, 0, 0, tzinfo=timezone.utc)
    """
    due = date(period_year, period_month, 15)
    return datetime.combine(due, datetime.min.time(), tzinfo=timezone.utc)


# === Main Service Functions ===

def get_invoice_detail(
    db: Session,
    invoice_type: str,
    invoice_id: int,
) -> Optional[Dict[str, Any]]:
    """
    Get single invoice with transactions and documents.

    Args:
        db: Database session
        invoice_type: "term" or "recurring"
        invoice_id: Invoice ID

    Returns:
        Dictionary with invoice, payments, documents, and contract info
        None if invoice not found
    """
    model = _get_invoice_model(invoice_type)

    # Query with eager loading
    invoice = (
        db.query(model)
        .options(
            joinedload(model.transactions),
            joinedload(model.documents),
            joinedload(model.contract),
        )
        .filter(model.id == invoice_id)
        .first()
    )

    if not invoice:
        return None

    # Build response
    invoice_data = {
        "id": invoice.id,
        "invoice_type": _get_invoice_type_db_value(invoice_type),
        "invoice_number": invoice.invoice_number,
        "contract_id": invoice.contract_id,
        "invoice_status": invoice.invoice_status,
        "payment_due_status": invoice.status,
        "original_amount": invoice.original_amount,
        "amount": invoice.amount,
        "base_amount": invoice.base_amount,
        "ppn_amount": invoice.ppn_amount,
        "pph_amount": invoice.pph_amount,
        "net_payable_amount": invoice.net_payable_amount,
        "paid_amount": invoice.paid_amount,
        "outstanding_amount": (
            _parse_decimal_amount(invoice.net_payable_amount) -
            _parse_decimal_amount(invoice.paid_amount)
        ),
        "payment_progress_pct": (
            (_parse_decimal_amount(invoice.paid_amount) / _parse_decimal_amount(invoice.net_payable_amount) * 100)
            if invoice.net_payable_amount and invoice.net_payable_amount > 0
            else Decimal('0.00')
        ),
        "due_date": invoice.due_date,
        "period_label": invoice.period_label,
        "period_year": invoice.period_year,
        "period_month": invoice.period_month,
        "ppn_paid": invoice.ppn_paid,
        "pph23_paid": invoice.pph23_paid,
        "sent_date": invoice.sent_date,
        "notes": invoice.notes,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
    }

    # Add termin_number or cycle_number based on type
    if invoice_type.lower() == "term":
        invoice_data["termin_number"] = invoice.termin_number
    else:
        invoice_data["cycle_number"] = invoice.cycle_number

    # Build payments list
    payments = []
    for txn in invoice.transactions or []:
        payments.append({
            "id": txn.id,
            "payment_date": txn.payment_date,
            "amount": txn.amount,
            "payment_method": txn.payment_method,
            "reference_number": txn.reference_number,
            "ppn_included": txn.ppn_included,
            "pph23_included": txn.pph23_included,
            "notes": txn.notes,
            "created_by_id": txn.created_by_id,
            "created_at": txn.created_at,
        })

    # Build documents list
    documents = []
    for doc in invoice.documents or []:
        documents.append({
            "id": doc.id,
            "document_type": doc.document_type,
            "file_name": doc.file_name,
            "file_path": doc.file_path,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "payment_transaction_id": doc.payment_transaction_id,
            "uploaded_by_id": doc.uploaded_by_id,
            "uploaded_at": doc.uploaded_at,
            "notes": doc.notes,
        })

    # Build contract info
    contract_data = None
    if invoice.contract:
        contract = invoice.contract
        contract_data = {
            "id": contract.id,
            "customer_name": contract.customer_name,
            "customer_npwp": contract.customer_npwp,
            "customer_address": getattr(contract, 'customer_address', None),
            "contract_number": getattr(contract, 'contract_number', None),
        }

    return {
        "invoice": invoice_data,
        "payments": payments,
        "documents": documents,
        "contract": contract_data,
    }


def add_payment(
    db: Session,
    invoice_type: str,
    invoice_id: int,
    payment_data: Dict[str, Any],
    acting_user: User,
) -> PaymentTransaction:
    """
    Add payment transaction and update invoice paid_amount.

    Business rules:
    - Validate payment amount <= (net_payable_amount - paid_amount)
    - Create PaymentTransaction record
    - Update invoice.paid_amount += payment.amount
    - Update tax flags if payment includes ppn/pph23
    - Auto-update invoice_status via database trigger

    Does NOT commit. Caller must commit.

    Args:
        db: Database session
        invoice_type: "term" or "recurring"
        invoice_id: Invoice ID
        payment_data: Payment details (payment_date, amount, payment_method, etc.)
        acting_user: User performing the action

    Returns:
        Created PaymentTransaction

    Raises:
        ValueError: If invoice not found or validation fails
    """
    # Get invoice
    invoice = _get_invoice_by_id(db, invoice_type, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice not found: {invoice_type}/{invoice_id}")

    # Parse and validate payment amount
    payment_amount = _parse_decimal_amount(payment_data.get("amount"), "payment_amount")
    _validate_payment_amount(invoice, payment_amount)

    # Parse payment date
    payment_date = payment_data.get("payment_date")
    if isinstance(payment_date, str):
        payment_date = datetime.fromisoformat(payment_date.replace('Z', '+00:00'))
    elif isinstance(payment_date, date) and not isinstance(payment_date, datetime):
        payment_date = datetime.combine(payment_date, datetime.min.time())

    # Create payment transaction
    invoice_type_db = _get_invoice_type_db_value(invoice_type)

    payment = PaymentTransaction(
        invoice_type=invoice_type_db,
        term_payment_id=invoice_id if invoice_type.lower() == "term" else None,
        recurring_payment_id=invoice_id if invoice_type.lower() == "recurring" else None,
        payment_date=payment_date,
        amount=payment_amount,
        payment_method=payment_data.get("payment_method"),
        reference_number=payment_data.get("reference_number"),
        ppn_included=payment_data.get("ppn_included", False),
        pph23_included=payment_data.get("pph23_included", False),
        notes=payment_data.get("notes"),
        created_by_id=acting_user.id if acting_user else None,
    )

    db.add(payment)

    # Update invoice paid_amount
    current_paid = _parse_decimal_amount(invoice.paid_amount, "current_paid")
    invoice.paid_amount = current_paid + payment_amount

    # Update tax flags if payment includes them
    if payment_data.get("ppn_included"):
        invoice.ppn_paid = True
    if payment_data.get("pph23_included"):
        invoice.pph23_paid = True

    # Update audit field
    invoice.updated_by_id = acting_user.id if acting_user else None

    logger.info(
        f"Added payment {payment_amount} to invoice {invoice_type}/{invoice_id}. "
        f"New paid_amount: {invoice.paid_amount}"
    )

    # Note: invoice_status is auto-updated by database trigger

    return payment


async def upload_document(
    db: Session,
    invoice_type: str,
    invoice_id: int,
    file: UploadFile,
    document_type: str,
    payment_transaction_id: Optional[int],
    notes: Optional[str],
    acting_user: User,
) -> InvoiceDocument:
    """
    Save file and create invoice_document record.

    Does NOT commit. Caller must commit.

    Args:
        db: Database session
        invoice_type: "term" or "recurring"
        invoice_id: Invoice ID
        file: Uploaded file
        document_type: Type of document (BUKTI_BAYAR, BUPOT_PPH23, etc.)
        payment_transaction_id: Optional link to specific payment
        notes: Optional notes
        acting_user: User performing the action

    Returns:
        Created InvoiceDocument

    Raises:
        ValueError: If validation fails
    """
    # Validate invoice exists
    invoice = _get_invoice_by_id(db, invoice_type, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice not found: {invoice_type}/{invoice_id}")

    # Validate document type
    if document_type not in VALID_DOCUMENT_TYPES:
        raise ValueError(f"Invalid document_type: {document_type}. Valid types: {VALID_DOCUMENT_TYPES}")

    # Validate file extension
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise ValueError(f"File type not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}")

    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"MIME type not allowed. Supported: {', '.join(ALLOWED_MIME_TYPES)}")

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Validate file size
    if file_size > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB")

    # Create storage directory
    storage_dir = Path(f"storage/invoices/{invoice_type.lower()}/{invoice_id}")
    storage_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    unique_id = str(uuid.uuid4())[:8]
    saved_filename = f"{unique_id}_{file.filename}"
    file_path = storage_dir / saved_filename

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Create document record
    invoice_type_db = _get_invoice_type_db_value(invoice_type)

    document = InvoiceDocument(
        invoice_type=invoice_type_db,
        term_payment_id=invoice_id if invoice_type.lower() == "term" else None,
        recurring_payment_id=invoice_id if invoice_type.lower() == "recurring" else None,
        payment_transaction_id=payment_transaction_id,
        document_type=document_type,
        file_name=file.filename,
        file_path=str(file_path),
        file_size=file_size,
        mime_type=file.content_type,
        notes=notes,
        uploaded_by_id=acting_user.id if acting_user else None,
    )

    db.add(document)

    logger.info(
        f"Uploaded document {file.filename} ({file_size} bytes) for invoice {invoice_type}/{invoice_id}"
    )

    return document


def send_invoice(
    db: Session,
    invoice_type: str,
    invoice_id: int,
    acting_user: User,
) -> None:
    """
    Mark invoice as sent.

    Updates invoice_status to 'SENT' (if currently DRAFT) and sets sent_date.

    Does NOT commit. Caller must commit.

    Args:
        db: Database session
        invoice_type: "term" or "recurring"
        invoice_id: Invoice ID
        acting_user: User performing the action

    Raises:
        ValueError: If invoice not found or not in DRAFT status
    """
    invoice = _get_invoice_by_id(db, invoice_type, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice not found: {invoice_type}/{invoice_id}")

    if invoice.invoice_status != "DRAFT":
        raise ValueError(
            f"Invoice cannot be sent. Current status: {invoice.invoice_status}. "
            "Only DRAFT invoices can be sent."
        )

    invoice.invoice_status = "SENT"
    invoice.sent_date = datetime.now(timezone.utc)
    invoice.updated_by_id = acting_user.id if acting_user else None

    logger.info(f"Invoice {invoice_type}/{invoice_id} marked as SENT")


def get_invoices_by_period(
    db: Session,
    year: int,
    month: int,
    invoice_type: Optional[str] = None,
    status_list: Optional[List[str]] = None,
    witel_id: Optional[int] = None,
    segment_id: Optional[int] = None,
    customer_name: Optional[str] = None,
    contract_number: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
) -> Dict[str, Any]:
    """
    Query v_invoices view with filters.

    Args:
        db: Database session
        year: Billing year
        month: Billing month (1-12)
        invoice_type: Optional filter: "term" or "recurring"
        status_list: Optional list of invoice statuses to filter
        witel_id: Optional witel filter
        segment_id: Optional segment filter
        customer_name: Optional customer name search
        contract_number: Optional contract number search
        page: Page number (1-indexed)
        limit: Records per page

    Returns:
        Dictionary with data, summary, and pagination
    """
    # Build base query with filters
    where_clauses = ["period_year = :year", "period_month = :month"]
    params = {"year": year, "month": month}

    if invoice_type:
        where_clauses.append("invoice_type = :invoice_type")
        params["invoice_type"] = _get_invoice_type_db_value(invoice_type)

    if status_list:
        placeholders = ", ".join([f":status_{i}" for i in range(len(status_list))])
        where_clauses.append(f"invoice_status IN ({placeholders})")
        for i, status in enumerate(status_list):
            params[f"status_{i}"] = status

    if witel_id:
        where_clauses.append("witel_id = :witel_id")
        params["witel_id"] = witel_id

    if customer_name:
        where_clauses.append("customer_name ILIKE :customer_name")
        params["customer_name"] = f"%{customer_name}%"

    if contract_number:
        where_clauses.append("contract_number ILIKE :contract_number")
        params["contract_number"] = f"%{contract_number}%"

    where_sql = " AND ".join(where_clauses)

    # Count total records
    count_query = text(f"""
        SELECT COUNT(*) as total
        FROM v_invoices
        WHERE {where_sql}
    """)

    count_result = db.execute(count_query, params).fetchone()
    total_records = count_result.total if count_result else 0

    # Calculate pagination
    offset = (page - 1) * limit
    total_pages = (total_records + limit - 1) // limit if total_records > 0 else 0

    # Fetch paginated data
    data_query = text(f"""
        SELECT
            id,
            invoice_type,
            invoice_number,
            contract_id,
            contract_number,
            customer_name,
            witel_id,
            witel_name,
            segment_id,
            invoice_status,
            status as payment_due_status,
            original_amount,
            amount,
            base_amount,
            ppn_amount,
            pph_amount,
            net_payable_amount,
            paid_amount,
            (COALESCE(net_payable_amount, 0) - COALESCE(paid_amount, 0)) as outstanding_amount,
            CASE
                WHEN net_payable_amount > 0
                THEN ROUND((COALESCE(paid_amount, 0) / net_payable_amount * 100), 2)
                ELSE 0
            END as payment_progress_pct,
            due_date,
            period_year,
            period_month,
            period_label,
            ppn_paid,
            pph23_paid,
            sent_date,
            created_at,
            updated_at
        FROM v_invoices
        WHERE {where_sql}
        ORDER BY due_date DESC NULLS LAST, invoice_number ASC
        LIMIT :limit OFFSET :offset
    """)

    params["limit"] = limit
    params["offset"] = offset

    result = db.execute(data_query, params)
    rows = result.mappings().all()

    # Convert to list of dicts
    invoices = [dict(row) for row in rows]

    # Calculate summary statistics
    summary_query = text(f"""
        SELECT
            COUNT(*) as total_invoices,
            COALESCE(SUM(amount), 0) as total_amount,
            COALESCE(SUM(paid_amount), 0) as total_paid,
            COALESCE(SUM(net_payable_amount - COALESCE(paid_amount, 0)), 0) as total_outstanding,
            COUNT(*) FILTER (
                WHERE status = 'OVERDUE'
                AND (net_payable_amount - COALESCE(paid_amount, 0)) > 0
            ) as overdue_count
        FROM v_invoices
        WHERE {where_sql}
    """)

    # Remove pagination params for summary
    summary_params = {k: v for k, v in params.items() if k not in ["limit", "offset"]}
    summary_result = db.execute(summary_query, summary_params).fetchone()

    summary = {
        "total_invoices": summary_result.total_invoices if summary_result else 0,
        "total_amount": Decimal(str(summary_result.total_amount)) if summary_result else Decimal('0'),
        "total_paid": Decimal(str(summary_result.total_paid)) if summary_result else Decimal('0'),
        "total_outstanding": Decimal(str(summary_result.total_outstanding)) if summary_result else Decimal('0'),
        "overdue_count": summary_result.overdue_count if summary_result else 0,
    }

    pagination = {
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "total_records": total_records,
    }

    return {
        "data": invoices,
        "summary": summary,
        "pagination": pagination,
    }


def get_invoice_documents(
    db: Session,
    invoice_type: str,
    invoice_id: int,
    document_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Get all documents for an invoice.

    Args:
        db: Database session
        invoice_type: "term" or "recurring"
        invoice_id: Invoice ID
        document_type: Optional filter by document type

    Returns:
        List of document dictionaries

    Raises:
        ValueError: If invoice not found
    """
    # Validate invoice exists
    invoice = _get_invoice_by_id(db, invoice_type, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice not found: {invoice_type}/{invoice_id}")

    # Build query
    query = db.query(InvoiceDocument)

    if invoice_type.lower() == "term":
        query = query.filter(InvoiceDocument.term_payment_id == invoice_id)
    else:
        query = query.filter(InvoiceDocument.recurring_payment_id == invoice_id)

    if document_type:
        query = query.filter(InvoiceDocument.document_type == document_type)

    documents = query.order_by(InvoiceDocument.uploaded_at.desc()).all()

    return [
        {
            "id": doc.id,
            "document_type": doc.document_type,
            "file_name": doc.file_name,
            "file_path": doc.file_path,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "payment_transaction_id": doc.payment_transaction_id,
            "uploaded_by_id": doc.uploaded_by_id,
            "uploaded_at": doc.uploaded_at,
            "notes": doc.notes,
        }
        for doc in documents
    ]


def generate_invoice_number(
    db: Session,
    account_number: str,
    year: int,
    month: int,
) -> str:
    """
    Call database function generate_invoice_number().

    Args:
        db: Database session
        account_number: Account number (7 digits)
        year: Invoice year
        month: Invoice month

    Returns:
        Invoice number in format AAAAAAA-NNNNNN-YYYYMM

    Raises:
        ValueError: If database function fails
    """
    query = text("""
        SELECT generate_invoice_number(:account_number, :year, :month) as invoice_number
    """)

    result = db.execute(query, {
        "account_number": account_number,
        "year": year,
        "month": month,
    }).fetchone()

    if not result or not result.invoice_number:
        raise ValueError("Failed to generate invoice number")

    return result.invoice_number


def update_invoice_amount(
    db: Session,
    invoice_type: str,
    invoice_id: int,
    new_amount: Decimal,
    acting_user: User,
) -> None:
    """
    Update invoice amount. Database trigger auto-recalculates tax breakdown.

    Does NOT commit. Caller must commit.

    Args:
        db: Database session
        invoice_type: "term" or "recurring"
        invoice_id: Invoice ID
        new_amount: New invoice amount
        acting_user: User performing the action

    Raises:
        ValueError: If invoice not found or amount is invalid
    """
    invoice = _get_invoice_by_id(db, invoice_type, invoice_id)
    if not invoice:
        raise ValueError(f"Invoice not found: {invoice_type}/{invoice_id}")

    if new_amount <= 0:
        raise ValueError("Amount must be greater than 0")

    # Update amount - database trigger will recalculate tax breakdown
    invoice.amount = new_amount
    invoice.updated_by_id = acting_user.id if acting_user else None

    logger.info(f"Updated amount for invoice {invoice_type}/{invoice_id} to {new_amount}")
