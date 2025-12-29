"""
Contracts API endpoints
Read-only endpoints for viewing and exporting confirmed contracts
"""

import os
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, cast, String, func

logger = logging.getLogger(__name__)
from pydantic import BaseModel

from app.api.dependencies import get_db_and_user
from app.models.database import (
    Contract,
    ProcessingJob,
    File as FileModel,
    ExportHistory,
    ExportTarget,
    JobStatus,
    ContractTermPayment,
    ContractRecurringPayment,
    TerminPaymentStatus,
    User,
)
from app.config import settings

router = APIRouter(prefix="/api/contracts", tags=["contracts"])

# Response models
class ContractSummary(BaseModel):
    id: int
    file_id: int
    source_job_id: int
    filename: str
    confirmed_by: str
    confirmed_at: datetime
    created_at: datetime
    contract_start_date: Optional[str] = None
    contract_end_date: Optional[str] = None
    payment_method: Optional[str] = None
    customer_name: Optional[str] = None

    class Config:
        from_attributes = True

class ContractDetail(BaseModel):
    id: int
    file_id: int
    source_job_id: int
    filename: str
    final_data: Dict[str, Any]
    version: int
    confirmed_by: str
    confirmed_at: datetime
    created_at: datetime
    updated_at: datetime
    file_size_bytes: int
    processing_time_seconds: Optional[float] = None
    
    class Config:
        from_attributes = True

class ContractListResponse(BaseModel):
    contracts: List[ContractSummary]
    total: int
    page: int
    per_page: int
    total_pages: int

class ContractStatsResponse(BaseModel):
    """
    KPI stats computed from denormalized contract fields
    All aggregations use indexed denorm columns, no JSONB parsing
    """
    total_contracts: int
    contracts_this_month: int
    total_contract_value: str  # String representation of Decimal for JSON serialization
    avg_processing_time_sec: Optional[float] = None
    success_rate: float
    # Service statistics
    total_connectivity_services: int
    total_non_connectivity_services: int
    total_bundling_services: int
    # Payment method breakdown
    payment_methods: Dict[str, int]  # {"termin": 10, "recurring": 5, "one_time": 3}

    class Config:
        from_attributes = True

class UnifiedContractItem(BaseModel):
    """Unified response model for both confirmed contracts and awaiting_review jobs"""
    item_type: str  # 'contract' or 'job'
    status: str  # 'confirmed' or 'awaiting_review'
    id: int
    file_id: int
    source_job_id: Optional[int] = None
    filename: str
    customer_name: Optional[str] = None
    contract_start_date: Optional[str] = None
    contract_end_date: Optional[str] = None
    payment_method: Optional[str] = None
    total_contract_value: Optional[str] = None  # String representation of Decimal
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UnifiedContractListResponse(BaseModel):
    items: List[UnifiedContractItem]
    total: int
    page: int
    per_page: int
    total_pages: int

# Termin Payment Models
class TerminPaymentResponse(BaseModel):
    """Response model for termin payment details"""
    id: int
    contract_id: int
    termin_number: int
    period_label: str
    period_year: int
    period_month: int
    original_amount: str  # Decimal as string for JSON
    amount: str  # Decimal as string for JSON
    status: str  # PENDING, DUE, OVERDUE, PAID, CANCELLED
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UpdateTerminPaymentRequest(BaseModel):
    """Request model for updating termin payment"""
    status: Optional[str] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    amount: Optional[Decimal] = None

# Recurring Payment Models
class RecurringPaymentResponse(BaseModel):
    """Response model for recurring payment details"""
    id: int
    contract_id: int
    cycle_number: int
    period_label: str
    period_year: int
    period_month: int
    original_amount: str  # Decimal as string for JSON
    amount: str  # Decimal as string for JSON
    status: str  # PENDING, DUE, OVERDUE, PAID, CANCELLED
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UpdateRecurringPaymentRequest(BaseModel):
    """Request model for updating recurring payment"""
    status: Optional[str] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None

