"""
Processing API endpoints
Handles job status monitoring, data retrieval, and PDF streaming
"""

import os
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.dependencies import get_db_and_user
from app.models.database import ProcessingJob, JobStatus, File as FileModel

router = APIRouter(prefix="/api/processing", tags=["processing"])

# Response models
class JobStatusResponse(BaseModel):
    job_id: int
    file_id: int
    filename: str
    status: str
    progress_message: str
    processing_time_seconds: Optional[float] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class JobDataResponse(BaseModel):
    job_id: int
    file_id: int
    filename: str
    status: str
    extracted_data: Optional[Dict[str, Any]] = None
    edited_data: Optional[Dict[str, Any]] = None
    ocr_artifacts: Optional[Dict[str, str]] = None
    has_data: bool
    
    class Config:
        from_attributes = True

class DataUpdateRequest(BaseModel):
    edited_data: Dict[str, Any]

class JobListResponse(BaseModel):
    jobs: list[JobStatusResponse]
    total: int
    page: int
    per_page: int
    total_pages: int

def get_progress_message(job: ProcessingJob) -> str:
    """Generate user-friendly progress message based on job status"""
    status_messages = {
        JobStatus.QUEUED: "Waiting in queue for processing",
        JobStatus.PROCESSING: "Running OCR and data extraction",
        JobStatus.EXTRACTED: "OCR completed, processing data",
        JobStatus.AWAITING_REVIEW: "Ready for review and confirmation",
        JobStatus.CONFIRMED: "Data confirmed and saved to contracts",
        JobStatus.FAILED: f"Processing failed: {job.error_message or 'Unknown error'}"
    }
    return status_messages.get(job.status, f"Status: {job.status.value}")

@router.get("/jobs", response_model=JobListResponse)
async def list_all_jobs(
    page: int = 1,
    per_page: int = 10,
    status_filter: Optional[str] = None,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """List all processing jobs with pagination and optional status filtering"""
    db, current_user = db_and_user

    # Build query
    query = db.query(ProcessingJob).join(FileModel, ProcessingJob.file_id == FileModel.id)

    # Apply status filter if provided
    if status_filter:
        try:
            status_enum = JobStatus(status_filter.lower())
            query = query.filter(ProcessingJob.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {status_filter}"
            )

    # Order by creation date (newest first)
    query = query.order_by(ProcessingJob.created_at.desc())

    # Get total count
    total = query.count()

    # Calculate pagination
    total_pages = (total + per_page - 1) // per_page
    offset = (page - 1) * per_page

    # Get jobs for current page
    jobs = query.offset(offset).limit(per_page).all()

    # Convert to response format
    job_responses = []
    for job in jobs:
        file_model = db.query(FileModel).filter(FileModel.id == job.file_id).first()
        job_responses.append(JobStatusResponse(
            job_id=job.id,
            file_id=job.file_id,
            filename=file_model.original_filename if file_model else "Unknown",
            status=job.status.value,
            progress_message=get_progress_message(job),
            processing_time_seconds=job.processing_time_seconds,
            error_message=job.error_message,
            created_at=job.created_at,
            updated_at=job.updated_at
        ))

    return JobListResponse(
        jobs=job_responses,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )

@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: int,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Get real-time status of a processing job"""
    db, current_user = db_and_user
    
    # Get job with file information
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processing job not found"
        )
    
    # Get associated file
    file_model = db.query(FileModel).filter(FileModel.id == job.file_id).first()
    if not file_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated file not found"
        )
    
    return JobStatusResponse(
        job_id=job.id,
        file_id=job.file_id,
        filename=file_model.original_filename,
        status=job.status.value,
        progress_message=get_progress_message(job),
        processing_time_seconds=job.processing_time_seconds,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at
    )

@router.get("/data/{job_id}", response_model=JobDataResponse)
async def get_job_data(
    job_id: int,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Get extracted and edited data for a job"""
    db, current_user = db_and_user
    
    # Get job with file information
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processing job not found"
        )
    
    # Get associated file
    file_model = db.query(FileModel).filter(FileModel.id == job.file_id).first()
    if not file_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated file not found"
        )
    
    # Check if job has extractable data
    has_data = job.status in [JobStatus.AWAITING_REVIEW, JobStatus.CONFIRMED] and job.extracted_data is not None
    
    return JobDataResponse(
        job_id=job.id,
        file_id=job.file_id,
        filename=file_model.original_filename,
        status=job.status.value,
        extracted_data=job.extracted_data,
        edited_data=job.edited_data,
        ocr_artifacts=job.ocr_artifacts,
        has_data=has_data
    )

