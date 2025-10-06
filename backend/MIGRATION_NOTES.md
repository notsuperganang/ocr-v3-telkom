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
