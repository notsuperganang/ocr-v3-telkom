"""create_users_table

Create users table for database-backed RBAC authentication.

This migration creates the users table with:
- UserRole enum (STAFF, MANAGER) for role-based access control
- Core user fields: username, email, password_hash, full_name
- Role and status fields: role (enum), is_active (boolean)
- Audit timestamps: created_at, updated_at, last_login_at
- Indexes for efficient queries

Revision ID: 89a29e3e9d45
Revises: 6b81976f05de
Create Date: 2025-12-24 14:25:43.040929

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '89a29e3e9d45'
down_revision: Union[str, Sequence[str], None] = '6b81976f05de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create users table with RBAC support."""

    print("=" * 60)
    print("Creating Users Table for RBAC Authentication")
    print("=" * 60)

    # Phase A: Create UserRole enum type
    print("Phase A: Creating UserRole enum...")
    user_role_enum = postgresql.ENUM('STAFF', 'MANAGER', name='userrole', create_type=True)
    user_role_enum.create(op.get_bind())
    print("✓ UserRole enum created (STAFF, MANAGER)")

    # Phase B: Create users table
    print("\nPhase B: Creating users table...")
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('username', sa.String(50), nullable=False, unique=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('role', user_role_enum, nullable=False, server_default='STAFF'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    )
    print("✓ Users table created with all columns")

    # Phase C: Create indexes
    print("\nPhase C: Creating indexes...")
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_role', 'users', ['role'], unique=False)
    op.create_index('ix_users_is_active', 'users', ['is_active'], unique=False)
    print("✓ Created 5 indexes: id, username (unique), email (unique), role, is_active")

    print("\n" + "=" * 60)
    print("✅ Users table migration completed successfully!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Run the FK migration to link existing tables to users")
    print("2. Run the seed script to create initial admin user")
    print("=" * 60)


def downgrade() -> None:
    """Drop users table."""

    print("=" * 60)
    print("Rolling Back Users Table Migration")
    print("=" * 60)

    # Drop indexes
    print("Dropping indexes...")
    op.drop_index('ix_users_is_active', table_name='users')
    op.drop_index('ix_users_role', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    print("✓ Indexes dropped")

    # Drop table
    print("Dropping users table...")
    op.drop_table('users')
    print("✓ Users table dropped")

    # Drop enum type
    print("Dropping UserRole enum...")
    user_role_enum = postgresql.ENUM('STAFF', 'MANAGER', name='userrole')
    user_role_enum.drop(op.get_bind())
    print("✓ UserRole enum dropped")

    print("\n" + "=" * 60)
    print("✅ Users table rollback completed successfully")
    print("=" * 60)
