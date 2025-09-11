#!/usr/bin/env python3
"""
OCR Service for Telkom Contract Documents

Converted from scripts/raw_pipeline_processor.py to be used as a backend service
for the web application. Processes PDF contract files using PP-StructureV3 pipeline.
"""

import os
import sys
import time
import tempfile
import json
from datetime import datetime
from pathlib import Path
from statistics import mean
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

import fitz  # PyMuPDF
from loguru import logger
from paddleocr import PPStructureV3
from pdf2image import convert_from_path

# Import from backend config  
from app.config import settings, get_pipeline_params


@dataclass
class OCRResult:
    """OCR processing result"""
    success: bool
    file_id: str
    pages_processed: int
    processing_time: float
    output_paths: Dict[str, str]  # {"page_1": "path/to/page_1_res.json", ...}
    error_message: Optional[str] = None
    

class OCRService:
    """PP-StructureV3 OCR service for web application"""
    
    def __init__(self):
        self.pipeline = None
        self.temp_dir = None
        self._setup_temp_dir()
        self._initialize_pipeline()
    
    def _setup_temp_dir(self):
        """Create temporary directory for processing"""
        try:
            self.temp_dir = tempfile.mkdtemp(prefix="telkom_ocr_")
            logger.info(f"OCR Service temp directory: {self.temp_dir}")
        except Exception as e:
            logger.error(f"Failed to create temp directory: {str(e)}")
            raise
    
    def _initialize_pipeline(self):
        """Initialize PP-StructureV3 pipeline using centralized configuration"""
        try:
            if settings.log_config_details:
                logger.info("="*80)
                logger.info("🏭 INITIALIZING PP-STRUCTUREV3 OCR SERVICE")
                logger.info("="*80)
            
            # Get pipeline parameters from centralized config
            pipeline_params = get_pipeline_params(settings)
            
            if settings.log_model_loading:
                logger.info("📋 Pipeline Parameters from Config:")
                for key, value in pipeline_params.items():
                    logger.info(f"  {key}: {value}")
            
            # Initialize pipeline with config
            start_time = time.time()
            logger.info("🔄 Loading PP-StructureV3 pipeline...")
            
            self.pipeline = PPStructureV3(**pipeline_params)
            
            load_time = time.time() - start_time
            logger.success(f"✅ Pipeline loaded successfully in {load_time:.2f} seconds")
            
            if settings.log_model_loading:
                logger.info("🎯 Pipeline initialization complete")
                logger.info("="*80)
        
        except Exception as e:
            logger.error(f"❌ Pipeline initialization failed: {str(e)}")
            raise
    
    def _convert_pdf_to_images(self, pdf_path: str, output_dir: str) -> List[str]:
        """Convert PDF pages to images for OCR processing"""
        try:
            logger.info(f"📄 Converting PDF to images: {pdf_path}")
            start_time = time.time()
            
            # Use pdf2image for conversion - only first 2 pages
            images = convert_from_path(
                pdf_path,
                dpi=200,  # Good balance of quality and processing speed
                fmt='PNG',
                thread_count=1,  # Single thread for stability
                first_page=1,
                last_page=2  # Only process first 2 pages
            )
            
            image_paths = []
            for i, image in enumerate(images):
                image_path = os.path.join(output_dir, f"page_{i+1}.png")
                image.save(image_path, 'PNG')
                image_paths.append(image_path)
                logger.info(f"  📸 Page {i+1} saved: {image_path}")
            
            conversion_time = time.time() - start_time
            logger.success(f"✅ PDF converted to {len(images)} images in {conversion_time:.2f}s")
            
            return image_paths
        
        except Exception as e:
            logger.error(f"❌ PDF conversion failed: {str(e)}")
            raise
    
    def _process_page_with_pipeline(self, image_path: str, page_num: int) -> List:
        """Process a single page with PP-StructureV3"""
        try:
            logger.info(f"🔍 Processing page {page_num}: {os.path.basename(image_path)}")
            start_time = time.time()
            
            # Process with PP-StructureV3
            result = self.pipeline.predict(image_path)
            
            processing_time = time.time() - start_time
            logger.success(f"✅ Page {page_num} processed in {processing_time:.2f}s")
            
            return result
        
        except Exception as e:
            logger.error(f"❌ Page {page_num} processing failed: {str(e)}")
            raise
    
    def _save_page_result(self, results: List, output_dir: str, page_num: int) -> str:
        """Save page OCR result to JSON file using built-in save_to_json method"""
        try:
            # Ensure output directory exists
            os.makedirs(output_dir, exist_ok=True)
            
            # Save results using the built-in save_to_json method
            for res in results:
                res.save_to_json(save_path=output_dir)
            
            # Return the path to the main result JSON file
            result_file = os.path.join(output_dir, f"page_{page_num}_res.json")
            logger.info(f"💾 Page {page_num} result saved: {output_dir}")
            
            return result_file
        
        except Exception as e:
            logger.error(f"❌ Failed to save page {page_num} result: {str(e)}")
            raise
    
    def process_pdf(self, pdf_path: str, output_base_dir: str, file_id: str) -> OCRResult:
        """
        Process a PDF file with OCR and return structured results
        
        Args:
            pdf_path: Path to PDF file
            output_base_dir: Base directory for OCR outputs
            file_id: Unique identifier for this file
        
        Returns:
            OCRResult with processing details and output paths
        """
        start_time = time.time()
        
        try:
            logger.info("="*80)
            logger.info(f"🚀 Starting OCR processing for: {os.path.basename(pdf_path)}")
            logger.info(f"📁 File ID: {file_id}")
            logger.info("="*80)
            
            # Create output directory structure
            file_output_dir = os.path.join(output_base_dir, f"{file_id}_ocr_results")
            os.makedirs(file_output_dir, exist_ok=True)
            
            # Convert PDF to images
            page_temp_dir = os.path.join(self.temp_dir, file_id)
            os.makedirs(page_temp_dir, exist_ok=True)
            
            image_paths = self._convert_pdf_to_images(pdf_path, page_temp_dir)
            
            # Process each page
            output_paths = {}
            page_times = []
            
            for i, image_path in enumerate(image_paths):
                page_num = i + 1
                
                # Process page with OCR
                page_start = time.time()
                ocr_results = self._process_page_with_pipeline(image_path, page_num)
                page_time = time.time() - page_start
                page_times.append(page_time)
                
                # Save result
                page_output_dir = os.path.join(file_output_dir, f"page_{page_num}_results")
                result_file = self._save_page_result(ocr_results, page_output_dir, page_num)
                
                output_paths[f"page_{page_num}"] = result_file
            
            total_time = time.time() - start_time
            avg_page_time = mean(page_times) if page_times else 0
            
            # Log summary
            logger.info("="*80)
            logger.success(f"✅ OCR PROCESSING COMPLETE")
            logger.info(f"📄 File: {os.path.basename(pdf_path)}")
            logger.info(f"📊 Pages processed: {len(image_paths)}")
            logger.info(f"⏱️  Total time: {total_time:.2f}s")
            logger.info(f"⏱️  Average per page: {avg_page_time:.2f}s")
            logger.info(f"📂 Output directory: {file_output_dir}")
            logger.info("="*80)
            
            return OCRResult(
                success=True,
                file_id=file_id,
                pages_processed=len(image_paths),
                processing_time=total_time,
                output_paths=output_paths
            )
        
        except Exception as e:
            total_time = time.time() - start_time
            error_msg = f"OCR processing failed: {str(e)}"
            
            logger.error("="*80)
            logger.error(f"❌ OCR PROCESSING FAILED")
            logger.error(f"📄 File: {os.path.basename(pdf_path)}")
            logger.error(f"⏱️  Time before failure: {total_time:.2f}s")
            logger.error(f"🚨 Error: {error_msg}")
            logger.error("="*80)
            
            return OCRResult(
                success=False,
                file_id=file_id,
                pages_processed=0,
                processing_time=total_time,
                output_paths={},
                error_message=error_msg
            )
    
    def cleanup_temp_files(self) -> None:
        """Clean up temporary files"""
        try:
            if self.temp_dir and os.path.exists(self.temp_dir):
                import shutil
                shutil.rmtree(self.temp_dir)
                logger.info(f"🧹 Cleaned up temp directory: {self.temp_dir}")
        except Exception as e:
            logger.warning(f"⚠️  Failed to cleanup temp directory: {str(e)}")
    
    def __del__(self):
        """Cleanup on object destruction"""
        self.cleanup_temp_files()


# Singleton instance for web application
_ocr_service_instance: Optional[OCRService] = None

def get_ocr_service() -> OCRService:
    """Get or create OCR service singleton instance"""
    global _ocr_service_instance
    
    if _ocr_service_instance is None:
        _ocr_service_instance = OCRService()
    
    return _ocr_service_instance