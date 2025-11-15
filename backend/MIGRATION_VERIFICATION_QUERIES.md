# Migration Verification Queries

## Migration: `6bef71f3b410_add_contract_term_payments_table`

This document provides SQL queries to verify the successful application of the migration that introduces the normalized `contract_term_payments` table.

---

## 1. Verify Table Structure

### 1.1 Check if `contract_term_payments` table exists

```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'contract_term_payments'
) AS table_exists;
```

**Expected Result:** `true`

---

### 1.2 Verify column structure

```sql
SELECT
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'contract_term_payments'
ORDER BY ordinal_position;
```

**Expected Columns:**
- `id` (bigint, NOT NULL, auto-increment)
- `contract_id` (integer, NOT NULL)
- `termin_number` (integer, NOT NULL)
- `period_label` (text, NOT NULL)
- `period_year` (integer, NOT NULL)
- `period_month` (integer, NOT NULL)
- `original_amount` (numeric 18,2, NOT NULL)
- `amount` (numeric 18,2, NOT NULL)
- `status` (text, NOT NULL, DEFAULT 'PENDING')
- `paid_at` (timestamp with time zone, NULL)
- `notes` (text, NULL)
- `created_by` (text, NULL)
- `updated_by` (text, NULL)
- `created_at` (timestamp with time zone, NOT NULL, DEFAULT now())
- `updated_at` (timestamp with time zone, NOT NULL, DEFAULT now())

---

## 2. Verify Constraints