@router.patch("/data/{job_id}")
async def update_job_data(
    job_id: int,
    update_request: DataUpdateRequest,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Auto-save edited data for a job"""
    db, current_user = db_and_user
    
    # Get job
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processing job not found"
        )
    
    # Check if job is in a state that allows editing
    if job.status not in [JobStatus.AWAITING_REVIEW]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit data for job in status: {job.status.value}"
        )
    
    try:
        # Update edited data
        job.edited_data = update_request.edited_data
        job.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "message": "Data saved successfully",
            "job_id": job_id,
            "updated_at": job.updated_at
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save data: {str(e)}"
        )

@router.post("/confirm/{job_id}")
async def confirm_job_data(
    job_id: int,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Confirm job data and create contract record with denormalized fields"""
    db, current_user = db_and_user

    # Import here to avoid circular imports
    from app.models.database import Contract
    from app.services.denorm import compute_denorm_fields
    from app.services.termin_sync import sync_contract_terms_from_final_data
    from app.services.recurring_sync import sync_contract_recurring_payments

    # Get job
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processing job not found"
        )

    # Check if job is ready for confirmation
    if job.status != JobStatus.AWAITING_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm job in status: {job.status.value}"
        )

    if not job.extracted_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted data available for confirmation"
        )

    try:
        # Use edited data if available, otherwise use extracted data
        final_data = job.edited_data if job.edited_data else job.extracted_data

        # Compute denormalized fields from final_data
        denorm_fields = compute_denorm_fields(final_data)

        # Create contract record with denormalized fields (original + extended)
        contract = Contract(
            source_job_id=job.id,
            file_id=job.file_id,
            final_data=final_data,
            confirmed_by_id=current_user.id,
            confirmed_at=datetime.now(timezone.utc),
            # Contract identification
            contract_number=denorm_fields.contract_number,
            # Original denormalized fields for efficient querying
            customer_name=denorm_fields.customer_name,
            customer_npwp=denorm_fields.customer_npwp,
            period_start=denorm_fields.period_start,
            period_end=denorm_fields.period_end,
            service_connectivity=denorm_fields.service_connectivity,
            service_non_connectivity=denorm_fields.service_non_connectivity,
            service_bundling=denorm_fields.service_bundling,
            payment_method=denorm_fields.payment_method,
            termin_count=denorm_fields.termin_count,
            installation_cost=denorm_fields.installation_cost,
            annual_subscription_cost=denorm_fields.annual_subscription_cost,
            total_contract_value=denorm_fields.total_contract_value,
            # Extended fields - Customer & Representatives
            customer_address=denorm_fields.customer_address,
            rep_name=denorm_fields.rep_name,
            rep_title=denorm_fields.rep_title,
            customer_contact_name=denorm_fields.customer_contact_name,
            customer_contact_title=denorm_fields.customer_contact_title,
            customer_contact_email=denorm_fields.customer_contact_email,
            customer_contact_phone=denorm_fields.customer_contact_phone,
            # Extended fields - Contract Period Raw
            period_start_raw=denorm_fields.period_start_raw,
            period_end_raw=denorm_fields.period_end_raw,
            # Extended fields - Telkom Contact
            telkom_contact_name=denorm_fields.telkom_contact_name,
            telkom_contact_title=denorm_fields.telkom_contact_title,
            telkom_contact_email=denorm_fields.telkom_contact_email,
            telkom_contact_phone=denorm_fields.telkom_contact_phone,
            # Extended fields - Payment Details
            payment_description=denorm_fields.payment_description,
            termin_total_count=denorm_fields.termin_total_count,
            termin_total_amount=denorm_fields.termin_total_amount,
            payment_raw_text=denorm_fields.payment_raw_text,
            termin_payments_raw=denorm_fields.termin_payments_raw,
            # Extended fields - Recurring Payment Details
            recurring_monthly_amount=denorm_fields.recurring_monthly_amount,
            recurring_month_count=denorm_fields.recurring_month_count,
            recurring_total_amount=denorm_fields.recurring_total_amount,
            # Extended fields - Extraction Metadata
            extraction_timestamp=denorm_fields.extraction_timestamp,
            contract_processing_time_sec=denorm_fields.contract_processing_time_sec,
        )
        db.add(contract)

        # Flush to get contract.id before syncing payments
        db.flush()

        # Sync termin payments from final_data to ContractTermPayment rows
        sync_contract_terms_from_final_data(db, contract, acting_user=current_user)

        # Sync recurring payments from contract fields to ContractRecurringPayment rows
        sync_contract_recurring_payments(db, contract, acting_user=current_user)

        # Update job status
        job.status = JobStatus.CONFIRMED
        job.reviewed_at = datetime.now(timezone.utc)
        job.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(contract)

        return {
            "message": "Data confirmed and contract created successfully",
            "job_id": job_id,
            "contract_id": contract.id,
            "confirmed_at": contract.confirmed_at
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm data: {str(e)}"
        )

