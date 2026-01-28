"""
Seed Account data from the distribution invoice CSV.

This script creates Account records based on the unique accounts
found in the DISTRIBUSI INV - JANUARI26.csv file.

Usage:
    python scripts/seed_accounts.py

Requirements:
    - Database must be migrated (alembic upgrade head)
    - Segments must be seeded (run seed_segments.py first)
    - Witels must be seeded
    - Account Managers must be seeded (run seed_account_managers.py first)
"""

import csv
import sys
from pathlib import Path

# Add backend to path so we can import app modules
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.database import Account, Segment, Witel, AccountManager

# Path to CSV file
CSV_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "test-samples" / "distribusi inv" / "DISTRIBUSI INV - JANUARI26.csv"


def parse_witel_code(witel_str: str) -> str:
    """Extract witel code from format '901 - Aceh' -> '901'"""
    if not witel_str:
        return None
    parts = witel_str.split(" - ")
    return parts[0].strip() if parts else None


def parse_nipnas(nipnas_str: str) -> str:
    """Parse NIPNAS and handle scientific notation from Excel.

    Converts values like '5,59E+08' or '4.65E+06' back to regular numbers.
    """
    if not nipnas_str:
        return None

    nipnas_str = nipnas_str.strip()
    if not nipnas_str:
        return None

    # Check if it's in scientific notation (contains 'E' or 'e')
    if 'E' in nipnas_str.upper():
        try:
            # Replace comma with period for European notation
            nipnas_str = nipnas_str.replace(',', '.')
            # Convert to float then to int to remove decimals
            num = int(float(nipnas_str))
            return str(num)
        except (ValueError, OverflowError):
            # If conversion fails, return as-is
            return nipnas_str

    return nipnas_str


def load_accounts_from_csv() -> list[dict]:
    """Load unique accounts from CSV file."""
    accounts = {}

    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)  # Skip header

        for row in reader:
            if len(row) >= 9:
                account_num = row[2].strip()
                if account_num and account_num not in accounts:
                    # Normalize AM name to title case
                    am_name = row[8].strip().title() if row[8].strip() else None

                    accounts[account_num] = {
                        'account_number': account_num,
                        'bus_area': row[1].strip() or None,
                        'name': row[3].strip(),
                        'nipnas': parse_nipnas(row[4]),
                        'segment': row[5].strip() or None,
                        'witel_code': parse_witel_code(row[6].strip()),
                        'am_name': am_name
                    }

    return list(accounts.values())


def seed_accounts():
    """Create Account records from CSV data."""

    print("=" * 70)
    print("  Telkom Contract Extractor - Accounts Seed Script")
    print("=" * 70)
    print()

    # Check if CSV exists
    if not CSV_PATH.exists():
        print(f"❌ ERROR: CSV file not found at {CSV_PATH}")
        sys.exit(1)

    db: Session = SessionLocal()

    try:
        # Load lookup tables
        segments = {s.name: s.id for s in db.query(Segment).all()}
        witels = {w.code: w.id for w in db.query(Witel).all()}
        account_managers = {am.name: am.id for am in db.query(AccountManager).all()}

        print(f"  Loaded {len(segments)} segments, {len(witels)} witels, {len(account_managers)} account managers")
        print()

        # Check existing accounts
        existing_count = db.query(Account).count()
        if existing_count > 0:
            print(f"⚠️  WARNING: Database already has {existing_count} account(s).")
            print()
            response = input("    Do you want to add missing accounts? (y/N): ").strip().lower()
            if response != 'y':
                print("    Skipping seed.")
                return

        # Load accounts from CSV
        accounts_data = load_accounts_from_csv()
        print(f"  Found {len(accounts_data)} unique accounts in CSV")
        print()
        print("Creating accounts...")
        print()

        created_count = 0
        skipped_count = 0
        errors = []

        for acc_data in accounts_data:
            # Check if account already exists
            existing = db.query(Account).filter(
                Account.account_number == acc_data['account_number']
            ).first()

            if existing:
                print(f"  ⏭️  Skipped (exists): {acc_data['account_number']} - {acc_data['name']}")
                skipped_count += 1
                continue

            # Lookup foreign keys
            segment_id = segments.get(acc_data['segment']) if acc_data['segment'] else None
            witel_id = witels.get(acc_data['witel_code']) if acc_data['witel_code'] else None
            am_id = account_managers.get(acc_data['am_name']) if acc_data['am_name'] else None

            # Track missing references
            if acc_data['segment'] and not segment_id:
                errors.append(f"Segment not found: {acc_data['segment']}")
            if acc_data['witel_code'] and not witel_id:
                errors.append(f"Witel not found: {acc_data['witel_code']}")
            if acc_data['am_name'] and not am_id:
                errors.append(f"Account Manager not found: {acc_data['am_name']}")

            account = Account(
                account_number=acc_data['account_number'],
                name=acc_data['name'],
                nipnas=acc_data['nipnas'],
                bus_area=acc_data['bus_area'],
                segment_id=segment_id,
                witel_id=witel_id,
                account_manager_id=am_id,
                is_active=True
            )
            db.add(account)
            print(f"  ✅ Created: {acc_data['account_number']} - {acc_data['name'][:40]}")
            created_count += 1

        db.commit()

        print()
        print("=" * 70)
        print(f"  Summary:")
        print(f"    Created: {created_count}")
        print(f"    Skipped: {skipped_count}")
        print(f"    Total:   {created_count + skipped_count}")

        if errors:
            print()
            print(f"  ⚠️  Warnings ({len(errors)}):")
            for err in set(errors):  # Deduplicate
                print(f"      - {err}")

        print("=" * 70)

    except Exception as e:
        db.rollback()
        print()
        print(f"❌ ERROR: Failed to seed accounts!")
        print(f"   Error details: {str(e)}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_accounts()
