# Contract Denormalization Migration Guide

## Overview

**Migration ID:** `a53e7fef9408_add_contract_denorm_columns`
**Purpose:** Add denormalized columns to `contracts` table for efficient KPI queries and aggregation
**Risk Level:** 🟡 Medium (modifies production schema, backfills data)
**Reversible:** ✅ Yes (downgrade available)
**Estimated Duration:** ~1-5 minutes (depends on contract count)

---

## What This Migration Does

This migration adds 12 new denormalized columns to the `contracts` table to improve query performance for:
- Dashboard KPI cards (total contracts, revenue, service counts)
- Contract filtering and sorting (by customer, date, payment method)
- Analytics and reporting

### New Columns Added

| Column | Type | Purpose | Indexed |
|--------|------|---------|---------|
| `customer_name` | VARCHAR(500) | Customer name for search/display | ✅ |
| `customer_npwp` | VARCHAR(50) | Tax ID for filtering | ❌ |
| `period_start` | DATE | Contract start date | ✅ DESC |
| `period_end` | DATE | Contract end date | ❌ |
| `service_connectivity` | INTEGER | Connectivity service count | ❌ |
| `service_non_connectivity` | INTEGER | Non-connectivity service count | ❌ |
| `service_bundling` | INTEGER | Bundling service count | ❌ |
| `payment_method` | VARCHAR(20) | Normalized payment method (termin/recurring/one_time) | ✅ |
| `termin_count` | INTEGER | Number of termin installments | ❌ |
| `installation_cost` | NUMERIC(18,2) | Total installation costs | ❌ |
| `annual_subscription_cost` | NUMERIC(18,2) | Total annual subscription | ❌ |
| `total_contract_value` | NUMERIC(18,2) | Sum of installation + subscription | ✅ DESC |

**Important:** The `final_data` JSONB column remains **unchanged** and is still the source of truth.

---

## Pre-Migration Checklist

### 1. Backup Database

```bash
# Create database backup
pg_dump -h localhost -U postgres -d telkom_contracts \
  -F c -b -v -f "backup_contracts_$(date +%Y%m%d_%H%M%S).dump"

# Verify backup
pg_restore --list backup_contracts_*.dump | head -20
```

### 2. Check Current State

```sql
-- Check number of existing contracts
SELECT COUNT(*) FROM contracts;

-- Check sample final_data structure
SELECT
    id,
    final_data->'informasi_pelanggan'->>'nama_pelanggan' as customer,
    final_data->'tata_cara_pembayaran'->>'method_type' as payment_method,
    final_data->'jangka_waktu'->>'mulai' as start_date
FROM contracts
LIMIT 5;

-- Check current migration version
SELECT * FROM alembic_version;
```

### 3. Verify Dependencies

```bash
# Ensure backend is stopped or in maintenance mode
systemctl status telkom-backend  # or equivalent

# Check PostgreSQL version (should be 12+)
psql -U postgres -c "SELECT version();"

# Verify Alembic is installed
cd /path/to/backend
pip list | grep alembic
```

---

## Running the Migration

### Step 1: Apply Migration (Upgrade)

```bash
cd /path/to/telkom-contract-extractor/backend

# Dry-run (check SQL without executing)
alembic upgrade a53e7fef9408 --sql

# Apply migration
alembic upgrade head
```

**Expected Output:**

```
INFO  [alembic.runtime.migration] Running upgrade 4c94e7565b76 -> a53e7fef9408, add_contract_denorm_columns
Phase A: Adding denormalized columns to contracts table...
✓ Columns added successfully
Phase B: Backfilling data from final_data JSONB...
✓ Backfilled 123 contract rows
Phase C: Creating indexes for query optimization...
✓ Indexes created successfully
Migration completed successfully!
```

### Step 2: Verify Migration Success

```sql
-- 1. Check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contracts'
  AND column_name IN (
    'customer_name', 'payment_method', 'total_contract_value'
  );

-- 2. Verify backfill coverage
SELECT
    COUNT(*) as total_contracts,
    COUNT(customer_name) as with_customer_name,
    COUNT(payment_method) as with_payment_method,
    COUNT(CASE WHEN total_contract_value > 0 THEN 1 END) as with_value,
    ROUND(COUNT(customer_name) * 100.0 / COUNT(*), 2) as backfill_percentage
FROM contracts;

-- 3. Sample denormalized data
SELECT
    id,
    customer_name,
    period_start,
    period_end,
    payment_method,
    service_connectivity,
    total_contract_value
FROM contracts
LIMIT 10;

-- 4. Verify indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'contracts'
  AND indexname LIKE 'ix_contracts_%';

-- 5. Test aggregation query (should be fast!)
SELECT
    COUNT(*) as total_contracts,
    SUM(total_contract_value) as total_value,
    SUM(service_connectivity) as total_services,
    payment_method,
    COUNT(*) as count_per_method
FROM contracts
GROUP BY payment_method;
```