### 2.1 Check PRIMARY KEY constraint

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name = 'contract_term_payments'
AND constraint_type = 'PRIMARY KEY';
```

**Expected Result:** `contract_term_payments_pkey` on `id`

---

### 2.2 Check FOREIGN KEY constraint

```sql
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
AND tc.table_name = 'contract_term_payments'
AND tc.constraint_type = 'FOREIGN KEY';
```

**Expected Result:**
- `fk_contract_term_payments_contract_id` → `contracts.id` with `ON DELETE CASCADE`

---

### 2.3 Check UNIQUE constraint

```sql
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint con
INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
WHERE nsp.nspname = 'public'
AND rel.relname = 'contract_term_payments'
AND con.contype = 'u';
```

**Expected Result:** `uq_contract_term_payments_contract_termin` on `(contract_id, termin_number)`

---

### 2.4 Check CHECK constraints

```sql
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint con
INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
WHERE nsp.nspname = 'public'
AND rel.relname = 'contract_term_payments'
AND con.contype = 'c'
ORDER BY con.conname;
```

**Expected Result (4 CHECK constraints):**
1. `ck_contract_term_payments_period_month`: `period_month >= 1 AND period_month <= 12`
2. `ck_contract_term_payments_period_year`: `period_year >= 2000 AND period_year <= 2100`
3. `ck_contract_term_payments_status`: `status IN ('PENDING', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED')`
4. `ck_contract_term_payments_termin_number`: `termin_number >= 1`

---

## 3. Verify Indexes

### 3.1 List all indexes on `contract_term_payments`

```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'contract_term_payments'
ORDER BY indexname;
```

**Expected Indexes:**
1. `contract_term_payments_pkey` (PRIMARY KEY on `id`)
2. `idx_contract_term_payments_contract_id` (on `contract_id`)
3. `idx_contract_term_payments_period` (on `period_year, period_month`)
4. `idx_contract_term_payments_status_period` (on `status, period_year, period_month`)

---

## 4. Verify Column Rename in `contracts` Table

### 4.1 Check that `termin_payments_raw` exists and `termin_payments_json` does NOT exist

```sql
SELECT
    COUNT(*) FILTER (WHERE column_name = 'termin_payments_raw') AS has_termin_payments_raw,
    COUNT(*) FILTER (WHERE column_name = 'termin_payments_json') AS has_termin_payments_json
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'contracts';
```

**Expected Result:**
- `has_termin_payments_raw`: `1`
- `has_termin_payments_json`: `0`

---

## 5. Test Foreign Key Relationship

### 5.1 Join test (requires at least one contract in database)

```sql
SELECT
    c.id AS contract_id,
    c.customer_name,
    c.payment_method,
    ctp.termin_number,
    ctp.period_label,
    ctp.period_year,
    ctp.period_month,
    ctp.amount,
    ctp.status
FROM contracts c
LEFT JOIN contract_term_payments ctp ON c.id = ctp.contract_id
WHERE c.payment_method = 'termin'
ORDER BY c.id, ctp.termin_number
LIMIT 10;
```

**Expected Result:**
- If there are termin contracts, should show joined data
- If database is empty, should return empty result set (no errors)

---

## 6. Test INSERT (Manual Data Entry)

### 6.1 Insert test data (requires at least one contract)

```sql
-- First, find a contract ID
SELECT id, customer_name, payment_method
FROM contracts
WHERE payment_method = 'termin'
LIMIT 1;

-- Then insert a test termin payment (replace <contract_id> with actual ID)
INSERT INTO contract_term_payments (
    contract_id,
    termin_number,
    period_label,
    period_year,
    period_month,
    original_amount,
    amount,
    status
) VALUES (
    <contract_id>,  -- Replace with actual contract ID
    1,
    'Maret 2025',
    2025,
    3,  -- March
    100000000.00,
    100000000.00,
    'PENDING'
);

-- Verify insertion
SELECT * FROM contract_term_payments
WHERE contract_id = <contract_id>;
```

**Expected Result:**
- Successful insert with auto-generated `id`, `created_at`, `updated_at`
- All fields populated correctly

---

## 7. Test Constraints

### 7.1 Test UNIQUE constraint violation (should fail)

```sql
-- This should fail if you already inserted termin_number=1 for the same contract
INSERT INTO contract_term_payments (
    contract_id, termin_number, period_label, period_year, period_month,
    original_amount, amount, status
) VALUES (
    <contract_id>, 1, 'April 2025', 2025, 4, 50000000, 50000000, 'PENDING'
);
```

**Expected Result:** Error due to UNIQUE constraint on `(contract_id, termin_number)`

---

### 7.2 Test CHECK constraint for status (should fail)

```sql
INSERT INTO contract_term_payments (
    contract_id, termin_number, period_label, period_year, period_month,
    original_amount, amount, status
) VALUES (
    <contract_id>, 2, 'April 2025', 2025, 4, 50000000, 50000000, 'INVALID_STATUS'
);
```

**Expected Result:** Error due to CHECK constraint on `status`

---

### 7.3 Test CHECK constraint for period_month (should fail)

```sql
INSERT INTO contract_term_payments (
    contract_id, termin_number, period_label, period_year, period_month,
    original_amount, amount, status
) VALUES (
    <contract_id>, 3, 'Invalid Month', 2025, 13, 50000000, 50000000, 'PENDING'
);
```

**Expected Result:** Error due to CHECK constraint on `period_month` (must be 1-12)

---

### 7.4 Test CASCADE DELETE (should succeed)

```sql
-- Create a test contract and termin payment
-- (Assuming you have permission to delete test data)

-- Insert will cascade delete to contract_term_payments
DELETE FROM contracts WHERE id = <test_contract_id>;

-- Verify termin payments were also deleted
SELECT COUNT(*) FROM contract_term_payments WHERE contract_id = <test_contract_id>;
```

**Expected Result:** `0` (all termin payments for that contract deleted)

---

## 8. Performance Verification

### 8.1 Check index usage for common queries

```sql
EXPLAIN ANALYZE
SELECT * FROM contract_term_payments
WHERE contract_id = 1;
```

**Expected Result:** Should use `idx_contract_term_payments_contract_id` index

---

### 8.2 Check composite index usage

```sql
EXPLAIN ANALYZE
SELECT * FROM contract_term_payments
WHERE status = 'DUE'
AND period_year = 2025
AND period_month = 3;
```

**Expected Result:** Should use `idx_contract_term_payments_status_period` index

---

## 9. Migration Rollback Test (Optional)

### 9.1 Test downgrade (BE CAREFUL - only in development)

```bash
# From backend/ directory
alembic downgrade -1
```

**Expected Result:**
- `contract_term_payments` table dropped
- `termin_payments_raw` renamed back to `termin_payments_json`
- All indexes removed

---

### 9.2 Re-apply migration

```bash
# From backend/ directory
alembic upgrade head
```

**Expected Result:** Migration re-applies successfully

---

## 10. Summary Checklist

After running the migration, verify:

- [ ] `contract_term_payments` table exists with 15 columns
- [ ] Primary key constraint on `id` exists
- [ ] Foreign key constraint to `contracts.id` with CASCADE DELETE exists
- [ ] Unique constraint on `(contract_id, termin_number)` exists
- [ ] 4 CHECK constraints exist (status, period_month, period_year, termin_number)
- [ ] 4 indexes exist (pkey, contract_id, period, status_period)
- [ ] `contracts.termin_payments_raw` exists (renamed from `termin_payments_json`)
- [ ] `contracts.termin_payments_json` does NOT exist
- [ ] Can JOIN contracts and contract_term_payments
- [ ] Can INSERT valid termin payment records
- [ ] Constraints prevent invalid data
- [ ] CASCADE DELETE works correctly

---

## Notes

- **Database is currently empty**: No data backfill is needed at this stage
- **Indonesian month names**: When populating data, remember to parse Indonesian month names:
  - Januari (1), Februari (2), Maret (3), April (4), Mei (5), Juni (6)
  - Juli (7), Agustus (8), September (9), Oktober (10), November (11), Desember (12)
- **Future migrations**: Data backfill logic can be added in a subsequent migration when needed
- **Alembic commands**: All commands should be run from the `backend/` directory

---

## Running the Migration

```bash
# Navigate to backend directory
cd backend

# Check current migration status
alembic current

# Review pending migrations
alembic history

# Apply this migration
alembic upgrade head

# Or upgrade to specific revision
alembic upgrade 6bef71f3b410

# Check migration was applied
alembic current
```

Expected output after upgrade:
```
INFO  [alembic.runtime.migration] Running upgrade 8a6d04b41608 -> 6bef71f3b410, add_contract_term_payments_table
Phase A: Creating contract_term_payments table...
✓ contract_term_payments table created successfully
Phase B: Renaming contracts.termin_payments_json → termin_payments_raw...
✓ Column renamed successfully
Phase C: Creating indexes for efficient querying...
✓ Indexes created successfully
Migration completed successfully! contract_term_payments table is ready for use.
```
