"""
Update Account assigned officers from the distribution invoice CSV.

This script updates existing Account records with assigned_officer_id
based on the officer column in the DISTRIBUSI INV - JANUARI26.csv file.

Mapping:
  - ALDO -> bangaldo user
  - DECI -> kakdeci user
  - LAINNYA -> NULL (no assignment)

Usage:
    python scripts/update_account_officers.py

Requirements:
    - Accounts must be seeded (run seed_accounts.py first)
    - Users must exist (bangaldo, kakdeci)
"""

import csv
import sys
from pathlib import Path

# Add backend to path so we can import app modules
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.database import Account, User

# Path to CSV file
CSV_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "test-samples" / "distribusi inv" / "DISTRIBUSI INV - JANUARI26.csv"


def load_officer_assignments() -> dict[str, str]:
    """Load account_number -> officer mapping from CSV."""
    assignments = {}

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)  # Skip header

        for row in reader:
            if len(row) >= 10:
                account_num = row[2].strip()
                officer = row[9].strip().upper() if row[9].strip() else None

                if account_num and officer:
                    # Only store if not already assigned (first occurrence wins)
                    if account_num not in assignments:
                        assignments[account_num] = officer

    return assignments


def update_account_officers():
    """Update Account records with assigned officer."""

    print("=" * 70)
    print("  Telkom Contract Extractor - Update Account Officers Script")
    print("=" * 70)
    print()

    # Check if CSV exists
    if not CSV_PATH.exists():
        print(f"❌ ERROR: CSV file not found at {CSV_PATH}")
        sys.exit(1)

    db: Session = SessionLocal()

    try:
        # Get user mappings
        users = {u.username: u.id for u in db.query(User).all()}

        # Map officer codes to usernames
        officer_to_user = {
            'ALDO': users.get('bangaldo'),
            'DECI': users.get('kakdeci'),
            'LAINNYA': None  # No assignment
        }

        print(f"  Officer mappings:")
        print(f"    ALDO -> bangaldo (id={officer_to_user.get('ALDO')})")
        print(f"    DECI -> kakdeci (id={officer_to_user.get('DECI')})")
        print(f"    LAINNYA -> NULL")
        print()

        # Load assignments from CSV
        assignments = load_officer_assignments()
        print(f"  Found {len(assignments)} officer assignments in CSV")
        print()

        # Update accounts
        print("Updating accounts...")
        print()

        updated_count = 0
        skipped_count = 0
        not_found_count = 0

        for account_num, officer_code in assignments.items():
            # Skip LAINNYA
            if officer_code == 'LAINNYA':
                skipped_count += 1
                continue

            # Get user_id for this officer
            user_id = officer_to_user.get(officer_code)
            if not user_id:
                print(f"  ⚠️  Unknown officer code: {officer_code}")
                skipped_count += 1
                continue

            # Find account
            account = db.query(Account).filter(
                Account.account_number == account_num
            ).first()

            if not account:
                not_found_count += 1
                continue

            # Update if different
            if account.assigned_officer_id != user_id:
                account.assigned_officer_id = user_id
                print(f"  ✅ Updated: {account_num} -> {officer_code}")
                updated_count += 1
            else:
                skipped_count += 1

        db.commit()

        print()
        print("=" * 70)
        print(f"  Summary:")
        print(f"    Updated:   {updated_count}")
        print(f"    Skipped:   {skipped_count} (LAINNYA or already assigned)")
        print(f"    Not found: {not_found_count}")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print()
        print(f"❌ ERROR: Failed to update account officers!")
        print(f"   Error details: {str(e)}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    update_account_officers()
