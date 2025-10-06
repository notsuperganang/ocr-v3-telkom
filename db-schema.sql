-- Telkom Contract Extractor - Database Schema
-- PostgreSQL 15+
-- Generated from SQLAlchemy models on 2025-10-06

-- Enable UUID extension (optional, for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMERATIONS
-- ============================================================================

-- Job status enumeration
CREATE TYPE jobstatus AS ENUM (
    'queued',
    'processing',
    'extracted',
    'awaiting_review',
    'confirmed',
    'failed'
);

-- Export target enumeration
CREATE TYPE exporttarget AS ENUM (
    'json',
    'excel'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Files table: Uploaded PDF files metadata
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    original_filename VARCHAR NOT NULL,
    size_bytes BIGINT NOT NULL,
    mime_type VARCHAR NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pdf_path VARCHAR NOT NULL
);

-- Create index on uploaded_at for sorting
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at DESC);

-- Processing Jobs table: OCR processing queue and staging results
CREATE TABLE processing_jobs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    status jobstatus NOT NULL DEFAULT 'queued',

    -- Data fields (JSONB for flexibility)
    extracted_data JSONB,  -- Raw extractor function output
    edited_data JSONB,     -- Draft from UI right panel, auto-saved
    ocr_artifacts JSONB,   -- OCR JSON file paths per page

    -- Processing metadata
    error_message TEXT,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_seconds DOUBLE PRECISION,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR,
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for processing_jobs
CREATE INDEX idx_processing_jobs_file_id ON processing_jobs(file_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at DESC);

-- Contracts table: Final 'committed' contract data
CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    source_job_id INTEGER NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,

    -- Final confirmed data
    final_data JSONB NOT NULL,  -- Merged edited_data from job
    version INTEGER DEFAULT 1,  -- For future versioning

    -- Confirmation metadata
    confirmed_by VARCHAR,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for contracts
CREATE INDEX idx_contracts_source_job_id ON contracts(source_job_id);
CREATE INDEX idx_contracts_file_id ON contracts(file_id);
CREATE INDEX idx_contracts_confirmed_at ON contracts(confirmed_at DESC);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);

-- GIN index for JSONB queries on final_data (for searching within contract data)
CREATE INDEX idx_contracts_final_data_gin ON contracts USING GIN(final_data);

-- Extraction Logs table: Processing logs and audit trail
CREATE TABLE extraction_logs (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,

    level VARCHAR NOT NULL,  -- INFO, WARNING, ERROR, DEBUG
    message TEXT NOT NULL,
    details JSONB,  -- Additional structured data

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for extraction_logs
CREATE INDEX idx_extraction_logs_job_id ON extraction_logs(job_id);
CREATE INDEX idx_extraction_logs_level ON extraction_logs(level);
CREATE INDEX idx_extraction_logs_created_at ON extraction_logs(created_at DESC);

-- Export History table: Export tracking and history
CREATE TABLE export_history (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

    export_target exporttarget NOT NULL,
    export_path VARCHAR,  -- Path to generated file (if applicable)
    status VARCHAR DEFAULT 'success',  -- success, failed
    notes TEXT,

    exported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for export_history
CREATE INDEX idx_export_history_contract_id ON export_history(contract_id);
CREATE INDEX idx_export_history_exported_at ON export_history(exported_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to processing_jobs table
CREATE TRIGGER update_processing_jobs_updated_at
    BEFORE UPDATE ON processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to contracts table
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS (Optional: Useful for reporting)
-- ============================================================================

-- View: Contract summary with file information
CREATE OR REPLACE VIEW v_contract_summary AS
SELECT
    c.id AS contract_id,
    c.confirmed_at,
    c.confirmed_by,
    f.id AS file_id,
    f.original_filename,
    f.size_bytes,
    pj.id AS job_id,
    pj.status AS job_status,
    pj.processing_time_seconds,
    c.final_data->>'informasi_pelanggan' AS customer_info,
    c.final_data->>'jangka_waktu' AS contract_period,
    c.final_data->>'tata_cara_pembayaran' AS payment_method
FROM contracts c
JOIN files f ON c.file_id = f.id
JOIN processing_jobs pj ON c.source_job_id = pj.id
ORDER BY c.confirmed_at DESC;

-- View: Processing job statistics
CREATE OR REPLACE VIEW v_processing_stats AS
SELECT
    status,
    COUNT(*) AS count,
    AVG(processing_time_seconds) AS avg_processing_time,
    MIN(processing_time_seconds) AS min_processing_time,
    MAX(processing_time_seconds) AS max_processing_time
FROM processing_jobs
WHERE processing_time_seconds IS NOT NULL
GROUP BY status;

-- ============================================================================
-- SAMPLE QUERIES (Commented - for reference)
-- ============================================================================

-- Get all contracts with customer names
-- SELECT
--     c.id,
--     c.final_data->'informasi_pelanggan'->>'nama_pelanggan' AS customer_name,
--     c.confirmed_at
-- FROM contracts c
-- ORDER BY c.confirmed_at DESC;

-- Get processing jobs awaiting review
-- SELECT
--     pj.id,
--     f.original_filename,
--     pj.status,
--     pj.created_at
-- FROM processing_jobs pj
-- JOIN files f ON pj.file_id = f.id
-- WHERE pj.status = 'awaiting_review'
-- ORDER BY pj.created_at ASC;

-- Get contract value totals (requires extracting from JSONB)
-- SELECT
--     c.id,
--     (c.final_data->'rincian_layanan'->0->>'biaya_instalasi')::FLOAT AS installation_cost,
--     (c.final_data->'rincian_layanan'->0->>'biaya_langganan_tahunan')::FLOAT AS annual_subscription,
--     (c.final_data->'rincian_layanan'->0->>'biaya_instalasi')::FLOAT +
--     (c.final_data->'rincian_layanan'->0->>'biaya_langganan_tahunan')::FLOAT AS total_value
-- FROM contracts c
-- WHERE c.final_data->'rincian_layanan'->0 IS NOT NULL;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. JSONB Storage Strategy:
--    - extracted_data: Raw OCR extraction output (TelkomContractData schema)
--    - edited_data: User-modified draft data (same schema, auto-saved)
--    - final_data: Confirmed contract data (immutable after confirmation)
--    - ocr_artifacts: File paths to OCR result JSON files per page

-- 2. Processing Flow:
--    queued → processing → extracted → awaiting_review → confirmed
--                                                      → failed

-- 3. Data Integrity:
--    - ON DELETE CASCADE ensures orphaned records are cleaned up
--    - Foreign keys maintain referential integrity
--    - JSONB allows schema flexibility while maintaining structure

-- 4. Future Enhancements:
--    - Add users table for proper authentication (currently string-based)
--    - Add total_contract_value column for faster aggregations
--    - Add contract_number column extracted from final_data
--    - Add full-text search indexes on customer names

-- 5. Performance Considerations:
--    - GIN index on final_data enables fast JSONB queries
--    - Regular B-tree indexes on foreign keys and timestamps
--    - Consider partitioning contracts table by year for large datasets
