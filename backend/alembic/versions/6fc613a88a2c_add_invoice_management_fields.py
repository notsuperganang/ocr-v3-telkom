"""add_invoice_management_fields

Revision ID: 6fc613a88a2c
Revises: f1a2b3c4d5e6
Create Date: 2026-01-23 20:30:19.100619

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6fc613a88a2c'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add invoice management fields to payment tables and create supporting infrastructure.

    This migration extends contract_term_payments and contract_recurring_payments tables
    with invoice management capabilities including:
    - Invoice numbering (account-based format: AAAAAAA-NNNNNN-YYYYMM)
    - Invoice lifecycle status tracking (DRAFT, SENT, PAID, etc.)
    - PPh 23 tax breakdown (base_amount, ppn_amount, pph_amount, net_payable_amount)
    - Payment tracking (paid_amount, ppn_paid, pph23_paid)
    - Due dates and sent dates

    Creates supporting tables for:
    - payment_transactions: Track multiple partial payments per invoice
    - invoice_documents: Store multiple documents (bukti bayar, BUPOT, etc.)

    Creates database functions for:
    - generate_invoice_number(): Account-based invoice numbering
    - recalculate_invoice_breakdown_trigger(): Auto-calculate tax breakdown
    - update_invoice_status_trigger(): Auto-update invoice status based on payments

    Creates unified view:
    - v_invoices: Combine term and recurring payments into single queryable view
    """

    # =========================================================================
    # 1. ALTER TABLE contract_term_payments - Add invoice fields
    # =========================================================================

    # Invoice identification and status
    op.add_column('contract_term_payments',
        sa.Column('invoice_number', sa.String(50), unique=True, nullable=True))
    op.add_column('contract_term_payments',
        sa.Column('invoice_status', sa.String(30), server_default='DRAFT', nullable=False))
    op.add_column('contract_term_payments',
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True))

    # Amount breakdown fields (auto-calculated from amount)
    # These fields implement PPh 23 (2% withholding tax) calculation:
    # - base_amount = amount / 1.11 (DPP - Dasar Pengenaan Pajak)
    # - ppn_amount = base_amount × 0.11 (11% PPN)
    # - pph_amount = base_amount × 0.02 (2% PPh 23 - withheld by customer)
    # - net_payable_amount = amount - pph_amount (what customer actually pays)
    op.add_column('contract_term_payments',
        sa.Column('base_amount', sa.Numeric(18,2), nullable=True))
    op.add_column('contract_term_payments',
        sa.Column('ppn_amount', sa.Numeric(18,2), nullable=True))
    op.add_column('contract_term_payments',
        sa.Column('pph_amount', sa.Numeric(18,2), nullable=True))
    op.add_column('contract_term_payments',
        sa.Column('net_payable_amount', sa.Numeric(18,2), nullable=True))
    op.add_column('contract_term_payments',
        sa.Column('paid_amount', sa.Numeric(18,2), server_default='0', nullable=False))

    # Tax status tracking (per-invoice flags)
    op.add_column('contract_term_payments',
        sa.Column('ppn_paid', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('contract_term_payments',
        sa.Column('pph23_paid', sa.Boolean(), server_default='false', nullable=False))

    # Metadata
    op.add_column('contract_term_payments',
        sa.Column('sent_date', sa.DateTime(timezone=True), nullable=True))

    # =========================================================================
    # 2. ALTER TABLE contract_recurring_payments - Same fields
    # =========================================================================

    op.add_column('contract_recurring_payments',
        sa.Column('invoice_number', sa.String(50), unique=True, nullable=True))
    op.add_column('contract_recurring_payments',
        sa.Column('invoice_status', sa.String(30), server_default='DRAFT', nullable=False))
    op.add_column('contract_recurring_payments',
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('contract_recurring_payments',
        sa.Column('base_amount', sa.Numeric(18,2), nullable=True))
    op.add_column('contract_recurring_payments',
        sa.Column('ppn_amount', sa.Numeric(18,2), nullable=True))
    op.add_column('contract_recurring_payments',
        sa.Column('pph_amount', sa.Numeric(18,2), nullable=True))
    op.add_column('contract_recurring_payments',
        sa.Column('net_payable_amount', sa.Numeric(18,2), nullable=True))
    op.add_column('contract_recurring_payments',
        sa.Column('paid_amount', sa.Numeric(18,2), server_default='0', nullable=False))
    op.add_column('contract_recurring_payments',
        sa.Column('ppn_paid', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('contract_recurring_payments',
        sa.Column('pph23_paid', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('contract_recurring_payments',
        sa.Column('sent_date', sa.DateTime(timezone=True), nullable=True))

    # =========================================================================
    # 3. CREATE INDEXES for performance
    # =========================================================================

    # Indexes on contract_term_payments
    op.create_index('idx_ctp_billing_period', 'contract_term_payments',
                    ['period_year', 'period_month'])
    op.create_index('idx_ctp_invoice_status', 'contract_term_payments',
                    ['invoice_status'])
    op.create_index('idx_ctp_due_date', 'contract_term_payments', ['due_date'])
    op.create_index('idx_ctp_invoice_number', 'contract_term_payments',
                    ['invoice_number'])

    # Indexes on contract_recurring_payments
    op.create_index('idx_crp_billing_period', 'contract_recurring_payments',
                    ['period_year', 'period_month'])
    op.create_index('idx_crp_invoice_status', 'contract_recurring_payments',
                    ['invoice_status'])
    op.create_index('idx_crp_due_date', 'contract_recurring_payments', ['due_date'])
    op.create_index('idx_crp_invoice_number', 'contract_recurring_payments',
                    ['invoice_number'])

    # =========================================================================
    # 4. CREATE TABLE payment_transactions
    # =========================================================================

    # This table tracks individual payment transactions for invoices
    # Supports partial payments (multiple payments per invoice)
    op.create_table('payment_transactions',
        sa.Column('id', sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column('invoice_type', sa.String(20), nullable=False),  # 'TERM' or 'RECURRING'
        sa.Column('term_payment_id', sa.BigInteger(), nullable=True),
        sa.Column('recurring_payment_id', sa.BigInteger(), nullable=True),
        sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('amount', sa.Numeric(18,2), nullable=False),
        sa.Column('payment_method', sa.String(50), nullable=True),  # TRANSFER, CASH, GIRO, etc
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('ppn_included', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('pph23_included', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),

        sa.ForeignKeyConstraint(['term_payment_id'], ['contract_term_payments.id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recurring_payment_id'], ['contract_recurring_payments.id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),

        sa.CheckConstraint('amount > 0', name='chk_payment_amount'),
        sa.CheckConstraint(
            '(term_payment_id IS NOT NULL AND recurring_payment_id IS NULL) OR '
            '(term_payment_id IS NULL AND recurring_payment_id IS NOT NULL)',
            name='chk_payment_reference'
        )
    )

    # Indexes for payment_transactions
    op.create_index('idx_payment_term', 'payment_transactions', ['term_payment_id'])
    op.create_index('idx_payment_recurring', 'payment_transactions', ['recurring_payment_id'])
    op.create_index('idx_payment_date', 'payment_transactions', ['payment_date'])
    op.create_index('idx_payment_created_at', 'payment_transactions', ['created_at'])

    # =========================================================================
    # 5. CREATE TABLE invoice_documents
    # =========================================================================

    # This table stores documents related to invoices and payments
    # Document types: BUKTI_BAYAR, BUPOT_PPH23, BUKTI_BAYAR_PPH,
    #                 BUKTI_BAYAR_PPN, INVOICE_PDF, FAKTUR_PAJAK, OTHER
    op.create_table('invoice_documents',
        sa.Column('id', sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column('invoice_type', sa.String(20), nullable=False),  # 'TERM' or 'RECURRING'
        sa.Column('term_payment_id', sa.BigInteger(), nullable=True),
        sa.Column('recurring_payment_id', sa.BigInteger(), nullable=True),
        sa.Column('payment_transaction_id', sa.BigInteger(), nullable=True),  # Optional link to specific payment
        sa.Column('document_type', sa.String(30), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('uploaded_by_id', sa.Integer(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('notes', sa.Text(), nullable=True),

        sa.ForeignKeyConstraint(['term_payment_id'], ['contract_term_payments.id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recurring_payment_id'], ['contract_recurring_payments.id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['payment_transaction_id'], ['payment_transactions.id'],
                                ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id']),

        sa.CheckConstraint('file_size <= 10485760', name='chk_file_size'),  # Max 10MB
        sa.CheckConstraint(
            '(term_payment_id IS NOT NULL AND recurring_payment_id IS NULL) OR '
            '(term_payment_id IS NULL AND recurring_payment_id IS NOT NULL)',
            name='chk_invoice_reference'
        )
    )

    # Indexes for invoice_documents
    op.create_index('idx_doc_term', 'invoice_documents', ['term_payment_id'])
    op.create_index('idx_doc_recurring', 'invoice_documents', ['recurring_payment_id'])
    op.create_index('idx_doc_payment', 'invoice_documents', ['payment_transaction_id'])
    op.create_index('idx_doc_type', 'invoice_documents', ['document_type'])
    op.create_index('idx_doc_uploaded_at', 'invoice_documents', ['uploaded_at'])

    # =========================================================================
    # 6. CREATE SQL FUNCTIONS using op.execute()
    # =========================================================================

    # Function: generate_invoice_number (account-based format)
    # Format: AAAAAAA-NNNNNN-YYYYMM
    # Example: 4997096-000035-202512
    # - AAAAAAA: First 7 digits of account number
    # - NNNNNN: 6-digit cumulative sequence (never resets)
    # - YYYYMM: Billing year and month
    op.execute("""
        CREATE OR REPLACE FUNCTION generate_invoice_number(
            p_account_number VARCHAR,
            p_year INTEGER,
            p_month INTEGER
        ) RETURNS VARCHAR AS $$
        DECLARE
            v_account_prefix VARCHAR(7);
            v_sequence INTEGER;
            v_number VARCHAR;
        BEGIN
            -- Extract first 7 digits of account number
            v_account_prefix := LEFT(p_account_number, 7);

            -- Get total invoice count for this account (cumulative, never resets)
            SELECT COALESCE(COUNT(*), 0) + 1
            INTO v_sequence
            FROM (
                SELECT invoice_number FROM contract_term_payments
                WHERE invoice_number LIKE v_account_prefix || '-%'
                UNION ALL
                SELECT invoice_number FROM contract_recurring_payments
                WHERE invoice_number LIKE v_account_prefix || '-%'
            ) combined;

            -- Format: 4997096-000035-202512
            v_number := v_account_prefix || '-' ||
                        LPAD(v_sequence::TEXT, 6, '0') || '-' ||
                        p_year || LPAD(p_month::TEXT, 2, '0');

            RETURN v_number;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Function: recalculate_invoice_breakdown_trigger
    # Automatically recalculates tax breakdown when amount field changes
    # Implements PPh 23 (2% withholding tax) calculation
    op.execute("""
        CREATE OR REPLACE FUNCTION recalculate_invoice_breakdown_trigger()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Recalculate all breakdown fields from amount
            -- Formula implements PPh 23 withholding tax:
            -- amount = total invoice value (including PPN)
            -- base_amount = amount / 1.11 (DPP - Dasar Pengenaan Pajak)
            -- ppn_amount = base_amount × 0.11 (11% PPN)
            -- pph_amount = base_amount × 0.02 (2% PPh 23 - withheld by customer)
            -- net_payable_amount = amount - pph_amount (what customer actually pays)
            NEW.base_amount := NEW.amount / 1.11;
            NEW.ppn_amount := NEW.base_amount * 0.11;
            NEW.pph_amount := NEW.base_amount * 0.02;
            NEW.net_payable_amount := NEW.amount - NEW.pph_amount;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Function: update_invoice_status_trigger
    # Automatically updates invoice_status based on payment state
    # Status logic:
    # - PAID: paid_amount >= net_payable_amount AND ppn_paid AND pph23_paid
    # - PAID_PENDING_PPH23: paid >= net_payable AND NOT pph23_paid
    # - PAID_PENDING_PPN: paid >= net_payable AND ppn_paid AND NOT pph23_paid (rare)
    # - PARTIALLY_PAID: paid_amount > 0 AND paid < net_payable
    # - OVERDUE: due_date < CURRENT_DATE AND not fully paid
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
                v_new_invoice_status := COALESCE(NEW.invoice_status, 'SENT');
            END IF;

            NEW.invoice_status := v_new_invoice_status;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # =========================================================================
    # 7. CREATE TRIGGERS
    # =========================================================================

    # Trigger to recalculate tax breakdown on amount change (term payments)
    # Note: On INSERT, OLD.amount is NULL, so IS DISTINCT FROM will evaluate to TRUE
    op.execute("""
        CREATE TRIGGER trg_recalc_term_breakdown
            BEFORE INSERT OR UPDATE ON contract_term_payments
            FOR EACH ROW
            WHEN (NEW.amount IS NOT NULL)
            EXECUTE FUNCTION recalculate_invoice_breakdown_trigger();
    """)

    # Trigger to recalculate tax breakdown on amount change (recurring payments)
    # Note: On INSERT, OLD.amount is NULL, so IS DISTINCT FROM will evaluate to TRUE
    op.execute("""
        CREATE TRIGGER trg_recalc_recurring_breakdown
            BEFORE INSERT OR UPDATE ON contract_recurring_payments
            FOR EACH ROW
            WHEN (NEW.amount IS NOT NULL)
            EXECUTE FUNCTION recalculate_invoice_breakdown_trigger();
    """)

    # Trigger to update invoice status on payment changes (term payments)
    op.execute("""
        CREATE TRIGGER trg_update_term_invoice_status
            BEFORE UPDATE ON contract_term_payments
            FOR EACH ROW
            WHEN (OLD.paid_amount IS DISTINCT FROM NEW.paid_amount OR
                  OLD.ppn_paid IS DISTINCT FROM NEW.ppn_paid OR
                  OLD.pph23_paid IS DISTINCT FROM NEW.pph23_paid)
            EXECUTE FUNCTION update_invoice_status_trigger();
    """)

    # Trigger to update invoice status on payment changes (recurring payments)
    op.execute("""
        CREATE TRIGGER trg_update_recurring_invoice_status
            BEFORE UPDATE ON contract_recurring_payments
            FOR EACH ROW
            WHEN (OLD.paid_amount IS DISTINCT FROM NEW.paid_amount OR
                  OLD.ppn_paid IS DISTINCT FROM NEW.ppn_paid OR
                  OLD.pph23_paid IS DISTINCT FROM NEW.pph23_paid)
            EXECUTE FUNCTION update_invoice_status_trigger();
    """)

    # =========================================================================
    # 8. CREATE VIEW v_invoices
    # =========================================================================

    # Unified view combining term and recurring payments into single queryable interface
    # Includes contract, account, and witel information via JOINs
    # Calculates outstanding_amount and payment_progress_pct based on net_payable_amount
    op.execute("""
        CREATE OR REPLACE VIEW v_invoices AS
        -- Term Payments as Invoices
        SELECT
            'TERM' as invoice_type,
            tp.id,
            tp.invoice_number,
            tp.contract_id,
            tp.termin_number as invoice_sequence,
            tp.invoice_status,
            tp.status as payment_due_status,
            tp.due_date,
            tp.period_month as billing_month,
            tp.period_year as billing_year,
            tp.original_amount,
            tp.amount,
            tp.base_amount,
            tp.ppn_amount,
            tp.pph_amount,
            tp.net_payable_amount,
            tp.paid_amount,
            tp.ppn_paid,
            tp.pph23_paid,
            tp.sent_date,
            tp.notes,
            tp.created_at,
            tp.updated_at,
            tp.updated_by_id,

            -- Contract Info
            c.contract_number,
            c.customer_name,
            c.customer_npwp as npwp,
            c.customer_address,
            a.witel_id,
            a.segment_id,
            c.period_start as contract_start_date,
            c.period_end as contract_end_date,
            c.account_id,

            -- Account Info
            a.account_number,

            -- Witel Info
            w.name as witel_name,

            -- Calculate outstanding (based on net payable, not total amount)
            -- Customer pays net_payable_amount (amount minus PPh 23 withholding)
            (tp.net_payable_amount - COALESCE(tp.paid_amount, 0)) as outstanding_amount,

            -- Payment progress percentage (based on net payable)
            CASE
                WHEN tp.net_payable_amount > 0
                THEN ROUND((COALESCE(tp.paid_amount, 0) / tp.net_payable_amount * 100), 2)
                ELSE 0
            END as payment_progress_pct

        FROM contract_term_payments tp
        LEFT JOIN contracts c ON tp.contract_id = c.id
        LEFT JOIN accounts a ON c.account_id = a.id
        LEFT JOIN witels w ON a.witel_id = w.id

        UNION ALL

        -- Recurring Payments as Invoices
        SELECT
            'RECURRING' as invoice_type,
            rp.id,
            rp.invoice_number,
            rp.contract_id,
            NULL as invoice_sequence,
            rp.invoice_status,
            rp.status as payment_due_status,
            rp.due_date,
            rp.period_month as billing_month,
            rp.period_year as billing_year,
            rp.original_amount,
            rp.amount,
            rp.base_amount,
            rp.ppn_amount,
            rp.pph_amount,
            rp.net_payable_amount,
            rp.paid_amount,
            rp.ppn_paid,
            rp.pph23_paid,
            rp.sent_date,
            rp.notes,
            rp.created_at,
            rp.updated_at,
            rp.updated_by_id,

            -- Contract Info
            c.contract_number,
            c.customer_name,
            c.customer_npwp as npwp,
            c.customer_address,
            a.witel_id,
            a.segment_id,
            c.period_start as contract_start_date,
            c.period_end as contract_end_date,
            c.account_id,

            -- Account Info
            a.account_number,

            -- Witel Info
            w.name as witel_name,

            -- Calculate outstanding (based on net payable, not total amount)
            (rp.net_payable_amount - COALESCE(rp.paid_amount, 0)) as outstanding_amount,

            -- Payment progress percentage (based on net payable)
            CASE
                WHEN rp.net_payable_amount > 0
                THEN ROUND((COALESCE(rp.paid_amount, 0) / rp.net_payable_amount * 100), 2)
                ELSE 0
            END as payment_progress_pct

        FROM contract_recurring_payments rp
        LEFT JOIN contracts c ON rp.contract_id = c.id
        LEFT JOIN accounts a ON c.account_id = a.id
        LEFT JOIN witels w ON a.witel_id = w.id;
    """)

    # =========================================================================
    # 9. ADD TABLE COMMENTS
    # =========================================================================

    op.execute("""
        COMMENT ON TABLE payment_transactions IS
            'Tracks individual payment transactions for invoices. Supports partial payments.';
    """)
    op.execute("""
        COMMENT ON COLUMN payment_transactions.invoice_type IS
            'Type of invoice: TERM or RECURRING';
    """)
    op.execute("""
        COMMENT ON COLUMN payment_transactions.ppn_included IS
            'Whether PPN tax was paid in this transaction';
    """)
    op.execute("""
        COMMENT ON COLUMN payment_transactions.pph23_included IS
            'Whether PPh 23 tax was paid in this transaction';
    """)
    op.execute("""
        COMMENT ON TABLE invoice_documents IS
            'Stores documents related to invoices and payments';
    """)
    op.execute("""
        COMMENT ON COLUMN invoice_documents.payment_transaction_id IS
            'Optional: Link document to specific payment transaction';
    """)
    op.execute("""
        COMMENT ON COLUMN invoice_documents.document_type IS
            'Type of document: BUKTI_BAYAR, BUPOT_PPH23, FAKTUR_PAJAK, etc';
    """)
    op.execute("""
        COMMENT ON VIEW v_invoices IS
            'Unified view of all invoices from term_payments and recurring_payments';
    """)


def downgrade() -> None:
    """Rollback invoice management schema changes.

    This completely reverses the upgrade() function by:
    - Dropping the v_invoices view
    - Dropping all triggers
    - Dropping all functions
    - Dropping new tables (invoice_documents, payment_transactions)
    - Dropping indexes
    - Removing new columns from payment tables
    """

    # =========================================================================
    # 1. DROP VIEW
    # =========================================================================

    op.execute("DROP VIEW IF EXISTS v_invoices")

    # =========================================================================
    # 2. DROP TRIGGERS
    # =========================================================================

    op.execute("DROP TRIGGER IF EXISTS trg_update_recurring_invoice_status ON contract_recurring_payments")
    op.execute("DROP TRIGGER IF EXISTS trg_update_term_invoice_status ON contract_term_payments")
    op.execute("DROP TRIGGER IF EXISTS trg_recalc_recurring_breakdown ON contract_recurring_payments")
    op.execute("DROP TRIGGER IF EXISTS trg_recalc_term_breakdown ON contract_term_payments")

    # =========================================================================
    # 3. DROP FUNCTIONS
    # =========================================================================

    op.execute("DROP FUNCTION IF EXISTS update_invoice_status_trigger() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS recalculate_invoice_breakdown_trigger() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS generate_invoice_number(VARCHAR, INTEGER, INTEGER) CASCADE")

    # =========================================================================
    # 4. DROP INDEXES ON NEW TABLES
    # =========================================================================

    # invoice_documents indexes
    op.drop_index('idx_doc_uploaded_at', 'invoice_documents')
    op.drop_index('idx_doc_type', 'invoice_documents')
    op.drop_index('idx_doc_payment', 'invoice_documents')
    op.drop_index('idx_doc_recurring', 'invoice_documents')
    op.drop_index('idx_doc_term', 'invoice_documents')

    # payment_transactions indexes
    op.drop_index('idx_payment_created_at', 'payment_transactions')
    op.drop_index('idx_payment_date', 'payment_transactions')
    op.drop_index('idx_payment_recurring', 'payment_transactions')
    op.drop_index('idx_payment_term', 'payment_transactions')

    # =========================================================================
    # 5. DROP TABLES
    # =========================================================================

    # Must drop invoice_documents first due to FK dependency on payment_transactions
    op.drop_table('invoice_documents')
    op.drop_table('payment_transactions')

    # =========================================================================
    # 6. DROP INDEXES ON PAYMENT TABLES
    # =========================================================================

    # contract_recurring_payments indexes
    op.drop_index('idx_crp_invoice_number', 'contract_recurring_payments')
    op.drop_index('idx_crp_due_date', 'contract_recurring_payments')
    op.drop_index('idx_crp_invoice_status', 'contract_recurring_payments')
    op.drop_index('idx_crp_billing_period', 'contract_recurring_payments')

    # contract_term_payments indexes
    op.drop_index('idx_ctp_invoice_number', 'contract_term_payments')
    op.drop_index('idx_ctp_due_date', 'contract_term_payments')
    op.drop_index('idx_ctp_invoice_status', 'contract_term_payments')
    op.drop_index('idx_ctp_billing_period', 'contract_term_payments')

    # =========================================================================
    # 7. DROP COLUMNS FROM contract_recurring_payments
    # =========================================================================

    op.drop_column('contract_recurring_payments', 'sent_date')
    op.drop_column('contract_recurring_payments', 'pph23_paid')
    op.drop_column('contract_recurring_payments', 'ppn_paid')
    op.drop_column('contract_recurring_payments', 'paid_amount')
    op.drop_column('contract_recurring_payments', 'net_payable_amount')
    op.drop_column('contract_recurring_payments', 'pph_amount')
    op.drop_column('contract_recurring_payments', 'ppn_amount')
    op.drop_column('contract_recurring_payments', 'base_amount')
    op.drop_column('contract_recurring_payments', 'due_date')
    op.drop_column('contract_recurring_payments', 'invoice_status')
    op.drop_column('contract_recurring_payments', 'invoice_number')

    # =========================================================================
    # 8. DROP COLUMNS FROM contract_term_payments
    # =========================================================================

    op.drop_column('contract_term_payments', 'sent_date')
    op.drop_column('contract_term_payments', 'pph23_paid')
    op.drop_column('contract_term_payments', 'ppn_paid')
    op.drop_column('contract_term_payments', 'paid_amount')
    op.drop_column('contract_term_payments', 'net_payable_amount')
    op.drop_column('contract_term_payments', 'pph_amount')
    op.drop_column('contract_term_payments', 'ppn_amount')
    op.drop_column('contract_term_payments', 'base_amount')
    op.drop_column('contract_term_payments', 'due_date')
    op.drop_column('contract_term_payments', 'invoice_status')
    op.drop_column('contract_term_payments', 'invoice_number')