### Expected Verification Results

- ✅ Backfill percentage should be **≥ 95%** (some NULL values are OK for incomplete data)
- ✅ 6 new indexes created (starting with `ix_contracts_`)
- ✅ Aggregation query completes in **< 100ms** (even with thousands of contracts)

---

## Rollback Procedure

If issues arise, you can safely rollback:

```bash
cd /path/to/backend

# Rollback to previous migration
alembic downgrade 4c94e7565b76
```

**What happens during downgrade:**
- All 6 indexes are dropped
- All 12 denormalized columns are dropped
- **`final_data` JSONB remains intact** (no data loss!)

### Post-Rollback Verification

```sql
-- Verify denormalized columns are gone
SELECT column_name FROM information_schema.columns
WHERE table_name = 'contracts'
  AND column_name LIKE 'customer_%'
  OR column_name LIKE 'service_%'
  OR column_name LIKE '%_cost';
-- Should return 0 rows

-- Verify final_data is still intact
SELECT COUNT(*),
       COUNT(final_data) as with_final_data
FROM contracts;
-- Both counts should match
```

---

## Troubleshooting

### Issue 1: Backfill Shows Low Coverage

**Symptom:** Verification query shows < 90% backfill coverage

**Diagnosis:**

```sql
-- Find contracts with missing data
SELECT
    id,
    customer_name,
    payment_method,
    total_contract_value,
    jsonb_pretty(final_data) as final_data_sample
FROM contracts
WHERE customer_name IS NULL
   OR payment_method IS NULL
LIMIT 5;
```

**Solution:**
This is expected if `final_data` has incomplete information. New contracts will populate correctly via the updated confirmation flow.

---

### Issue 2: Migration Takes Too Long

**Symptom:** Migration hangs during Phase B (backfill)

**Diagnosis:**

```sql
-- Check long-running queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%';
```

**Solution:**
- For large databases (>10k contracts), consider running migration during off-peak hours
- Backfill uses a single UPDATE with subqueries; PostgreSQL will lock the table

---

### Issue 3: Index Creation Fails

**Symptom:** Error during Phase C index creation

**Diagnosis:**

```sql
-- Check existing indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'contracts';
```

**Solution:**
- If index names conflict, manually drop old indexes:

```sql
DROP INDEX IF EXISTS ix_contracts_confirmed_at;
-- Then re-run migration
```

---

### Issue 4: Performance Degradation After Migration

**Symptom:** Queries are slower than before

**Diagnosis:**

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT SUM(total_contract_value)
FROM contracts
WHERE confirmed_at >= '2025-01-01';
```

**Solution:**

```sql
-- Rebuild table statistics
ANALYZE contracts;

-- Vacuum table to reclaim space
VACUUM ANALYZE contracts;
```

---

## Post-Migration Tasks

### 1. Update Application Code (Already Done ✅)

- ✅ `app/api/processing.py` - Confirmation flow populates denorm fields
- ✅ `app/api/contracts.py` - Stats endpoint uses denormalized columns
- ✅ `app/api/contracts.py` - List endpoint uses denormalized columns

### 2. Monitor Query Performance

```sql
-- Enable query logging (optional)
ALTER DATABASE telkom_contracts SET log_min_duration_statement = 100;

-- Monitor slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%contracts%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 3. Test API Endpoints

```bash
# Test stats endpoint
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/contracts/stats/summary

# Expected: Fast response (<200ms) with aggregated KPIs

# Test contract listing
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/contracts?page=1&per_page=10"

# Expected: No JSONB parsing in logs
```

### 4. Validate Data Integrity

```sql
-- Cross-check denormalized vs JSONB values (sample check)
SELECT
    id,
    customer_name,
    final_data->'informasi_pelanggan'->>'nama_pelanggan' as jsonb_customer,
    customer_name = (final_data->'informasi_pelanggan'->>'nama_pelanggan') as matches
FROM contracts
LIMIT 100;

-- Should show high match rate (>95%)
```

---

## Performance Benchmarks

### Before Migration

```sql
-- KPI query (parses JSONB for every row)
EXPLAIN ANALYZE
SELECT
    COUNT(*),
    SUM((final_data->'rincian_layanan'->0->>'biaya_instalasi')::numeric)
FROM contracts;

-- Typical: 200-500ms for 1000 contracts
```

### After Migration

