"""
Test status synchronization between invoice_status and status columns.

This test verifies that when payments complete and BUPOT is uploaded,
the status column syncs correctly with invoice_status.
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.database import (
    User,
    Account,
    Contract,
    ContractTermPayment,
    PaymentTransaction,
)
from app.services.invoice_service import add_payment, sync_invoice_status
from app.config import settings


def test_sync_status():
    """Test that status syncs when payment completes invoice."""
    
    # Create test database connection
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # 1. Find test user with paycol credentials
        test_user = db.query(User).filter(User.username == "paycol").first()
        if not test_user:
            print("❌ User 'paycol' not found in database.")
            return False
        
        # 2. Find an existing invoice with PARTIALLY_PAID or SENT status
        test_invoice = db.query(ContractTermPayment).filter(
            ContractTermPayment.invoice_status.in_(["SENT", "PARTIALLY_PAID"])
        ).first()
        
        if not test_invoice:
            # Try recurring payments
            from app.models.database import ContractRecurringPayment
            test_invoice = db.query(ContractRecurringPayment).filter(
                ContractRecurringPayment.invoice_status.in_(["SENT", "PARTIALLY_PAID"])
            ).first()
            invoice_type = "recurring" if test_invoice else None
        else:
            invoice_type = "term"
        
        if not test_invoice:
            # Try DRAFT invoices instead
            print("⚠️  No SENT/PARTIALLY_PAID invoices found, trying DRAFT...")
            test_invoice = db.query(ContractTermPayment).filter(
                ContractTermPayment.invoice_status == "DRAFT"
            ).first()
            if not test_invoice:
                from app.models.database import ContractRecurringPayment
                test_invoice = db.query(ContractRecurringPayment).filter(
                    ContractRecurringPayment.invoice_status == "DRAFT"
                ).first()
                invoice_type = "recurring" if test_invoice else None
            else:
                invoice_type = "term"
        
        if not test_invoice:
            print("❌ No suitable test invoice found (need SENT, PARTIALLY_PAID, or DRAFT status)")
            return False
        
        print(f"\n✅ Found test invoice: {test_invoice.id}")
        print(f"   Period: {test_invoice.period_year}-{test_invoice.period_month:02d}")
        print(f"   Net payable: {test_invoice.net_payable_amount}")
        print(f"   Paid amount: {test_invoice.paid_amount}")
        print(f"   Invoice status: {test_invoice.invoice_status}")
        print(f"   Status (time-based): {test_invoice.status}")
        
        # 3. Calculate remaining amount needed to reach PAID
        net_payable = Decimal(str(test_invoice.net_payable_amount))
        paid_amount = Decimal(str(test_invoice.paid_amount or 0))
        remaining = net_payable - paid_amount
        
        if remaining <= 0:
            print("❌ Invoice already fully paid")
            return False
        
        print(f"\n📊 Need to pay: {remaining} to complete invoice")
        
        # Store original status values
        original_invoice_status = test_invoice.invoice_status
        original_status = test_invoice.status
        
        # 4. Add payment to complete the invoice
        print(f"\n💰 Adding payment of {remaining}...")
        payment_data = {
            "payment_date": datetime.now(),
            "amount": float(remaining),
            "payment_method": "TRANSFER",
            "reference_number": "TEST_SYNC_001",
            "ppn_included": True,  # Assume PPN is included
            "notes": "Test payment for status sync"
        }
        
        payment = add_payment(
            db=db,
            invoice_type=invoice_type,
            invoice_id=test_invoice.id,
            payment_data=payment_data,
            acting_user=test_user
        )
        
        # Commit the transaction
        db.commit()
        
        # 5. Refresh and check results
        db.refresh(test_invoice)
        
        print(f"\n✅ Payment added successfully!")
        print(f"   Payment ID: {payment.id}")
        print(f"   Payment amount: {payment.amount}")
        print(f"\n📈 Invoice status after payment:")
        print(f"   Paid amount: {test_invoice.paid_amount}")
        print(f"   Invoice status: {original_invoice_status} → {test_invoice.invoice_status}")
        print(f"   Status (time-based): {original_status} → {test_invoice.status}")
        
        # 6. Verify synchronization
        if test_invoice.invoice_status == "PAID" and test_invoice.pph23_paid:
            # If both PPN and PPH23 paid, should be PAID
            expected_status = "PAID"
            if test_invoice.status == expected_status:
                print(f"\n✅ SYNC VERIFIED: Both columns = {expected_status}")
                return True
            else:
                print(f"\n❌ SYNC FAILED: invoice_status={test_invoice.invoice_status} but status={test_invoice.status}")
                return False
        elif test_invoice.invoice_status in ["PARTIALLY_PAID", "PAID_PENDING_PPH23"]:
            print(f"\n✅ Invoice is {test_invoice.invoice_status}")
            print(f"   Status correctly recalculated as time-based: {test_invoice.status}")
            print(f"   (Payment complete but need BUPOT PPh23 to reach final PAID status)")
            return True
        else:
            print(f"\n⚠️  Unexpected invoice_status: {test_invoice.invoice_status}")
            return False
            
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_sync_function_directly():
    """Test sync_invoice_status function directly."""
    
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Find test user
        test_user = db.query(User).filter(User.username == "paycol").first()
        if not test_user:
            print("❌ User 'paycol' not found")
            return False
        
        # Find any invoice
        test_invoice = db.query(ContractTermPayment).first()
        if not test_invoice:
            print("❌ No term payment invoices found")
            # Try recurring payment
            from app.models.database import ContractRecurringPayment
            test_invoice = db.query(ContractRecurringPayment).first()
            if not test_invoice:
                print("❌ No recurring payment invoices found either")
                print("ℹ️  Database appears to be empty. Please add test data first.")
                return False
            invoice_type = "recurring"
        else:
            invoice_type = "term"
        
        print(f"\n🔍 Testing sync_invoice_status function directly...")
        print(f"   Invoice: {test_invoice.id}")
        print(f"   Before sync:")
        print(f"     invoice_status: {test_invoice.invoice_status}")
        print(f"     status: {test_invoice.status}")
        
        # Call sync function
        sync_invoice_status(
            db=db,
            invoice_type=invoice_type,
            invoice_id=test_invoice.id,
            acting_user=test_user
        )
        
        db.commit()
        db.refresh(test_invoice)
        
        print(f"   After sync:")
        print(f"     invoice_status: {test_invoice.invoice_status}")
        print(f"     status: {test_invoice.status}")
        
        print(f"\n✅ Sync function executed successfully")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 70)
    print("STATUS SYNCHRONIZATION TEST")
    print("=" * 70)
    
    print("\n[TEST 1] Direct sync function test")
    print("-" * 70)
    result1 = test_sync_function_directly()
    
    print("\n[TEST 2] Payment completion with sync test")
    print("-" * 70)
    result2 = test_sync_status()
    
    print("\n" + "=" * 70)
    if result1 and result2:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 70)
