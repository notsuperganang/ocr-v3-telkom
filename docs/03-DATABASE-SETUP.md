# Database Setup

This guide covers PostgreSQL database setup, migration management, and data restoration.

## Database Overview

| Property | Value |
|----------|-------|
| Database | PostgreSQL 15+ |
| Name | `telkom_contracts` |
| Default User | `postgres` |
| Default Password | `postgres` |
| Default Port | `5432` |
| ORM | SQLAlchemy |
| Migration Tool | Alembic |

## Quick Start

### Using Docker (Recommended)

```bash
# Start PostgreSQL container
docker-compose up postgres -d

# Verify it's running
docker-compose ps

# Connection string:
# postgresql://postgres:postgres@localhost:5432/telkom_contracts
```

### Using Local PostgreSQL

```bash
# Create database
sudo -u postgres createdb telkom_contracts

# Or via psql
sudo -u postgres psql -c "CREATE DATABASE telkom_contracts;"
```

---

## Restoring the Database Snapshot

A complete database snapshot is included at `docs/initial_db_dump.sql`. This contains:
- All table schemas
- Reference data (segments, witels, account managers)
- Test users (paycol, petugas)
- Sample accounts and contracts

### Restore Steps

```bash
# 1. Ensure PostgreSQL is running
docker-compose up postgres -d

# 2. Wait for it to be ready
sleep 5

# 3. Restore the dump
PGPASSWORD=postgres psql -h localhost -U postgres -d telkom_contracts < docs/initial_db_dump.sql

# 4. Verify restoration
PGPASSWORD=postgres psql -h localhost -U postgres -d telkom_contracts -c "SELECT COUNT(*) FROM users;"
```

### What's Included in the Snapshot

| Table | Records | Description |
|-------|---------|-------------|
| `users` | 3 | Test users (paycol, petugas, admin) |
| `segments` | 6 | Client segments (Regional 1-7, Enterprise, etc.) |
| `witels` | 1 | Regional office codes |
| `account_managers` | 13 | Telkom account managers |
| `accounts` | 134 | Client master data |
| `contracts` | 8 | Confirmed contracts |
| `processing_jobs` | 8 | Processing history |
| `files` | 8 | Uploaded file metadata |

---

## Database Schema

### Core Tables

#### `files`
Stores metadata for uploaded PDF files.

```sql
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR NOT NULL,
    original_filename VARCHAR NOT NULL,
    file_size INTEGER,
    file_path VARCHAR,
    mime_type VARCHAR,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    uploaded_by_id INTEGER REFERENCES users(id)
);
```

#### `processing_jobs`
Tracks OCR processing queue and stores extracted data.

```sql
CREATE TABLE processing_jobs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES files(id),
    status jobstatus DEFAULT 'QUEUED',  -- QUEUED, PROCESSING, EXTRACTED, AWAITING_REVIEW, CONFIRMED, FAILED
    extracted_data JSONB,                -- Raw OCR output
    edited_data JSONB,                   -- User modifications
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    reviewed_by_id INTEGER REFERENCES users(id)
);
```

#### `contracts`
Final confirmed contract data.

```sql
CREATE TABLE contracts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES processing_jobs(id),
    account_id INTEGER REFERENCES accounts(id),
    contract_year INTEGER,
    final_data JSONB NOT NULL,           -- Source of truth

    -- Denormalized columns for queries
    customer_name VARCHAR,
    customer_npwp VARCHAR,
    period_start DATE,
    period_end DATE,
    service_connectivity INTEGER,
    service_non_connectivity INTEGER,
    service_bundling INTEGER,
    payment_method VARCHAR,
    termin_count INTEGER,
    installation_cost NUMERIC(15,2),
    annual_subscription_cost NUMERIC(15,2),
    total_contract_value NUMERIC(15,2),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    confirmed_by_id INTEGER REFERENCES users(id),
    telkom_contact_id INTEGER REFERENCES contract_contacts(id)
);
```

### Account Management Tables

#### `segments`
Client classification reference data.

