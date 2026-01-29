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
    # Invoice management relationships
    created_payment_transactions = relationship("PaymentTransaction", back_populates="created_by")
    uploaded_invoice_documents = relationship("InvoiceDocument", back_populates="uploaded_by")
    # Account relationships
    assigned_accounts = relationship("Account", foreign_keys="Account.assigned_officer_id", back_populates="assigned_officer")
    created_accounts = relationship("Account", foreign_keys="Account.created_by_id", back_populates="creator")


class AccountManager(Base):
    """Telkom Account Managers - CRUD managed by Paycol officers"""
    __tablename__ = "account_managers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=True)  # Jabatan/position
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    accounts = relationship("Account", back_populates="account_manager")
    contracts = relationship("Contract", back_populates="telkom_contact")


class Segment(Base):
    """Segment master data for client classification"""
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    accounts = relationship("Account", back_populates="segment")


class Witel(Base):
    """Witel (regional office) master data"""
    __tablename__ = "witels"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False, unique=True)  # e.g., "901"
    name = Column(String(100), nullable=False)  # e.g., "Aceh"
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    accounts = relationship("Account", back_populates="witel")


class Account(Base):
    """Master client entity - manually managed via CRUD by staff"""
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)

    # Business identifiers
    account_number = Column(String(50), unique=True, nullable=True, index=True)  # Telkom internal ID
    name = Column(String(500), nullable=False)  # Customer name
    nipnas = Column(String(50), nullable=True, index=True)  # Customer identifier
    bus_area = Column(String(50), nullable=True)  # Business area (manual input)

    # Foreign keys to reference tables
    segment_id = Column(Integer, ForeignKey("segments.id", ondelete="SET NULL"), nullable=True, index=True)
    witel_id = Column(Integer, ForeignKey("witels.id", ondelete="SET NULL"), nullable=True, index=True)
    account_manager_id = Column(Integer, ForeignKey("account_managers.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_officer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Status and notes
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    notes = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    segment = relationship("Segment", back_populates="accounts")
    witel = relationship("Witel", back_populates="accounts")
    account_manager = relationship("AccountManager", back_populates="accounts")
    assigned_officer = relationship("User", foreign_keys=[assigned_officer_id], back_populates="assigned_accounts")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_accounts")
    contracts = relationship("Contract", back_populates="account")


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

    # Account relationship (new backbone refactor)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    contract_year = Column(Integer, nullable=False, index=True)  # Working year (2024, 2025, etc.)
    telkom_contact_id = Column(Integer, ForeignKey("account_managers.id", ondelete="SET NULL"), nullable=True, index=True)

    # Final confirmed data
    final_data = Column(JSONB, nullable=False)  # Merged edited_data from job (source of truth)
    version = Column(Integer, default=1)        # For future versioning

    # Denormalized fields for efficient querying and aggregation
    # Contract identification
    contract_number = Column(String(100), unique=True, nullable=True, index=True)  # K.TEL. XX/XXX/XXX/YYYY format

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
    # Account backbone relationships
    account = relationship("Account", back_populates="contracts")
    telkom_contact = relationship("AccountManager", back_populates="contracts")
    # Customer contacts (manually added)
    customer_contacts = relationship("ContractContact", back_populates="contract", cascade="all, delete-orphan")


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

    # Invoice management fields
    invoice_number = Column(String(50), unique=True, nullable=True)  # Format: AAAAAAA-NNNNNN-YYYYMM
    invoice_status = Column(String(30), default="DRAFT", server_default="DRAFT", nullable=False)  # DRAFT/SENT/PAID/etc
    due_date = Column(DateTime(timezone=True), nullable=True)  # Invoice due date

    # Tax breakdown (auto-calculated via trigger)
    base_amount = Column(Numeric(18, 2), nullable=True)  # DPP (Dasar Pengenaan Pajak) = amount / 1.11
    ppn_amount = Column(Numeric(18, 2), nullable=True)  # PPN 11% = base_amount × 0.11
    pph_amount = Column(Numeric(18, 2), nullable=True)  # PPh 23 2% withheld = base_amount × 0.02
    net_payable_amount = Column(Numeric(18, 2), nullable=True)  # Net to customer = amount - pph_amount
    paid_amount = Column(Numeric(18, 2), default=0, server_default="0", nullable=False)  # Sum of payments

    # Tax status flags
    ppn_paid = Column(Boolean, default=False, server_default="false", nullable=False)  # PPN payment status
    pph23_paid = Column(Boolean, default=False, server_default="false", nullable=False)  # PPh 23 payment status
    sent_date = Column(DateTime(timezone=True), nullable=True)  # When invoice was sent to customer

    # Audit fields
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who created this record
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who last updated this record
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    contract = relationship("Contract", back_populates="term_payments")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_term_payments")
    updater = relationship("User", foreign_keys=[updated_by_id], back_populates="updated_term_payments")
    transactions = relationship("PaymentTransaction", back_populates="term_payment", cascade="all, delete-orphan")
    documents = relationship("InvoiceDocument", back_populates="term_payment", cascade="all, delete-orphan")

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

    # Invoice management fields
    invoice_number = Column(String(50), unique=True, nullable=True)  # Format: AAAAAAA-NNNNNN-YYYYMM
    invoice_status = Column(String(30), default="DRAFT", server_default="DRAFT", nullable=False)  # DRAFT/SENT/PAID/etc
    due_date = Column(DateTime(timezone=True), nullable=True)  # Invoice due date

    # Tax breakdown (auto-calculated via trigger)
    base_amount = Column(Numeric(18, 2), nullable=True)  # DPP (Dasar Pengenaan Pajak) = amount / 1.11
    ppn_amount = Column(Numeric(18, 2), nullable=True)  # PPN 11% = base_amount × 0.11
    pph_amount = Column(Numeric(18, 2), nullable=True)  # PPh 23 2% withheld = base_amount × 0.02
    net_payable_amount = Column(Numeric(18, 2), nullable=True)  # Net to customer = amount - pph_amount
    paid_amount = Column(Numeric(18, 2), default=0, server_default="0", nullable=False)  # Sum of payments

    # Tax status flags
    ppn_paid = Column(Boolean, default=False, server_default="false", nullable=False)  # PPN payment status
    pph23_paid = Column(Boolean, default=False, server_default="false", nullable=False)  # PPh 23 payment status
    sent_date = Column(DateTime(timezone=True), nullable=True)  # When invoice was sent to customer

    # Audit fields
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who created this record
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who last updated this record
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    contract = relationship("Contract", back_populates="recurring_payments")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_recurring_payments")
    updater = relationship("User", foreign_keys=[updated_by_id], back_populates="updated_recurring_payments")
    transactions = relationship("PaymentTransaction", back_populates="recurring_payment", cascade="all, delete-orphan")
    documents = relationship("InvoiceDocument", back_populates="recurring_payment", cascade="all, delete-orphan")


class ContractContact(Base):
    """Customer contact persons manually added to contracts (not from OCR extraction)"""
    __tablename__ = "contract_contacts"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Contact information
    name = Column(String(255), nullable=False)
    phone_number = Column(String(50), nullable=True)
    job_title = Column(String(255), nullable=True)  # Jabatan
    email = Column(String(255), nullable=True)

    # Audit fields
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    contract = relationship("Contract", back_populates="customer_contacts")
    creator = relationship("User", foreign_keys=[created_by_id])
    updater = relationship("User", foreign_keys=[updated_by_id])


class PaymentTransaction(Base):
    """Tracks individual payment transactions for invoices. Supports partial payments."""
    __tablename__ = "payment_transactions"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)

    # Polymorphic invoice reference (exactly one must be set)
    invoice_type = Column(String(20), nullable=False)  # 'TERM' or 'RECURRING'
    term_payment_id = Column(BigInteger, ForeignKey("contract_term_payments.id", ondelete="CASCADE"), nullable=True)
    recurring_payment_id = Column(BigInteger, ForeignKey("contract_recurring_payments.id", ondelete="CASCADE"), nullable=True)

    # Payment details
    payment_date = Column(DateTime(timezone=True), nullable=False)  # When payment was received
    amount = Column(Numeric(18, 2), nullable=False)  # Payment amount (must be > 0)
    payment_method = Column(String(50), nullable=True)  # TRANSFER, CASH, GIRO, CHECK, etc
    reference_number = Column(String(100), nullable=True)  # Bank reference or transaction ID

    # Tax info (per-payment flags)
    ppn_included = Column(Boolean, default=False, server_default="false", nullable=False)  # PPN paid in this payment?
    pph23_included = Column(Boolean, default=False, server_default="false", nullable=False)  # PPh 23 paid in this payment?

    # Metadata
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    term_payment = relationship("ContractTermPayment", back_populates="transactions")
    recurring_payment = relationship("ContractRecurringPayment", back_populates="transactions")
    created_by = relationship("User", back_populates="created_payment_transactions")
    documents = relationship("InvoiceDocument", back_populates="payment_transaction", cascade="all, delete-orphan")


class InvoiceDocument(Base):
    """Stores documents related to invoices and payments (bukti bayar, BUPOT, etc)."""
    __tablename__ = "invoice_documents"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)

    # Polymorphic invoice reference (exactly one must be set)
    invoice_type = Column(String(20), nullable=False)  # 'TERM' or 'RECURRING'
    term_payment_id = Column(BigInteger, ForeignKey("contract_term_payments.id", ondelete="CASCADE"), nullable=True)
    recurring_payment_id = Column(BigInteger, ForeignKey("contract_recurring_payments.id", ondelete="CASCADE"), nullable=True)

    # Optional link to specific payment transaction
    payment_transaction_id = Column(BigInteger, ForeignKey("payment_transactions.id", ondelete="CASCADE"), nullable=True)

    # Document details
    document_type = Column(String(30), nullable=False)  # BUKTI_BAYAR, BUPOT_PPH23, FAKTUR_PAJAK, etc
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)  # In bytes (max 10MB via check constraint)
    mime_type = Column(String(100), nullable=True)  # application/pdf, image/jpeg, etc

    # Metadata
    notes = Column(Text, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    term_payment = relationship("ContractTermPayment", back_populates="documents")
    recurring_payment = relationship("ContractRecurringPayment", back_populates="documents")
    payment_transaction = relationship("PaymentTransaction", back_populates="documents")
    uploaded_by = relationship("User", back_populates="uploaded_invoice_documents")


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