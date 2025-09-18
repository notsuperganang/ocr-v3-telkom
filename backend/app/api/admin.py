"""
Admin API endpoints
Handles administrative operations like file cleanup and storage management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any

from app.api.dependencies import get_db_and_user
from app.services.file_manager import file_manager

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Response models
class StorageMetricsResponse(BaseModel):
    upload_directory: Dict[str, Any]
    ocr_directory: Dict[str, Any]
    database_records: Dict[str, Any]
    orphaned_files: Dict[str, Any]

class CleanupResponse(BaseModel):
    message: str
    deleted_files: int
    total_size: int
    errors: list

@router.get("/storage/metrics", response_model=StorageMetricsResponse)
async def get_storage_metrics(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Get comprehensive storage usage metrics"""
    db, current_user = db_and_user

    try:
        metrics = file_manager.get_storage_metrics(db)
        return StorageMetricsResponse(**metrics)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get storage metrics: {str(e)}"
        )

@router.get("/storage/orphaned")
async def find_orphaned_files(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Find files in storage without database references"""
    db, current_user = db_and_user

    try:
        orphaned_info = file_manager.find_orphaned_files(db)
        return orphaned_info

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find orphaned files: {str(e)}"
        )

@router.delete("/storage/orphaned", response_model=CleanupResponse)
async def cleanup_orphaned_files(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Delete all orphaned files from storage"""
    db, current_user = db_and_user

    try:
        cleanup_result = file_manager.cleanup_orphaned_files(db)

        return CleanupResponse(
            message=f"Cleaned up orphaned files by {current_user}",
            deleted_files=cleanup_result["total_count"],
            total_size=cleanup_result["total_size"],
            errors=cleanup_result["errors"]
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup orphaned files: {str(e)}"
        )

@router.delete("/storage/temp", response_model=CleanupResponse)
async def cleanup_temp_files(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Clean up temporary OCR processing files"""
    db, current_user = db_and_user

    try:
        cleanup_result = file_manager.cleanup_temp_files()

        return CleanupResponse(
            message=f"Cleaned up temporary files by {current_user}",
            deleted_files=len(cleanup_result["deleted_files"]),
            total_size=cleanup_result["total_size"],
            errors=cleanup_result["errors"]
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup temp files: {str(e)}"
        )

@router.delete("/storage/all", response_model=CleanupResponse)
async def cleanup_all_files(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Clean up all orphaned and temporary files"""
    db, current_user = db_and_user

    try:
        # Clean up orphaned files
        orphaned_result = file_manager.cleanup_orphaned_files(db)

        # Clean up temp files
        temp_result = file_manager.cleanup_temp_files()

        total_deleted = orphaned_result["total_count"] + len(temp_result["deleted_files"])
        total_size = orphaned_result["total_size"] + temp_result["total_size"]
        all_errors = orphaned_result["errors"] + temp_result["errors"]

        return CleanupResponse(
            message=f"Cleaned up all orphaned and temporary files by {current_user}",
            deleted_files=total_deleted,
            total_size=total_size,
            errors=all_errors
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup all files: {str(e)}"
        )

@router.get("/storage/health")
async def storage_health_check(
    db_and_user: tuple[Session, str] = Depends(get_db_and_user)
):
    """Get storage health status and recommendations"""
    db, current_user = db_and_user

    try:
        metrics = file_manager.get_storage_metrics(db)
        orphaned = metrics["orphaned_files"]

        total_storage = (
            metrics["upload_directory"]["size"] +
            metrics["ocr_directory"]["size"]
        )

        # Calculate health score
        orphaned_ratio = orphaned["total_size"] / total_storage if total_storage > 0 else 0

        health_status = "healthy"
        recommendations = []

        if orphaned_ratio > 0.1:  # More than 10% orphaned
            health_status = "warning"
            recommendations.append("High number of orphaned files detected")

        if orphaned["total_count"] > 50:
            health_status = "warning"
            recommendations.append("Many orphaned files present")

        if total_storage > 100 * 1024 * 1024:  # More than 100MB
            recommendations.append("Consider regular cleanup maintenance")

        return {
            "status": health_status,
            "total_storage_bytes": total_storage,
            "orphaned_files_count": orphaned["total_count"],
            "orphaned_size_bytes": orphaned["total_size"],
            "orphaned_ratio": round(orphaned_ratio * 100, 2),
            "recommendations": recommendations,
            "last_checked": current_user
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check storage health: {str(e)}"
        )