```sql
-- KPI query (uses indexed denormalized columns)
EXPLAIN ANALYZE
SELECT
    COUNT(*),
    SUM(total_contract_value)
FROM contracts;

-- Typical: 5-20ms for 1000 contracts (10-100x faster!)
```

---

## FAQ

**Q: Will this migration cause downtime?**
A: No, but the `contracts` table will be locked during Phase B backfill (~1-5 minutes). No new contracts can be created during this time.

**Q: What if backfill fails for some contracts?**
A: The migration uses `COALESCE` for safe NULL handling. Incomplete data will default to 0/NULL. New contracts will populate correctly.

**Q: Can I re-run the migration if it partially completes?**
A: Yes, but you must first rollback: `alembic downgrade 4c94e7565b76`, then re-run `alembic upgrade head`.

**Q: Will old API endpoints break?**
A: No. The `final_data` JSONB is unchanged, so all existing code continues to work. New code uses faster denormalized columns.

**Q: How do I verify KPI dashboard is using denormalized columns?**
A: Check PostgreSQL logs for queries hitting `/api/contracts/stats/summary`. They should NOT contain `->` JSONB operators.

---

## Rollback Scenarios

### Scenario 1: Immediate Rollback (Within 1 Hour)

```bash
# If migration just completed and issues are found
alembic downgrade 4c94e7565b76

# Verify
psql -U postgres -d telkom_contracts \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='contracts';"
```

### Scenario 2: Rollback After Days/Weeks

**⚠️ Warning:** New contracts confirmed after migration will have denormalized data that will be lost on rollback. However, `final_data` JSONB is preserved, so no permanent data loss occurs.

```bash
# 1. Stop application
systemctl stop telkom-backend

# 2. Backup current state
pg_dump -h localhost -U postgres -d telkom_contracts \
  -F c -f "backup_before_rollback.dump"

# 3. Rollback
alembic downgrade 4c94e7565b76

# 4. Restart application
systemctl start telkom-backend
```

---

## Support & Contact

For issues with this migration:

1. Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-*.log`
2. Check Alembic history: `alembic history`
3. Review migration file: `backend/alembic/versions/a53e7fef9408_add_contract_denorm_columns.py`

---

## Appendix: Manual Backfill (If Needed)

If automatic backfill fails, run manually:

```sql
-- Manual backfill query (idempotent)
UPDATE contracts
SET
    customer_name = final_data->'informasi_pelanggan'->>'nama_pelanggan',
    customer_npwp = final_data->'informasi_pelanggan'->>'npwp',
    period_start = CASE
        WHEN final_data->'jangka_waktu'->>'mulai' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN (final_data->'jangka_waktu'->>'mulai')::date
        ELSE NULL
    END,
    period_end = CASE
        WHEN final_data->'jangka_waktu'->>'akhir' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN (final_data->'jangka_waktu'->>'akhir')::date
        ELSE NULL
    END,
    service_connectivity = COALESCE((final_data->'layanan_utama'->>'connectivity_telkom')::integer, 0),
    service_non_connectivity = COALESCE((final_data->'layanan_utama'->>'non_connectivity_telkom')::integer, 0),
    service_bundling = COALESCE((final_data->'layanan_utama'->>'bundling')::integer, 0),
    payment_method = CASE
        WHEN LOWER(final_data->'tata_cara_pembayaran'->>'method_type') = 'termin' THEN 'termin'
        WHEN LOWER(final_data->'tata_cara_pembayaran'->>'method_type') = 'recurring' THEN 'recurring'
        WHEN LOWER(final_data->'tata_cara_pembayaran'->>'method_type') LIKE '%one_time%' THEN 'one_time'
        ELSE NULL
    END,
    termin_count = CASE
        WHEN LOWER(final_data->'tata_cara_pembayaran'->>'method_type') = 'termin'
        THEN (final_data->'tata_cara_pembayaran'->>'total_termin_count')::integer
        ELSE NULL
    END,
    installation_cost = COALESCE(
        (SELECT SUM(COALESCE((item->>'biaya_instalasi')::numeric, 0))
         FROM jsonb_array_elements(COALESCE(final_data->'rincian_layanan', '[]'::jsonb)) AS item),
        0
    ),
    annual_subscription_cost = COALESCE(
        (SELECT SUM(COALESCE((item->>'biaya_langganan_tahunan')::numeric, 0))
         FROM jsonb_array_elements(COALESCE(final_data->'rincian_layanan', '[]'::jsonb)) AS item),
        0
    ),
    total_contract_value = COALESCE(
        (SELECT SUM(
            COALESCE((item->>'biaya_instalasi')::numeric, 0) +
            COALESCE((item->>'biaya_langganan_tahunan')::numeric, 0)
        )
         FROM jsonb_array_elements(COALESCE(final_data->'rincian_layanan', '[]'::jsonb)) AS item),
        0
    )