```sql
CREATE TABLE segments (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,  -- Regional 1-7, Enterprise, Government, SME
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `witels`
Regional office codes.

```sql
CREATE TABLE witels (
    id SERIAL PRIMARY KEY,
    code VARCHAR NOT NULL UNIQUE,  -- e.g., "901"
    name VARCHAR NOT NULL,         -- e.g., "Aceh"
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `account_managers`
Telkom account manager contact info.

```sql
CREATE TABLE account_managers (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    title VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `accounts`
Master client entities.

```sql
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    account_number VARCHAR NOT NULL UNIQUE,
    name VARCHAR NOT NULL,
    nipnas VARCHAR,
    bus_area VARCHAR,
    segment_id INTEGER REFERENCES segments(id),
    witel_id INTEGER REFERENCES witels(id),
    account_manager_id INTEGER REFERENCES account_managers(id),
    assigned_officer_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_id INTEGER REFERENCES users(id)
);
```

### Invoice Management Tables

#### `contract_term_payments`
Termin payment tracking with invoice lifecycle.

```sql
CREATE TABLE contract_term_payments (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
    termin_number INTEGER NOT NULL,
    period_label VARCHAR NOT NULL,      -- "Januari 2025"
    period_year INTEGER,
    period_month INTEGER,
    original_amount NUMERIC(15,2),
    amount NUMERIC(15,2),               -- Total including PPN
    status VARCHAR DEFAULT 'PENDING',   -- PENDING, DUE, OVERDUE, PAID, CANCELLED

    -- Invoice fields
    invoice_number VARCHAR UNIQUE,      -- AAAAAAA-NNNNNN-YYYYMM
    invoice_status VARCHAR DEFAULT 'DRAFT',  -- DRAFT, SENT, PARTIALLY_PAID, PAID_PENDING_PPH23, PAID
    due_date DATE,
    sent_date DATE,

    -- Tax breakdown (auto-calculated)
    base_amount NUMERIC(15,2),          -- DPP = amount / 1.11
    ppn_amount NUMERIC(15,2),           -- 11% PPN
    pph_amount NUMERIC(15,2),           -- 2% PPh 23
    net_payable_amount NUMERIC(15,2),   -- amount - pph_amount (what customer actually pays)

    -- Payment tracking
    paid_amount NUMERIC(15,2) DEFAULT 0,
    ppn_paid BOOLEAN DEFAULT FALSE,
    pph23_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP,
    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    created_by_id INTEGER REFERENCES users(id),
    updated_by_id INTEGER REFERENCES users(id)
);
```

#### `payment_transactions`
Individual payment records.

```sql
CREATE TABLE payment_transactions (
    id SERIAL PRIMARY KEY,
    invoice_type VARCHAR NOT NULL,      -- TERM or RECURRING
    term_payment_id INTEGER REFERENCES contract_term_payments(id),
    recurring_payment_id INTEGER REFERENCES contract_recurring_payments(id),
    payment_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    payment_method VARCHAR,
    reference_number VARCHAR,
    ppn_included BOOLEAN DEFAULT FALSE,
    pph23_included BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_id INTEGER REFERENCES users(id)
);
```

#### `invoice_documents`
Supporting documents for invoices.

```sql
CREATE TABLE invoice_documents (
    id SERIAL PRIMARY KEY,
    invoice_type VARCHAR NOT NULL,
    term_payment_id INTEGER REFERENCES contract_term_payments(id),
    recurring_payment_id INTEGER REFERENCES contract_recurring_payments(id),
    payment_transaction_id INTEGER REFERENCES payment_transactions(id),
    document_type VARCHAR NOT NULL,     -- BUKTI_BAYAR, BUPOT_PPH23, FAKTUR_PAJAK, etc.
    filename VARCHAR NOT NULL,
    original_filename VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR,
    notes TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    uploaded_by_id INTEGER REFERENCES users(id)
);
```

### Database Views

#### `v_invoices`
Unified view combining term and recurring payments.

```sql
CREATE VIEW v_invoices AS
SELECT
    'term' as invoice_type,
    tp.id as invoice_id,
    tp.invoice_number,
    tp.invoice_status,
    tp.amount,
    tp.net_payable_amount,
    tp.paid_amount,
    c.customer_name,
    a.account_number,
    w.name as witel_name,
    -- ... more fields
FROM contract_term_payments tp
JOIN contracts c ON tp.contract_id = c.id
LEFT JOIN accounts a ON c.account_id = a.id
LEFT JOIN witels w ON a.witel_id = w.id
UNION ALL
SELECT
    'recurring' as invoice_type,
    -- ... similar fields for recurring payments
FROM contract_recurring_payments rp
JOIN contracts c ON rp.contract_id = c.id
-- ...
```

### Database Functions & Triggers

#### `generate_invoice_number()`
Generates invoice numbers in format `AAAAAAA-NNNNNN-YYYYMM`.

```sql
CREATE FUNCTION generate_invoice_number(account_num VARCHAR, billing_year INT, billing_month INT)
RETURNS VARCHAR AS $$
DECLARE
    account_prefix VARCHAR(7);
    sequence_num INT;
    invoice_num VARCHAR;
BEGIN
    -- Get first 7 digits of account number
    account_prefix := LEFT(account_num, 7);

    -- Get next sequence number (cumulative, never resets)
    SELECT COALESCE(MAX(seq), 0) + 1 INTO sequence_num
    FROM (
        SELECT SUBSTRING(invoice_number FROM 9 FOR 6)::INT as seq
        FROM contract_term_payments
        WHERE invoice_number LIKE account_prefix || '-%'
    ) sub;

    -- Format: AAAAAAA-NNNNNN-YYYYMM
    invoice_num := account_prefix || '-' ||
                   LPAD(sequence_num::TEXT, 6, '0') || '-' ||
                   billing_year::TEXT || LPAD(billing_month::TEXT, 2, '0');

    RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;
