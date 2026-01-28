#!/usr/bin/env python3
"""
Invoice Status Synchronization Script

This script can be run as a scheduled job (cron/systemd timer) to automatically
synchronize time-based status for all active invoices.

Usage:
    # Dry run (preview changes)
    python sync_invoice_statuses.py --dry-run

    # Execute sync
    python sync_invoice_statuses.py

    # Sync specific contract
    python sync_invoice_statuses.py --contract-id 123

    # Sync only term payments
    python sync_invoice_statuses.py --invoice-type term

Cron Example:
    # Run daily at 00:01
    1 0 * * * /path/to/python /path/to/sync_invoice_statuses.py >> /var/log/invoice-sync.log 2>&1
"""

import sys
import os
import argparse
from datetime import datetime, timezone

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import get_settings
from app.services import invoice_service

# Get database URL from settings
settings = get_settings()
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def main():
    parser = argparse.ArgumentParser(
        description="Synchronize invoice time-based statuses"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without applying them"
    )
    parser.add_argument(
        "--invoice-type",
        choices=["term", "recurring"],
        help="Filter by invoice type"
    )
    parser.add_argument(
        "--contract-id",
        type=int,
        help="Filter by specific contract ID"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed changes"
    )

    args = parser.parse_args()

    print("=" * 80)
    print("INVOICE STATUS SYNCHRONIZATION")
    print("=" * 80)
    print(f"Started at: {datetime.now()}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'EXECUTE'}")
    if args.invoice_type:
        print(f"Filter: {args.invoice_type} payments only")
    if args.contract_id:
        print(f"Filter: Contract ID {args.contract_id}")
    print("-" * 80)

    # Create database session
    db = SessionLocal()

    try:
        # Run bulk sync
        result = invoice_service.bulk_sync_invoice_statuses(
            db=db,
            invoice_type=args.invoice_type,
            contract_id=args.contract_id,
            current_date=datetime.now(timezone.utc),
            dry_run=args.dry_run,
        )

        # Commit if not dry run
        if not args.dry_run:
            db.commit()
            print("✓ Changes committed to database")
        else:
            db.rollback()
            print("✓ Dry run - no changes made")

        print("-" * 80)
        print("SUMMARY:")
        print(f"  Total invoices checked: {result['total_checked']}")
        print(f"  Total invoices updated: {result['total_updated']}")
        print()

        # Show breakdown by type
        if result['term_payments']['checked'] > 0:
            print("Term Payments:")
            print(f"  Checked: {result['term_payments']['checked']}")
            print(f"  Updated: {result['term_payments']['updated']}")

        if result['recurring_payments']['checked'] > 0:
            print("Recurring Payments:")
            print(f"  Checked: {result['recurring_payments']['checked']}")
            print(f"  Updated: {result['recurring_payments']['updated']}")

        # Show detailed changes if verbose
        if args.verbose and result['total_updated'] > 0:
            print()
            print("-" * 80)
            print("DETAILED CHANGES:")
            print()

            for payment_type in ['term_payments', 'recurring_payments']:
                changes = result[payment_type]['changes']
                if changes:
                    print(f"{payment_type.upper().replace('_', ' ')}:")
                    for change in changes:
                        print(f"  Invoice #{change['invoice_number']} (ID: {change['id']})")
                        print(f"    Period: {change['period']}")
                        print(f"    Status: {change['old_status']} → {change['new_status']}")
                        print()

        print("-" * 80)
        if result['total_updated'] > 0:
            print(f"✅ SUCCESS: {'Would update' if args.dry_run else 'Updated'} {result['total_updated']} invoices")
        else:
            print("✅ SUCCESS: All invoices already in sync")

    except Exception as e:
        db.rollback()
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

    finally:
        db.close()
        print(f"Completed at: {datetime.now()}")
        print("=" * 80)

    return 0


if __name__ == "__main__":
    sys.exit(main())