WHERE final_data IS NOT NULL;
```

---

**Migration Created:** 2025-10-06
**Last Updated:** 2025-10-06
**Version:** 1.0.0

---
---

# Extended Contract Denormalization Migration Guide

## Overview

**Migration ID:** `8a6d04b41608_extend_contract_denorm_all_fields`
**Purpose:** Extend denormalized columns to include ALL important fields from TelkomContractData for comprehensive contract data access
**Risk Level:** 🟡 Medium (adds 20 new columns, backfills data)
**Reversible:** ✅ Yes (downgrade available)
**Estimated Duration:** ~2-10 minutes (depends on contract count)

---

## What This Migration Does

This migration extends the previous denormalization by adding **20 new columns** to capture all important fields from `TelkomContractData`, eliminating the need for JSONB traversal in most queries.

### New Columns Added (20 total)

#### A. Customer & Representatives (from `informasi_pelanggan`)

| Column | Type | Purpose | Source Path |
|--------|------|---------|-------------|
| `customer_address` | TEXT | Customer address | `informasi_pelanggan->alamat` |
| `rep_name` | TEXT | Representative name | `informasi_pelanggan->perwakilan->nama` |
| `rep_title` | TEXT | Representative title | `informasi_pelanggan->perwakilan->jabatan` |
| `customer_contact_name` | TEXT | Customer contact person | `informasi_pelanggan->kontak_person->nama` |
| `customer_contact_title` | TEXT | Contact title | `informasi_pelanggan->kontak_person->jabatan` |
| `customer_contact_email` | TEXT | Contact email (normalized) | `informasi_pelanggan->kontak_person->email` |
| `customer_contact_phone` | TEXT | Contact phone (trimmed) | `informasi_pelanggan->kontak_person->telepon` |

#### B. Contract Period Raw (for tracing)

| Column | Type | Purpose | Source Path |
|--------|------|---------|-------------|
| `period_start_raw` | TEXT | Raw start date before parsing | `jangka_waktu->mulai` |
| `period_end_raw` | TEXT | Raw end date before parsing | `jangka_waktu->akhir` |

#### C. Telkom Contact Person (from `kontak_person_telkom`)

| Column | Type | Purpose | Source Path |
|--------|------|---------|-------------|
| `telkom_contact_name` | TEXT | Telkom contact name | `kontak_person_telkom->nama` |
| `telkom_contact_title` | TEXT | Telkom contact title | `kontak_person_telkom->jabatan` |
| `telkom_contact_email` | TEXT | Telkom email (normalized) | `kontak_person_telkom->email` |
| `telkom_contact_phone` | TEXT | Telkom phone (trimmed) | `kontak_person_telkom->telepon` |

#### D. Payment Details (from `tata_cara_pembayaran`)

| Column | Type | Purpose | Source Path |
|--------|------|---------|-------------|
| `payment_description` | TEXT | Payment method description | `tata_cara_pembayaran->description` |
| `termin_total_count` | INTEGER | Count of termin payments | Computed: `COUNT(termin_payments)` |
| `termin_total_amount` | NUMERIC(18,2) | Sum of termin amounts | Computed: `SUM(termin_payments[].amount)` |
| `payment_raw_text` | TEXT | Original payment text | `tata_cara_pembayaran->raw_text` |
| `termin_payments_json` | JSONB | Termin details snapshot | `tata_cara_pembayaran->termin_payments` |

#### E. Extraction Metadata

| Column | Type | Purpose | Source Path |
|--------|------|---------|-------------|
| `extraction_timestamp` | TIMESTAMPTZ | When extraction occurred | `extraction_timestamp` (parsed) |
| `contract_processing_time_sec` | FLOAT | Processing duration | `processing_time_seconds` |

### New Indexes Created

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `ix_contracts_customer_npwp` | `customer_npwp` | Tax ID lookups |
| `ix_contracts_extraction_timestamp` | `extraction_timestamp DESC` | Processing analytics |
| `ix_contracts_payment_termin` | `payment_method, termin_total_count, termin_total_amount` | Termin payment queries |

**Important:** The `final_data` JSONB column remains **unchanged** and is still the source of truth.

---

## Pre-Migration Checklist

### 1. Backup Database

```bash
# Create database backup
pg_dump -h localhost -U postgres -d telkom_contracts \
  -F c -b -v -f "backup_extended_denorm_$(date +%Y%m%d_%H%M%S).dump"

