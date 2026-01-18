"""add_accounts_table_and_contract_refactor

Backbone refactor for account-based contract management:
1. Create account_managers table (Telkom AMs)
2. Create segments table (with seed data)
3. Create witels table (with seed data)
4. Create accounts table (master client entity)
5. Modify contracts table (add account_id, contract_year, telkom_contact_id)

New relationship structure:
  Account
    └── Contract (2024)
    └── Contract (2025)
    └── Contract (2026)
          └── Invoice (term & recurring payments)

Revision ID: f1a2b3c4d5e6
Revises: 395dad69684b
Create Date: 2025-01-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '395dad69684b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with accounts infrastructure and contract refactor."""

    # =========================================================================
    # Step 1: Create account_managers table
    # =========================================================================
    print("Step 1: Creating account_managers table...")
    op.create_table(
        'account_managers',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_account_managers_name', 'account_managers', ['name'])
    op.create_index('ix_account_managers_is_active', 'account_managers', ['is_active'])
    print("✓ account_managers table created")

    # =========================================================================
    # Step 2: Create segments table with seed data
    # =========================================================================
    print("Step 2: Creating segments table...")
    op.create_table(
        'segments',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(length=100), nullable=False, unique=True),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_segments_name', 'segments', ['name'])
    op.create_index('ix_segments_is_active', 'segments', ['is_active'])

    # Seed segments data
    print("  Seeding segments data...")
    connection = op.get_bind()
    segments_data = [
        {'name': 'Regional 1', 'code': 'REG1'},
        {'name': 'Regional 2', 'code': 'REG2'},
        {'name': 'Regional 3', 'code': 'REG3'},
        {'name': 'Regional 4', 'code': 'REG4'},
        {'name': 'Regional 5', 'code': 'REG5'},
        {'name': 'Regional 6', 'code': 'REG6'},
        {'name': 'Regional 7', 'code': 'REG7'},
        {'name': 'Enterprise', 'code': 'ENT'},
        {'name': 'Government', 'code': 'GOV'},
        {'name': 'SME', 'code': 'SME'},
    ]
    for segment in segments_data:
        connection.execute(
            sa.text("INSERT INTO segments (name, code) VALUES (:name, :code)"),
            segment
        )
    print(f"  ✓ Seeded {len(segments_data)} segments")
    print("✓ segments table created with seed data")

    # =========================================================================
    # Step 3: Create witels table with seed data
    # =========================================================================
    print("Step 3: Creating witels table...")
    op.create_table(
        'witels',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(length=20), nullable=False, unique=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_witels_code', 'witels', ['code'])
    op.create_index('ix_witels_is_active', 'witels', ['is_active'])

    # Seed witels data
    print("  Seeding witels data...")
    witels_data = [
        {'code': '901', 'name': 'Aceh'},
    ]
    for witel in witels_data:
        connection.execute(
            sa.text("INSERT INTO witels (code, name) VALUES (:code, :name)"),
            witel
        )
    print(f"  ✓ Seeded {len(witels_data)} witels")
    print("✓ witels table created with seed data")

    # =========================================================================
    # Step 4: Create accounts table
    # =========================================================================
    print("Step 4: Creating accounts table...")
    op.create_table(
        'accounts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),

        # Business identifiers
        sa.Column('account_number', sa.String(length=50), nullable=True, unique=True),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('nipnas', sa.String(length=50), nullable=True),
        sa.Column('bus_area', sa.String(length=50), nullable=True),

        # Foreign keys to reference tables
        sa.Column('segment_id', sa.Integer(), sa.ForeignKey('segments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('witel_id', sa.Integer(), sa.ForeignKey('witels.id', ondelete='SET NULL'), nullable=True),
        sa.Column('account_manager_id', sa.Integer(), sa.ForeignKey('account_managers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_officer_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),

        # Status and notes
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('notes', sa.Text(), nullable=True),

        # Audit fields
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )

    # Create indexes for efficient queries
    op.create_index('ix_accounts_account_number', 'accounts', ['account_number'], unique=True)
    op.create_index('ix_accounts_name', 'accounts', ['name'])
    op.create_index('ix_accounts_nipnas', 'accounts', ['nipnas'])
    op.create_index('ix_accounts_segment_id', 'accounts', ['segment_id'])
    op.create_index('ix_accounts_witel_id', 'accounts', ['witel_id'])
    op.create_index('ix_accounts_account_manager_id', 'accounts', ['account_manager_id'])
    op.create_index('ix_accounts_assigned_officer_id', 'accounts', ['assigned_officer_id'])
    op.create_index('ix_accounts_is_active', 'accounts', ['is_active'])
    print("✓ accounts table created with indexes")

    # =========================================================================
    # Step 5: Modify contracts table
    # =========================================================================
    print("Step 5: Modifying contracts table...")

    # Add account_id column (nullable)
    op.add_column(
        'contracts',
        sa.Column('account_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_contracts_account_id',
        'contracts',
        'accounts',
        ['account_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_contracts_account_id', 'contracts', ['account_id'])
    print("  ✓ account_id column added")

    # Add contract_year column (NOT NULL)
    op.add_column(
        'contracts',
        sa.Column('contract_year', sa.Integer(), nullable=False)
    )
    op.create_index('ix_contracts_contract_year', 'contracts', ['contract_year'])
    op.create_check_constraint(
        'ck_contracts_contract_year',
        'contracts',
        'contract_year >= 2000 AND contract_year <= 2100'
    )
    print("  ✓ contract_year column added")

    # Add telkom_contact_id column (nullable FK to account_managers)
    op.add_column(
        'contracts',
        sa.Column('telkom_contact_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_contracts_telkom_contact_id',
        'contracts',
        'account_managers',
        ['telkom_contact_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_contracts_telkom_contact_id', 'contracts', ['telkom_contact_id'])
    print("  ✓ telkom_contact_id column added")

    # Create composite index for account + year queries
    op.create_index(
        'ix_contracts_account_year',
        'contracts',
        ['account_id', 'contract_year']
    )
    print("  ✓ composite index (account_id, contract_year) created")

    print("✓ contracts table modifications complete")
    print("\nMigration completed successfully!")


def downgrade() -> None:
    """Downgrade schema - remove all new tables and columns."""
    print("Downgrading: Removing accounts infrastructure and contract changes...")

    # =========================================================================
    # Step 5 (reverse): Remove contracts table modifications
    # =========================================================================
    print("Step 1: Removing contracts table modifications...")

    # Drop composite index
    op.drop_index('ix_contracts_account_year', table_name='contracts')

    # Drop telkom_contact_id
    op.drop_index('ix_contracts_telkom_contact_id', table_name='contracts')
    op.drop_constraint('fk_contracts_telkom_contact_id', 'contracts', type_='foreignkey')
    op.drop_column('contracts', 'telkom_contact_id')

    # Drop contract_year
    op.drop_constraint('ck_contracts_contract_year', 'contracts', type_='check')
    op.drop_index('ix_contracts_contract_year', table_name='contracts')
    op.drop_column('contracts', 'contract_year')

    # Drop account_id
    op.drop_index('ix_contracts_account_id', table_name='contracts')
    op.drop_constraint('fk_contracts_account_id', 'contracts', type_='foreignkey')
    op.drop_column('contracts', 'account_id')

    print("  ✓ contracts table modifications removed")

    # =========================================================================
    # Step 4 (reverse): Drop accounts table
    # =========================================================================
    print("Step 2: Dropping accounts table...")
    op.drop_index('ix_accounts_is_active', table_name='accounts')
    op.drop_index('ix_accounts_assigned_officer_id', table_name='accounts')
    op.drop_index('ix_accounts_account_manager_id', table_name='accounts')
    op.drop_index('ix_accounts_witel_id', table_name='accounts')
    op.drop_index('ix_accounts_segment_id', table_name='accounts')
    op.drop_index('ix_accounts_nipnas', table_name='accounts')
    op.drop_index('ix_accounts_name', table_name='accounts')
    op.drop_index('ix_accounts_account_number', table_name='accounts')
    op.drop_table('accounts')
    print("  ✓ accounts table dropped")

    # =========================================================================
    # Step 3 (reverse): Drop witels table
    # =========================================================================
    print("Step 3: Dropping witels table...")
    op.drop_index('ix_witels_is_active', table_name='witels')
    op.drop_index('ix_witels_code', table_name='witels')
    op.drop_table('witels')
    print("  ✓ witels table dropped")

    # =========================================================================
    # Step 2 (reverse): Drop segments table
    # =========================================================================
    print("Step 4: Dropping segments table...")
    op.drop_index('ix_segments_is_active', table_name='segments')
    op.drop_index('ix_segments_name', table_name='segments')
    op.drop_table('segments')
    print("  ✓ segments table dropped")

    # =========================================================================
    # Step 1 (reverse): Drop account_managers table
    # =========================================================================
    print("Step 5: Dropping account_managers table...")
    op.drop_index('ix_account_managers_is_active', table_name='account_managers')
    op.drop_index('ix_account_managers_name', table_name='account_managers')
    op.drop_table('account_managers')
    print("  ✓ account_managers table dropped")

    print("\n✓ Downgrade completed")