@router.get("/pdf/{job_id}")
async def stream_pdf(
    job_id: int,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Stream PDF file for preview"""
    db, current_user = db_and_user
    
    # Get job with file information
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processing job not found"
        )
    
    # Get associated file
    file_model = db.query(FileModel).filter(FileModel.id == job.file_id).first()
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
    
    # Return file response with appropriate headers
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=file_model.original_filename,
        headers={
            "Content-Disposition": f"inline; filename={file_model.original_filename}"
        }
    )

@router.delete("/discard/{job_id}")
async def discard_job(
    job_id: int,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Discard a processing job and clean up its files"""
    db, current_user = db_and_user

    # Import file manager
    from app.services.file_manager import file_manager

    # Get job
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processing job not found"
        )

    # Check if job can be discarded
    if job.status == JobStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot discard confirmed job"
        )

    try:
        # Clean up job files (keep PDF as other jobs might reference it)
        file_cleanup_result = file_manager.delete_job_files(db, job_id, keep_pdf=True)

        # If job is already failed, completely delete it from database
        if job.status == JobStatus.FAILED:
            # Get file_id before deleting job
            file_id = job.file_id

            # Delete the job completely
            db.delete(job)

            # Check if any other jobs reference this file
            other_jobs = db.query(ProcessingJob).filter(
                ProcessingJob.file_id == file_id,
                ProcessingJob.id != job_id
            ).count()

            # If no other jobs reference this file, delete the file record too
            if other_jobs == 0:
                file_record = db.query(FileModel).filter(FileModel.id == file_id).first()
                if file_record:
                    db.delete(file_record)

            db.commit()

            return {
                "message": "Failed job and associated files deleted completely",
                "job_id": job_id,
                "status": "deleted",
                "file_cleanup": {
                    "deleted_files": len(file_cleanup_result.get("deleted_files", [])),
                    "total_size": file_cleanup_result.get("total_size", 0),
                    "errors": file_cleanup_result.get("errors", [])
                }
            }
        else:
            # Clear draft data for non-failed jobs
            job.edited_data = None
            job.ocr_artifacts = None  # Clear OCR artifacts reference
            job.updated_at = datetime.now(timezone.utc)

            # If job is not processing, mark as failed
            if job.status not in [JobStatus.PROCESSING]:
                job.status = JobStatus.FAILED
                job.error_message = f"Job discarded by {current_user}"

            db.commit()

        return {
            "message": "Job discarded and files cleaned up successfully",
            "job_id": job_id,
            "status": job.status.value,
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
            detail=f"Failed to discard job: {str(e)}"
        )