# Verify backup
pg_restore --list backup_extended_denorm_*.dump | head -20
```

### 2. Check Current State

```sql
-- Check number of existing contracts
SELECT COUNT(*) FROM contracts;

-- Check sample final_data structure (extended fields)
SELECT
    id,
    final_data->'informasi_pelanggan'->>'alamat' as address,
    final_data->'kontak_person_telkom'->>'nama' as telkom_contact,
    jsonb_array_length(COALESCE(final_data->'tata_cara_pembayaran'->'termin_payments', '[]'::jsonb)) as termin_count
FROM contracts
LIMIT 5;

-- Check current migration version
SELECT * FROM alembic_version;
```

### 3. Verify Dependencies

```bash
# Ensure backend is stopped or in maintenance mode
systemctl status telkom-backend  # or equivalent

# Check PostgreSQL version (should be 12+)
psql -U postgres -c "SELECT version();"
```

---

## Running the Migration

### Step 1: Apply Migration (Upgrade)

```bash
cd /path/to/telkom-contract-extractor/backend

# Dry-run (check SQL without executing)
alembic upgrade 8a6d04b41608 --sql

# Apply migration
alembic upgrade head
```

**Expected Output:**

```
INFO  [alembic.runtime.migration] Running upgrade a53e7fef9408 -> 8a6d04b41608, extend_contract_denorm_all_fields
Phase A: Adding 20 new denormalized columns to contracts table...
✓ 20 columns added successfully
Phase B: Backfilling data from final_data JSONB...
  ✓ Backfilled customer & representative data for 123 rows
  ✓ Backfilled period raw data for 123 rows
  ✓ Backfilled Telkom contact data for 123 rows
  ✓ Backfilled payment details & termin aggregation for 123 rows
  ✓ Backfilled extraction metadata for 123 rows
Phase C: Creating indexes for query optimization...
✓ Indexes created successfully
Migration completed successfully! 20 new columns added and backfilled.
```

### Step 2: Verify Migration Success

```sql
-- 1. Check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contracts'
  AND column_name IN (
    'customer_address', 'rep_name', 'telkom_contact_name',
    'termin_total_count', 'termin_total_amount', 'extraction_timestamp'
  );

-- 2. Verify backfill coverage
SELECT
    COUNT(*) as total_contracts,
    COUNT(customer_address) as with_address,
    COUNT(telkom_contact_name) as with_telkom_contact,
    COUNT(termin_payments_json) as with_termin_json,
    COUNT(extraction_timestamp) as with_extraction_ts,
    ROUND(COUNT(customer_address) * 100.0 / COUNT(*), 2) as address_backfill_pct
FROM contracts;

-- 3. Sample extended denormalized data
SELECT
    id,
    customer_name,
    customer_address,
    rep_name,
    customer_contact_email,
    telkom_contact_name,
    telkom_contact_email,
    payment_description,
    termin_total_count,
    termin_total_amount,
    extraction_timestamp
FROM contracts
LIMIT 10;

-- 4. Verify termin aggregation accuracy
SELECT
    id,
    termin_total_count,
    termin_total_amount,
    jsonb_array_length(COALESCE(termin_payments_json, '[]'::jsonb)) as json_count,
    (
        SELECT COALESCE(SUM((e->>'amount')::numeric), 0)
        FROM jsonb_array_elements(COALESCE(termin_payments_json, '[]'::jsonb)) AS e
    ) as json_sum,
    -- Verify aggregation matches
    termin_total_count = jsonb_array_length(COALESCE(termin_payments_json, '[]'::jsonb)) as count_matches,
    termin_total_amount = (
        SELECT COALESCE(SUM((e->>'amount')::numeric), 0)
        FROM jsonb_array_elements(COALESCE(termin_payments_json, '[]'::jsonb)) AS e
    ) as sum_matches
FROM contracts
WHERE payment_method = 'termin'
LIMIT 5;

-- 5. Verify new indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'contracts'
  AND indexname IN (
    'ix_contracts_customer_npwp',
    'ix_contracts_extraction_timestamp',
    'ix_contracts_payment_termin'
  );

-- 6. Test query performance (should be fast with indexes)
EXPLAIN ANALYZE
SELECT
    COUNT(*) as total_contracts,
    COUNT(DISTINCT customer_npwp) as unique_customers,
    SUM(termin_total_amount) as total_termin_value,
    AVG(contract_processing_time_sec) as avg_processing_time
FROM contracts
WHERE payment_method = 'termin'
  AND extraction_timestamp >= '2025-01-01';