def _extract_job_display_data(job: ProcessingJob) -> Dict[str, Optional[str]]:
    """Extract display data from processing job's edited_data or extracted_data"""
    # Prefer edited_data (user modifications) over extracted_data (raw OCR)
    data = job.edited_data or job.extracted_data or {}

    # Safely extract nested data with fallbacks
    customer_name = None
    contract_start_date = None
    contract_end_date = None
    payment_method = None
    total_contract_value = None

    try:
        if 'informasi_pelanggan' in data:
            customer_name = data['informasi_pelanggan'].get('nama_pelanggan')

        if 'jangka_waktu' in data:
            contract_start_date = data['jangka_waktu'].get('mulai')
            contract_end_date = data['jangka_waktu'].get('akhir')

        if 'tata_cara_pembayaran' in data:
            payment_method = data['tata_cara_pembayaran'].get('method_type')

        # Calculate total contract value from rincian_layanan
        if 'rincian_layanan' in data and isinstance(data['rincian_layanan'], list):
            total_installation = Decimal('0')
            total_subscription = Decimal('0')

            for item in data['rincian_layanan']:
                if isinstance(item, dict):
                    # Parse installation cost
                    install_cost = item.get('biaya_instalasi', 0)
                    if install_cost:
                        try:
                            if isinstance(install_cost, str):
                                # Remove non-numeric characters except digits, comma, and period
                                cleaned = install_cost.replace(',', '.')
                                cleaned = ''.join(c for c in cleaned if c.isdigit() or c == '.')
                                if cleaned:
                                    total_installation += Decimal(cleaned)
                            else:
                                total_installation += Decimal(str(install_cost))
                        except (ValueError, ArithmeticError):
                            pass

                    # Parse subscription cost
                    subscription_cost = item.get('biaya_langganan_tahunan', 0)
                    if subscription_cost:
                        try:
                            if isinstance(subscription_cost, str):
                                cleaned = subscription_cost.replace(',', '.')
                                cleaned = ''.join(c for c in cleaned if c.isdigit() or c == '.')
                                if cleaned:
                                    total_subscription += Decimal(cleaned)
                            else:
                                total_subscription += Decimal(str(subscription_cost))
                        except (ValueError, ArithmeticError):
                            pass

            total_value = total_installation + total_subscription
            if total_value > 0:
                total_contract_value = str(total_value)
    except (AttributeError, TypeError, KeyError):
        # If data structure is unexpected, return None values
        pass

    return {
        'customer_name': customer_name,
        'contract_start_date': contract_start_date,
        'contract_end_date': contract_end_date,
        'payment_method': payment_method,
        'total_contract_value': total_contract_value,
    }

def _format_payment_method(payment_method: Optional[str]) -> str:
    """Format payment method enum to friendly label"""
    if not payment_method:
        return ''

    payment_method_map = {
        'one_time': 'OTC',
        'recurring': 'Recurring',
        'termin': 'Termin'
    }
    return payment_method_map.get(payment_method, '')

