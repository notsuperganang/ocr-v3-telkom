#!/usr/bin/env python3
"""
Comprehensive test suite for recurring payment management feature.

Tests:
1. Database schema (tables, columns, constraints, indexes)
2. SQLAlchemy models and relationships
3. Denormalization service (recurring fields computation)
4. Recurring sync service (schedule generation, CRUD operations)
5. End-to-end integration (create contract, verify sync)
"""

import sys
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 80)
print("RECURRING PAYMENT MANAGEMENT - COMPREHENSIVE TEST SUITE")
print("=" * 80)
print()

# Test 1: Database Schema Validation
print("TEST 1: Database Schema Validation")
print("-" * 80)

try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

    # Connect to database
    conn = psycopg2.connect(
        dbname="telkom_contracts",
        user="postgres",
        host="localhost"
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Check table exists
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'contract_recurring_payments'
        );
    """)
    table_exists = cur.fetchone()[0]
    print(f"✓ Table 'contract_recurring_payments' exists: {table_exists}")
    assert table_exists, "Table does not exist!"

    # Check columns
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'contract_recurring_payments'
        ORDER BY ordinal_position;
    """)
    columns = cur.fetchall()
    print(f"✓ Found {len(columns)} columns")

    expected_columns = [
        'id', 'contract_id', 'cycle_number', 'period_label', 'period_year',
        'period_month', 'original_amount', 'amount', 'status', 'paid_at',
        'notes', 'created_by', 'updated_by', 'created_at', 'updated_at'
    ]
    actual_columns = [col[0] for col in columns]
    for expected in expected_columns:
        assert expected in actual_columns, f"Missing column: {expected}"
    print(f"✓ All expected columns present: {', '.join(expected_columns[:5])}...")

    # Check constraints
    cur.execute("""
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'contract_recurring_payments';
    """)
    constraints = cur.fetchall()
    print(f"✓ Found {len(constraints)} constraints")

    # Check indexes
    cur.execute("""
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'contract_recurring_payments';
    """)
    indexes = cur.fetchall()
    print(f"✓ Found {len(indexes)} indexes")

    expected_indexes = [
        'idx_contract_recurring_payments_contract_id',
        'idx_contract_recurring_payments_status_period',
        'idx_contract_recurring_payments_period'
    ]
    actual_indexes = [idx[0] for idx in indexes]
    for expected_idx in expected_indexes:
        assert expected_idx in actual_indexes, f"Missing index: {expected_idx}"
    print(f"✓ All expected indexes present")

    # Check contracts table has new columns
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'contracts'
        AND column_name IN ('recurring_monthly_amount', 'recurring_month_count', 'recurring_total_amount');
    """)
    recurring_columns = cur.fetchall()
    print(f"✓ Contracts table has {len(recurring_columns)} recurring denorm columns")
    assert len(recurring_columns) == 3, "Missing recurring columns in contracts table!"

    cur.close()
    conn.close()

    print("✅ TEST 1 PASSED: Database schema is correct\n")

except Exception as e:
    print(f"❌ TEST 1 FAILED: {e}\n")
    sys.exit(1)


# Test 2: Model Imports and Relationships
print("TEST 2: Model Imports and Relationships")
print("-" * 80)

try:
    from app.models.database import Contract, ContractRecurringPayment, TerminPaymentStatus

    print("✓ Successfully imported Contract model")
    print("✓ Successfully imported ContractRecurringPayment model")
    print("✓ Successfully imported TerminPaymentStatus enum")

    # Check Contract has recurring_payments relationship
    assert hasattr(Contract, 'recurring_payments'), "Contract missing recurring_payments relationship"
    print("✓ Contract has 'recurring_payments' relationship")

    # Check ContractRecurringPayment has contract relationship
    assert hasattr(ContractRecurringPayment, 'contract'), "ContractRecurringPayment missing contract relationship"
    print("✓ ContractRecurringPayment has 'contract' relationship")

    # Check Contract has recurring denorm fields
    assert hasattr(Contract, 'recurring_monthly_amount'), "Contract missing recurring_monthly_amount"
    assert hasattr(Contract, 'recurring_month_count'), "Contract missing recurring_month_count"
    assert hasattr(Contract, 'recurring_total_amount'), "Contract missing recurring_total_amount"
    print("✓ Contract has all recurring denorm fields")

    # Check TerminPaymentStatus enum values (reused for recurring)
    expected_statuses = {'PENDING', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED'}
    actual_statuses = {status.value for status in TerminPaymentStatus}
    assert expected_statuses == actual_statuses, f"Status mismatch: {actual_statuses}"
    print(f"✓ TerminPaymentStatus enum has correct values: {', '.join(expected_statuses)}")

    print("✅ TEST 2 PASSED: Models and relationships are correct\n")

except Exception as e:
    print(f"❌ TEST 2 FAILED: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)


# Test 3: Denormalization Service
print("TEST 3: Denormalization Service - Recurring Fields Computation")
print("-" * 80)

try:
    from app.services.denorm import compute_denorm_fields, _diff_months_inclusive, _compute_recurring_fields

    # Test 3.1: _diff_months_inclusive
    print("Test 3.1: Month difference calculation")

    # Same month
    result = _diff_months_inclusive(date(2025, 1, 1), date(2025, 1, 31))
    assert result == 1, f"Expected 1, got {result}"
    print("  ✓ Same month: 1 month")

    # 3 months
    result = _diff_months_inclusive(date(2025, 1, 15), date(2025, 3, 20))
    assert result == 3, f"Expected 3, got {result}"
    print("  ✓ Jan-Mar 2025: 3 months")

    # 12 months (full year)
    result = _diff_months_inclusive(date(2025, 1, 1), date(2025, 12, 31))
    assert result == 12, f"Expected 12, got {result}"
    print("  ✓ Jan-Dec 2025: 12 months")

    # Cross-year
    result = _diff_months_inclusive(date(2024, 11, 1), date(2025, 2, 28))
    assert result == 4, f"Expected 4, got {result}"
    print("  ✓ Nov 2024 - Feb 2025: 4 months")

    # Test 3.2: _compute_recurring_fields
    print("\nTest 3.2: Recurring fields computation")

    # Valid recurring contract
    monthly, count, total = _compute_recurring_fields(
        payment_method="recurring",
        annual_subscription_cost=Decimal("12000000.00"),
        period_start=date(2025, 1, 1),
        period_end=date(2025, 12, 31)
    )
    assert monthly == Decimal("1000000.00"), f"Expected 1000000.00, got {monthly}"
    assert count == 12, f"Expected 12 months, got {count}"
    assert total == Decimal("12000000.00"), f"Expected 12000000.00, got {total}"
    print(f"  ✓ Annual 12M → Monthly 1M × 12 = Total 12M")

    # Non-recurring payment method (should return zeros)
    monthly, count, total = _compute_recurring_fields(
        payment_method="termin",
        annual_subscription_cost=Decimal("12000000.00"),
        period_start=date(2025, 1, 1),
        period_end=date(2025, 12, 31)
    )
    assert monthly == Decimal("0.00"), f"Expected 0, got {monthly}"
    assert count is None, f"Expected None, got {count}"
    assert total == Decimal("0.00"), f"Expected 0, got {total}"
    print(f"  ✓ Non-recurring method → All zeros")

    # Zero annual cost (should return zeros)
    monthly, count, total = _compute_recurring_fields(
        payment_method="recurring",
        annual_subscription_cost=Decimal("0.00"),
        period_start=date(2025, 1, 1),
        period_end=date(2025, 12, 31)
    )
    assert monthly == Decimal("0.00"), f"Expected 0, got {monthly}"
    print(f"  ✓ Zero annual cost → All zeros")

    # Test 3.3: Full denorm computation
    print("\nTest 3.3: Full denormalization with recurring")

    test_final_data: Dict[str, Any] = {
        "informasi_pelanggan": {
            "nama_pelanggan": "SMK Test School"
        },
        "jangka_waktu": {
            "mulai": "2025-01-01",
            "akhir": "2025-06-30"
        },
        "layanan_utama": {
            "connectivity_telkom": 10,
            "non_connectivity_telkom": 5,
            "bundling": 2
        },
        "rincian_layanan": [
            {
                "biaya_instalasi": "5000000",
                "biaya_langganan_tahunan": "6000000"
            }
        ],
        "tata_cara_pembayaran": {
            "method_type": "recurring",
            "description": "Monthly recurring payment"
        }
    }

    denorm = compute_denorm_fields(test_final_data)

    assert denorm.customer_name == "SMK Test School"
    assert denorm.payment_method == "recurring"
    assert denorm.annual_subscription_cost == Decimal("6000000.00")
    assert denorm.recurring_monthly_amount == Decimal("500000.00"), f"Expected 500k, got {denorm.recurring_monthly_amount}"
    assert denorm.recurring_month_count == 6, f"Expected 6 months, got {denorm.recurring_month_count}"
    assert denorm.recurring_total_amount == Decimal("3000000.00"), f"Expected 3M, got {denorm.recurring_total_amount}"

    print(f"  ✓ Full denorm: 6M annual ÷ 12 = 500K/month × 6 months = 3M total")

    print("✅ TEST 3 PASSED: Denormalization service works correctly\n")

except Exception as e:
    print(f"❌ TEST 3 FAILED: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)


# Test 4: Recurring Sync Service
print("TEST 4: Recurring Sync Service - Schedule Generation")
print("-" * 80)

try:
    from app.services.recurring_sync import (
        iter_months_inclusive,
        format_period_label,
        sync_contract_recurring_payments
    )

    # Test 4.1: iter_months_inclusive
    print("Test 4.1: Month iteration")

    months = iter_months_inclusive(date(2025, 1, 15), date(2025, 3, 20))
    expected = [(2025, 1, 1), (2025, 2, 2), (2025, 3, 3)]
    assert months == expected, f"Expected {expected}, got {months}"
    print(f"  ✓ Jan-Mar 2025: {len(months)} billing cycles")

    months = iter_months_inclusive(date(2024, 11, 1), date(2025, 2, 28))
    assert len(months) == 4, f"Expected 4 months, got {len(months)}"
    assert months[0] == (2024, 11, 1), f"First month incorrect: {months[0]}"
    assert months[-1] == (2025, 2, 4), f"Last month incorrect: {months[-1]}"
    print(f"  ✓ Nov 2024 - Feb 2025: {len(months)} billing cycles (cross-year)")

    # Test 4.2: format_period_label
    print("\nTest 4.2: Period label formatting")

    label = format_period_label(2025, 1)
    assert label == "Januari 2025", f"Expected 'Januari 2025', got '{label}'"
    print(f"  ✓ Month 1 → {label}")

    label = format_period_label(2025, 12)
    assert label == "Desember 2025", f"Expected 'Desember 2025', got '{label}'"
    print(f"  ✓ Month 12 → {label}")

    print("✅ TEST 4 PASSED: Recurring sync service utilities work correctly\n")

except Exception as e:
    print(f"❌ TEST 4 FAILED: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)


# Test 5: End-to-End Integration Test
print("TEST 5: End-to-End Integration Test")
print("-" * 80)

try:
    from app.database import get_db
    from app.models.database import Contract, ContractRecurringPayment, ProcessingJob, File as FileModel
    from app.services.denorm import compute_denorm_fields
    from app.services.recurring_sync import sync_contract_recurring_payments
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    # Create test database session
    DATABASE_URL = "postgresql://postgres@localhost/telkom_contracts"
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    print("Test 5.1: Create test contract with recurring payment")

    # Create test file
    test_file = FileModel(
        original_filename="test_recurring.pdf",
        size_bytes=1024,
        mime_type="application/pdf",
        pdf_path="/tmp/test_recurring.pdf"
    )
    db.add(test_file)
    db.flush()

    # Create test processing job
    test_job = ProcessingJob(
        file_id=test_file.id,
        status="CONFIRMED"
    )
    db.add(test_job)
    db.flush()

    # Prepare test contract data
    test_final_data = {
        "informasi_pelanggan": {
            "nama_pelanggan": "SMK Negeri 1 Jakarta",
            "npwp": "01.234.567.8-901.000",
            "alamat": "Jl. Test No. 123, Jakarta"
        },
        "jangka_waktu": {
            "mulai": "2025-01-01",
            "akhir": "2025-06-30"
        },
        "layanan_utama": {
            "connectivity_telkom": 20,
            "non_connectivity_telkom": 10,
            "bundling": 5
        },
        "rincian_layanan": [
            {
                "biaya_instalasi": "10000000",
                "biaya_langganan_tahunan": "12000000"
            }
        ],
        "tata_cara_pembayaran": {
            "method_type": "recurring",
            "description": "Monthly recurring subscription payment"
        },
        "kontak_person_telkom": {
            "nama": "John Doe",
            "jabatan": "Account Manager"
        }
    }

    # Compute denorm fields
    denorm = compute_denorm_fields(test_final_data)

    # Create contract
    contract = Contract(
        source_job_id=test_job.id,
        file_id=test_file.id,
        final_data=test_final_data,
        confirmed_by="test_user",
        # Basic fields
        customer_name=denorm.customer_name,
        customer_npwp=denorm.customer_npwp,
        period_start=denorm.period_start,
        period_end=denorm.period_end,
        service_connectivity=denorm.service_connectivity,
        service_non_connectivity=denorm.service_non_connectivity,
        service_bundling=denorm.service_bundling,
        payment_method=denorm.payment_method,
        installation_cost=denorm.installation_cost,
        annual_subscription_cost=denorm.annual_subscription_cost,
        total_contract_value=denorm.total_contract_value,
        # Recurring fields
        recurring_monthly_amount=denorm.recurring_monthly_amount,
        recurring_month_count=denorm.recurring_month_count,
        recurring_total_amount=denorm.recurring_total_amount,
    )
    db.add(contract)
    db.flush()

    print(f"  ✓ Created contract ID: {contract.id}")
    print(f"    - Payment method: {contract.payment_method}")
    print(f"    - Period: {contract.period_start} to {contract.period_end}")
    print(f"    - Annual subscription: Rp {contract.annual_subscription_cost:,.0f}")
    print(f"    - Monthly amount: Rp {contract.recurring_monthly_amount:,.0f}")
    print(f"    - Month count: {contract.recurring_month_count}")
    print(f"    - Total recurring: Rp {contract.recurring_total_amount:,.0f}")

    # Sync recurring payments
    print("\nTest 5.2: Sync recurring payment schedule")
    sync_contract_recurring_payments(db, contract, acting_user="test_user")
    db.flush()

    # Query recurring payments
    recurring_payments = db.query(ContractRecurringPayment).filter(
        ContractRecurringPayment.contract_id == contract.id
    ).order_by(ContractRecurringPayment.cycle_number).all()

    print(f"  ✓ Created {len(recurring_payments)} recurring payment records")

    # Verify count matches expected
    assert len(recurring_payments) == 6, f"Expected 6 payments (Jan-Jun), got {len(recurring_payments)}"

    # Verify first payment
    first_payment = recurring_payments[0]
    assert first_payment.cycle_number == 1, f"Expected cycle 1, got {first_payment.cycle_number}"
    assert first_payment.period_year == 2025, f"Expected year 2025, got {first_payment.period_year}"
    assert first_payment.period_month == 1, f"Expected month 1, got {first_payment.period_month}"
    assert first_payment.period_label == "Januari 2025", f"Expected 'Januari 2025', got '{first_payment.period_label}'"
    assert first_payment.amount == Decimal("1000000.00"), f"Expected 1M, got {first_payment.amount}"
    assert first_payment.status == "PENDING", f"Expected PENDING, got {first_payment.status}"

    print(f"\n  Payment schedule:")
    for payment in recurring_payments:
        print(f"    #{payment.cycle_number}: {payment.period_label} - Rp {payment.amount:,.0f} ({payment.status})")

    # Test 5.3: Update contract (change period_end)
    print("\nTest 5.3: Update contract period and re-sync")

    contract.period_end = date(2025, 3, 31)  # Reduce to 3 months
    contract.recurring_month_count = 3
    contract.recurring_total_amount = contract.recurring_monthly_amount * Decimal("3")

    sync_contract_recurring_payments(db, contract, acting_user="test_user")
    db.flush()

    # Query again
    recurring_payments = db.query(ContractRecurringPayment).filter(
        ContractRecurringPayment.contract_id == contract.id
    ).order_by(ContractRecurringPayment.cycle_number).all()

    assert len(recurring_payments) == 3, f"Expected 3 payments after update, got {len(recurring_payments)}"
    print(f"  ✓ Updated schedule to {len(recurring_payments)} payments (Jan-Mar)")

    # Verify last payment
    last_payment = recurring_payments[-1]
    assert last_payment.period_month == 3, f"Expected month 3, got {last_payment.period_month}"
    assert last_payment.period_label == "Maret 2025", f"Expected 'Maret 2025', got '{last_payment.period_label}'"

    # Test 5.4: Change payment method to non-recurring
    print("\nTest 5.4: Change payment method to termin (should delete recurring payments)")

    contract.payment_method = "termin"
    contract.recurring_monthly_amount = Decimal("0.00")
    contract.recurring_month_count = None
    contract.recurring_total_amount = Decimal("0.00")

    sync_contract_recurring_payments(db, contract, acting_user="test_user")
    db.flush()

    # Query again
    recurring_payments = db.query(ContractRecurringPayment).filter(
        ContractRecurringPayment.contract_id == contract.id
    ).all()

    assert len(recurring_payments) == 0, f"Expected 0 payments after method change, got {len(recurring_payments)}"
    print(f"  ✓ All recurring payments deleted (payment method changed to termin)")

    # Cleanup
    print("\nTest 5.5: Cleanup test data")
    db.delete(contract)
    db.delete(test_job)
    db.delete(test_file)
    db.commit()
    print("  ✓ Test data cleaned up")

    db.close()

    print("✅ TEST 5 PASSED: End-to-end integration works correctly\n")

except Exception as e:
    print(f"❌ TEST 5 FAILED: {e}\n")
    import traceback
    traceback.print_exc()
    db.rollback()
    db.close()
    sys.exit(1)


# Final Summary
print("=" * 80)
print("✅ ALL TESTS PASSED!")
print("=" * 80)
print()
print("Summary:")
print("  ✓ Database schema is correct")
print("  ✓ Models and relationships work")
print("  ✓ Denormalization service computes recurring fields correctly")
print("  ✓ Recurring sync service generates schedules correctly")
print("  ✓ End-to-end integration creates, updates, and deletes recurring payments")
print()
print("Recurring payment management is ready for production! 🎉")
print()
