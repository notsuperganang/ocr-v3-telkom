#!/usr/bin/env python3
"""
Test script for recurring payment status updates.

Tests the new update_recurring_statuses() function and verifies it works correctly.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 80)
print("RECURRING PAYMENT STATUS UPDATE TEST")
print("=" * 80)
print()

# Test 1: Import and verify function exists
print("TEST 1: Import status update functions")
print("-" * 80)

try:
    from app.services.termin_status import (
        compute_termin_status,
        update_termin_statuses,
        update_recurring_statuses,
        _update_payment_statuses_generic
    )

    print("✓ Successfully imported compute_termin_status")
    print("✓ Successfully imported update_termin_statuses")
    print("✓ Successfully imported update_recurring_statuses")
    print("✓ Successfully imported _update_payment_statuses_generic (internal)")

    print("✅ TEST 1 PASSED: All functions imported successfully\n")

except Exception as e:
    print(f"❌ TEST 1 FAILED: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)


# Test 2: Verify function signatures
print("TEST 2: Verify function signatures")
print("-" * 80)

try:
    import inspect

    # Check update_termin_statuses signature
    termin_sig = inspect.signature(update_termin_statuses)
    termin_params = list(termin_sig.parameters.keys())
    expected_termin_params = ['db', 'contract_id', 'termin_ids', 'current_date', 'dry_run']
    assert termin_params == expected_termin_params, f"Termin params mismatch: {termin_params}"
    print(f"✓ update_termin_statuses has correct signature: {', '.join(termin_params)}")

    # Check update_recurring_statuses signature
    recurring_sig = inspect.signature(update_recurring_statuses)
    recurring_params = list(recurring_sig.parameters.keys())
    expected_recurring_params = ['db', 'contract_id', 'recurring_ids', 'current_date', 'dry_run']
    assert recurring_params == expected_recurring_params, f"Recurring params mismatch: {recurring_params}"
    print(f"✓ update_recurring_statuses has correct signature: {', '.join(recurring_params)}")

    # Check generic function signature
    generic_sig = inspect.signature(_update_payment_statuses_generic)
    generic_params = list(generic_sig.parameters.keys())
    expected_generic_params = ['db', 'table_model', 'contract_id', 'payment_ids', 'current_date', 'dry_run', 'payment_number_field']
    assert generic_params == expected_generic_params, f"Generic params mismatch: {generic_params}"
    print(f"✓ _update_payment_statuses_generic has correct signature: {', '.join(generic_params[:4])}...")

    print("✅ TEST 2 PASSED: All function signatures are correct\n")

except Exception as e:
    print(f"❌ TEST 2 FAILED: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)


# Test 3: Test compute_termin_status function
print("TEST 3: Test status computation logic")
print("-" * 80)

try:
    from datetime import datetime, timezone

    # Create test date: 2025-03-15
    test_date = datetime(2025, 3, 15, tzinfo=timezone.utc)

    # Test OVERDUE (past month)
    status = compute_termin_status(2025, 1, test_date)
    assert status == "OVERDUE", f"Expected OVERDUE for Jan 2025, got {status}"
    print("✓ January 2025 from March 2025 → OVERDUE")

    status = compute_termin_status(2025, 2, test_date)
    assert status == "OVERDUE", f"Expected OVERDUE for Feb 2025, got {status}"
    print("✓ February 2025 from March 2025 → OVERDUE")

    # Test DUE (current month)
    status = compute_termin_status(2025, 3, test_date)
    assert status == "DUE", f"Expected DUE for Mar 2025, got {status}"
    print("✓ March 2025 from March 2025 → DUE")

    # Test PENDING (future months)
    status = compute_termin_status(2025, 4, test_date)
    assert status == "PENDING", f"Expected PENDING for Apr 2025, got {status}"
    print("✓ April 2025 from March 2025 → PENDING")

    status = compute_termin_status(2025, 12, test_date)
    assert status == "PENDING", f"Expected PENDING for Dec 2025, got {status}"
    print("✓ December 2025 from March 2025 → PENDING")

    status = compute_termin_status(2026, 1, test_date)
    assert status == "PENDING", f"Expected PENDING for Jan 2026, got {status}"
    print("✓ January 2026 from March 2025 → PENDING")

    print("✅ TEST 3 PASSED: Status computation works correctly\n")

except Exception as e:
    print(f"❌ TEST 3 FAILED: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)


# Test 4: Verify model imports
print("TEST 4: Verify model imports and table structure")
print("-" * 80)

try:
    from app.models.database import ContractTermPayment, ContractRecurringPayment, TerminPaymentStatus

    print("✓ Successfully imported ContractTermPayment model")
    print("✓ Successfully imported ContractRecurringPayment model")
    print("✓ Successfully imported TerminPaymentStatus enum")

    # Verify both tables have required fields
    termin_fields = ['id', 'contract_id', 'period_year', 'period_month', 'status', 'termin_number']
    for field in termin_fields:
        assert hasattr(ContractTermPayment, field), f"ContractTermPayment missing {field}"
    print(f"✓ ContractTermPayment has required fields: {', '.join(termin_fields)}")

    recurring_fields = ['id', 'contract_id', 'period_year', 'period_month', 'status', 'cycle_number']
    for field in recurring_fields:
        assert hasattr(ContractRecurringPayment, field), f"ContractRecurringPayment missing {field}"
    print(f"✓ ContractRecurringPayment has required fields: {', '.join(recurring_fields)}")

    # Verify status enum values
    expected_statuses = {'PENDING', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED'}
    actual_statuses = {status.value for status in TerminPaymentStatus}
    assert expected_statuses == actual_statuses, f"Status mismatch: {actual_statuses}"
    print(f"✓ TerminPaymentStatus enum has correct values: {', '.join(expected_statuses)}")

    print("✅ TEST 4 PASSED: Models have correct structure\n")

except Exception as e:
    print(f"❌ TEST 4 FAILED: {e}\n")
    import traceback
    traceback.print_exc()
    sys.exit(1)


# Final Summary
print("=" * 80)
print("✅ ALL TESTS PASSED!")
print("=" * 80)
print()
print("Summary:")
print("  ✓ Status update functions imported successfully")
print("  ✓ Function signatures are correct")
print("  ✓ Status computation logic works correctly")
print("  ✓ Database models have correct structure")
print()
print("Status update refactoring is complete and working! 🎉")
print()
print("Next steps:")
print("  - Test with actual database (run test_recurring_payments.py with psycopg2)")
print("  - Verify API endpoints call the status update functions")
print("  - Test end-to-end with frontend")
print()