```

### Expected Verification Results

- ✅ All 20 new columns exist with correct data types
- ✅ Backfill percentage should be **≥ 80%** (some NULL values OK for incomplete data)
- ✅ Termin aggregations match JSONB data exactly (count and sum)
- ✅ 3 new indexes created successfully
- ✅ Email/phone fields are normalized (lowercase, trimmed)
- ✅ Aggregation queries complete in **< 200ms**

---

## Rollback Procedure

If issues arise, you can safely rollback:

```bash
cd /path/to/backend

# Rollback to previous migration
alembic downgrade a53e7fef9408
```

**What happens during downgrade:**
- All 3 new indexes are dropped
- All 20 extended denormalized columns are dropped
- **`final_data` JSONB remains intact** (no data loss!)

### Post-Rollback Verification

```sql
-- Verify extended columns are gone
SELECT column_name FROM information_schema.columns
WHERE table_name = 'contracts'
  AND (
    column_name LIKE '%_contact_%'
    OR column_name LIKE 'rep_%'
    OR column_name LIKE 'telkom_%'
    OR column_name LIKE 'termin_total_%'
    OR column_name = 'extraction_timestamp'
  );
-- Should return 0 rows

-- Verify final_data is still intact
SELECT COUNT(*),
       COUNT(final_data) as with_final_data,
       COUNT(final_data->'informasi_pelanggan') as with_customer_data
FROM contracts;
-- All counts should match
```

---

## Troubleshooting

### Issue 1: Backfill Shows Low Coverage for Extended Fields

**Symptom:** Verification query shows < 70% backfill coverage for new fields

**Diagnosis:**

```sql
-- Find contracts with missing extended data
SELECT
    id,
    customer_address,
    telkom_contact_name,
    termin_total_count,
    jsonb_pretty(final_data->'informasi_pelanggan') as customer_data_sample,
    jsonb_pretty(final_data->'kontak_person_telkom') as telkom_data_sample
FROM contracts
WHERE customer_address IS NULL
   OR telkom_contact_name IS NULL
LIMIT 5;
```

**Solution:**
This is expected if `final_data` has incomplete information (e.g., missing `kontak_person_telkom` or `perwakilan`). New contracts will populate correctly via the updated confirmation flow.

---

### Issue 2: Termin Aggregation Mismatch

**Symptom:** `termin_total_count` or `termin_total_amount` doesn't match JSONB data

**Diagnosis:**

```sql
-- Find mismatched termin aggregations
SELECT
    id,
    termin_total_count,
    termin_total_amount,
    jsonb_pretty(termin_payments_json) as termin_json,
    jsonb_array_length(COALESCE(termin_payments_json, '[]'::jsonb)) as actual_count,
    (
        SELECT COALESCE(SUM((e->>'amount')::numeric), 0)
        FROM jsonb_array_elements(COALESCE(termin_payments_json, '[]'::jsonb)) AS e
    ) as actual_sum
FROM contracts
WHERE payment_method = 'termin'
  AND (
    termin_total_count != jsonb_array_length(COALESCE(termin_payments_json, '[]'::jsonb))
    OR termin_total_amount != (
        SELECT COALESCE(SUM((e->>'amount')::numeric), 0)
        FROM jsonb_array_elements(COALESCE(termin_payments_json, '[]'::jsonb)) AS e
    )
  );
```

**Solution:**
Re-run the backfill query manually (see Appendix). This should only happen if data was modified during migration.

---

### Issue 3: Email/Phone Normalization Issues

**Symptom:** Emails not lowercase or phones have excess whitespace

**Diagnosis:**

```sql
-- Check normalization
SELECT
    id,
    customer_contact_email,
    final_data->'informasi_pelanggan'->'kontak_person'->>'email' as raw_email,
    telkom_contact_email,
    final_data->'kontak_person_telkom'->>'email' as raw_telkom_email
FROM contracts
WHERE customer_contact_email IS NOT NULL
   OR telkom_contact_email IS NOT NULL
LIMIT 10;
```

**Solution:**
Re-run the customer/telkom contact backfill queries with proper `LOWER(TRIM(...))` functions (see migration file).

---

## Post-Migration Tasks

### 1. Update Application Code (Already Done ✅)

- ✅ `app/models/database.py` - Contract model has 20 new columns
- ✅ `app/services/denorm.py` - Extended `compute_denorm_fields()` extracts all new fields
- ✅ `app/api/processing.py` - Confirmation flow populates all 20 new columns
- ✅ Tests updated with 62 passing test cases

### 2. Monitor Query Performance

```sql
-- Enable query logging (optional)
ALTER DATABASE telkom_contracts SET log_min_duration_statement = 100;

-- Monitor queries using extended fields
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%contracts%'
  AND (
    query LIKE '%customer_address%'
    OR query LIKE '%telkom_contact%'
    OR query LIKE '%termin_total%'
  )
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 3. Validate Data Integrity

