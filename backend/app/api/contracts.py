"""
Contracts API endpoints
Read-only endpoints for viewing and exporting confirmed contracts
"""

import os
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from pydantic import BaseModel

from app.api.dependencies import get_db_and_user
from app.models.database import Contract, ProcessingJob, File as FileModel, ExportHistory, ExportTarget
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

def extract_contract_summary_data(final_data: Dict[str, Any]) -> Dict[str, str]:
    """Extract key fields for contract summary display"""
    result = {}

    if isinstance(final_data, dict):
        # Extract customer name
        customer_info = final_data.get('customer_info', {}) or final_data.get('informasi_pelanggan', {})
        if isinstance(customer_info, dict):
            result['customer_name'] = (
                customer_info.get('nama_pelanggan', '') or
                customer_info.get('customer_name', '') or
                customer_info.get('nama', '')
            )

        # Extract contract period (jangka_waktu)
        jangka_waktu = final_data.get('jangka_waktu', {})
        if isinstance(jangka_waktu, dict):
            result['contract_start_date'] = jangka_waktu.get('mulai', '')
            result['contract_end_date'] = jangka_waktu.get('akhir', '')

        # Extract payment method (tata_cara_pembayaran)
        tata_cara = final_data.get('tata_cara_pembayaran', {})
        if isinstance(tata_cara, dict):
            method_type = tata_cara.get('method_type', '')
            # Map to friendly labels
            payment_method_map = {
                'one_time_charge': 'OTC',
                'recurring': 'Recurring',
                'termin': 'Termin'
            }
            result['payment_method'] = payment_method_map.get(method_type, '')

    return result

@router.get("", response_model=ContractListResponse)
async def list_contracts(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search in filename or contract data"),
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
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
                Contract.final_data.astext.ilike(search_term)
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
    
    # Build response
    contract_summaries = []
    for contract in contracts:
        # Get file info
        file_model = db.query(FileModel).filter(FileModel.id == contract.file_id).first()
        
        # Extract summary data
        summary_data = extract_contract_summary_data(contract.final_data)
        
        contract_summaries.append(ContractSummary(
            id=contract.id,
            file_id=contract.file_id,
            source_job_id=contract.source_job_id,
            filename=file_model.original_filename if file_model else "Unknown",
            confirmed_by=contract.confirmed_by,
            confirmed_at=contract.confirmed_at,
            created_at=contract.created_at,
            contract_start_date=summary_data.get('contract_start_date'),
            contract_end_date=summary_data.get('contract_end_date'),
            payment_method=summary_data.get('payment_method'),
            customer_name=summary_data.get('customer_name')
        ))
    
    total_pages = (total + per_page - 1) // per_page
    
    return ContractListResponse(
        contracts=contract_summaries,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )

@router.get("/{contract_id}", response_model=ContractDetail)
async def get_contract_detail(
    contract_id: int,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
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
        confirmed_by=contract.confirmed_by,
        confirmed_at=contract.confirmed_at,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
        file_size_bytes=file_model.size_bytes,
        processing_time_seconds=job.processing_time_seconds if job else None
    )

@router.get("/{contract_id}/json")
async def download_contract_json(
    contract_id: int,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
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
            "confirmed_by": contract.confirmed_by,
            "version": contract.version,
            "data": contract.final_data
        }
        
        json_content = json.dumps(json_data, indent=2, ensure_ascii=False)
        
        # Log export
        export_record = ExportHistory(
            contract_id=contract.id,
            export_target=ExportTarget.JSON,
            status="success",
            notes=f"Downloaded by {current_user}"
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
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
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

@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: int,
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
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
            "deleted_by": current_user,
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