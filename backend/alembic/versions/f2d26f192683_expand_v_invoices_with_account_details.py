"""expand v_invoices with account details

Revision ID: f2d26f192683
Revises: 4888c5cfcef0
Create Date: 2026-01-26 16:05:44.867453

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2d26f192683'
down_revision: Union[str, Sequence[str], None] = '4888c5cfcef0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Expand v_invoices view with additional account details.

    Adds the following fields to v_invoices:
    - bus_area: Account business area
    - nipnas: Account NIPNAS identifier
    - segment_name: Segment name (via JOIN to segments table)
    - account_manager_name: Account manager name (via JOIN to account_managers table)
    - assigned_officer_name: Assigned officer full name (via JOIN to users table)
    - account_notes: Account notes
    """

    # Drop existing view
    op.execute("DROP VIEW IF EXISTS v_invoices")

    # Recreate view with additional fields
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
            tp.status,
            tp.status as payment_due_status,
            tp.due_date,
            tp.period_month,
            tp.period_year,
            TO_CHAR(TO_DATE(tp.period_month::text, 'MM'), 'Mon') || ' ' || tp.period_year::text as period_label,
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
            a.bus_area,
            a.nipnas,

            -- Witel Info
            w.name as witel_name,

            -- Segment Info (NEW)
            s.name as segment_name,

            -- Account Manager Info (NEW)
            am.name as account_manager_name,

            -- Assigned Officer Info (NEW)
            ao.full_name as assigned_officer_name,

            -- Account Notes (NEW)
            a.notes as account_notes,

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
        LEFT JOIN segments s ON a.segment_id = s.id
        LEFT JOIN account_managers am ON a.account_manager_id = am.id
        LEFT JOIN users ao ON a.assigned_officer_id = ao.id

        UNION ALL

        -- Recurring Payments as Invoices
        SELECT
            'RECURRING' as invoice_type,
            rp.id,
            rp.invoice_number,
            rp.contract_id,
            NULL as invoice_sequence,
            rp.invoice_status,
            rp.status,
            rp.status as payment_due_status,
            rp.due_date,
            rp.period_month,
            rp.period_year,
            TO_CHAR(TO_DATE(rp.period_month::text, 'MM'), 'Mon') || ' ' || rp.period_year::text as period_label,
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
            a.bus_area,
            a.nipnas,

            -- Witel Info
            w.name as witel_name,

            -- Segment Info (NEW)
            s.name as segment_name,

            -- Account Manager Info (NEW)
            am.name as account_manager_name,

            -- Assigned Officer Info (NEW)
            ao.full_name as assigned_officer_name,

            -- Account Notes (NEW)
            a.notes as account_notes,

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
        LEFT JOIN witels w ON a.witel_id = w.id
        LEFT JOIN segments s ON a.segment_id = s.id
        LEFT JOIN account_managers am ON a.account_manager_id = am.id
        LEFT JOIN users ao ON a.assigned_officer_id = ao.id;
    """)

    # Add comment to view
    op.execute("""
        COMMENT ON VIEW v_invoices IS
            'Unified view of all invoices with account, segment, witel, account manager, and assigned officer details';
    """)


def downgrade() -> None:
    """Revert v_invoices view to previous version without additional account details."""

    # Drop current view
    op.execute("DROP VIEW IF EXISTS v_invoices")

    # Recreate original view (without new fields)
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
            tp.status,
            tp.status as payment_due_status,
            tp.due_date,
            tp.period_month,
            tp.period_year,
            TO_CHAR(TO_DATE(tp.period_month::text, 'MM'), 'Mon') || ' ' || tp.period_year::text as period_label,
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
            rp.status,
            rp.status as payment_due_status,
            rp.due_date,
            rp.period_month,
            rp.period_year,
            TO_CHAR(TO_DATE(rp.period_month::text, 'MM'), 'Mon') || ' ' || rp.period_year::text as period_label,
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

    # Add comment to view
    op.execute("""
        COMMENT ON VIEW v_invoices IS
            'Unified view of all invoices from term_payments and recurring_payments';
    """)

