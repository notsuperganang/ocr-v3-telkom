"""
File Management Service
Handles cleanup of uploaded files, OCR artifacts, and orphaned storage
"""

import os
import shutil
import glob
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.database import File, ProcessingJob, Contract
from app.config import settings


class FileManager:
    """Manages file operations and cleanup for the Telkom Contract Extractor"""

    def __init__(self):
        self.upload_dir = Path("storage/uploads")
        self.ocr_output_dir = Path("storage/ocr_outputs")
        self.temp_dir = Path("/tmp")

        # Ensure directories exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.ocr_output_dir.mkdir(parents=True, exist_ok=True)

    def delete_contract_files(self, db: Session, contract_id: int) -> Dict[str, any]:
        """
        Delete all files associated with a contract
        Returns summary of deleted files and sizes
        """
        deleted_files = []
        total_size = 0
        errors = []

        try:
            # Get contract and associated file
            contract = db.query(Contract).filter(Contract.id == contract_id).first()
            if not contract:
                return {"error": "Contract not found", "deleted_files": [], "total_size": 0}

            file_record = db.query(File).filter(File.id == contract.file_id).first()
            if file_record:
                # Delete uploaded PDF
                pdf_path = Path(file_record.pdf_path)
                if pdf_path.exists():
                    size = pdf_path.stat().st_size
                    pdf_path.unlink()
                    deleted_files.append({
                        "path": str(pdf_path),
                        "type": "uploaded_pdf",
                        "size": size
                    })
                    total_size += size

                # Delete OCR artifacts
                job = db.query(ProcessingJob).filter(ProcessingJob.id == contract.source_job_id).first()
                if job and job.ocr_artifacts:
                    ocr_size = self._delete_ocr_artifacts(job.ocr_artifacts)
                    if ocr_size > 0:
                        deleted_files.append({
                            "path": f"OCR artifacts for job {job.id}",
                            "type": "ocr_artifacts",
                            "size": ocr_size
                        })
                        total_size += ocr_size

            return {
                "contract_id": contract_id,
                "deleted_files": deleted_files,
                "total_size": total_size,
                "errors": errors
            }

        except Exception as e:
            errors.append(f"Error deleting contract files: {str(e)}")
            return {
                "contract_id": contract_id,
                "deleted_files": deleted_files,
                "total_size": total_size,
                "errors": errors
            }

    def delete_job_files(self, db: Session, job_id: int, keep_pdf: bool = True) -> Dict[str, any]:
        """
        Delete files associated with a processing job
        keep_pdf: If True, only delete OCR artifacts, keep uploaded PDF
        """
        deleted_files = []
        total_size = 0
        errors = []

        try:
            job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
            if not job:
                return {"error": "Job not found", "deleted_files": [], "total_size": 0}

            # Delete OCR artifacts
            if job.ocr_artifacts:
                ocr_size = self._delete_ocr_artifacts(job.ocr_artifacts)
                if ocr_size > 0:
                    deleted_files.append({
                        "path": f"OCR artifacts for job {job_id}",
                        "type": "ocr_artifacts",
                        "size": ocr_size
                    })
                    total_size += ocr_size

            # Delete uploaded PDF if requested and no other jobs reference it
            if not keep_pdf:
                file_record = db.query(File).filter(File.id == job.file_id).first()
                if file_record:
                    # Check if other jobs reference this file
                    other_jobs = db.query(ProcessingJob).filter(
                        ProcessingJob.file_id == job.file_id,
                        ProcessingJob.id != job_id
                    ).count()

                    if other_jobs == 0:
                        pdf_path = Path(file_record.pdf_path)
                        if pdf_path.exists():
                            size = pdf_path.stat().st_size
                            pdf_path.unlink()
                            deleted_files.append({
                                "path": str(pdf_path),
                                "type": "uploaded_pdf",
                                "size": size
                            })
                            total_size += size

            return {
                "job_id": job_id,
                "deleted_files": deleted_files,
                "total_size": total_size,
                "errors": errors
            }

        except Exception as e:
            errors.append(f"Error deleting job files: {str(e)}")
            return {
                "job_id": job_id,
                "deleted_files": deleted_files,
                "total_size": total_size,
                "errors": errors
            }

    def _delete_ocr_artifacts(self, ocr_artifacts: Dict[str, str]) -> int:
        """Delete OCR artifacts and return total size deleted"""
        total_size = 0

        for page, artifact_path in ocr_artifacts.items():
            try:
                artifact_path = Path(artifact_path)

                # Delete the specific OCR result file
                if artifact_path.exists():
                    total_size += artifact_path.stat().st_size
                    artifact_path.unlink()

                # Delete the parent OCR results directory if it exists
                if artifact_path.parent.exists():
                    # Calculate size of directory before deletion
                    for root, dirs, files in os.walk(artifact_path.parent):
                        for file in files:
                            file_path = Path(root) / file
                            if file_path.exists():
                                total_size += file_path.stat().st_size

                    # Remove the entire OCR results directory
                    shutil.rmtree(artifact_path.parent, ignore_errors=True)

                    # Also try to remove the parent job directory if empty
                    try:
                        if artifact_path.parent.parent.exists():
                            artifact_path.parent.parent.rmdir()  # Only removes if empty
                    except OSError:
                        pass  # Directory not empty, that's fine

            except Exception as e:
                print(f"Error deleting OCR artifact {artifact_path}: {e}")
                continue

        return total_size

    def find_orphaned_files(self, db: Session) -> Dict[str, any]:
        """
        Find files in storage that don't have corresponding database records
        """
        orphaned = []
        total_size = 0

        # Get all file paths from database
        db_files = set()
        file_records = db.query(File).all()
        for file_record in file_records:
            if file_record.pdf_path:
                db_files.add(Path(file_record.pdf_path).name)

        # Check uploaded files
        if self.upload_dir.exists():
            for file_path in self.upload_dir.iterdir():
                if file_path.is_file() and file_path.name not in db_files:
                    size = file_path.stat().st_size
                    orphaned.append({
                        "path": str(file_path),
                        "type": "uploaded_pdf",
                        "size": size,
                        "modified": datetime.fromtimestamp(file_path.stat().st_mtime)
                    })
                    total_size += size

        # Check OCR output directories
        db_job_ids = set()
        jobs = db.query(ProcessingJob).all()
        for job in jobs:
            db_job_ids.add(f"{job.id}_ocr_results")

        if self.ocr_output_dir.exists():
            for dir_path in self.ocr_output_dir.iterdir():
                if dir_path.is_dir() and dir_path.name not in db_job_ids:
                    dir_size = sum(f.stat().st_size for f in dir_path.rglob('*') if f.is_file())
                    orphaned.append({
                        "path": str(dir_path),
                        "type": "ocr_directory",
                        "size": dir_size,
                        "modified": datetime.fromtimestamp(dir_path.stat().st_mtime)
                    })
                    total_size += dir_size

        return {
            "orphaned_files": orphaned,
            "total_count": len(orphaned),
            "total_size": total_size
        }

    def cleanup_orphaned_files(self, db: Session) -> Dict[str, any]:
        """
        Delete all orphaned files found in storage
        """
        orphaned_info = self.find_orphaned_files(db)
        deleted_files = []
        errors = []

        for item in orphaned_info["orphaned_files"]:
            try:
                path = Path(item["path"])
                if path.exists():
                    if path.is_file():
                        path.unlink()
                    elif path.is_dir():
                        shutil.rmtree(path)
                    deleted_files.append(item)
            except Exception as e:
                errors.append(f"Error deleting {item['path']}: {str(e)}")

        return {
            "deleted_files": deleted_files,
            "total_count": len(deleted_files),
            "total_size": sum(f["size"] for f in deleted_files),
            "errors": errors
        }

    def get_storage_metrics(self, db: Session) -> Dict[str, any]:
        """
        Get comprehensive storage usage metrics
        """
        metrics = {
            "upload_directory": {"path": str(self.upload_dir), "size": 0, "files": 0},
            "ocr_directory": {"path": str(self.ocr_output_dir), "size": 0, "files": 0},
            "database_records": {"files": 0, "jobs": 0, "contracts": 0}
        }

        # Calculate upload directory size
        if self.upload_dir.exists():
            for file_path in self.upload_dir.rglob('*'):
                if file_path.is_file():
                    metrics["upload_directory"]["size"] += file_path.stat().st_size
                    metrics["upload_directory"]["files"] += 1

        # Calculate OCR directory size
        if self.ocr_output_dir.exists():
            for file_path in self.ocr_output_dir.rglob('*'):
                if file_path.is_file():
                    metrics["ocr_directory"]["size"] += file_path.stat().st_size
                    metrics["ocr_directory"]["files"] += 1

        # Get database counts
        metrics["database_records"]["files"] = db.query(File).count()
        metrics["database_records"]["jobs"] = db.query(ProcessingJob).count()
        metrics["database_records"]["contracts"] = db.query(Contract).count()

        # Add orphaned files info
        orphaned_info = self.find_orphaned_files(db)
        metrics["orphaned_files"] = orphaned_info

        return metrics

    def cleanup_temp_files(self) -> Dict[str, any]:
        """
        Clean up temporary OCR processing files in /tmp
        """
        deleted_files = []
        total_size = 0
        errors = []

        try:
            # Look for telkom_ocr_* directories in /tmp
            temp_pattern = "/tmp/telkom_ocr_*"
            temp_dirs = glob.glob(temp_pattern)

            for temp_dir in temp_dirs:
                try:
                    temp_path = Path(temp_dir)
                    if temp_path.exists() and temp_path.is_dir():
                        # Calculate size before deletion
                        dir_size = sum(f.stat().st_size for f in temp_path.rglob('*') if f.is_file())
                        shutil.rmtree(temp_path)
                        deleted_files.append({
                            "path": str(temp_path),
                            "type": "temp_directory",
                            "size": dir_size
                        })
                        total_size += dir_size
                except Exception as e:
                    errors.append(f"Error deleting temp directory {temp_dir}: {str(e)}")

        except Exception as e:
            errors.append(f"Error during temp cleanup: {str(e)}")

        return {
            "deleted_files": deleted_files,
            "total_size": total_size,
            "errors": errors
        }


# Global instance
file_manager = FileManager()