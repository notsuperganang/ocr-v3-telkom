"""add_contract_contacts_table

Revision ID: adad14de3653
Revises: d58e32756d2b
Create Date: 2026-01-29 15:20:22.187807

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'adad14de3653'
down_revision: Union[str, Sequence[str], None] = 'd58e32756d2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'contract_contacts',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('phone_number', sa.String(length=50), nullable=True),
        sa.Column('job_title', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('updated_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['contract_id'], ['contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index('ix_contract_contacts_contract_id', 'contract_contacts', ['contract_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_contract_contacts_contract_id', table_name='contract_contacts')
    op.drop_table('contract_contacts')
