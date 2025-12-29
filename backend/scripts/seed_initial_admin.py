"""
Seed initial admin user from environment variables.

This script creates the first MANAGER user from the credentials
configured in the .env file (AUTH_USERNAME and AUTH_PASSWORD).

This should be run ONCE after migrations to bootstrap the system
with an initial administrator account.

Usage:
    python scripts/seed_initial_admin.py

Requirements:
    - Database must be migrated (alembic upgrade head)
    - AUTH_USERNAME and AUTH_PASSWORD must be set in .env
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone

# Add backend to path so we can import app modules
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.database import User, UserRole
from app.auth.utils import get_password_hash
from app.config import settings


def seed_initial_admin():
    """Create initial admin user from .env credentials."""

    print("=" * 70)
    print("  Telkom Contract Extractor - Initial Admin User Seed Script")
    print("=" * 70)
    print()

    db: Session = SessionLocal()

    try:
        # Check if any users exist
        existing_user_count = db.query(User).count()

        if existing_user_count > 0:
            print(f"⚠️  WARNING: Database already has {existing_user_count} user(s).")
            print(f"    Skipping seed to avoid duplicate users.")
            print()
            print(f"    Existing users:")
            existing_users = db.query(User).all()
            for user in existing_users:
                print(f"      - {user.username} ({user.email}) - {user.role.value}")
            print()
            print(f"    To reset users, manually delete them from the database")
            print(f"    or wipe and remigrate the entire database.")
            return

        # Get credentials from environment
        admin_username = settings.auth_username
        admin_password = settings.auth_password

        if not admin_username or not admin_password:
            print("❌ ERROR: Missing required environment variables!")
            print()
            print("   AUTH_USERNAME and AUTH_PASSWORD must be set in .env file")
            print("   These credentials are used to create the initial MANAGER user.")
            print()
            print("   Example .env configuration:")
            print("   AUTH_USERNAME=admin")
            print("   AUTH_PASSWORD=your-secure-password-here")
            print()
            sys.exit(1)

        # Create initial MANAGER user
        print(f"Creating initial MANAGER user...")
        print()

        admin_email = f"{admin_username}@telkom.local"

        admin_user = User(
            username=admin_username,
            email=admin_email,
            password_hash=get_password_hash(admin_password),
            full_name="Initial Administrator",
            role=UserRole.MANAGER,
            is_active=True
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("✅ Initial admin user created successfully!")
        print()
        print("=" * 70)
        print("  User Details:")
        print("=" * 70)
        print(f"  User ID:       {admin_user.id}")
        print(f"  Username:      {admin_user.username}")
        print(f"  Email:         {admin_user.email}")
        print(f"  Full Name:     {admin_user.full_name}")
        print(f"  Role:          {admin_user.role.value} (full access)")
        print(f"  Status:        {'Active' if admin_user.is_active else 'Inactive'}")
        print(f"  Created At:    {admin_user.created_at}")
        print("=" * 70)
        print()
        print("🔐 Login Credentials:")
        print(f"   Username: {admin_username}")
        print(f"   Password: (from .env AUTH_PASSWORD)")
        print()
        print("=" * 70)
        print("  Next Steps:")
        print("=" * 70)
        print("  1. Start the backend server:")
        print("     uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        print()
        print("  2. Login via API:")
        print(f"     POST http://localhost:8000/auth/login")
        print(f'     Body: {{"username": "{admin_username}", "password": "..."}}')
        print()
        print("  3. Create additional users via API:")
        print(f"     POST http://localhost:8000/api/users/")
        print(f"     (Requires MANAGER authentication)")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print()
        print("❌ ERROR: Failed to create initial admin user!")
        print()
        print(f"   Error details: {str(e)}")
        print()
        print("   Troubleshooting:")
        print("   1. Check that database migrations are up to date:")
        print("      alembic upgrade head")
        print()
        print("   2. Verify database connection in .env:")
        print("      DATABASE_URL=postgresql://user:pass@host:port/dbname")
        print()
        print("   3. Check that users table exists:")
        print("      psql -d telkom_contracts -c '\\d users'")
        print()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_initial_admin()
