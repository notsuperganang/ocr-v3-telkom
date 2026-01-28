"""
Seed segments data from the distribution invoice CSV.

This script creates segment records based on the unique segments
found in the DISTRIBUSI INV - JANUARI26.csv file.

Usage:
    python scripts/seed_segments.py

Requirements:
    - Database must be migrated (alembic upgrade head)
"""

import sys
from pathlib import Path

# Add backend to path so we can import app modules
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.database import Segment


# Segments extracted from DISTRIBUSI INV - JANUARI26.csv
SEGMENTS = [
    {"name": "B2B TREG", "code": "B2B_TREG"},
    {"name": "Financial & Regional Banking", "code": "FIN_BANK"},
    {"name": "Financial & Welfare", "code": "FIN_WELF"},
    {"name": "Manufacturing & Infrastructure", "code": "MFG_INFRA"},
    {"name": "Regional 1", "code": "REG1"},
    {"name": "Tourism & Welfare", "code": "TOUR_WELF"},
]


def seed_segments():
    """Create segment records from the predefined list."""

    print("=" * 70)
    print("  Telkom Contract Extractor - Segments Seed Script")
    print("=" * 70)
    print()

    db: Session = SessionLocal()

    try:
        # Check existing segments
        existing_count = db.query(Segment).count()
        if existing_count > 0:
            print(f"⚠️  WARNING: Database already has {existing_count} segment(s).")
            print(f"    Existing segments:")
            existing = db.query(Segment).all()
            for seg in existing:
                status = "Active" if seg.is_active else "Inactive"
                print(f"      - {seg.name} ({seg.code}) [{status}]")
            print()

            # Ask if we should continue
            response = input("    Do you want to add missing segments? (y/N): ").strip().lower()
            if response != 'y':
                print("    Skipping seed.")
                return

        print("Creating segments...")
        print()

        created_count = 0
        skipped_count = 0

        for seg_data in SEGMENTS:
            # Check if segment already exists
            existing = db.query(Segment).filter(Segment.name == seg_data["name"]).first()
            if existing:
                print(f"  ⏭️  Skipped (exists): {seg_data['name']}")
                skipped_count += 1
                continue

            segment = Segment(
                name=seg_data["name"],
                code=seg_data["code"],
                is_active=True
            )
            db.add(segment)
            print(f"  ✅ Created: {seg_data['name']} ({seg_data['code']})")
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
        print(f"❌ ERROR: Failed to seed segments!")
        print(f"   Error details: {str(e)}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_segments()
