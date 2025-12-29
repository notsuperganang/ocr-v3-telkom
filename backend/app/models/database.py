"""
SQLAlchemy database models for Telkom Contract Extractor
Based on the project brief database schema design
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, BigInteger, Enum, ForeignKey, Float, Date, Numeric, Boolean
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

class TerminPaymentStatus(enum.Enum):
    """Termin payment status enumeration"""
    PENDING = "PENDING"
    DUE = "DUE"
    OVERDUE = "OVERDUE"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

class UserRole(enum.Enum):
    """User role enumeration for RBAC"""
    STAFF = "STAFF"
    MANAGER = "MANAGER"

class User(Base):
    """User authentication and management"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)

    # Role-based access control
    role = Column(Enum(UserRole), nullable=False, default=UserRole.STAFF)

    # Account status
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships (back_populates defined in related tables)
    reviewed_jobs = relationship("ProcessingJob", back_populates="reviewer")
    confirmed_contracts = relationship("Contract", back_populates="confirmer")
    created_term_payments = relationship("ContractTermPayment", foreign_keys="ContractTermPayment.created_by_id", back_populates="creator")
    updated_term_payments = relationship("ContractTermPayment", foreign_keys="ContractTermPayment.updated_by_id", back_populates="updater")
    created_recurring_payments = relationship("ContractRecurringPayment", foreign_keys="ContractRecurringPayment.created_by_id", back_populates="creator")
    updated_recurring_payments = relationship("ContractRecurringPayment", foreign_keys="ContractRecurringPayment.updated_by_id", back_populates="updater")

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
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who reviewed/confirmed
    reviewed_at = Column(DateTime(timezone=True))

    # Relationships
    file = relationship("File", back_populates="processing_jobs")
    contracts = relationship("Contract", back_populates="source_job")
    extraction_logs = relationship("ExtractionLog", back_populates="job")
    reviewer = relationship("User", back_populates="reviewed_jobs")

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
    termin_payments_raw = Column(JSONB)  # Raw snapshot: final_data->tata_cara_pembayaran->termin_payments (OCR extraction only)

    # D2. Recurring Payment Details (computed for payment_method="recurring")
    recurring_monthly_amount = Column(Numeric(18, 2), default=0, nullable=False)  # Monthly subscription charge (annual_subscription_cost / 12)
    recurring_month_count = Column(Integer, nullable=True)  # Number of monthly billing cycles (period_start to period_end inclusive)
    recurring_total_amount = Column(Numeric(18, 2), default=0, nullable=False)  # Total recurring billing amount (recurring_monthly_amount * recurring_month_count)

    # E. Extraction Metadata
    extraction_timestamp = Column(DateTime(timezone=True))  # From final_data->extraction_timestamp (parsed)
    contract_processing_time_sec = Column(Float)  # From final_data->processing_time_seconds or processing_job

    # Confirmation metadata
    confirmed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # User who confirmed
    confirmed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    source_job = relationship("ProcessingJob", back_populates="contracts")
    file = relationship("File", back_populates="contracts")
    export_history = relationship("ExportHistory", back_populates="contract")
    term_payments = relationship("ContractTermPayment", back_populates="contract", cascade="all, delete-orphan")
    recurring_payments = relationship("ContractRecurringPayment", back_populates="contract", cascade="all, delete-orphan")
    confirmer = relationship("User", back_populates="confirmed_contracts")

class ContractTermPayment(Base):
    """Normalized termin payment tracking for operational reminders and status management"""
    __tablename__ = "contract_term_payments"

    id = Column(BigInteger, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Termin details
    termin_number = Column(Integer, nullable=False)  # 1, 2, 3, ...
    period_label = Column(Text, nullable=False)  # Original period string (e.g., "Maret 2025")
    period_year = Column(Integer, nullable=False)  # Extracted year (e.g., 2025)
    period_month = Column(Integer, nullable=False)  # Extracted month 1-12 (Januari-Desember)

    # Amount tracking
    original_amount = Column(Numeric(18, 2), nullable=False)  # Original amount from extraction
    amount = Column(Numeric(18, 2), nullable=False)  # Current editable amount

    # Status tracking
    status = Column(String(20), nullable=False, default="PENDING")  # PENDING/DUE/OVERDUE/PAID/CANCELLED
    paid_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when marked as paid
    notes = Column(Text, nullable=True)  # Additional notes or comments

    # Audit fields
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who created this record
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who last updated this record
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    contract = relationship("Contract", back_populates="term_payments")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_term_payments")
    updater = relationship("User", foreign_keys=[updated_by_id], back_populates="updated_term_payments")

class ContractRecurringPayment(Base):
    """Normalized recurring payment tracking for operational monthly billing management"""
    __tablename__ = "contract_recurring_payments"

    id = Column(BigInteger, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Recurring payment details
    cycle_number = Column(Integer, nullable=False)  # Billing cycle sequence number (1, 2, 3, ...)
    period_label = Column(Text, nullable=False)  # Period string (e.g., "Januari 2025")
    period_year = Column(Integer, nullable=False)  # Billing year (e.g., 2025)
    period_month = Column(Integer, nullable=False)  # Billing month 1-12 (Januari-Desember)

    # Amount tracking
    original_amount = Column(Numeric(18, 2), nullable=False)  # Original monthly amount from extraction
    amount = Column(Numeric(18, 2), nullable=False)  # Current editable monthly amount

    # Status tracking (reuses TerminPaymentStatus enum)
    status = Column(String(20), nullable=False, default="PENDING")  # PENDING/DUE/OVERDUE/PAID/CANCELLED
    paid_at = Column(DateTime(timezone=True), nullable=True)  # Timestamp when marked as paid
    notes = Column(Text, nullable=True)  # Additional notes or comments

    # Audit fields
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who created this record
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who last updated this record
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    contract = relationship("Contract", back_populates="recurring_payments")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_recurring_payments")
    updater = relationship("User", foreign_keys=[updated_by_id], back_populates="updated_recurring_payments")

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