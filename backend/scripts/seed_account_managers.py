"""
Seed Account Manager data from the distribution invoice CSV.

This script creates Account Manager records based on the unique AM names
found in the DISTRIBUSI INV - JANUARI26.csv file.

Usage:
    python scripts/seed_account_managers.py

Requirements:
    - Database must be migrated (alembic upgrade head)
"""

import sys
import random
from pathlib import Path

# Add backend to path so we can import app modules
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.database import AccountManager


def generate_indonesian_phone() -> str:
    """Generate a random Indonesian mobile phone number."""
    # Indonesian mobile prefixes (Telkomsel, Indosat, XL, etc.)
    prefixes = ["0811", "0812", "0813", "0821", "0822", "0851", "0852", "0853", "0857", "0858"]
    prefix = random.choice(prefixes)
    # Generate 7-8 random digits
    suffix = "".join([str(random.randint(0, 9)) for _ in range(8)])
    return f"{prefix}{suffix}"


def name_to_email(name: str) -> str:
    """Convert name to email format: name@telkom.co.id"""
    # Replace spaces with dots and lowercase
    email_name = name.lower().replace(" ", ".")
    return f"{email_name}@telkom.co.id"


# Account Managers extracted from DISTRIBUSI INV - JANUARI26.csv (normalized to title case)
ACCOUNT_MANAGERS = [
    "Abdi Iqram",
    "Aidil Azhar",
    "Evan Wahyudi",
    "Gogi Gautama Al Hadid",
    "Judha Ananda Pratama",
    "Muhammad Daniel Yuna",
    "Muhammad Ihsan Hidayat",
    "Muhammad Wahidi",
    "Mulki",
    "Mushawir Ahmad Mudarso",
    "Risma Handayani",
    "Vathayani Sunarto",
    "Vidilla Elfa",
]


def seed_account_managers():
    """Create Account Manager records from the predefined list."""

    print("=" * 70)
    print("  Telkom Contract Extractor - Account Managers Seed Script")
    print("=" * 70)
    print()

    db: Session = SessionLocal()

    try:
        # Check existing account managers
        existing_count = db.query(AccountManager).count()
        if existing_count > 0:
            print(f"⚠️  WARNING: Database already has {existing_count} account manager(s).")
            print(f"    Existing account managers:")
            existing = db.query(AccountManager).all()
            for am in existing:
                status = "Active" if am.is_active else "Inactive"
                print(f"      - {am.name} ({am.email}) [{status}]")
            print()

            # Ask if we should continue
            response = input("    Do you want to add missing account managers? (y/N): ").strip().lower()
            if response != 'y':
                print("    Skipping seed.")
                return

        print("Creating account managers...")
        print()

        created_count = 0
        skipped_count = 0

        for am_name in ACCOUNT_MANAGERS:
            # Check if account manager already exists (case-insensitive)
            existing = db.query(AccountManager).filter(
                AccountManager.name.ilike(am_name)
            ).first()

            if existing:
                print(f"  ⏭️  Skipped (exists): {am_name}")
                skipped_count += 1
                continue

            email = name_to_email(am_name)
            phone = generate_indonesian_phone()

            account_manager = AccountManager(
                name=am_name,
                title="Account Manager",
                email=email,
                phone=phone,
                is_active=True
            )
            db.add(account_manager)
            print(f"  ✅ Created: {am_name} <{email}> | {phone}")
            created_count += 1

        db.commit()

        print()
        print("=" * 70)
        print(f"  Summary:")
        print(f"    Created: {created_count}")
        print(f"    Skipped: {skipped_count}")
        print(f"    Total:   {created_count + skipped_count}")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print()
        print(f"❌ ERROR: Failed to seed account managers!")
        print(f"   Error details: {str(e)}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_account_managers()
