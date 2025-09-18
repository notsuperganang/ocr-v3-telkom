"""
File upload API endpoints
Handles PDF upload and creates processing jobs
"""

import os
import uuid
import json
from typing import List
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.dependencies import get_db_and_user
from app.models.database import File as FileModel, ProcessingJob, JobStatus
from app.config import settings

router = APIRouter(prefix="/api", tags=["upload"])

# Response models
class UploadResponse(BaseModel):
    job_id: int
    file_id: int
    filename: str
    message: str

class BatchUploadResponse(BaseModel):
    uploaded_files: List[UploadResponse]
    total_files: int
    message: str

# File validation
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png", 
    "image/jpeg",
    "image/jpg"
}

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def validate_file(file: UploadFile) -> None:
    """Validate uploaded file"""
    # Check file extension
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check content type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"MIME type not allowed. Supported: {', '.join(ALLOWED_MIME_TYPES)}"
        )

async def save_uploaded_file(file: UploadFile, file_id: str) -> str:
    """Save uploaded file to storage directory"""
    try:
        # Create storage directory if it doesn't exist
        storage_dir = Path("storage/uploads")
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix.lower()
        saved_filename = f"{file_id}_{file.filename}"
        file_path = storage_dir / saved_filename
        
        # Save file
        content = await file.read()
        
        # Check file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        return str(file_path)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

def create_processing_job(db: Session, file_model: FileModel, current_user: str) -> ProcessingJob:
    """Create a new processing job for the uploaded file"""
    job = ProcessingJob(
        file_id=file_model.id,
        status=JobStatus.QUEUED,
        reviewed_by=current_user
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

async def process_file_background(job_id: int, file_path: str):
    """Background task to process uploaded file with OCR"""
    # Import here to avoid circular imports during startup
    from app.database import SessionLocal
    from app.services.ocr_service import get_ocr_service
    from app.services.data_extractor import extract_from_page1_one_time, merge_with_page2
    
    db = SessionLocal()
    try:
        # Get job
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            return
        
        # Update job status
        job.status = JobStatus.PROCESSING
        job.processing_started_at = datetime.now(timezone.utc)
        db.commit()
        
        try:
            # Run OCR processing
            ocr_service = get_ocr_service()
            ocr_result = ocr_service.process_pdf(
                file_path, 
                "storage/ocr_outputs",
                str(job.file_id)
            )
            
            if ocr_result.success:
                # Store OCR artifacts
                job.ocr_artifacts = ocr_result.output_paths
                
                # Extract data from OCR results
                page1_path = ocr_result.output_paths.get("page_1")
                if page1_path:
                    # Load page1 JSON instead of passing file path
                    with open(page1_path, 'r') as f:
                        page1_ocr = json.load(f)
                    extracted_data = extract_from_page1_one_time(page1_ocr)
                    
                    # Merge with page 2 if available
                    page2_path = ocr_result.output_paths.get("page_2")
                    if page2_path:
                        # Load page2 JSON instead of passing file path
                        with open(page2_path, 'r') as f:
                            page2_ocr = json.load(f)
                        extracted_data = merge_with_page2(extracted_data, page2_ocr)
                    
                    # Use json() to handle datetime serialization properly
                    job.extracted_data = json.loads(extracted_data.json())
                    job.status = JobStatus.AWAITING_REVIEW
                else:
                    job.status = JobStatus.FAILED
                    job.error_message = "No OCR results generated"
            else:
                job.status = JobStatus.FAILED
                job.error_message = ocr_result.error_message
        
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = f"Processing failed: {str(e)}"
        
        finally:
            job.processing_completed_at = datetime.now(timezone.utc)
            if job.processing_started_at:
                processing_time = (job.processing_completed_at - job.processing_started_at).total_seconds()
                job.processing_time_seconds = processing_time
            db.commit()
    
    except Exception as e:
        print(f"Background processing error: {str(e)}")
    finally:
        db.close()

@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Upload a single PDF file for processing"""
    db, current_user = db_and_user
    
    # Validate file
    validate_file(file)
    
    try:
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        
        # Save file to storage
        file_path = await save_uploaded_file(file, file_id)
        
        # Create file record
        file_size = len(await file.read())
        await file.seek(0)  # Reset file pointer
        
        file_model = FileModel(
            original_filename=file.filename,
            size_bytes=file_size,
            mime_type=file.content_type,
            pdf_path=file_path
        )
        db.add(file_model)
        db.commit()
        db.refresh(file_model)
        
        # Create processing job
        job = create_processing_job(db, file_model, current_user)
        
        # Start background processing
        background_tasks.add_task(process_file_background, job.id, file_path)
        
        return UploadResponse(
            job_id=job.id,
            file_id=file_model.id,
            filename=file.filename,
            message="File uploaded successfully. Processing started."
        )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

@router.post("/upload/batch", response_model=BatchUploadResponse)
async def upload_batch(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Upload multiple PDF files for batch processing"""
    db, current_user = db_and_user
    
    # Validate batch size
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files allowed per batch"
        )
    
    uploaded_files = []
    
    for file in files:
        try:
            # Validate file
            validate_file(file)
            
            # Generate unique file ID
            file_id = str(uuid.uuid4())
            
            # Save file to storage
            file_path = await save_uploaded_file(file, file_id)
            
            # Create file record
            file_size = len(await file.read())
            await file.seek(0)  # Reset file pointer
            
            file_model = FileModel(
                original_filename=file.filename,
                size_bytes=file_size,
                mime_type=file.content_type,
                pdf_path=file_path
            )
            db.add(file_model)
            db.commit()
            db.refresh(file_model)
            
            # Create processing job
            job = create_processing_job(db, file_model, current_user)
            
            # Start background processing
            background_tasks.add_task(process_file_background, job.id, file_path)
            
            uploaded_files.append(UploadResponse(
                job_id=job.id,
                file_id=file_model.id,
                filename=file.filename,
                message="File uploaded successfully"
            ))
        
        except Exception as e:
            # Continue with other files even if one fails
            uploaded_files.append(UploadResponse(
                job_id=0,
                file_id=0,
                filename=file.filename,
                message=f"Upload failed: {str(e)}"
            ))
    
    return BatchUploadResponse(
        uploaded_files=uploaded_files,
        total_files=len(files),
        message=f"Batch upload completed. {len([f for f in uploaded_files if f.job_id > 0])} files processed successfully."
    )