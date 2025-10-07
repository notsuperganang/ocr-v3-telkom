"""
SQLAlchemy database models for Telkom Contract Extractor
Based on the project brief database schema design
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, BigInteger, Enum, ForeignKey, Float, Date, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()

class JobStatus(enum.Enum):
    """Processing job status enumeration"""
    QUEUED = "queued"
    PROCESSING = "processing"
    EXTRACTED = "extracted"
    AWAITING_REVIEW = "awaiting_review"
    CONFIRMED = "confirmed"
    FAILED = "failed"

class ExportTarget(enum.Enum):
    """Export target enumeration"""
    JSON = "json"
    EXCEL = "excel"

class File(Base):
    """File metadata and storage"""
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String, nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    mime_type = Column(String, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    pdf_path = Column(String, nullable=False)  # Path to stored PDF file
    
    # Relationships
    processing_jobs = relationship("ProcessingJob", back_populates="file")
    contracts = relationship("Contract", back_populates="file")

class ProcessingJob(Base):
    """Job queue and staging results"""
    __tablename__ = "processing_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.QUEUED, nullable=False)
    
    # Data fields (JSONB for flexibility)
    extracted_data = Column(JSONB)  # Raw extractor function output
    edited_data = Column(JSONB)     # Draft from UI right panel, auto-saved
    ocr_artifacts = Column(JSONB)   # OCR JSON file paths per page
    
    # Processing metadata
    error_message = Column(Text)
    processing_started_at = Column(DateTime(timezone=True))
    processing_completed_at = Column(DateTime(timezone=True))
    processing_time_seconds = Column(Float)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    reviewed_by = Column(String)  # Future: user who reviewed/confirmed
    reviewed_at = Column(DateTime(timezone=True))
    
    # Relationships
    file = relationship("File", back_populates="processing_jobs")
    contracts = relationship("Contract", back_populates="source_job")
    extraction_logs = relationship("ExtractionLog", back_populates="job")

class Contract(Base):
    """Final 'committed' contract data"""
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    source_job_id = Column(Integer, ForeignKey("processing_jobs.id"), nullable=False)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)

    # Final confirmed data
    final_data = Column(JSONB, nullable=False)  # Merged edited_data from job (source of truth)
    version = Column(Integer, default=1)        # For future versioning

    # Denormalized fields for efficient querying and aggregation
    # Customer information
    customer_name = Column(String(500))  # From final_data->informasi_pelanggan->nama_pelanggan
    customer_npwp = Column(String(50))   # From final_data->informasi_pelanggan->npwp

    # Contract period
    period_start = Column(Date)  # From final_data->jangka_waktu->mulai
    period_end = Column(Date)    # From final_data->jangka_waktu->akhir

    # Service counts (for KPI aggregation)
    service_connectivity = Column(Integer, default=0)      # From final_data->layanan_utama->connectivity_telkom
    service_non_connectivity = Column(Integer, default=0)  # From final_data->layanan_utama->non_connectivity_telkom
    service_bundling = Column(Integer, default=0)          # From final_data->layanan_utama->bundling

    # Payment method (normalized enum from root-level tata_cara_pembayaran)
    payment_method = Column(String(20))  # termin | recurring | one_time
    termin_count = Column(Integer)       # For termin payments: number of termin installments

    # Financial data (NUMERIC for precision, avoiding float)
    # Sum of ALL items in rincian_layanan array
    installation_cost = Column(Numeric(18, 2), default=0)          # Sum of all rincian_layanan->biaya_instalasi
    annual_subscription_cost = Column(Numeric(18, 2), default=0)   # Sum of all rincian_layanan->biaya_langganan_tahunan
    total_contract_value = Column(Numeric(18, 2), default=0)       # Computed: installation_cost + annual_subscription_cost

    # Extended denormalized fields for comprehensive contract data access
    # A. Customer & Representatives (from informasi_pelanggan)
    customer_address = Column(Text)  # From final_data->informasi_pelanggan->alamat
    rep_name = Column(Text)  # From final_data->informasi_pelanggan->perwakilan->nama
    rep_title = Column(Text)  # From final_data->informasi_pelanggan->perwakilan->jabatan
    customer_contact_name = Column(Text)  # From final_data->informasi_pelanggan->kontak_person->nama
    customer_contact_title = Column(Text)  # From final_data->informasi_pelanggan->kontak_person->jabatan
    customer_contact_email = Column(Text)  # From final_data->informasi_pelanggan->kontak_person->email
    customer_contact_phone = Column(Text)  # From final_data->informasi_pelanggan->kontak_person->telepon

    # B. Contract Period Raw (for tracing original format variations)
    period_start_raw = Column(Text)  # Raw period start before parsing (for debugging)
    period_end_raw = Column(Text)  # Raw period end before parsing (for debugging)

    # C. Telkom Contact Person (from kontak_person_telkom)
    telkom_contact_name = Column(Text)  # From final_data->kontak_person_telkom->nama
    telkom_contact_title = Column(Text)  # From final_data->kontak_person_telkom->jabatan
    telkom_contact_email = Column(Text)  # From final_data->kontak_person_telkom->email
    telkom_contact_phone = Column(Text)  # From final_data->kontak_person_telkom->telepon

    # D. Payment Details (from tata_cara_pembayaran)
    payment_description = Column(Text)  # From final_data->tata_cara_pembayaran->description
    termin_total_count = Column(Integer)  # Computed: COUNT of termin_payments array
    termin_total_amount = Column(Numeric(18, 2))  # Computed: SUM of termin_payments[].amount
    payment_raw_text = Column(Text)  # From final_data->tata_cara_pembayaran->raw_text
    termin_payments_json = Column(JSONB)  # Snapshot: final_data->tata_cara_pembayaran->termin_payments (for detail inspection)

    # E. Extraction Metadata
    extraction_timestamp = Column(DateTime(timezone=True))  # From final_data->extraction_timestamp (parsed)
    contract_processing_time_sec = Column(Float)  # From final_data->processing_time_seconds or processing_job

    # Confirmation metadata
    confirmed_by = Column(String)  # User who confirmed (future: foreign key to users)
    confirmed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    source_job = relationship("ProcessingJob", back_populates="contracts")
    file = relationship("File", back_populates="contracts")
    export_history = relationship("ExportHistory", back_populates="contract")

class ExtractionLog(Base):
    """Processing logs and audit trail"""
    __tablename__ = "extraction_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("processing_jobs.id"), nullable=False)
    
    level = Column(String, nullable=False)  # INFO, WARNING, ERROR, DEBUG
    message = Column(Text, nullable=False)
    details = Column(JSONB)  # Additional structured data
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    job = relationship("ProcessingJob", back_populates="extraction_logs")

class ExportHistory(Base):
    """Export tracking and history"""
    __tablename__ = "export_history"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    
    export_target = Column(Enum(ExportTarget), nullable=False)
    export_path = Column(String)  # Path to generated file (if applicable)
    status = Column(String, default="success")  # success, failed
    notes = Column(Text)
    
    exported_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    contract = relationship("Contract", back_populates="export_history")