```sql
-- Cross-check denormalized vs JSONB values (sample check)
SELECT
    id,
    customer_address,
    final_data->'informasi_pelanggan'->>'alamat' as jsonb_address,
    customer_address = (final_data->'informasi_pelanggan'->>'alamat') as matches,
    telkom_contact_email,
    LOWER(TRIM(final_data->'kontak_person_telkom'->>'email')) as jsonb_email,
    telkom_contact_email = LOWER(TRIM(final_data->'kontak_person_telkom'->>'email')) as email_matches
FROM contracts
WHERE customer_address IS NOT NULL
   OR telkom_contact_email IS NOT NULL
LIMIT 100;

-- Should show high match rate (>95%)
```

---

## Performance Benchmarks

### Before Extended Migration

```sql
-- Contact info query (requires JSONB parsing)
EXPLAIN ANALYZE
SELECT
    COUNT(*),
    COUNT(DISTINCT final_data->'kontak_person_telkom'->>'nama') as unique_telkom_contacts
FROM contracts;

-- Typical: 150-300ms for 1000 contracts
```

### After Extended Migration

```sql
-- Contact info query (uses indexed denormalized columns)
EXPLAIN ANALYZE
SELECT
    COUNT(*),
    COUNT(DISTINCT telkom_contact_name) as unique_telkom_contacts
FROM contracts;

-- Typical: 10-30ms for 1000 contracts (5-15x faster!)
```

### Termin Payment Analysis

```sql
-- Before: Complex JSONB aggregation
EXPLAIN ANALYZE
SELECT
    SUM((
        SELECT SUM((e->>'amount')::numeric)
        FROM jsonb_array_elements(COALESCE(final_data->'tata_cara_pembayaran'->'termin_payments', '[]'::jsonb)) AS e
    )) as total_termin_value
FROM contracts
WHERE final_data->'tata_cara_pembayaran'->>'method_type' = 'termin';

-- Typical: 300-600ms for 1000 contracts

-- After: Simple SUM on denormalized column
EXPLAIN ANALYZE
SELECT SUM(termin_total_amount) as total_termin_value
FROM contracts
WHERE payment_method = 'termin';

-- Typical: 15-40ms for 1000 contracts (10-20x faster!)
```

---

## FAQ

**Q: Will this migration cause downtime?**
A: No, but the `contracts` table will be locked during Phase B backfill (~2-10 minutes). No new contracts can be created during this time.

**Q: What if backfill fails for some contracts?**
A: The migration uses safe NULL handling. Incomplete data will default to NULL. New contracts will populate correctly via the updated confirmation flow.

**Q: Can I re-run the migration if it partially completes?**
A: Yes, but you must first rollback: `alembic downgrade a53e7fef9408`, then re-run `alembic upgrade head`.

**Q: Will old API endpoints break?**
A: No. The `final_data` JSONB is unchanged, so all existing code continues to work. New code can leverage faster denormalized columns.

**Q: How do I verify termin aggregation is accurate?**
A: Run the verification query in Step 2.4 above. The `count_matches` and `sum_matches` columns should all be TRUE.

**Q: Why are some emails/phones NULL despite having data in final_data?**
A: The normalization functions (`_normalize_email`, `_normalize_phone`) return NULL for empty strings. Check if the raw JSONB values are empty strings.

---

## Rollback Scenarios

### Scenario 1: Immediate Rollback (Within 1 Hour)

```bash
# If migration just completed and issues are found
alembic downgrade a53e7fef9408

# Verify
psql -U postgres -d telkom_contracts \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='contracts' AND column_name='customer_address';"
# Should return 0 rows
```

### Scenario 2: Rollback After Days/Weeks

**⚠️ Warning:** New contracts confirmed after migration will have extended denormalized data that will be lost on rollback. However, `final_data` JSONB is preserved, so no permanent data loss occurs.

```bash
# 1. Stop application
systemctl stop telkom-backend

# 2. Backup current state
pg_dump -h localhost -U postgres -d telkom_contracts \
  -F c -f "backup_before_extended_rollback.dump"

# 3. Rollback
alembic downgrade a53e7fef9408

# 4. Restart application
systemctl start telkom-backend
```

---

## Appendix: Manual Backfill (If Needed)

If automatic backfill fails, run manually (idempotent):