@router.get("/stats/summary", response_model=ContractStatsResponse)
async def get_contract_stats(
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Get contract KPI statistics using denormalized columns
    This endpoint performs pure SQL aggregation on indexed columns for maximum performance
    """
    db, current_user = db_and_user

    # Calculate start of current month (for "this month" metric)
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    # 1. Total contracts
    total_contracts = db.query(func.count(Contract.id)).scalar() or 0

    # 2. Contracts confirmed this month
    contracts_this_month = (
        db.query(func.count(Contract.id))
        .filter(Contract.confirmed_at >= start_of_month)
        .scalar() or 0
    )

    # 3. Total contract value (sum of all confirmed contracts)
    total_value_decimal = (
        db.query(func.sum(Contract.total_contract_value))
        .scalar() or Decimal('0')
    )
    total_contract_value_str = str(total_value_decimal)

    # 4. Average processing time (from processing_jobs)
    avg_processing_time = (
        db.query(func.avg(ProcessingJob.processing_time_seconds))
        .join(Contract, Contract.source_job_id == ProcessingJob.id)
        .scalar()
    )

    # 5. Success rate (confirmed contracts / total processed jobs)
    total_processed_jobs = (
        db.query(func.count(ProcessingJob.id))
        .filter(ProcessingJob.status.in_([JobStatus.CONFIRMED, JobStatus.FAILED]))
        .scalar() or 1  # Avoid division by zero
    )
    success_rate = total_contracts / total_processed_jobs if total_processed_jobs > 0 else 0.0

    # 6. Service totals (sum across all contracts)
    service_stats = (
        db.query(
            func.sum(Contract.service_connectivity),
            func.sum(Contract.service_non_connectivity),
            func.sum(Contract.service_bundling)
        )
        .first()
    )
    total_connectivity = service_stats[0] or 0
    total_non_connectivity = service_stats[1] or 0
    total_bundling = service_stats[2] or 0

    # 7. Payment method breakdown (count by payment_method)
    payment_method_query = (
        db.query(
            Contract.payment_method,
            func.count(Contract.id)
        )
        .filter(Contract.payment_method.isnot(None))
        .group_by(Contract.payment_method)
        .all()
    )

    payment_methods = {method: count for method, count in payment_method_query}

    return ContractStatsResponse(
        total_contracts=total_contracts,
        contracts_this_month=contracts_this_month,
        total_contract_value=total_contract_value_str,
        avg_processing_time_sec=avg_processing_time,
        success_rate=success_rate,
        total_connectivity_services=total_connectivity,
        total_non_connectivity_services=total_non_connectivity,
        total_bundling_services=total_bundling,
        payment_methods=payment_methods
    )

@router.get("", response_model=ContractListResponse)
async def list_contracts(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search in filename or contract data"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Get paginated list of confirmed contracts"""
    db, current_user = db_and_user
    
    # Build base query
    query = db.query(Contract).join(FileModel, Contract.file_id == FileModel.id)
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                FileModel.original_filename.ilike(search_term),
                cast(Contract.final_data, String).ilike(search_term)
            )
        )
    
    # Get total count
    total = query.count()
    
    # Apply pagination and ordering
    contracts = (
        query
        .order_by(desc(Contract.confirmed_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    
    # Build response using denormalized columns (no JSONB parsing!)
    contract_summaries = []
    for contract in contracts:
        # Get file info
        file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()

        contract_summaries.append(ContractSummary(
            id=contract.id,
            file_id=contract.file_id,
            source_job_id=contract.source_job_id,
            filename=file_model.original_filename if file_model else "Unknown",
            confirmed_by=contract.confirmer.username if contract.confirmer else "Unknown",
            confirmed_at=contract.confirmed_at,
            created_at=contract.created_at,
            # Use denormalized columns directly - no JSONB parsing!
            contract_start_date=contract.period_start.isoformat() if contract.period_start else None,
            contract_end_date=contract.period_end.isoformat() if contract.period_end else None,
            payment_method=_format_payment_method(contract.payment_method),
            customer_name=contract.customer_name
        ))
    
    total_pages = (total + per_page - 1) // per_page
    
    return ContractListResponse(
        contracts=contract_summaries,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )

@router.get("/all/items", response_model=UnifiedContractListResponse)
async def list_all_contract_items(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search in filename or contract data"),
    status_filter: Optional[str] = Query(None, description="Filter by status: confirmed, awaiting_review, or all"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """
    Get paginated list of both confirmed contracts AND awaiting_review jobs
    Returns unified list for contracts page display
    """
    db, current_user = db_and_user

    all_items = []

    # Fetch confirmed contracts
    contract_query = db.query(Contract).join(FileModel, Contract.file_id == FileModel.id)

    # Apply search filter to contracts
    if search:
        search_term = f"%{search}%"
        contract_query = contract_query.filter(
            or_(
                FileModel.original_filename.ilike(search_term),
                cast(Contract.final_data, String).ilike(search_term)
            )
        )

    # Apply status filter
    if status_filter and status_filter.lower() != 'all':
        if status_filter.lower() == 'confirmed':
            # Only fetch contracts
            pass
        elif status_filter.lower() == 'awaiting_review':
            # Skip contracts, only fetch jobs
            contract_query = contract_query.filter(Contract.id == -1)  # No results

    contracts = contract_query.order_by(desc(Contract.confirmed_at)).all()

    # Convert contracts to unified items
    for contract in contracts:
        file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()
        all_items.append(UnifiedContractItem(
            item_type='contract',
            status='confirmed',
            id=contract.id,
            file_id=contract.file_id,
            source_job_id=contract.source_job_id,
            filename=file_model.original_filename if file_model else "Unknown",
            customer_name=contract.customer_name,
            contract_start_date=contract.period_start.isoformat() if contract.period_start else None,
            contract_end_date=contract.period_end.isoformat() if contract.period_end else None,
            payment_method=_format_payment_method(contract.payment_method),
            total_contract_value=str(contract.total_contract_value) if contract.total_contract_value else None,
            confirmed_by=contract.confirmer.username if contract.confirmer else "Unknown",
            confirmed_at=contract.confirmed_at,
            created_at=contract.created_at,
            updated_at=contract.updated_at
        ))

    # Fetch awaiting_review jobs
    job_query = db.query(ProcessingJob).join(FileModel, ProcessingJob.file_id == FileModel.id).filter(
        ProcessingJob.status == JobStatus.AWAITING_REVIEW
    )

    # Apply search filter to jobs
    if search:
        search_term = f"%{search}%"
        job_query = job_query.filter(
            or_(
                FileModel.original_filename.ilike(search_term),
                cast(ProcessingJob.edited_data, String).ilike(search_term),
                cast(ProcessingJob.extracted_data, String).ilike(search_term)
            )
        )

    # Apply status filter
    if status_filter and status_filter.lower() != 'all':
        if status_filter.lower() == 'confirmed':
            # Skip jobs
            job_query = job_query.filter(ProcessingJob.id == -1)  # No results
        elif status_filter.lower() == 'awaiting_review':
            # Only fetch jobs
            pass

    jobs = job_query.order_by(desc(ProcessingJob.created_at)).all()

    # Convert jobs to unified items
    for job in jobs:
        file_model = db.query(FileModel).filter(FileModel.id == job.file_id).first()
        display_data = _extract_job_display_data(job)

        all_items.append(UnifiedContractItem(
            item_type='job',
            status='awaiting_review',
            id=job.id,
            file_id=job.file_id,
            source_job_id=None,  # Jobs don't have source_job_id yet
            filename=file_model.original_filename if file_model else "Unknown",
            customer_name=display_data.get('customer_name'),
            contract_start_date=display_data.get('contract_start_date'),
            contract_end_date=display_data.get('contract_end_date'),
            payment_method=_format_payment_method(display_data.get('payment_method')),
            total_contract_value=display_data.get('total_contract_value'),
            confirmed_by=None,
            confirmed_at=None,
            created_at=job.created_at,
            updated_at=job.updated_at
        ))

    # Sort all items by creation/confirmation date (newest first)
    all_items.sort(key=lambda x: x.confirmed_at or x.created_at, reverse=True)

    # Apply pagination
    total = len(all_items)
    total_pages = (total + per_page - 1) // per_page
    offset = (page - 1) * per_page
    paginated_items = all_items[offset:offset + per_page]

    return UnifiedContractListResponse(
        items=paginated_items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )

@router.get("/{contract_id}", response_model=ContractDetail)
async def get_contract_detail(
    contract_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Get detailed view of a specific contract"""
    db, current_user = db_and_user
    
    # Get contract with related data
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    # Get file info
    file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()
    if not file_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated file not found"
        )
    
    # Get processing job info for timing data
    job = db.query(ProcessingJob).filter(ProcessingJob.id == contract.source_job_id).first()
    
    return ContractDetail(
        id=contract.id,
        file_id=contract.file_id,
        source_job_id=contract.source_job_id,
        filename=file_model.original_filename,
        final_data=contract.final_data,
        version=contract.version,
        confirmed_by=contract.confirmer.username if contract.confirmer else "Unknown",
        confirmed_at=contract.confirmed_at,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
        file_size_bytes=file_model.size_bytes,
        processing_time_seconds=job.processing_time_seconds if job else None
    )

@router.get("/{contract_id}/json")
async def download_contract_json(
    contract_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Download contract data as JSON file"""
    db, current_user = db_and_user
    
    # Get contract
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    # Get file info for filename
    file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()
    
    try:
        # Create JSON response
        json_data = {
            "contract_id": contract.id,
            "filename": file_model.original_filename if file_model else "unknown",
            "confirmed_at": contract.confirmed_at.isoformat(),
            "confirmed_by": contract.confirmer.username if contract.confirmer else "Unknown",
            "version": contract.version,
            "data": contract.final_data
        }

        json_content = json.dumps(json_data, indent=2, ensure_ascii=False)

        # Log export
        export_record = ExportHistory(
            contract_id=contract.id,
            export_target=ExportTarget.JSON,
            status="success",
            notes=f"Downloaded by {current_user.username}"
        )
        db.add(export_record)
        db.commit()
        
        # Return JSON file
        filename = f"contract_{contract.id}_{file_model.original_filename}.json" if file_model else f"contract_{contract.id}.json"
        
        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate JSON: {str(e)}"
        )

@router.get("/{contract_id}/pdf")
async def download_contract_pdf(
    contract_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Download original PDF file for contract"""
    db, current_user = db_and_user
    
    # Get contract
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    # Get file info
    file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()
    if not file_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated file not found"
        )
    
    # Check if PDF file exists
    pdf_path = file_model.pdf_path
    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found on disk"
        )
    
    # Return PDF file
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=file_model.original_filename,
        headers={
            "Content-Disposition": f"attachment; filename={file_model.original_filename}"
        }
    )

@router.patch("/{contract_id}")
async def update_contract(
    contract_id: int,
    updated_data: Dict[str, Any],
    increment_version: bool = Query(False, description="Increment contract version (use for confirmations)"),
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Update contract data and recompute denormalized fields"""
    db, current_user = db_and_user

    # Import denormalization service
    from app.services.denorm import compute_denorm_fields
    from app.services.termin_sync import sync_contract_terms_from_final_data
    from app.services.recurring_sync import sync_contract_recurring_payments

    # Get contract
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    try:
        # Update final_data
        contract.final_data = updated_data

        # Recompute all denormalized fields
        denorm_fields = compute_denorm_fields(updated_data)

        # Update denormalized fields
        contract.customer_name = denorm_fields.customer_name
        contract.customer_npwp = denorm_fields.customer_npwp
        contract.period_start = denorm_fields.period_start
        contract.period_end = denorm_fields.period_end
        contract.service_connectivity = denorm_fields.service_connectivity
        contract.service_non_connectivity = denorm_fields.service_non_connectivity
        contract.service_bundling = denorm_fields.service_bundling
        contract.payment_method = denorm_fields.payment_method
        contract.termin_count = denorm_fields.termin_count
        contract.installation_cost = denorm_fields.installation_cost
        contract.annual_subscription_cost = denorm_fields.annual_subscription_cost
        contract.total_contract_value = denorm_fields.total_contract_value

        # Extended fields - Customer & Representatives
        contract.customer_address = denorm_fields.customer_address
        contract.rep_name = denorm_fields.rep_name
        contract.rep_title = denorm_fields.rep_title
        contract.customer_contact_name = denorm_fields.customer_contact_name
        contract.customer_contact_title = denorm_fields.customer_contact_title
        contract.customer_contact_email = denorm_fields.customer_contact_email
        contract.customer_contact_phone = denorm_fields.customer_contact_phone

        # Extended fields - Contract Period Raw
        contract.period_start_raw = denorm_fields.period_start_raw
        contract.period_end_raw = denorm_fields.period_end_raw

        # Extended fields - Telkom Contact
        contract.telkom_contact_name = denorm_fields.telkom_contact_name
        contract.telkom_contact_title = denorm_fields.telkom_contact_title
        contract.telkom_contact_email = denorm_fields.telkom_contact_email
        contract.telkom_contact_phone = denorm_fields.telkom_contact_phone

        # Extended fields - Payment Details
        contract.payment_description = denorm_fields.payment_description
        contract.termin_total_count = denorm_fields.termin_total_count
        contract.termin_total_amount = denorm_fields.termin_total_amount
        contract.payment_raw_text = denorm_fields.payment_raw_text
        contract.termin_payments_raw = denorm_fields.termin_payments_raw

        # Extended fields - Recurring Payment Details
        contract.recurring_monthly_amount = denorm_fields.recurring_monthly_amount
        contract.recurring_month_count = denorm_fields.recurring_month_count
        contract.recurring_total_amount = denorm_fields.recurring_total_amount

        # Extended fields - Extraction Metadata
        contract.extraction_timestamp = denorm_fields.extraction_timestamp
        contract.contract_processing_time_sec = denorm_fields.contract_processing_time_sec

        # Increment version only if requested (for confirmations, not auto-save)
        if increment_version:
            contract.version += 1
        contract.updated_at = datetime.now(timezone.utc)

        # Sync termin payments from final_data to ContractTermPayment rows
        sync_contract_terms_from_final_data(db, contract, acting_user=current_user)

        # Sync recurring payments from contract fields to ContractRecurringPayment rows
        sync_contract_recurring_payments(db, contract, acting_user=current_user)

        db.commit()
        db.refresh(contract)

        # Get file info for response
        file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()

        return ContractDetail(
            id=contract.id,
            file_id=contract.file_id,
            source_job_id=contract.source_job_id,
            filename=file_model.original_filename if file_model else "unknown",
            final_data=contract.final_data,
            version=contract.version,
            confirmed_by=contract.confirmer.username if contract.confirmer else "Unknown",
            confirmed_at=contract.confirmed_at,
            created_at=contract.created_at,
            updated_at=contract.updated_at,
            file_size_bytes=file_model.size_bytes if file_model else 0,
            processing_time_seconds=None
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update contract: {str(e)}"
        )

@router.get("/{contract_id}/pdf/stream")
async def stream_contract_pdf(
    contract_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Stream PDF file for contract editing preview"""
    db, current_user = db_and_user

    # Get contract
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    # Get file info
    file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()
    if not file_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated file not found"
        )

    # Check if PDF file exists
    pdf_path = file_model.pdf_path
    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found on disk"
        )

    # Stream PDF file (inline, not as attachment)
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=file_model.original_filename
    )

@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Delete a contract and associated files (admin operation)"""
    db, current_user = db_and_user

    # Import file manager
    from app.services.file_manager import file_manager

    # Get contract
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    try:
        # Get contract info for logging
        file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()
        filename = file_model.original_filename if file_model else "unknown"

        # Delete associated files BEFORE deleting database records
        file_cleanup_result = file_manager.delete_contract_files(db, contract_id)

        # Delete related export history
        db.query(ExportHistory).filter(ExportHistory.contract_id == contract_id).delete()

        # Delete contract first (to avoid foreign key constraint)
        db.delete(contract)
        db.commit()  # Commit contract deletion before deleting processing job

        # Delete file record if no other contracts reference it
        if file_model:
            other_contracts = db.query(Contract).filter(
                Contract.file_id == file_model.id,
                Contract.id != contract_id
            ).count()

            if other_contracts == 0:
                # Now safe to delete processing jobs for this file
                db.query(ProcessingJob).filter(ProcessingJob.file_id == file_model.id).delete()
                db.delete(file_model)

        db.commit()

        return {
            "message": "Contract and associated files deleted successfully",
            "contract_id": contract_id,
            "filename": filename,
            "deleted_by": current_user.username,
            "deleted_at": datetime.now(timezone.utc),
            "file_cleanup": {
                "deleted_files": len(file_cleanup_result.get("deleted_files", [])),
                "total_size": file_cleanup_result.get("total_size", 0),
                "errors": file_cleanup_result.get("errors", [])
            }
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete contract: {str(e)}"
        )

@router.get("/{contract_id}/termin-payments", response_model=List[TerminPaymentResponse])
async def get_termin_payments(
    contract_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Get all termin payments for a contract"""
    db, current_user = db_and_user

    # Verify contract exists
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    # Auto-update termin statuses before returning
    # This ensures dashboard queries get fresh status
    from app.services.termin_status import update_termin_statuses

    try:
        update_result = update_termin_statuses(
            db=db,
            contract_id=contract_id,
            dry_run=False
        )
        db.commit()  # Commit status updates

        # Log if any updates occurred
        if update_result["updated"] > 0:
            logger.info(
                f"Auto-updated {update_result['updated']} termin statuses "
                f"for contract {contract_id}"
            )
    except Exception as e:
        db.rollback()
        logger.warning(f"Failed to auto-update termin statuses: {e}")
        # Continue anyway - return current data

    # Fetch termin payments ordered by termin number
    termin_payments = db.query(ContractTermPayment).filter(
        ContractTermPayment.contract_id == contract_id
    ).order_by(ContractTermPayment.termin_number).all()

    # Convert to response models (Decimal to string for JSON serialization)
    return [
        TerminPaymentResponse(
            id=tp.id,
            contract_id=tp.contract_id,
            termin_number=tp.termin_number,
            period_label=tp.period_label,
            period_year=tp.period_year,
            period_month=tp.period_month,
            original_amount=str(tp.original_amount),
            amount=str(tp.amount),
            status=tp.status,
            paid_at=tp.paid_at,
            notes=tp.notes,
            created_by=tp.creator.username if tp.creator else None,
            updated_by=tp.updater.username if tp.updater else None,
            created_at=tp.created_at,
            updated_at=tp.updated_at
        )
        for tp in termin_payments
    ]

@router.patch("/{contract_id}/termin-payments/{termin_number}", response_model=TerminPaymentResponse)
async def update_termin_payment(
    contract_id: int,
    termin_number: int,
    update_data: UpdateTerminPaymentRequest,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Update a specific termin payment (status, paid_at, notes, or amount)"""
    db, current_user = db_and_user

    # Verify contract exists
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    # Find the termin payment WITH ROW LOCK
    # This prevents concurrent auto-updates during user edit
    termin_payment = db.query(ContractTermPayment).filter(
        ContractTermPayment.contract_id == contract_id,
        ContractTermPayment.termin_number == termin_number
    ).with_for_update().first()

    if not termin_payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Termin payment {termin_number} not found for this contract"
        )

    # Validate status if provided
    if update_data.status is not None:
        valid_statuses = [s.value for s in TerminPaymentStatus]
        if update_data.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        termin_payment.status = update_data.status

    # Update fields if provided
    if update_data.paid_at is not None:
        termin_payment.paid_at = update_data.paid_at

    if update_data.notes is not None:
        termin_payment.notes = update_data.notes

    if update_data.amount is not None:
        termin_payment.amount = update_data.amount

    # Update audit fields
    termin_payment.updated_by_id = current_user.id
    termin_payment.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(termin_payment)

        # Return response with Decimal as string
        return TerminPaymentResponse(
            id=termin_payment.id,
            contract_id=termin_payment.contract_id,
            termin_number=termin_payment.termin_number,
            period_label=termin_payment.period_label,
            period_year=termin_payment.period_year,
            period_month=termin_payment.period_month,
            original_amount=str(termin_payment.original_amount),
            amount=str(termin_payment.amount),
            status=termin_payment.status,
            paid_at=termin_payment.paid_at,
            notes=termin_payment.notes,
            created_by=termin_payment.creator.username if termin_payment.creator else None,
            updated_by=termin_payment.updater.username if termin_payment.updater else None,
            created_at=termin_payment.created_at,
            updated_at=termin_payment.updated_at
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update termin payment: {str(e)}"
        )

@router.get("/{contract_id}/recurring-payments", response_model=List[RecurringPaymentResponse])
async def get_recurring_payments(
    contract_id: int,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Get all recurring payments for a contract"""
    db, current_user = db_and_user

    # Verify contract exists
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    # Auto-update recurring statuses before returning
    # This ensures dashboard queries get fresh status
    from app.services.termin_status import update_recurring_statuses

    try:
        update_result = update_recurring_statuses(
            db=db,
            contract_id=contract_id,
            dry_run=False
        )
        db.commit()  # Commit status updates

        # Log if any updates occurred
        if update_result["updated"] > 0:
            logger.info(
                f"Auto-updated {update_result['updated']} recurring payment statuses "
                f"for contract {contract_id}"
            )
    except Exception as e:
        db.rollback()
        logger.warning(f"Failed to auto-update recurring statuses: {e}")

    # Fetch recurring payments ordered by cycle number
    recurring_payments = db.query(ContractRecurringPayment).filter(
        ContractRecurringPayment.contract_id == contract_id
    ).order_by(ContractRecurringPayment.cycle_number).all()

    # Convert to response models (Decimal to string for JSON serialization)
    return [
        RecurringPaymentResponse(
            id=rp.id,
            contract_id=rp.contract_id,
            cycle_number=rp.cycle_number,
            period_label=rp.period_label,
            period_year=rp.period_year,
            period_month=rp.period_month,
            original_amount=str(rp.original_amount),
            amount=str(rp.amount),
            status=rp.status,
            paid_at=rp.paid_at,
            notes=rp.notes,
            created_by=rp.creator.username if rp.creator else None,
            updated_by=rp.updater.username if rp.updater else None,
            created_at=rp.created_at,
            updated_at=rp.updated_at
        )
        for rp in recurring_payments
    ]

@router.patch("/{contract_id}/recurring-payments/{cycle_number}", response_model=RecurringPaymentResponse)
async def update_recurring_payment(
    contract_id: int,
    cycle_number: int,
    update_data: UpdateRecurringPaymentRequest,
    db_and_user: tuple[Session, User] = Depends(get_db_and_user)
):
    """Update a specific recurring payment (status, paid_at, notes)"""
    db, current_user = db_and_user

    # Verify contract exists
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )

    # Find the recurring payment WITH ROW LOCK
    # This prevents concurrent auto-updates during user edit
    recurring_payment = db.query(ContractRecurringPayment).filter(
        ContractRecurringPayment.contract_id == contract_id,
        ContractRecurringPayment.cycle_number == cycle_number
    ).with_for_update().first()

    if not recurring_payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recurring payment cycle {cycle_number} not found for this contract"
        )

    # Validate status if provided
    if update_data.status is not None:
        valid_statuses = [s.value for s in TerminPaymentStatus]
        if update_data.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        recurring_payment.status = update_data.status

        # If marking as PAID and paid_at not explicitly provided, set it to now
        if update_data.status == TerminPaymentStatus.PAID.value and update_data.paid_at is None:
            recurring_payment.paid_at = datetime.now(timezone.utc)

    # Update fields if provided
    if update_data.paid_at is not None:
        recurring_payment.paid_at = update_data.paid_at

    if update_data.notes is not None:
        recurring_payment.notes = update_data.notes

    # Update audit fields
    recurring_payment.updated_by_id = current_user.id
    recurring_payment.updated_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(recurring_payment)

        # Return response with Decimal as string
        return RecurringPaymentResponse(
            id=recurring_payment.id,
            contract_id=recurring_payment.contract_id,
            cycle_number=recurring_payment.cycle_number,
            period_label=recurring_payment.period_label,
            period_year=recurring_payment.period_year,
            period_month=recurring_payment.period_month,
            original_amount=str(recurring_payment.original_amount),
            amount=str(recurring_payment.amount),
            status=recurring_payment.status,
            paid_at=recurring_payment.paid_at,
            notes=recurring_payment.notes,
            created_by=recurring_payment.creator.username if recurring_payment.creator else None,
            updated_by=recurring_payment.updater.username if recurring_payment.updater else None,
            created_at=recurring_payment.created_at,
            updated_at=recurring_payment.updated_at
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update recurring payment: {str(e)}"
        )
