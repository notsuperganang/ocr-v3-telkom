"""fix_invoice_status_trigger_for_payment_deletion

Revision ID: d58e32756d2b
Revises: f2d26f192683
Create Date: 2026-01-27 21:50:40.563747

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd58e32756d2b'
down_revision: Union[str, Sequence[str], None] = 'f2d26f192683'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix invoice status trigger to properly revert status when payments are deleted.

    Problem:
    When an invoice is PAID_PENDING_PPH23 and you delete the BUPOT document,
    it correctly reverts to PAID_PENDING_PPH23. However, if you then delete
    the payment itself (making paid_amount = 0), the status gets stuck on
    PAID_PENDING_PPH23 instead of reverting to SENT or OVERDUE.

    Root cause:
    The trigger had: ELSE v_new_invoice_status := COALESCE(NEW.invoice_status, 'SENT')
    This preserved the existing status when paid_amount = 0 and not overdue.

    Fix:
    Always set to 'SENT' when paid_amount = 0 and not overdue, instead of
    preserving the previous status.
    """

    # Drop and recreate the function with fixed logic
    op.execute("""
        CREATE OR REPLACE FUNCTION update_invoice_status_trigger()
        RETURNS TRIGGER AS $$
        DECLARE
            v_new_invoice_status VARCHAR(30);
        BEGIN
            -- Determine new INVOICE_STATUS based on payment
            -- IMPORTANT: Use net_payable_amount (not amount) because PPh 23 is withheld
            -- Customer pays net_payable_amount = amount - pph_amount
            IF NEW.paid_amount >= NEW.net_payable_amount THEN
                IF NEW.ppn_paid AND NEW.pph23_paid THEN
                    v_new_invoice_status := 'PAID';
                ELSIF NOT NEW.pph23_paid THEN
                    -- Customer paid full net amount, but waiting for BUPOT document
                    v_new_invoice_status := 'PAID_PENDING_PPH23';
                ELSE
                    -- Rare case: payment complete but PPN documentation pending
                    v_new_invoice_status := 'PAID_PENDING_PPN';
                END IF;
            ELSIF NEW.paid_amount > 0 THEN
                v_new_invoice_status := 'PARTIALLY_PAID';
            ELSIF NEW.due_date < CURRENT_DATE THEN
                v_new_invoice_status := 'OVERDUE';
            ELSE
                -- FIX: When no payments and not overdue, revert to SENT
                -- UNLESS the invoice is in DRAFT (hasn't been sent yet)
                -- This prevents stuck PAID_PENDING_PPH23 when payments are deleted
                IF NEW.invoice_status = 'DRAFT' THEN
                    v_new_invoice_status := 'DRAFT';
                ELSE
                    v_new_invoice_status := 'SENT';
                END IF;
            END IF;

            NEW.invoice_status := v_new_invoice_status;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    """Revert to old trigger logic (with the bug)."""

    # Restore old function with COALESCE that preserves status
    op.execute("""
        CREATE OR REPLACE FUNCTION update_invoice_status_trigger()
        RETURNS TRIGGER AS $$
        DECLARE
            v_new_invoice_status VARCHAR(30);
        BEGIN
            IF NEW.paid_amount >= NEW.net_payable_amount THEN
                IF NEW.ppn_paid AND NEW.pph23_paid THEN
                    v_new_invoice_status := 'PAID';
                ELSIF NOT NEW.pph23_paid THEN
                    v_new_invoice_status := 'PAID_PENDING_PPH23';
                ELSE
                    v_new_invoice_status := 'PAID_PENDING_PPN';
                END IF;
            ELSIF NEW.paid_amount > 0 THEN
                v_new_invoice_status := 'PARTIALLY_PAID';
            ELSIF NEW.due_date < CURRENT_DATE THEN
                v_new_invoice_status := 'OVERDUE';
            ELSE
                -- Old buggy logic that preserves existing status
                v_new_invoice_status := COALESCE(NEW.invoice_status, 'SENT');
            END IF;

            NEW.invoice_status := v_new_invoice_status;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