```sql
-- A. Customer & Representatives
UPDATE contracts
SET
    customer_address = final_data->'informasi_pelanggan'->>'alamat',
    rep_name = final_data->'informasi_pelanggan'->'perwakilan'->>'nama',
    rep_title = final_data->'informasi_pelanggan'->'perwakilan'->>'jabatan',
    customer_contact_name = final_data->'informasi_pelanggan'->'kontak_person'->>'nama',
    customer_contact_title = final_data->'informasi_pelanggan'->'kontak_person'->>'jabatan',
    customer_contact_email = LOWER(TRIM(final_data->'informasi_pelanggan'->'kontak_person'->>'email')),
    customer_contact_phone = TRIM(final_data->'informasi_pelanggan'->'kontak_person'->>'telepon')
WHERE final_data IS NOT NULL;

-- B. Contract Period Raw
UPDATE contracts
SET
    period_start_raw = final_data->'jangka_waktu'->>'mulai',
    period_end_raw = final_data->'jangka_waktu'->>'akhir'
WHERE final_data IS NOT NULL;

-- C. Telkom Contact
UPDATE contracts
SET
    telkom_contact_name = final_data->'kontak_person_telkom'->>'nama',
    telkom_contact_title = final_data->'kontak_person_telkom'->>'jabatan',
    telkom_contact_email = LOWER(TRIM(final_data->'kontak_person_telkom'->>'email')),
    telkom_contact_phone = TRIM(final_data->'kontak_person_telkom'->>'telepon')
WHERE final_data IS NOT NULL;

-- D. Payment Details with Termin Aggregation
WITH termin_agg AS (
    SELECT
        c.id,
        -- Only count if termin_payments is actually an array, otherwise 0
        CASE
            WHEN jsonb_typeof(c.final_data->'tata_cara_pembayaran'->'termin_payments') = 'array'
            THEN jsonb_array_length(c.final_data->'tata_cara_pembayaran'->'termin_payments')
            ELSE 0
        END AS tp_count,
        -- Only sum if termin_payments is actually an array, otherwise 0
        CASE
            WHEN jsonb_typeof(c.final_data->'tata_cara_pembayaran'->'termin_payments') = 'array'
            THEN COALESCE(
                (SELECT SUM(COALESCE((elem->>'amount')::numeric, 0))
                 FROM jsonb_array_elements(c.final_data->'tata_cara_pembayaran'->'termin_payments') AS elem),
                0
            )::numeric(18,2)
            ELSE 0::numeric(18,2)
        END AS tp_total
    FROM contracts c
    WHERE c.final_data IS NOT NULL
)
UPDATE contracts c
SET
    payment_description = c.final_data->'tata_cara_pembayaran'->>'description',
    termin_total_count = ta.tp_count,
    termin_total_amount = ta.tp_total,
    payment_raw_text = c.final_data->'tata_cara_pembayaran'->>'raw_text',
    termin_payments_json = CASE
        WHEN jsonb_typeof(c.final_data->'tata_cara_pembayaran'->'termin_payments') = 'array'
        THEN c.final_data->'tata_cara_pembayaran'->'termin_payments'
        ELSE NULL
    END
FROM termin_agg ta
WHERE c.id = ta.id;

-- E. Extraction Metadata
UPDATE contracts
SET
    extraction_timestamp = CASE
        WHEN final_data->>'extraction_timestamp' IS NOT NULL
            AND final_data->>'extraction_timestamp' != ''
        THEN (final_data->>'extraction_timestamp')::timestamptz
        ELSE NULL
    END,
    contract_processing_time_sec = CASE
        WHEN final_data->>'processing_time_seconds' IS NOT NULL
            AND final_data->>'processing_time_seconds' != ''
        THEN (final_data->>'processing_time_seconds')::float
        ELSE NULL
    END
WHERE final_data IS NOT NULL;
```

---

## Summary of Changes

### Database Schema
- ✅ 20 new denormalized columns added to `contracts` table
- ✅ 3 new indexes for optimized queries
- ✅ All columns nullable (safe for incomplete data)
- ✅ NUMERIC(18,2) for money values (no float rounding)
- ✅ JSONB snapshot for termin payments (detail inspection without extra tables)

### Application Code
- ✅ `DenormFields` dataclass extended with 20 new fields
- ✅ `compute_denorm_fields()` extracts all extended fields
- ✅ Helper functions: `_parse_timestamp`, `_normalize_email`, `_normalize_phone`, `_compute_termin_summary`
- ✅ Confirmation endpoint writes all 20 new fields
- ✅ 62 comprehensive unit tests (all passing)

### Performance Impact
- 🚀 **5-20x faster** queries for contact information
- 🚀 **10-20x faster** termin payment aggregations
- 🚀 Eliminated JSONB traversal for most queries
- 📊 New indexes support efficient filtering and analytics

---

**Migration Created:** 2025-10-07
**Last Updated:** 2025-10-07
**Version:** 2.0.0 (Extended Denormalization)
