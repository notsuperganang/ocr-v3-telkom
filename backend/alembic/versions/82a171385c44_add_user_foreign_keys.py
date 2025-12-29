"""add_user_foreign_keys

Convert string username columns to user_id foreign keys.

This migration converts 6 text-based user reference columns to proper
Foreign Key relationships with the users table:

1. processing_jobs.reviewed_by → reviewed_by_id (Integer FK)
2. contracts.confirmed_by → confirmed_by_id (Integer FK)
3. contract_term_payments.created_by → created_by_id (Integer FK)
4. contract_term_payments.updated_by → updated_by_id (Integer FK)
5. contract_recurring_payments.created_by → created_by_id (Integer FK)
6. contract_recurring_payments.updated_by → updated_by_id (Integer FK)

Since database will be wiped/reset before implementation, no data migration needed.
Focus on correct schema structure with FKs.

Phase A: Drop old string columns
Phase B: Add new Integer FK columns
Phase C: Create foreign key constraints
Phase D: Create indexes for performance

Revision ID: 82a171385c44
Revises: 89a29e3e9d45
Create Date: 2025-12-24 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '82a171385c44'
down_revision: Union[str, Sequence[str], None] = '89a29e3e9d45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add user_id foreign key columns to existing tables."""

    print("=" * 60)
    print("Converting User Reference Columns to Foreign Keys")
    print("=" * 60)
    print("Converting 6 text columns across 4 tables to Integer FKs")
    print("=" * 60)

    # Phase A: Drop old string columns
    print("\nPhase A: Dropping old string username columns...")

    # 1. ProcessingJob: reviewed_by
    print("  - Dropping processing_jobs.reviewed_by (String)")
    op.drop_column('processing_jobs', 'reviewed_by')

    # 2. Contract: confirmed_by
    print("  - Dropping contracts.confirmed_by (String)")
    op.drop_column('contracts', 'confirmed_by')

    # 3. ContractTermPayment: created_by, updated_by
    print("  - Dropping contract_term_payments.created_by (Text)")
    op.drop_column('contract_term_payments', 'created_by')
    print("  - Dropping contract_term_payments.updated_by (Text)")
    op.drop_column('contract_term_payments', 'updated_by')

    # 4. ContractRecurringPayment: created_by, updated_by
    print("  - Dropping contract_recurring_payments.created_by (Text)")
    op.drop_column('contract_recurring_payments', 'created_by')
    print("  - Dropping contract_recurring_payments.updated_by (Text)")
    op.drop_column('contract_recurring_payments', 'updated_by')

    print("✓ All 6 string columns dropped")

    # Phase B: Add new Integer FK columns
    print("\nPhase B: Adding new Integer FK columns...")

    # 1. ProcessingJob: reviewed_by_id
    print("  - Adding processing_jobs.reviewed_by_id (Integer)")
    op.add_column('processing_jobs',
                  sa.Column('reviewed_by_id', sa.Integer(), nullable=True))

    # 2. Contract: confirmed_by_id
    print("  - Adding contracts.confirmed_by_id (Integer, NOT NULL)")
    op.add_column('contracts',
                  sa.Column('confirmed_by_id', sa.Integer(), nullable=False))

    # 3. ContractTermPayment: created_by_id, updated_by_id
    print("  - Adding contract_term_payments.created_by_id (Integer)")
    op.add_column('contract_term_payments',
                  sa.Column('created_by_id', sa.Integer(), nullable=True))
    print("  - Adding contract_term_payments.updated_by_id (Integer)")
    op.add_column('contract_term_payments',
                  sa.Column('updated_by_id', sa.Integer(), nullable=True))

    # 4. ContractRecurringPayment: created_by_id, updated_by_id
    print("  - Adding contract_recurring_payments.created_by_id (Integer)")
    op.add_column('contract_recurring_payments',
                  sa.Column('created_by_id', sa.Integer(), nullable=True))
    print("  - Adding contract_recurring_payments.updated_by_id (Integer)")
    op.add_column('contract_recurring_payments',
                  sa.Column('updated_by_id', sa.Integer(), nullable=True))

    print("✓ All 6 Integer columns added")

    # Phase C: Create foreign key constraints
    print("\nPhase C: Creating foreign key constraints to users.id...")

    # 1. ProcessingJob FK
    print("  - Creating FK: processing_jobs.reviewed_by_id → users.id")
    op.create_foreign_key(
        'fk_processing_jobs_reviewed_by_id',
        'processing_jobs', 'users',
        ['reviewed_by_id'], ['id']
    )

    # 2. Contract FK
    print("  - Creating FK: contracts.confirmed_by_id → users.id")
    op.create_foreign_key(
        'fk_contracts_confirmed_by_id',
        'contracts', 'users',
        ['confirmed_by_id'], ['id']
    )

    # 3. ContractTermPayment FKs
    print("  - Creating FK: contract_term_payments.created_by_id → users.id")
    op.create_foreign_key(
        'fk_contract_term_payments_created_by_id',
        'contract_term_payments', 'users',
        ['created_by_id'], ['id']
    )
    print("  - Creating FK: contract_term_payments.updated_by_id → users.id")
    op.create_foreign_key(
        'fk_contract_term_payments_updated_by_id',
        'contract_term_payments', 'users',
        ['updated_by_id'], ['id']
    )

    # 4. ContractRecurringPayment FKs
    print("  - Creating FK: contract_recurring_payments.created_by_id → users.id")
    op.create_foreign_key(
        'fk_contract_recurring_payments_created_by_id',
        'contract_recurring_payments', 'users',
        ['created_by_id'], ['id']
    )
    print("  - Creating FK: contract_recurring_payments.updated_by_id → users.id")
    op.create_foreign_key(
        'fk_contract_recurring_payments_updated_by_id',
        'contract_recurring_payments', 'users',
        ['updated_by_id'], ['id']
    )

    print("✓ All 6 foreign key constraints created")

    # Phase D: Create indexes for query performance
    print("\nPhase D: Creating indexes on FK columns...")

    print("  - Creating index: ix_processing_jobs_reviewed_by_id")
    op.create_index('ix_processing_jobs_reviewed_by_id',
                    'processing_jobs', ['reviewed_by_id'])

    print("  - Creating index: ix_contracts_confirmed_by_id")
    op.create_index('ix_contracts_confirmed_by_id',
                    'contracts', ['confirmed_by_id'])

    print("  - Creating index: ix_contract_term_payments_created_by_id")
    op.create_index('ix_contract_term_payments_created_by_id',
                    'contract_term_payments', ['created_by_id'])

    print("  - Creating index: ix_contract_term_payments_updated_by_id")
    op.create_index('ix_contract_term_payments_updated_by_id',
                    'contract_term_payments', ['updated_by_id'])

    print("  - Creating index: ix_contract_recurring_payments_created_by_id")
    op.create_index('ix_contract_recurring_payments_created_by_id',
                    'contract_recurring_payments', ['created_by_id'])

    print("  - Creating index: ix_contract_recurring_payments_updated_by_id")
    op.create_index('ix_contract_recurring_payments_updated_by_id',
                    'contract_recurring_payments', ['updated_by_id'])

    print("✓ All 6 indexes created")

    print("\n" + "=" * 60)
    print("✅ User foreign keys migration completed successfully!")
    print("=" * 60)
    print("\nSummary:")
    print("- 6 string columns dropped")
    print("- 6 Integer FK columns added")
    print("- 6 foreign key constraints created → users.id")
    print("- 6 indexes created for query performance")
    print("\nNext steps:")
    print("1. Run seed script to create initial admin user")
    print("2. Update backend code to use User objects instead of strings")
    print("=" * 60)


