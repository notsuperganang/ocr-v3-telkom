"""add_contract_term_payments_table

Add normalized contract_term_payments table for operational termin tracking.
Replaces JSON-based termin storage with relational model for:
- Monthly payment reminders and due date tracking
- Payment status management (PENDING/DUE/OVERDUE/PAID/CANCELLED)
- Editable payment amounts while preserving original values
- Audit trail with created_by/updated_by fields

Also renames contracts.termin_payments_json → termin_payments_raw to indicate
it's a raw OCR snapshot, not operational data.

Phase A: Create contract_term_payments table
Phase B: Rename termin_payments_json column
Phase C: Create indexes for efficient querying

Revision ID: 6bef71f3b410
Revises: 8a6d04b41608
Create Date: 2025-11-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '6bef71f3b410'
down_revision: Union[str, Sequence[str], None] = '8a6d04b41608'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Upgrade schema with normalized contract_term_payments table.

    IMPORTANT: This migration is idempotent - safe to run multiple times.
    No data backfill is performed (database is currently empty).
    """

    # ===== PHASE A: Create contract_term_payments Table =====
    print("Phase A: Creating contract_term_payments table...")

    op.create_table(
        'contract_term_payments',
        # Primary key
        sa.Column('id', sa.BigInteger(), nullable=False),

        # Foreign key to contracts
        sa.Column('contract_id', sa.Integer(), nullable=False),

        # Termin details
        sa.Column('termin_number', sa.Integer(), nullable=False, comment='Termin sequence number (1, 2, 3, ...)'),
        sa.Column('period_label', sa.Text(), nullable=False, comment='Original period string (e.g., "Maret 2025")'),
        sa.Column('period_year', sa.Integer(), nullable=False, comment='Extracted year (e.g., 2025)'),
        sa.Column('period_month', sa.Integer(), nullable=False, comment='Extracted month 1-12 (Januari-Desember)'),

        # Amount tracking
        sa.Column('original_amount', sa.Numeric(precision=18, scale=2), nullable=False, comment='Original amount from extraction'),
        sa.Column('amount', sa.Numeric(precision=18, scale=2), nullable=False, comment='Current editable amount'),

        # Status tracking
        sa.Column('status', sa.Text(), nullable=False, server_default='PENDING', comment='PENDING/DUE/OVERDUE/PAID/CANCELLED'),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True, comment='Timestamp when marked as paid'),
        sa.Column('notes', sa.Text(), nullable=True, comment='Additional notes or comments'),

        # Audit fields
        sa.Column('created_by', sa.Text(), nullable=True, comment='User who created this record'),
        sa.Column('updated_by', sa.Text(), nullable=True, comment='User who last updated this record'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()'), comment='Creation timestamp'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()'), comment='Last update timestamp'),

        # Constraints
        sa.PrimaryKeyConstraint('id', name='contract_term_payments_pkey'),
        sa.ForeignKeyConstraint(
            ['contract_id'],
            ['contracts.id'],
            name='fk_contract_term_payments_contract_id',
            ondelete='CASCADE'
        ),
        sa.UniqueConstraint('contract_id', 'termin_number', name='uq_contract_term_payments_contract_termin'),
        sa.CheckConstraint(
            "status IN ('PENDING', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED')",
            name='ck_contract_term_payments_status'
        ),
        sa.CheckConstraint(
            'period_month >= 1 AND period_month <= 12',
            name='ck_contract_term_payments_period_month'
        ),
        sa.CheckConstraint(
            'period_year >= 2000 AND period_year <= 2100',
            name='ck_contract_term_payments_period_year'
        ),
        sa.CheckConstraint(
            'termin_number >= 1',
            name='ck_contract_term_payments_termin_number'
        ),
        comment='Normalized termin payment tracking table for operational reminders and status management'
    )

    print("✓ contract_term_payments table created successfully")

    # ===== PHASE B: Rename termin_payments_json Column =====
    print("Phase B: Renaming contracts.termin_payments_json → termin_payments_raw...")

    op.alter_column(
        'contracts',
        'termin_payments_json',
        new_column_name='termin_payments_raw',
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
        comment='Raw termin payment snapshot from OCR extraction (not operational data)'
    )

    print("✓ Column renamed successfully")

    # ===== PHASE C: Create Indexes =====
    print("Phase C: Creating indexes for efficient querying...")

    # Index on contract_id for fast lookups of all termins for a contract
    op.create_index(
        'idx_contract_term_payments_contract_id',
        'contract_term_payments',
        ['contract_id']
    )

    # Composite index for status and period queries (e.g., find all DUE payments in a month)
    op.create_index(
        'idx_contract_term_payments_status_period',
        'contract_term_payments',
        ['status', 'period_year', 'period_month']
    )

    # Index on period for date-based queries
    op.create_index(
        'idx_contract_term_payments_period',
        'contract_term_payments',
        ['period_year', 'period_month']
    )

    print("✓ Indexes created successfully")
    print("Migration completed successfully! contract_term_payments table is ready for use.")


def downgrade() -> None:
    """
    Downgrade schema - remove contract_term_payments table and revert column rename.

    WARNING: This will drop all termin payment tracking data.
    Ensure data is backed up before downgrading.
    """

    print("Downgrading: Removing contract_term_payments table and reverting column rename...")

    # Drop indexes first
    print("Dropping indexes...")
    op.drop_index('idx_contract_term_payments_period', table_name='contract_term_payments')
    op.drop_index('idx_contract_term_payments_status_period', table_name='contract_term_payments')
    op.drop_index('idx_contract_term_payments_contract_id', table_name='contract_term_payments')

    # Revert column rename
    print("Reverting contracts.termin_payments_raw → termin_payments_json...")
    op.alter_column(
        'contracts',
        'termin_payments_raw',
        new_column_name='termin_payments_json',
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True
    )

    # Drop table (CASCADE will handle FK constraints)
    print("Dropping contract_term_payments table...")
    op.drop_table('contract_term_payments')

    print("✓ Downgrade completed - contract_term_payments table removed")
    print("  Note: contracts table reverted to termin_payments_json")
