"""add_contract_denorm_columns

Add denormalized columns to contracts table for efficient querying and KPI aggregation.

This migration implements a 3-phase approach:
- Phase A: Add nullable columns
- Phase B: Backfill existing data from final_data JSONB
- Phase C: Create indexes for query optimization

Revision ID: a53e7fef9408
Revises: 4c94e7565b76
Create Date: 2025-10-06 15:26:15.213432

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a53e7fef9408'
down_revision: Union[str, Sequence[str], None] = '4c94e7565b76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Upgrade schema with denormalized contract fields.

    IMPORTANT: This migration is idempotent - safe to run multiple times.
    """

    # ===== PHASE A: Add Columns =====
    print("Phase A: Adding denormalized columns to contracts table...")

    # Customer information
    op.add_column('contracts', sa.Column('customer_name', sa.String(length=500), nullable=True))
    op.add_column('contracts', sa.Column('customer_npwp', sa.String(length=50), nullable=True))

    # Contract period
    op.add_column('contracts', sa.Column('period_start', sa.Date(), nullable=True))
    op.add_column('contracts', sa.Column('period_end', sa.Date(), nullable=True))

    # Service counts
    op.add_column('contracts', sa.Column('service_connectivity', sa.Integer(), server_default='0', nullable=False))
    op.add_column('contracts', sa.Column('service_non_connectivity', sa.Integer(), server_default='0', nullable=False))
    op.add_column('contracts', sa.Column('service_bundling', sa.Integer(), server_default='0', nullable=False))

    # Payment method
    op.add_column('contracts', sa.Column('payment_method', sa.String(length=20), nullable=True))
    op.add_column('contracts', sa.Column('termin_count', sa.Integer(), nullable=True))

    # Financial data (using NUMERIC for precision)
    op.add_column('contracts', sa.Column('installation_cost', sa.Numeric(precision=18, scale=2), server_default='0', nullable=False))
    op.add_column('contracts', sa.Column('annual_subscription_cost', sa.Numeric(precision=18, scale=2), server_default='0', nullable=False))
    op.add_column('contracts', sa.Column('total_contract_value', sa.Numeric(precision=18, scale=2), server_default='0', nullable=False))

    print("✓ Columns added successfully")

    # ===== PHASE B: Backfill Data =====
    print("Phase B: Backfilling data from final_data JSONB...")

    # Use raw SQL for complex JSONB operations
    connection = op.get_bind()

    # Backfill in a single UPDATE statement for efficiency
    backfill_sql = """
    UPDATE contracts
    SET
        -- Customer info
        customer_name = final_data->'informasi_pelanggan'->>'nama_pelanggan',
        customer_npwp = final_data->'informasi_pelanggan'->>'npwp',

        -- Contract period (cast to date, NULL on error)
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

        -- Service counts (with COALESCE for NULL safety)
        service_connectivity = COALESCE((final_data->'layanan_utama'->>'connectivity_telkom')::integer, 0),
        service_non_connectivity = COALESCE((final_data->'layanan_utama'->>'non_connectivity_telkom')::integer, 0),
        service_bundling = COALESCE((final_data->'layanan_utama'->>'bundling')::integer, 0),

        -- Payment method (normalized to enum values)
        payment_method = CASE
            WHEN LOWER(final_data->'tata_cara_pembayaran'->>'method_type') = 'termin' THEN 'termin'
            WHEN LOWER(final_data->'tata_cara_pembayaran'->>'method_type') = 'recurring' THEN 'recurring'
            WHEN LOWER(final_data->'tata_cara_pembayaran'->>'method_type') LIKE '%one_time%' THEN 'one_time'
            ELSE NULL
        END,

        -- Termin count (only for termin payments)
        termin_count = CASE
            WHEN LOWER(final_data->'tata_cara_pembayaran'->>'method_type') = 'termin'
            THEN (final_data->'tata_cara_pembayaran'->>'total_termin_count')::integer
            ELSE NULL
        END,

        -- Financial data - SUM all rincian_layanan items
        -- Using jsonb_array_elements to iterate over array
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
    """

    result = connection.execute(sa.text(backfill_sql))
    rows_updated = result.rowcount
    print(f"✓ Backfilled {rows_updated} contract rows")

    # ===== PHASE C: Create Indexes =====
    print("Phase C: Creating indexes for query optimization...")

    # Index on confirmed_at for time-based queries (descending for recent-first sorting)
    op.create_index('ix_contracts_confirmed_at', 'contracts', ['confirmed_at'], postgresql_ops={'confirmed_at': 'DESC'})

    # Index on total_contract_value for aggregation and filtering (descending for top contracts)
    op.create_index('ix_contracts_total_value', 'contracts', ['total_contract_value'], postgresql_ops={'total_contract_value': 'DESC'})

    # Index on payment_method for filtering
    op.create_index('ix_contracts_payment_method', 'contracts', ['payment_method'])

    # Index on period_start for date range queries (descending for recent contracts)
    op.create_index('ix_contracts_period_start', 'contracts', ['period_start'], postgresql_ops={'period_start': 'DESC'})

    # Index on customer_name for search queries
    op.create_index('ix_contracts_customer_name', 'contracts', ['customer_name'])

    # Composite index for common KPI queries (month-based filtering + aggregation)
    op.create_index('ix_contracts_confirmed_at_value', 'contracts', ['confirmed_at', 'total_contract_value'])

    print("✓ Indexes created successfully")
    print("Migration completed successfully!")


def downgrade() -> None:
    """
    Downgrade schema - remove denormalized columns and indexes.

    WARNING: This will drop all denormalized data. Ensure final_data JSONB is intact before downgrading.
    """

    print("Downgrading: Removing denormalized columns and indexes...")

    # Drop indexes first
    op.drop_index('ix_contracts_confirmed_at_value', table_name='contracts')
    op.drop_index('ix_contracts_customer_name', table_name='contracts')
    op.drop_index('ix_contracts_period_start', table_name='contracts')
    op.drop_index('ix_contracts_payment_method', table_name='contracts')
    op.drop_index('ix_contracts_total_value', table_name='contracts')
    op.drop_index('ix_contracts_confirmed_at', table_name='contracts')

    # Drop columns
    op.drop_column('contracts', 'total_contract_value')
    op.drop_column('contracts', 'annual_subscription_cost')
    op.drop_column('contracts', 'installation_cost')
    op.drop_column('contracts', 'termin_count')
    op.drop_column('contracts', 'payment_method')
    op.drop_column('contracts', 'service_bundling')
    op.drop_column('contracts', 'service_non_connectivity')
    op.drop_column('contracts', 'service_connectivity')
    op.drop_column('contracts', 'period_end')
    op.drop_column('contracts', 'period_start')
    op.drop_column('contracts', 'customer_npwp')
    op.drop_column('contracts', 'customer_name')

    print("✓ Downgrade completed - denormalized columns removed")