```

#### `recalculate_invoice_breakdown_trigger()`
Auto-calculates tax breakdown when amount changes.

```sql
-- When amount is set, calculates:
-- base_amount = amount / 1.11
-- ppn_amount = base_amount * 0.11
-- pph_amount = base_amount * 0.02
-- net_payable_amount = amount - pph_amount
```

#### `update_invoice_status_trigger()`
Auto-updates invoice status based on payment state.

```sql
-- Status logic:
-- PAID: paid_amount >= net_payable_amount AND ppn_paid AND pph23_paid
-- PAID_PENDING_PPH23: Fully paid but missing BUPOT
-- PARTIALLY_PAID: paid_amount > 0 but < net_payable_amount
-- OVERDUE: due_date < today and not fully paid
```

---

## Alembic Migrations

### View Migration History

```bash
cd backend
alembic history
```

### Apply All Migrations

```bash
alembic upgrade head
```

### Create New Migration

```bash
# Auto-generate from model changes
alembic revision --autogenerate -m "add new table"

# Empty migration for manual changes
alembic revision -m "manual migration"
```

### Rollback Migration

```bash
# Rollback one step
alembic downgrade -1

# Rollback to specific revision
alembic downgrade <revision_id>
```

### Check Current Version

```bash
alembic current
```

---

## Common Database Operations

### Connect to Database

```bash
# Via Docker
docker-compose exec postgres psql -U postgres -d telkom_contracts

# Via local psql
PGPASSWORD=postgres psql -h localhost -U postgres -d telkom_contracts
```

### Useful SQL Commands

```sql
-- List all tables
\dt

-- Describe table structure
\d+ contracts

-- Count records in main tables
SELECT 'contracts' as table_name, COUNT(*) FROM contracts
UNION ALL SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL SELECT 'users', COUNT(*) FROM users;

-- View recent contracts
SELECT id, customer_name, total_contract_value, created_at
FROM contracts
ORDER BY created_at DESC
LIMIT 10;

-- Check invoice statuses
SELECT invoice_status, COUNT(*)
FROM contract_term_payments
GROUP BY invoice_status;
```

### Backup Database

```bash
# Full backup
PGPASSWORD=postgres pg_dump -h localhost -U postgres -d telkom_contracts > backup_$(date +%Y%m%d).sql

# Schema only
PGPASSWORD=postgres pg_dump -h localhost -U postgres -d telkom_contracts --schema-only > schema.sql

# Data only
PGPASSWORD=postgres pg_dump -h localhost -U postgres -d telkom_contracts --data-only > data.sql
```

### Restore Database

```bash
# Drop and recreate (WARNING: destroys all data)
PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS telkom_contracts;"
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE telkom_contracts;"

# Restore from backup
PGPASSWORD=postgres psql -h localhost -U postgres -d telkom_contracts < backup.sql
```

### Reset Database

```bash
# Using Docker (cleanest method)
docker-compose down -v
docker-compose up postgres -d
sleep 5
cd backend && alembic upgrade head
```

---

## PPh 23 Tax Calculation (Important)

The invoice system handles Indonesian tax withholding. Understanding this is crucial:

```
amount = 1,000,000 (total invoice including PPN)
├── base_amount = amount / 1.11 = 900,900.90 (DPP - Dasar Pengenaan Pajak)
├── ppn_amount = base_amount × 0.11 = 99,099.10 (11% PPN)
├── pph_amount = base_amount × 0.02 = 18,018.02 (2% PPh 23)
└── net_payable_amount = amount - pph_amount = 981,981.98
```

**Key Point**: Customers pay `net_payable_amount`, not `amount`. They withhold PPh 23 and pay it directly to the tax office. Payment validation must use `net_payable_amount`.

---

## Troubleshooting

### "relation does not exist"

Migrations haven't been run:
```bash
cd backend
alembic upgrade head
```

### "FATAL: database does not exist"

Create the database:
```bash
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE telkom_contracts;"
```

### "connection refused"

PostgreSQL isn't running:
```bash
docker-compose up postgres -d
# or check local postgres
sudo systemctl status postgresql
```

### Migration conflicts

Reset and reapply:
```bash
alembic stamp head
alembic upgrade head
```

---

## Next Steps

- [Architecture Guide](./04-ARCHITECTURE.md) - Understand the codebase structure
- [Deployment Guide](./05-DEPLOYMENT-GUIDE.md) - Production deployment instructions