def downgrade() -> None:
    """Revert to string username columns."""

    print("=" * 60)
    print("Rolling Back User Foreign Keys Migration")
    print("=" * 60)

    # Drop indexes
    print("\nDropping indexes...")
    op.drop_index('ix_contract_recurring_payments_updated_by_id',
                  table_name='contract_recurring_payments')
    op.drop_index('ix_contract_recurring_payments_created_by_id',
                  table_name='contract_recurring_payments')
    op.drop_index('ix_contract_term_payments_updated_by_id',
                  table_name='contract_term_payments')
    op.drop_index('ix_contract_term_payments_created_by_id',
                  table_name='contract_term_payments')
    op.drop_index('ix_contracts_confirmed_by_id',
                  table_name='contracts')
    op.drop_index('ix_processing_jobs_reviewed_by_id',
                  table_name='processing_jobs')
    print("✓ Indexes dropped")

    # Drop foreign keys
    print("\nDropping foreign key constraints...")
    op.drop_constraint('fk_contract_recurring_payments_updated_by_id',
                       'contract_recurring_payments', type_='foreignkey')
    op.drop_constraint('fk_contract_recurring_payments_created_by_id',
                       'contract_recurring_payments', type_='foreignkey')
    op.drop_constraint('fk_contract_term_payments_updated_by_id',
                       'contract_term_payments', type_='foreignkey')
    op.drop_constraint('fk_contract_term_payments_created_by_id',
                       'contract_term_payments', type_='foreignkey')
    op.drop_constraint('fk_contracts_confirmed_by_id',
                       'contracts', type_='foreignkey')
    op.drop_constraint('fk_processing_jobs_reviewed_by_id',
                       'processing_jobs', type_='foreignkey')
    print("✓ Foreign key constraints dropped")

    # Drop Integer FK columns
    print("\nDropping Integer FK columns...")
    op.drop_column('contract_recurring_payments', 'updated_by_id')
    op.drop_column('contract_recurring_payments', 'created_by_id')
    op.drop_column('contract_term_payments', 'updated_by_id')
    op.drop_column('contract_term_payments', 'created_by_id')
    op.drop_column('contracts', 'confirmed_by_id')
    op.drop_column('processing_jobs', 'reviewed_by_id')
    print("✓ Integer FK columns dropped")

    # Restore string columns
    print("\nRestoring original string username columns...")
    op.add_column('processing_jobs',
                  sa.Column('reviewed_by', sa.String(), nullable=True))
    op.add_column('contracts',
                  sa.Column('confirmed_by', sa.String(), nullable=True))
    op.add_column('contract_term_payments',
                  sa.Column('created_by', sa.Text(), nullable=True))
    op.add_column('contract_term_payments',
                  sa.Column('updated_by', sa.Text(), nullable=True))
    op.add_column('contract_recurring_payments',
                  sa.Column('created_by', sa.Text(), nullable=True))
    op.add_column('contract_recurring_payments',
                  sa.Column('updated_by', sa.Text(), nullable=True))
    print("✓ String columns restored")

    print("\n" + "=" * 60)
    print("✅ User foreign keys rollback completed successfully")
    print("=" * 60)
