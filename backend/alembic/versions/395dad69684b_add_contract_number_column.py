"""add_contract_number_column

Add contract_number denormalized column for contract identification.
Format: K.TEL. XX/XXX/XXX/YYYY

Phase A: Add nullable column
Phase B: Backfill from final_data->>'nomor_kontrak' (if exists)
Phase C: Create unique index

Revision ID: 395dad69684b
Revises: 82a171385c44
Create Date: 2025-01-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '395dad69684b'
down_revision: Union[str, None] = '82a171385c44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with contract_number column."""

    # Phase A: Add nullable column
    print("Phase A: Adding contract_number column...")
    op.add_column('contracts', sa.Column('contract_number', sa.String(length=100), nullable=True))
    print("✓ Column added successfully")

    # Phase B: Backfill from final_data->>'nomor_kontrak' (for existing contracts)
    print("Phase B: Backfilling contract_number from final_data...")
    connection = op.get_bind()

    backfill_sql = """
    UPDATE contracts
    SET contract_number = UPPER(TRIM(final_data->>'nomor_kontrak'))
    WHERE final_data IS NOT NULL
      AND final_data->>'nomor_kontrak' IS NOT NULL
      AND TRIM(final_data->>'nomor_kontrak') != '';
    """

    result = connection.execute(sa.text(backfill_sql))
    print(f"✓ Backfilled {result.rowcount} contract rows")

    # Phase C: Create unique index (allows NULL but prevents duplicate non-NULL values)
    print("Phase C: Creating unique index for efficient queries...")
    op.create_index('ix_contracts_contract_number', 'contracts', ['contract_number'], unique=True)
    print("✓ Unique index created successfully")

    print("Migration completed successfully!")


def downgrade() -> None:
    """Downgrade schema - remove contract_number column and index."""
    print("Downgrading: Removing contract_number column and index...")

    op.drop_index('ix_contracts_contract_number', table_name='contracts')
    op.drop_column('contracts', 'contract_number')

    print("✓ Downgrade completed")
