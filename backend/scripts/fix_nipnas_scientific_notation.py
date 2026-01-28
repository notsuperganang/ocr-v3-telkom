"""
Fix NIPNAS values that are stored in scientific notation.

This script converts NIPNAS values like '5,59E+08' or '4.65E+06'
back to regular numbers.

Usage:
    python scripts/fix_nipnas_scientific_notation.py
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.database import Account


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


def fix_nipnas_values():
    """Fix NIPNAS values in database."""

    print("=" * 70)
    print("  Fix NIPNAS Scientific Notation")
    print("=" * 70)
    print()

    db: Session = SessionLocal()

    try:
        # Find accounts with scientific notation in NIPNAS
        accounts = db.query(Account).filter(
            Account.nipnas.ilike('%E+%')  # Contains E+ (scientific notation)
        ).all()

        if not accounts:
            print("  ✅ No accounts found with scientific notation in NIPNAS")
            print()
            return

        print(f"  Found {len(accounts)} account(s) with scientific notation")
        print()

        fixed_count = 0
        for account in accounts:
            old_nipnas = account.nipnas
            new_nipnas = parse_nipnas(old_nipnas)

            if new_nipnas != old_nipnas:
                account.nipnas = new_nipnas
                fixed_count += 1
                print(f"  ✅ Fixed: {account.account_number} - {old_nipnas} → {new_nipnas}")
            else:
                print(f"  ⏭️  Skipped: {account.account_number} - Could not parse {old_nipnas}")

        db.commit()

        print()
        print("=" * 70)
        print(f"  Summary:")
        print(f"    Fixed: {fixed_count}")
        print(f"    Total checked: {len(accounts)}")
        print("=" * 70)
        print()

    except Exception as e:
        db.rollback()
        print()
        print(f"❌ ERROR: Failed to fix NIPNAS values!")
        print(f"   Error details: {str(e)}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    fix_nipnas_values()
