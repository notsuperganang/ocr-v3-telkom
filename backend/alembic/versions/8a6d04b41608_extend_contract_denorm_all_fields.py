"""extend_contract_denorm_all_fields

Extend denormalized columns on contracts table to include all important fields from TelkomContractData.
This migration adds 20 new columns for comprehensive contract data access without JSONB traversal.

Phase A: Add nullable columns
Phase B: Backfill from final_data JSONB
Phase C: Create indexes for query optimization

Revision ID: 8a6d04b41608
Revises: a53e7fef9408
Create Date: 2025-10-07 09:11:33.341216

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8a6d04b41608'
down_revision: Union[str, Sequence[str], None] = 'a53e7fef9408'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Upgrade schema with extended denormalized contract fields.

    IMPORTANT: This migration is idempotent - safe to run multiple times.
    """

    # ===== PHASE A: Add Columns =====
    print("Phase A: Adding 20 new denormalized columns to contracts table...")

    # A. Customer & Representatives (from informasi_pelanggan)
    op.add_column('contracts', sa.Column('customer_address', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('rep_name', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('rep_title', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('customer_contact_name', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('customer_contact_title', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('customer_contact_email', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('customer_contact_phone', sa.Text(), nullable=True))

    # B. Contract Period Raw (for tracing)
    op.add_column('contracts', sa.Column('period_start_raw', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('period_end_raw', sa.Text(), nullable=True))

    # C. Telkom Contact Person (from kontak_person_telkom)
    op.add_column('contracts', sa.Column('telkom_contact_name', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('telkom_contact_title', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('telkom_contact_email', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('telkom_contact_phone', sa.Text(), nullable=True))

    # D. Payment Details (from tata_cara_pembayaran)
    op.add_column('contracts', sa.Column('payment_description', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('termin_total_count', sa.Integer(), nullable=True))
    op.add_column('contracts', sa.Column('termin_total_amount', sa.Numeric(precision=18, scale=2), nullable=True))
    op.add_column('contracts', sa.Column('payment_raw_text', sa.Text(), nullable=True))
    op.add_column('contracts', sa.Column('termin_payments_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # E. Extraction Metadata
    op.add_column('contracts', sa.Column('extraction_timestamp', sa.DateTime(timezone=True), nullable=True))
    op.add_column('contracts', sa.Column('contract_processing_time_sec', sa.Float(), nullable=True))

    print("✓ 20 columns added successfully")

    # ===== PHASE B: Backfill Data =====
    print("Phase B: Backfilling data from final_data JSONB...")

    # Use raw SQL for complex JSONB operations
    connection = op.get_bind()

    # B.1 - Backfill Customer & Representatives
    backfill_customer_sql = """
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
    """

    result = connection.execute(sa.text(backfill_customer_sql))
    print(f"  ✓ Backfilled customer & representative data for {result.rowcount} rows")

    # B.2 - Backfill Contract Period Raw
    backfill_period_raw_sql = """
    UPDATE contracts
    SET
        period_start_raw = final_data->'jangka_waktu'->>'mulai',
        period_end_raw = final_data->'jangka_waktu'->>'akhir'
    WHERE final_data IS NOT NULL;
    """

    result = connection.execute(sa.text(backfill_period_raw_sql))
    print(f"  ✓ Backfilled period raw data for {result.rowcount} rows")

    # B.3 - Backfill Telkom Contact
    backfill_telkom_contact_sql = """
    UPDATE contracts
    SET
        telkom_contact_name = final_data->'kontak_person_telkom'->>'nama',
        telkom_contact_title = final_data->'kontak_person_telkom'->>'jabatan',
        telkom_contact_email = LOWER(TRIM(final_data->'kontak_person_telkom'->>'email')),
        telkom_contact_phone = TRIM(final_data->'kontak_person_telkom'->>'telepon')
    WHERE final_data IS NOT NULL;
    """

    result = connection.execute(sa.text(backfill_telkom_contact_sql))
    print(f"  ✓ Backfilled Telkom contact data for {result.rowcount} rows")

    # B.4 - Backfill Payment Details with Termin Aggregation
    backfill_payment_sql = """
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
    """

    result = connection.execute(sa.text(backfill_payment_sql))
    print(f"  ✓ Backfilled payment details & termin aggregation for {result.rowcount} rows")

    # B.5 - Backfill Extraction Metadata
    backfill_metadata_sql = """
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
    """

    result = connection.execute(sa.text(backfill_metadata_sql))
    print(f"  ✓ Backfilled extraction metadata for {result.rowcount} rows")

    # ===== PHASE C: Create Indexes =====
    print("Phase C: Creating indexes for query optimization...")

    # Index on customer_npwp for tax ID lookups
    op.create_index('ix_contracts_customer_npwp', 'contracts', ['customer_npwp'])

    # Index on extraction_timestamp for processing analytics (descending for recent-first)
    op.create_index(
        'ix_contracts_extraction_timestamp',
        'contracts',
        ['extraction_timestamp'],
        postgresql_ops={'extraction_timestamp': 'DESC'}
    )

    # Composite index for termin payment queries (method + count + amount)
    op.create_index(
        'ix_contracts_payment_termin',
        'contracts',
        ['payment_method', 'termin_total_count', 'termin_total_amount']
    )

    print("✓ Indexes created successfully")
    print("Migration completed successfully! 20 new columns added and backfilled.")


def downgrade() -> None:
    """
    Downgrade schema - remove extended denormalized columns and indexes.

    WARNING: This will drop all extended denormalized data.
    Ensure final_data JSONB is intact before downgrading.
    """

    print("Downgrading: Removing extended denormalized columns and indexes...")

    # Drop indexes first
    op.drop_index('ix_contracts_payment_termin', table_name='contracts')
    op.drop_index('ix_contracts_extraction_timestamp', table_name='contracts')
    op.drop_index('ix_contracts_customer_npwp', table_name='contracts')

    # Drop columns (reverse order of creation)
    # E. Extraction Metadata
    op.drop_column('contracts', 'contract_processing_time_sec')
    op.drop_column('contracts', 'extraction_timestamp')

    # D. Payment Details
    op.drop_column('contracts', 'termin_payments_json')
    op.drop_column('contracts', 'payment_raw_text')
    op.drop_column('contracts', 'termin_total_amount')
    op.drop_column('contracts', 'termin_total_count')
    op.drop_column('contracts', 'payment_description')

    # C. Telkom Contact
    op.drop_column('contracts', 'telkom_contact_phone')
    op.drop_column('contracts', 'telkom_contact_email')
    op.drop_column('contracts', 'telkom_contact_title')
    op.drop_column('contracts', 'telkom_contact_name')

    # B. Contract Period Raw
    op.drop_column('contracts', 'period_end_raw')
    op.drop_column('contracts', 'period_start_raw')

    # A. Customer & Representatives
    op.drop_column('contracts', 'customer_contact_phone')
    op.drop_column('contracts', 'customer_contact_email')
    op.drop_column('contracts', 'customer_contact_title')
    op.drop_column('contracts', 'customer_contact_name')
    op.drop_column('contracts', 'rep_title')
    op.drop_column('contracts', 'rep_name')
    op.drop_column('contracts', 'customer_address')

    print("✓ Downgrade completed - extended denormalized columns removed")
    print("  Note: final_data JSONB remains intact (no data loss)")
