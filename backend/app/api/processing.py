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
    """Confirm job data and create contract record"""
    db, current_user = db_and_user
    
    # Import here to avoid circular imports
    from app.models.database import Contract
    
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
        
        # Create contract record
        contract = Contract(
            source_job_id=job.id,
            file_id=job.file_id,
            final_data=final_data,
            confirmed_by=current_user,
            confirmed_at=datetime.now(timezone.utc)
        )
        db.add(contract)
        
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
    """Discard a processing job and its data"""
    db, current_user = db_and_user
    
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
        # Clear draft data
        job.edited_data = None
        job.updated_at = datetime.now(timezone.utc)
        
        # If job is not processing, mark as failed
        if job.status not in [JobStatus.PROCESSING]:
            job.status = JobStatus.FAILED
            job.error_message = f"Job discarded by {current_user}"
        
        db.commit()
        
        return {
            "message": "Job discarded successfully",
            "job_id": job_id,
            "status": job.status.value
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to discard job: {str(e)}"
        )