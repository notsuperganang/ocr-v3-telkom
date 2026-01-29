--
-- PostgreSQL database dump
--

\restrict dDuRhAm75yeu8LwStojb6dUGDtieFwqaLxzcbZjlOHK5UfraWkzaoH3eSx6z5xJ

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: exporttarget; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exporttarget AS ENUM (
    'JSON',
    'EXCEL'
);


--
-- Name: jobstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.jobstatus AS ENUM (
    'QUEUED',
    'PROCESSING',
    'EXTRACTED',
    'AWAITING_REVIEW',
    'CONFIRMED',
    'FAILED'
);


--
-- Name: userrole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userrole AS ENUM (
    'STAFF',
    'MANAGER'
);


--
-- Name: generate_invoice_number(character varying, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number(p_account_number character varying, p_year integer, p_month integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
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
        $$;


--
-- Name: recalculate_invoice_breakdown_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_invoice_breakdown_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
        $$;


--
-- Name: update_invoice_status_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_invoice_status_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
        $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_managers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_managers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    title character varying(255),
    email character varying(255),
    phone character varying(50),
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account_managers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_managers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_managers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_managers_id_seq OWNED BY public.account_managers.id;


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    account_number character varying(50),
    name character varying(500) NOT NULL,
    nipnas character varying(50),
    bus_area character varying(50),
    segment_id integer,
    witel_id integer,
    account_manager_id integer,
    assigned_officer_id integer,
    is_active boolean NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_id integer
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: contract_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_contacts (
    id bigint NOT NULL,
    contract_id integer NOT NULL,
    name character varying(255) NOT NULL,
    phone_number character varying(50),
    job_title character varying(255),
    email character varying(255),
    created_by_id integer,
    updated_by_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contract_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_contacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_contacts_id_seq OWNED BY public.contract_contacts.id;


--
-- Name: contract_recurring_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_recurring_payments (
    id bigint NOT NULL,
    contract_id integer NOT NULL,
    cycle_number integer NOT NULL,
    period_label text NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    original_amount numeric(18,2) NOT NULL,
    amount numeric(18,2) NOT NULL,
    status character varying(20) NOT NULL,
    paid_at timestamp with time zone,
    notes text,
    created_by_id integer,
    updated_by_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_number character varying(50),
    invoice_status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    due_date timestamp with time zone,
    base_amount numeric(18,2),
    ppn_amount numeric(18,2),
    pph_amount numeric(18,2),
    net_payable_amount numeric(18,2),
    paid_amount numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    ppn_paid boolean DEFAULT false NOT NULL,
    pph23_paid boolean DEFAULT false NOT NULL,
    sent_date timestamp with time zone
);


--
-- Name: contract_recurring_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_recurring_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_recurring_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_recurring_payments_id_seq OWNED BY public.contract_recurring_payments.id;


--
-- Name: contract_term_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_term_payments (
    id bigint NOT NULL,
    contract_id integer NOT NULL,
    termin_number integer NOT NULL,
    period_label text NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    original_amount numeric(18,2) NOT NULL,
    amount numeric(18,2) NOT NULL,
    status character varying(20) NOT NULL,
    paid_at timestamp with time zone,
    notes text,
    created_by_id integer,
    updated_by_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_number character varying(50),
    invoice_status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    due_date timestamp with time zone,
    base_amount numeric(18,2),
    ppn_amount numeric(18,2),
    pph_amount numeric(18,2),
    net_payable_amount numeric(18,2),
    paid_amount numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    ppn_paid boolean DEFAULT false NOT NULL,
    pph23_paid boolean DEFAULT false NOT NULL,
    sent_date timestamp with time zone
);


--
-- Name: contract_term_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contract_term_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contract_term_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contract_term_payments_id_seq OWNED BY public.contract_term_payments.id;


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id integer NOT NULL,
    source_job_id integer NOT NULL,
    file_id integer NOT NULL,
    account_id integer,
    contract_year integer NOT NULL,
    telkom_contact_id integer,
    final_data jsonb NOT NULL,
    version integer,
    contract_number character varying(100),
    customer_name character varying(500),
    customer_npwp character varying(50),
    period_start date,
    period_end date,
    service_connectivity integer,
    service_non_connectivity integer,
    service_bundling integer,
    payment_method character varying(20),
    termin_count integer,
    installation_cost numeric(18,2),
    annual_subscription_cost numeric(18,2),
    total_contract_value numeric(18,2),
    customer_address text,
    rep_name text,
    rep_title text,
    customer_contact_name text,
    customer_contact_title text,
    customer_contact_email text,
    customer_contact_phone text,
    period_start_raw text,
    period_end_raw text,
    telkom_contact_name text,
    telkom_contact_title text,
    telkom_contact_email text,
    telkom_contact_phone text,
    payment_description text,
    termin_total_count integer,
    termin_total_amount numeric(18,2),
    payment_raw_text text,
    termin_payments_raw jsonb,
    recurring_monthly_amount numeric(18,2) NOT NULL,
    recurring_month_count integer,
    recurring_total_amount numeric(18,2) NOT NULL,
    extraction_timestamp timestamp with time zone,
    contract_processing_time_sec double precision,
    confirmed_by_id integer NOT NULL,
    confirmed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contracts_id_seq OWNED BY public.contracts.id;


--
-- Name: export_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.export_history (
    id integer NOT NULL,
    contract_id integer NOT NULL,
    export_target public.exporttarget NOT NULL,
    export_path character varying,
    status character varying,
    notes text,
    exported_at timestamp with time zone DEFAULT now()
);


--
-- Name: export_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.export_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: export_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.export_history_id_seq OWNED BY public.export_history.id;


--
-- Name: extraction_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extraction_logs (
    id integer NOT NULL,
    job_id integer NOT NULL,
    level character varying NOT NULL,
    message text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: extraction_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.extraction_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: extraction_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.extraction_logs_id_seq OWNED BY public.extraction_logs.id;


--
-- Name: files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.files (
    id integer NOT NULL,
    original_filename character varying NOT NULL,
    size_bytes bigint NOT NULL,
    mime_type character varying NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    pdf_path character varying NOT NULL
);


--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- Name: invoice_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_documents (
    id bigint NOT NULL,
    invoice_type character varying(20) NOT NULL,
    term_payment_id bigint,
    recurring_payment_id bigint,
    payment_transaction_id bigint,
    document_type character varying(30) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    mime_type character varying(100),
    uploaded_by_id integer,
    uploaded_at timestamp with time zone DEFAULT now(),
    notes text,
    CONSTRAINT chk_file_size CHECK ((file_size <= 10485760)),
    CONSTRAINT chk_invoice_reference CHECK ((((term_payment_id IS NOT NULL) AND (recurring_payment_id IS NULL)) OR ((term_payment_id IS NULL) AND (recurring_payment_id IS NOT NULL))))
);


--
-- Name: TABLE invoice_documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.invoice_documents IS 'Stores documents related to invoices and payments';


--
-- Name: COLUMN invoice_documents.payment_transaction_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.invoice_documents.payment_transaction_id IS 'Optional: Link document to specific payment transaction';


--
-- Name: COLUMN invoice_documents.document_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.invoice_documents.document_type IS 'Type of document: BUKTI_BAYAR, BUPOT_PPH23, FAKTUR_PAJAK, etc';


--
-- Name: invoice_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_documents_id_seq OWNED BY public.invoice_documents.id;


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id bigint NOT NULL,
    invoice_type character varying(20) NOT NULL,
    term_payment_id bigint,
    recurring_payment_id bigint,
    payment_date timestamp with time zone NOT NULL,
    amount numeric(18,2) NOT NULL,
    payment_method character varying(50),
    reference_number character varying(100),
    ppn_included boolean DEFAULT false NOT NULL,
    pph23_included boolean DEFAULT false NOT NULL,
    notes text,
    created_by_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_payment_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT chk_payment_reference CHECK ((((term_payment_id IS NOT NULL) AND (recurring_payment_id IS NULL)) OR ((term_payment_id IS NULL) AND (recurring_payment_id IS NOT NULL))))
);


--
-- Name: TABLE payment_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_transactions IS 'Tracks individual payment transactions for invoices. Supports partial payments.';


--
-- Name: COLUMN payment_transactions.invoice_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.invoice_type IS 'Type of invoice: TERM or RECURRING';


--
-- Name: COLUMN payment_transactions.ppn_included; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.ppn_included IS 'Whether PPN tax was paid in this transaction';


--
-- Name: COLUMN payment_transactions.pph23_included; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.pph23_included IS 'Whether PPh 23 tax was paid in this transaction';


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_transactions_id_seq OWNED BY public.payment_transactions.id;


--
-- Name: processing_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processing_jobs (
    id integer NOT NULL,
    file_id integer NOT NULL,
    status public.jobstatus NOT NULL,
    extracted_data jsonb,
    edited_data jsonb,
    ocr_artifacts jsonb,
    error_message text,
    processing_started_at timestamp with time zone,
    processing_completed_at timestamp with time zone,
    processing_time_seconds double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reviewed_by_id integer,
    reviewed_at timestamp with time zone
);


--
-- Name: processing_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.processing_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: processing_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.processing_jobs_id_seq OWNED BY public.processing_jobs.id;


--
-- Name: segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.segments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50),
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: segments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.segments_id_seq OWNED BY public.segments.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255),
    role public.userrole NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: witels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.witels (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_invoices; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_invoices AS
 SELECT 'TERM'::text AS invoice_type,
    tp.id,
    tp.invoice_number,
    tp.contract_id,
    tp.termin_number AS invoice_sequence,
    tp.invoice_status,
    tp.status,
    tp.status AS payment_due_status,
    tp.due_date,
    tp.period_month,
    tp.period_year,
    ((to_char((to_date((tp.period_month)::text, 'MM'::text))::timestamp with time zone, 'Mon'::text) || ' '::text) || (tp.period_year)::text) AS period_label,
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
    c.contract_number,
    c.customer_name,
    c.customer_npwp AS npwp,
    c.customer_address,
    a.witel_id,
    a.segment_id,
    c.period_start AS contract_start_date,
    c.period_end AS contract_end_date,
    c.account_id,
    a.account_number,
    a.bus_area,
    a.nipnas,
    w.name AS witel_name,
    s.name AS segment_name,
    am.name AS account_manager_name,
    ao.full_name AS assigned_officer_name,
    a.notes AS account_notes,
    (tp.net_payable_amount - COALESCE(tp.paid_amount, (0)::numeric)) AS outstanding_amount,
        CASE
            WHEN (tp.net_payable_amount > (0)::numeric) THEN round(((COALESCE(tp.paid_amount, (0)::numeric) / tp.net_payable_amount) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS payment_progress_pct
   FROM ((((((public.contract_term_payments tp
     LEFT JOIN public.contracts c ON ((tp.contract_id = c.id)))
     LEFT JOIN public.accounts a ON ((c.account_id = a.id)))
     LEFT JOIN public.witels w ON ((a.witel_id = w.id)))
     LEFT JOIN public.segments s ON ((a.segment_id = s.id)))
     LEFT JOIN public.account_managers am ON ((a.account_manager_id = am.id)))
     LEFT JOIN public.users ao ON ((a.assigned_officer_id = ao.id)))
UNION ALL
 SELECT 'RECURRING'::text AS invoice_type,
    rp.id,
    rp.invoice_number,
    rp.contract_id,
    NULL::integer AS invoice_sequence,
    rp.invoice_status,
    rp.status,
    rp.status AS payment_due_status,
    rp.due_date,
    rp.period_month,
    rp.period_year,
    ((to_char((to_date((rp.period_month)::text, 'MM'::text))::timestamp with time zone, 'Mon'::text) || ' '::text) || (rp.period_year)::text) AS period_label,
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
    c.contract_number,
    c.customer_name,
    c.customer_npwp AS npwp,
    c.customer_address,
    a.witel_id,
    a.segment_id,
    c.period_start AS contract_start_date,
    c.period_end AS contract_end_date,
    c.account_id,
    a.account_number,
    a.bus_area,
    a.nipnas,
    w.name AS witel_name,
    s.name AS segment_name,
    am.name AS account_manager_name,
    ao.full_name AS assigned_officer_name,
    a.notes AS account_notes,
    (rp.net_payable_amount - COALESCE(rp.paid_amount, (0)::numeric)) AS outstanding_amount,
        CASE
            WHEN (rp.net_payable_amount > (0)::numeric) THEN round(((COALESCE(rp.paid_amount, (0)::numeric) / rp.net_payable_amount) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS payment_progress_pct
   FROM ((((((public.contract_recurring_payments rp
     LEFT JOIN public.contracts c ON ((rp.contract_id = c.id)))
     LEFT JOIN public.accounts a ON ((c.account_id = a.id)))
     LEFT JOIN public.witels w ON ((a.witel_id = w.id)))
     LEFT JOIN public.segments s ON ((a.segment_id = s.id)))
     LEFT JOIN public.account_managers am ON ((a.account_manager_id = am.id)))
     LEFT JOIN public.users ao ON ((a.assigned_officer_id = ao.id)));


--
-- Name: VIEW v_invoices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_invoices IS 'Unified view of all invoices with account, segment, witel, account manager, and assigned officer details';


--
-- Name: witels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.witels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: witels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.witels_id_seq OWNED BY public.witels.id;


--
-- Name: account_managers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_managers ALTER COLUMN id SET DEFAULT nextval('public.account_managers_id_seq'::regclass);


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: contract_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_contacts ALTER COLUMN id SET DEFAULT nextval('public.contract_contacts_id_seq'::regclass);


--
-- Name: contract_recurring_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_recurring_payments ALTER COLUMN id SET DEFAULT nextval('public.contract_recurring_payments_id_seq'::regclass);


--
-- Name: contract_term_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_term_payments ALTER COLUMN id SET DEFAULT nextval('public.contract_term_payments_id_seq'::regclass);


--
-- Name: contracts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts ALTER COLUMN id SET DEFAULT nextval('public.contracts_id_seq'::regclass);


--
-- Name: export_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_history ALTER COLUMN id SET DEFAULT nextval('public.export_history_id_seq'::regclass);


--
-- Name: extraction_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_logs ALTER COLUMN id SET DEFAULT nextval('public.extraction_logs_id_seq'::regclass);


--
-- Name: files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- Name: invoice_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_documents ALTER COLUMN id SET DEFAULT nextval('public.invoice_documents_id_seq'::regclass);


--
-- Name: payment_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions ALTER COLUMN id SET DEFAULT nextval('public.payment_transactions_id_seq'::regclass);


--
-- Name: processing_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs ALTER COLUMN id SET DEFAULT nextval('public.processing_jobs_id_seq'::regclass);


--
-- Name: segments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segments ALTER COLUMN id SET DEFAULT nextval('public.segments_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: witels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.witels ALTER COLUMN id SET DEFAULT nextval('public.witels_id_seq'::regclass);


--
-- Data for Name: account_managers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_managers (id, name, title, email, phone, is_active, created_at, updated_at) FROM stdin;
1	Abdi Iqram	Account Manager	abdi.iqram@telkom.co.id	082251999963	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
2	Aidil Azhar	Account Manager	aidil.azhar@telkom.co.id	085702683054	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
3	Evan Wahyudi	Account Manager	evan.wahyudi@telkom.co.id	081144083627	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
4	Gogi Gautama Al Hadid	Account Manager	gogi.gautama.al.hadid@telkom.co.id	081150802884	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
5	Judha Ananda Pratama	Account Manager	judha.ananda.pratama@telkom.co.id	082275067094	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
6	Muhammad Daniel Yuna	Account Manager	muhammad.daniel.yuna@telkom.co.id	081399009691	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
7	Muhammad Ihsan Hidayat	Account Manager	muhammad.ihsan.hidayat@telkom.co.id	082260084634	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
8	Muhammad Wahidi	Account Manager	muhammad.wahidi@telkom.co.id	085864140460	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
9	Mulki	Account Manager	mulki@telkom.co.id	085369990971	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
10	Mushawir Ahmad Mudarso	Account Manager	mushawir.ahmad.mudarso@telkom.co.id	081167694378	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
11	Risma Handayani	Account Manager	risma.handayani@telkom.co.id	085172934286	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
12	Vathayani Sunarto	Account Manager	vathayani.sunarto@telkom.co.id	085251071145	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
13	Vidilla Elfa	Account Manager	vidilla.elfa@telkom.co.id	081399474764	t	2026-01-28 11:28:20.559253+07	2026-01-28 11:28:20.559253+07
\.


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.accounts (id, account_number, name, nipnas, bus_area, segment_id, witel_id, account_manager_id, assigned_officer_id, is_active, notes, created_at, updated_at, created_by_id) FROM stdin;
7	4973288	DINAS PENANAMAN MODAL	3000000000	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
10	4903796	BEND.PENGELUARAN LPKA KELAS II BANDA ACE	4600000	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
17	4858451	DPKKD KAB.ACEH UTARA	559000000	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
20	4988647	SMK NEGERI 4 LHOKSEUMAWE	4650000	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
27	4988744	SMK NEGERI 7 LHOKSEUMAWE	4650000	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
28	4985436	BADAN PERTANAHAN NASIONAL KOTA LANGSA	559000000	T963901	1	1	5	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
30	4987566	RSU FANDIKA	3000000000	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
32	5006896	YAYASAN HAJJAH ROHANI THAHER	4660000	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
39	5000004	HOTEL RASAMALA	4660000	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
40	4988128	YAY SEKOLAH SUKMA BANGSA	4650000	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
45	4978229	PT RSU KASIH IBU	4640000	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
49	5001162	TNA FATIH	4660000	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
52	4984648	RSUD KOTA SABANG	76500000	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
58	4999252	RSU MUFID	4640000	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
62	4984834	BPN LHOKSEUMAWE	3000000000	T963901	1	1	3	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
63	4861294	POLITEKNIK INDONESIA VENEZUELA (POLIVEN)	3000000000	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
65	4910067	UNICEF	3000000000	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
66	5005631	STIKES ACEH	4660000	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
68	4936027	BEND.ISBI ACEH	4620000	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
70	4985814	PT PEMA GLOBAL ENERGI	2000000	T973901	4	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
71	5012965	PT. PEMA GLOBAL ENERGI	2000000	T973901	4	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
120	5004175	PENGADILAN NEGERI BANDA ACEH	3000000000	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
122	4862099	UIN AR-RANIRY BANDA ACEH	2000000	T974901	6	1	4	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
24	4988741	BPN ACEH TAMIANG	4727302	T963901	1	1	12	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
124	4974222	POLTEKKES ACEH	5590000	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
127	4853202	PT. BANK ACEH SYARIAH	5500000	T972901	2	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
128	5010502	POLITEKNIK NEGERI LHOKSEUMAWE	4600000	T974901	6	1	4	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
134	4850005	BEND. RSU MEURAXA KOTA BANDA ACEH	10003731	T451901	5	1	6	3	t	\N	2026-01-28 14:56:26.787169+07	2026-01-28 14:56:26.787169+07	1
41	4863610	SEKRETARIAT DAERAH KABUPATEN ACEH TAMIANG	4727302	T963901	1	1	12	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
50	4987360	KANTOR PERTANAHAN ACEH TIMUR	76510010	T963901	1	1	12	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
53	5007310	AMAZONE FAMILY ENTERTAINMENT	4664702	T451901	5	1	11	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
108	5009631	SMAN UNGGUL TAPAKTUAN	4670000	T451901	5	1	1	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
111	5015522	SEKRETARIAT DPRK ACEH TENGAH	3000000000	T963901	1	1	2	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
69	4985166	RSUD LANGSA	559071100	T963901	1	1	5	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
121	4961725	RSUD dr ZUBIR MAHMUD	76500000	T963901	1	1	12	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
123	4866007	BPKD PEMKAB BIREUN	3000000000	T963901	1	1	2	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
130	4957495	PT LKMS MAHIRAH MUAMALAH	4631123	T451901	5	1	1	3	t	\N	2026-01-28 12:08:53.952552+07	2026-01-28 12:08:53.952552+07	1
132	4986281	PT MIFA BERSAUDARA	4641583	T451901	5	1	11	2	t	\N	2026-01-28 14:33:45.756665+07	2026-01-28 14:33:45.756665+07	1
133	4996114	PT. MEULABOH POWER GENERATION	4658821	T451901	5	1	11	1	t	\N	2026-01-28 14:45:11.944116+07	2026-01-28 14:45:11.944116+07	1
83	4864177	DINAS KOMUNIKASI DAN INFORMATIKA KABUPATEN ACEH TIMUR	76510010	T963901	1	1	12	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
89	4997489	MPU ACEH UTARA	558898900	T963901	1	1	3	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
101	5016745	BKPSDM ACEH BESAR	3001000658	T963901	1	1	2	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
103	4987968	KEMENTRIAN AGAMA ACEH TIMUR	76510010	T963901	1	1	12	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
106	5001842	SMA NEGERI 1 KUTACANE	4661629	T451901	5	1	10	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
110	5016660	PERKIM KABUPATEN PIDIE	3001001900	T963901	1	1	13	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
117	5020964	PT ANUGRAH DUTA PROMOSINDO	4669362	T451901	5	1	10	\N	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:36:09.887485+07	\N
1	4988142	RANGKANG COFFEE	4648549	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
2	5001589	DKUPI	4661540	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
3	5008524	SMK 1 LHOKNGA	4665240	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
4	4996893	PT. KRUENG JAYA GROUP	4659243	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
5	4922339	PT.BPRS ADECO	4611043	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
6	4979068	BPRS TAMAN INDAH DARUSSALAM	4645039	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
8	5001019	SMAN 1 LHOKNGA	4661275	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
9	5001938	ALEX KOPI	4661723	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
11	4985805	CV DISTRIBUSINDO BINTANG	4647527	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
12	4951519	CV TYDIY RAYATAMA	4627564	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
13	5000489	YAYASAN CHANA ISLAH CEMERLANG	4660960	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
14	4999142	SPNF SKB KOTA BANDA ACEH	4660326	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
15	5007181	PT. RUMAH SAKIT UMUM MEUTIA	4664565	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
16	5006708	PT. TEKNOLOGI PERDANA INDONESIA	4660414	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
18	4997330	KEMENAG ACEH TENGGARA	76510009	T963901	1	1	7	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
19	4978437	PT. CITRA HUSADA BAKTI	4644676	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
21	5010640	PT. KLIK DATA INDONESIA	4666285	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
22	4984324	DINAS PENDIDIKAN ACEH JAYA	4613182	T963901	1	1	8	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
23	4996737	BKPSDM ACEH BARAT	3001004899	T963901	1	1	8	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
25	4988097	CABANG DINAS PENDIDIKAN ACEH UTARA	558898900	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
26	4984023	KOMISI PEMILIHAN UMUM	3001040106	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
29	5010020	DPW PARTAI NASDEM ACEH	4666014	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
31	4995947	SMK PENERBANGAN	4658679	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
33	5001710	SMA NEGERI 1 DARUL IMARAH	4661598	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
34	4976657	PT. PT HARAPAN BUNDA UTAMA	4643886	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
35	4987524	STIKES MUHAMMADIYAH ACEH	4600566	T984901	3	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
36	4857064	PDAM.TIRTA MON PASE	3001071555	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
37	5002024	SMA LAB SCHOOL UNSYIAH	4661736	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
38	4985238	DPMTRANSNAKER ACEH UTARA	558898900	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
42	4988440	IMIGRASI KELAS II NON TPI MEULABOH	3001004899	T963901	1	1	8	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
43	4983776	BEND. AKPER KEDAM IM LHOKSEUMAWE	4646505	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
44	4999492	RS PRIMA INTI MEDIKA	4660493	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
46	4931344	YAY.LAMKARUNA BIREUN	4616066	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
47	4966410	YAY. AL ABRAR BIREUEN	4638121	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
48	4985678	DINAS PENDIDIKAN CABDIN ACEH BARAT	3001004899	T963901	1	1	8	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
51	4976903	PT. RUMAH SAKIT JEUMPA	3001075347	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
54	4980010	RS TEUNGKU FAKINAH	4645449	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
55	4977704	SMK N 1 BANDA ACEH	10300451	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
56	5008639	PT. MEULIGOE GAJAH PUTEH	4665349	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
57	4931444	BEND.PENGELUARAN PERTANAHAN ACEH BARAT	3001004899	T963901	1	1	8	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
59	4978464	SEKRETARIAT DPRK	558898900	T963901	1	1	3	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
60	4987013	KANTOR PERTANAHAN NASIONAL	558898900	T963901	1	1	3	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
61	4963061	PT.BANK ACEH SYARIAH	5497420	T972901	2	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
64	4921880	BAWASLU ACEH	5591387	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
67	4962215	PT TRANS CONTINENT	3001076577	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
72	4945598	PENGADILAN NEGERI SABANG	76510022	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
73	5010106	PENGADILAN NEGERI MEULABOH	3001004899	T963901	1	1	8	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
74	4954417	PENGADILAN NEGERI SIGLI	3001001900	T963901	1	1	13	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
75	4929366	BEND.PENGELUARAN BLKI BANDA ACEH	5591387	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
78	4979727	PT PEMA GLOBAL ENERGI	2000057	T973901	4	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
80	4918927	POLDA ACEH	76590002	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
81	4997461	BPPW Aceh	5591387	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
82	5010401	DISKOMINFO KOTA BANDA ACEH	3001002900	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
84	4993896	DISKOMINFO ACEH TENGAH	3001000926	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
85	4995349	UNIVERSITAS BUMI PERSADA	4658429	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
86	4870089	PT Asuransi Askrida Syariah	3001075313	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
91	5016744	BADAN PUSAT STATISTIK ACEH UTARA	558898900	T963901	1	1	3	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
95	5015661	CABDIN PENDIDIKAN KOTA SABANG	76510022	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
96	4987729	KPU BENER MERIAH	3001038612	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
99	4964079	YAY.ASSYIFAH	4636743	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
100	4843808	BANK ACEH	5497420	T972901	2	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
102	4996769	KADISPORA ACEH UTARA	558898900	T963901	1	1	3	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
107	4844744	PT. BANK ACEH SYARIAH	5497420	T972901	2	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
109	4937437	DINAS KOMUNIKASI DAN INFORMATIKA, STATISTIK DAN PERSANDIAN KOTA	76510022	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
112	5008616	SMK N 1 BIREUN	4665347	T451901	5	1	10	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
115	4873869	BALAI MONITOR SPEKTRUM FREKUENSI RADIO KELAS II BANDA ACEH DITJEN	5591387	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
116	4985943	DINAS PERPUSTAAN DAN KEARSIPAN	5591387	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
118	4903376	IAIN ZAWIYAH COT KALA LANGSA	4602264	T974901	6	1	4	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
119	5005151	DINAS PENDIDIKAN ACEH	5591387	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
125	4862297	Universitas Malikussaleh	2000377	T974901	6	1	4	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
126	4854211	BID TI POLRI POLDA ACEH	76590002	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
129	017088	PT. PUPUK ISKANDAR MUDA	\N	\N	\N	\N	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 11:44:08.868054+07	\N
76	4997096	HERMES HOTEL	4660000	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
77	4836370	PDAM TIRTA DAROY	1000000000	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
79	4929791	PERWAKILAN BADAN KEPENDUDUKAN DAN KELUARGA BERENCANA NASIONAL	5590000	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
87	4925951	DISKOMINFO ACEH JAYA	4610000	T963901	1	1	8	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
88	5019784	SMK NEGERI 1 MESJID RAYA	4670000	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
90	5016327	SMP PLUS MARYAM BINTI IBRAHIM	4670000	T451901	5	1	1	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
92	5014701	PT UTAMA KASEHAT WALAFIAT	3000000000	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
93	5018914	BADAN PUSAT STATISTIK KAB GAYO LUES	3000000000	T963901	1	1	7	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
94	5020059	DINAS PERPUSTAKAAN DAN KEARSIPAN A BARAT	3000000000	T963901	1	1	8	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
97	4973425	RSDU KABUPATEN PIDIE JAYA	4640000	T451901	5	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
98	4979292	PERENCANA PENGAWASAN JALAN NASIONAL ACEH	5590000	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
104	4997308	MPU ACEH	5590000	T963901	1	1	6	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
105	5013611	DINAS PENDIDIKAN KOTA SABANG	76500000	T963901	1	1	2	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
113	5015958	PT PAYMENT MOBILE INDONESIA	4670000	T451901	5	1	11	3	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
114	4867742	PT. BANK ACEH SYARIAH	5500000	T972901	2	1	9	2	t	\N	2026-01-28 11:36:09.887485+07	2026-01-28 12:06:53.243582+07	\N
131	4987780	POLTEKPEL MALAHAYATI ACEH	121345	90000	1	1	11	2	t	\N	2026-01-28 14:25:55.79986+07	2026-01-28 14:25:55.79986+07	1
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
adad14de3653
\.


--
-- Data for Name: contract_contacts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contract_contacts (id, contract_id, name, phone_number, job_title, email, created_by_id, updated_by_id, created_at, updated_at) FROM stdin;
2	7	Ganang Setyo Hadi	085338573726	Bendahara	ganangsetyohadi@gmail.com	1	1	2026-01-29 16:10:03.952914+07	2026-01-29 16:10:03.952914+07
\.


--
-- Data for Name: contract_recurring_payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contract_recurring_payments (id, contract_id, cycle_number, period_label, period_year, period_month, original_amount, amount, status, paid_at, notes, created_by_id, updated_by_id, created_at, updated_at, invoice_number, invoice_status, due_date, base_amount, ppn_amount, pph_amount, net_payable_amount, paid_amount, ppn_paid, pph23_paid, sent_date) FROM stdin;
2	1	2	Februari 2026	2026	2	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202602	DRAFT	2026-03-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
3	1	3	Maret 2026	2026	3	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202603	DRAFT	2026-04-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
4	1	4	April 2026	2026	4	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202604	DRAFT	2026-05-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
5	1	5	Mei 2026	2026	5	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202605	DRAFT	2026-06-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
6	1	6	Juni 2026	2026	6	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202606	DRAFT	2026-07-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
7	1	7	Juli 2026	2026	7	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202607	DRAFT	2026-08-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
8	1	8	Agustus 2026	2026	8	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202608	DRAFT	2026-09-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
9	1	9	September 2026	2026	9	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202609	DRAFT	2026-10-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
10	1	10	Oktober 2026	2026	10	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202610	DRAFT	2026-11-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
11	1	11	November 2026	2026	11	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202611	DRAFT	2026-12-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
12	1	12	Desember 2026	2026	12	1798200.00	1798200.00	PENDING	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07	4995947-000001-202612	DRAFT	2027-01-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
1	1	1	Januari 2026	2026	1	1798200.00	1798200.00	DUE	\N	\N	1	1	2026-01-28 11:58:29.678473+07	2026-01-28 12:16:32.20961+07	4995947-000001-202601	DRAFT	2026-02-01 06:59:59+07	1620000.00	178200.00	32400.00	1765800.00	0.00	f	f	\N
14	8	2	Februari 2026	2026	2	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202602	DRAFT	2026-03-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
15	8	3	Maret 2026	2026	3	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202603	DRAFT	2026-04-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
16	8	4	April 2026	2026	4	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202604	DRAFT	2026-05-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
17	8	5	Mei 2026	2026	5	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202605	DRAFT	2026-06-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
18	8	6	Juni 2026	2026	6	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202606	DRAFT	2026-07-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
19	8	7	Juli 2026	2026	7	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202607	DRAFT	2026-08-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
20	8	8	Agustus 2026	2026	8	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202608	DRAFT	2026-09-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
21	8	9	September 2026	2026	9	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202609	DRAFT	2026-10-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
22	8	10	Oktober 2026	2026	10	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202610	DRAFT	2026-11-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
23	8	11	November 2026	2026	11	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202611	DRAFT	2026-12-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
24	8	12	Desember 2026	2026	12	798090.00	798090.00	PENDING	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07	5010640-000001-202612	DRAFT	2027-01-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
13	8	1	Januari 2026	2026	1	798090.00	798090.00	DUE	\N	\N	1	1	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:23.920431+07	5010640-000001-202601	DRAFT	2026-02-01 06:59:59+07	719000.00	79090.00	14380.00	783710.00	0.00	f	f	\N
\.


--
-- Data for Name: contract_term_payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contract_term_payments (id, contract_id, termin_number, period_label, period_year, period_month, original_amount, amount, status, paid_at, notes, created_by_id, updated_by_id, created_at, updated_at, invoice_number, invoice_status, due_date, base_amount, ppn_amount, pph_amount, net_payable_amount, paid_amount, ppn_paid, pph23_paid, sent_date) FROM stdin;
1	2	1	Maret 2026	2026	3	5028300.00	5028300.00	PENDING	\N	\N	1	1	2026-01-28 12:15:58.883057+07	2026-01-28 12:15:58.883057+07	4957495-000001-202603	DRAFT	2026-04-01 06:59:59+07	4530000.00	498300.00	90600.00	4937700.00	0.00	f	f	\N
2	2	2	Juni 2026	2026	6	5028300.00	5028300.00	PENDING	\N	\N	1	1	2026-01-28 12:15:58.883057+07	2026-01-28 12:15:58.883057+07	4957495-000001-202606	DRAFT	2026-07-01 06:59:59+07	4530000.00	498300.00	90600.00	4937700.00	0.00	f	f	\N
3	2	3	Oktober 2026	2026	10	5028300.00	5028300.00	PENDING	\N	\N	1	1	2026-01-28 12:15:58.883057+07	2026-01-28 12:15:58.883057+07	4957495-000001-202610	DRAFT	2026-11-01 06:59:59+07	4530000.00	498300.00	90600.00	4937700.00	0.00	f	f	\N
4	2	4	Desember 2026	2026	12	5028300.00	5028300.00	PENDING	\N	\N	1	1	2026-01-28 12:15:58.883057+07	2026-01-28 12:15:58.883057+07	4957495-000001-202612	DRAFT	2027-01-01 06:59:59+07	4530000.00	498300.00	90600.00	4937700.00	0.00	f	f	\N
5	3	1	Februari 2026	2026	2	215364420.00	215364420.00	PENDING	\N	\N	1	1	2026-01-28 14:31:37.478795+07	2026-01-28 14:31:37.478795+07	4987780-000001-202602	DRAFT	2026-03-01 06:59:59+07	194022000.00	21342420.00	3880440.00	211483980.00	0.00	f	f	\N
6	3	2	April 2026	2026	4	215364420.00	215364420.00	PENDING	\N	\N	1	1	2026-01-28 14:31:37.478795+07	2026-01-28 14:31:37.478795+07	4987780-000001-202604	DRAFT	2026-05-01 06:59:59+07	194022000.00	21342420.00	3880440.00	211483980.00	0.00	f	f	\N
7	3	3	September 2026	2026	9	215364420.00	215364420.00	PENDING	\N	\N	1	1	2026-01-28 14:31:37.478795+07	2026-01-28 14:31:37.478795+07	4987780-000001-202609	DRAFT	2026-10-01 06:59:59+07	194022000.00	21342420.00	3880440.00	211483980.00	0.00	f	f	\N
8	3	4	Desember 2026	2026	12	215364420.00	215364420.00	PENDING	\N	\N	1	1	2026-01-28 14:31:37.478795+07	2026-01-28 14:31:37.478795+07	4987780-000001-202612	DRAFT	2027-01-01 06:59:59+07	194022000.00	21342420.00	3880440.00	211483980.00	0.00	f	f	\N
17	7	1	Maret  2026	2026	3	96570000.00	96570000.00	PENDING	\N	\N	1	1	2026-01-28 14:58:10.865517+07	2026-01-28 15:03:59.240584+07	4850005-000001-202603	SENT	2026-04-01 06:59:59+07	87000000.00	9570000.00	1740000.00	94830000.00	0.00	f	f	2026-01-28 15:03:59.243655+07
13	5	1	Januari 2026	2026	1	224115660.00	224115660.00	PAID	\N	\N	1	1	2026-01-28 14:46:23.2246+07	2026-01-28 15:08:29.732898+07	4996114-000001-202503	PAID	2025-04-01 06:59:59+07	201906000.00	22209660.00	4038120.00	220077540.00	220077540.00	t	t	2026-01-28 15:05:47.610917+07
9	4	1	Maret 2026	2026	3	56017260.00	56017260.00	PENDING	\N	\N	1	1	2026-01-28 14:42:50.676386+07	2026-01-28 14:47:16.424963+07	4986281-000001-202503	DRAFT	2025-04-01 06:59:59+07	50466000.00	5551260.00	1009320.00	55007940.00	0.00	f	f	\N
10	4	2	Juni 2026	2026	6	56017260.00	56017260.00	PENDING	\N	\N	1	1	2026-01-28 14:42:50.676386+07	2026-01-28 14:47:16.424963+07	4986281-000001-202506	DRAFT	2025-07-01 06:59:59+07	50466000.00	5551260.00	1009320.00	55007940.00	0.00	f	f	\N
11	4	3	September 2026	2026	9	56017260.00	56017260.00	PENDING	\N	\N	1	1	2026-01-28 14:42:50.676386+07	2026-01-28 14:47:16.424963+07	4986281-000001-202509	DRAFT	2025-10-01 06:59:59+07	50466000.00	5551260.00	1009320.00	55007940.00	0.00	f	f	\N
12	4	4	Desember 2026	2026	12	56017260.00	56017260.00	PENDING	\N	\N	1	1	2026-01-28 14:42:50.676386+07	2026-01-28 14:47:16.424963+07	4986281-000001-202512	DRAFT	2026-01-01 06:59:59+07	50466000.00	5551260.00	1009320.00	55007940.00	0.00	f	f	\N
14	5	2	Juni 2026	2026	6	224115660.00	224115660.00	PENDING	\N	\N	1	1	2026-01-28 14:46:23.2246+07	2026-01-28 14:48:03.132635+07	4996114-000001-202506	DRAFT	2025-07-01 06:59:59+07	201906000.00	22209660.00	4038120.00	220077540.00	0.00	f	f	\N
15	5	3	September 2026	2026	9	224115660.00	224115660.00	PENDING	\N	\N	1	1	2026-01-28 14:46:23.2246+07	2026-01-28 14:48:03.132635+07	4996114-000001-202509	DRAFT	2025-10-01 06:59:59+07	201906000.00	22209660.00	4038120.00	220077540.00	0.00	f	f	\N
16	5	4	Desember 2026	2026	12	224115660.00	224115660.00	PENDING	\N	\N	1	1	2026-01-28 14:46:23.2246+07	2026-01-28 14:48:03.132635+07	4996114-000001-202512	DRAFT	2026-01-01 06:59:59+07	201906000.00	22209660.00	4038120.00	220077540.00	0.00	f	f	\N
18	7	2	April 2026	2026	4	96570000.00	96570000.00	PENDING	\N	\N	1	1	2026-01-28 14:58:10.865517+07	2026-01-28 14:58:10.865517+07	4850005-000001-202604	DRAFT	2026-05-01 06:59:59+07	87000000.00	9570000.00	1740000.00	94830000.00	0.00	f	f	\N
19	7	3	September 2026	2026	9	96570000.00	96570000.00	PENDING	\N	\N	1	1	2026-01-28 14:58:10.865517+07	2026-01-28 14:58:10.865517+07	4850005-000001-202609	DRAFT	2026-10-01 06:59:59+07	87000000.00	9570000.00	1740000.00	94830000.00	0.00	f	f	\N
20	7	4	Desember 2026	2026	12	96570000.00	96570000.00	PENDING	\N	\N	1	1	2026-01-28 14:58:10.865517+07	2026-01-28 14:58:10.865517+07	4850005-000001-202612	DRAFT	2027-01-01 06:59:59+07	87000000.00	9570000.00	1740000.00	94830000.00	0.00	f	f	\N
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contracts (id, source_job_id, file_id, account_id, contract_year, telkom_contact_id, final_data, version, contract_number, customer_name, customer_npwp, period_start, period_end, service_connectivity, service_non_connectivity, service_bundling, payment_method, termin_count, installation_cost, annual_subscription_cost, total_contract_value, customer_address, rep_name, rep_title, customer_contact_name, customer_contact_title, customer_contact_email, customer_contact_phone, period_start_raw, period_end_raw, telkom_contact_name, telkom_contact_title, telkom_contact_email, telkom_contact_phone, payment_description, termin_total_count, termin_total_amount, payment_raw_text, termin_payments_raw, recurring_monthly_amount, recurring_month_count, recurring_total_amount, extraction_timestamp, contract_processing_time_sec, confirmed_by_id, confirmed_at, created_at, updated_at) FROM stdin;
1	2	2	31	2026	11	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 3, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 36.1/810/R1W-A01000000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 21578400}], "informasi_pelanggan": {"alamat": "JL.BLANGBINTANG-KRUENGRAYAKM5ACEHBESAR", "perwakilan": {"nama": "HELFIANDI,S.Pd.,M.Pd", "jabatan": "KEPALASEKOLAH"}, "kontak_person": {"nama": "Helfiandi,S.Pd.,M.Pd", "email": "", "jabatan": "Kepala Sekolah"}, "nama_pelanggan": "SMKN PENERBANGAN ACEH"}, "extraction_timestamp": "2026-01-28T11:49:12.395698", "kontak_person_telkom": {"nama": "Risma Handayani", "email": "risma.handayani@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6285172934286"}, "tata_cara_pembayaran": {"raw_text": "5. TATA CARA PEMBAYARAN Pembayaran dilakukanolehPELANGGANkepada TELKOM secara:Recurring atau Perbulan Valid Yes No 同 2/0/ Nama :T.khain NIK 0r0098： Jabatan: Mbe  Paρe1nf2 the worid in your hand Nama J.LATANAN 2. PELANGGAN", "description": "Pembayaran bulanan terdeteksi ('recurring')", "method_type": "recurring", "total_amount": 0, "termin_payments": [], "total_termin_count": 0}, "processing_time_seconds": 0.01}	1	K.TEL. 36.1/810/R1W-A01000000/2025	SMKN PENERBANGAN ACEH	\N	2026-01-01	2026-12-31	3	0	0	recurring	\N	0.00	21578400.00	21578400.00	JL.BLANGBINTANG-KRUENGRAYAKM5ACEHBESAR	HELFIANDI,S.Pd.,M.Pd	KEPALASEKOLAH	Helfiandi,S.Pd.,M.Pd	Kepala Sekolah	\N	\N	2026-01-01	2026-12-31	Risma Handayani	Account Manager	risma.handayani@telkom.co.id	+6285172934286	Pembayaran bulanan terdeteksi ('recurring')	0	0.00	5. TATA CARA PEMBAYARAN Pembayaran dilakukanolehPELANGGANkepada TELKOM secara:Recurring atau Perbulan Valid Yes No 同 2/0/ Nama :T.khain NIK 0r0098： Jabatan: Mbe  Paρe1nf2 the worid in your hand Nama J.LATANAN 2. PELANGGAN	[]	1798200.00	12	21578400.00	2026-01-28 11:49:12.395698+07	0.01	1	2026-01-28 11:58:29.697815+07	2026-01-28 11:58:29.678473+07	2026-01-28 11:58:29.678473+07
2	1	1	130	2026	1	{"jangka_waktu": {"akhir": "2027-02-23", "mulai": "2026-02-24"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 1, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 020057/HK.820/R1W-A0100000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 20113200}], "informasi_pelanggan": {"npwp": "835461583101000", "alamat": "JI.TGK H.MDAUDBEREUEH,KUTAALAM,BANDA ACEH", "perwakilan": {"nama": "Mufied Alkamal", "jabatan": "PLT Direktur Utama"}, "kontak_person": {"nama": "Dian Rizakanita", "email": "", "jabatan": "Kabag IT", "telepon": "+6281360499630"}, "nama_pelanggan": "PT LKMS MAHIRA MUAMALAH"}, "extraction_timestamp": "2026-01-28T11:48:28.963492", "kontak_person_telkom": {"nama": "Abdi Iqram", "email": "abdi.iqram@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6282251999963"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin (4 periode)", "method_type": "termin", "total_amount": 20113200, "termin_payments": [{"amount": 5028300, "period": "Maret 2026", "raw_text": "Termin-1 Maret 2025 5.028.300.,", "termin_number": 1}, {"amount": 5028300, "period": "Juni 2026", "raw_text": "Termin-2 Juni2025 5.028.300.,", "termin_number": 2}, {"amount": 5028300, "period": "Oktober 2026", "raw_text": "Termin-3 Oktober2025 5.028.300.,", "termin_number": 3}, {"amount": 5028300, "period": "Desember 2026", "raw_text": "Termin-4 Desember2025 5.028.300.,", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.029}	1	K.TEL. 020057/HK.820/R1W-A0100000/2025	PT LKMS MAHIRA MUAMALAH	835461583101000	2026-02-24	2027-02-23	1	0	0	termin	4	0.00	20113200.00	20113200.00	JI.TGK H.MDAUDBEREUEH,KUTAALAM,BANDA ACEH	Mufied Alkamal	PLT Direktur Utama	Dian Rizakanita	Kabag IT	\N	+6281360499630	2026-02-24	2027-02-23	Abdi Iqram	Account Manager	abdi.iqram@telkom.co.id	+6282251999963	Pembayaran termin (4 periode)	4	20113200.00		[{"amount": 5028300, "period": "Maret 2026", "raw_text": "Termin-1 Maret 2025 5.028.300.,", "termin_number": 1}, {"amount": 5028300, "period": "Juni 2026", "raw_text": "Termin-2 Juni2025 5.028.300.,", "termin_number": 2}, {"amount": 5028300, "period": "Oktober 2026", "raw_text": "Termin-3 Oktober2025 5.028.300.,", "termin_number": 3}, {"amount": 5028300, "period": "Desember 2026", "raw_text": "Termin-4 Desember2025 5.028.300.,", "termin_number": 4}]	0.00	\N	0.00	2026-01-28 11:48:28.963492+07	0.029	1	2026-01-28 12:15:58.896766+07	2026-01-28 12:15:58.883057+07	2026-01-28 12:15:58.883057+07
3	5	5	131	2026	11	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 53, "non_connectivity_telkom": 2}, "nomor_kontrak": "K.TEL. 43/HK.810/R1W-0A000000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 861457680}], "informasi_pelanggan": {"alamat": "JL.LAKSAMANAMALAHAYATIKM19DESADURUNGKECMESJIDRAYAACEHBESAR", "perwakilan": {"nama": "Andi Aulia Arikha Setyo", "jabatan": "PEJABAT PEMBUAT KOMITMEN"}, "kontak_person": {"nama": "Andi Aulia Arikha Setyo", "email": "", "jabatan": "PPK"}, "nama_pelanggan": "POLTEKPEL MALAHAYATI ACEH"}, "extraction_timestamp": "2026-01-28T11:51:25.546436", "kontak_person_telkom": {"nama": "Risma Handayani", "email": "risma.handayani@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6285172934286"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin terdeteksi (gagal ekstrak detail)", "method_type": "termin", "total_amount": 861457680, "termin_payments": [{"amount": 215364420, "period": "Februari 2026", "termin_number": 1}, {"amount": 215364420, "period": "April 2026", "termin_number": 2}, {"amount": 215364420, "period": "September 2026", "termin_number": 3}, {"amount": 215364420, "period": "Desember 2026", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.049}	1	K.TEL. 43/HK.810/R1W-0A000000/2025	POLTEKPEL MALAHAYATI ACEH	\N	2026-01-01	2026-12-31	53	2	0	termin	4	0.00	861457680.00	861457680.00	JL.LAKSAMANAMALAHAYATIKM19DESADURUNGKECMESJIDRAYAACEHBESAR	Andi Aulia Arikha Setyo	PEJABAT PEMBUAT KOMITMEN	Andi Aulia Arikha Setyo	PPK	\N	\N	2026-01-01	2026-12-31	Risma Handayani	Account Manager	risma.handayani@telkom.co.id	+6285172934286	Pembayaran termin terdeteksi (gagal ekstrak detail)	4	861457680.00		[{"amount": 215364420, "period": "Februari 2026", "termin_number": 1}, {"amount": 215364420, "period": "April 2026", "termin_number": 2}, {"amount": 215364420, "period": "September 2026", "termin_number": 3}, {"amount": 215364420, "period": "Desember 2026", "termin_number": 4}]	0.00	\N	0.00	2026-01-28 11:51:25.546436+07	0.049	1	2026-01-28 14:31:37.481472+07	2026-01-28 14:31:37.478795+07	2026-01-28 14:31:37.478795+07
5	3	3	133	2025	11	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 1}, "nomor_kontrak": "K.TEL. 01.32/HK.810/R1W-1D100000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 896462640}], "informasi_pelanggan": {"alamat": "JL.MEULABOHTAPAKTUAN,SUAKPUNTONGKABNAGANRAYA", "perwakilan": {"nama": "WANGFANG", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "Gao Xue Feng", "email": "ptmpg@china-cdto.com", "jabatan": "T&M Dept Manager"}, "nama_pelanggan": "PT. MEULABOH POWER GENERATION"}, "extraction_timestamp": "2026-01-28T11:49:51.435089", "kontak_person_telkom": {"nama": "Risma Handayani", "email": "risma.handayani@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6285172934286"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin (4 periode, dengan jadwal bulanan)", "method_type": "termin", "total_amount": 896462640, "termin_payments": [{"amount": 224115660, "period": "Januari 2026", "raw_text": "Auto-generated: Maret 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 1}, {"amount": 224115660, "period": "Juni 2026", "raw_text": "Auto-generated: Juni 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 2}, {"amount": 224115660, "period": "September 2026", "raw_text": "Auto-generated: September 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 3}, {"amount": 224115660, "period": "Desember 2026", "raw_text": "Auto-generated: Desember 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.011}	3	K.TEL. 01.32/HK.810/R1W-1D100000/2025	PT. MEULABOH POWER GENERATION	\N	2026-01-01	2026-12-31	4	1	0	termin	4	0.00	896462640.00	896462640.00	JL.MEULABOHTAPAKTUAN,SUAKPUNTONGKABNAGANRAYA	WANGFANG	DIREKTUR	Gao Xue Feng	T&M Dept Manager	ptmpg@china-cdto.com	\N	2026-01-01	2026-12-31	Risma Handayani	Account Manager	risma.handayani@telkom.co.id	+6285172934286	Pembayaran termin (4 periode, dengan jadwal bulanan)	4	896462640.00		[{"amount": 224115660, "period": "Januari 2026", "raw_text": "Auto-generated: Maret 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 1}, {"amount": 224115660, "period": "Juni 2026", "raw_text": "Auto-generated: Juni 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 2}, {"amount": 224115660, "period": "September 2026", "raw_text": "Auto-generated: September 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 3}, {"amount": 224115660, "period": "Desember 2026", "raw_text": "Auto-generated: Desember 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 4}]	0.00	\N	0.00	2026-01-28 11:49:51.435089+07	0.011	1	2026-01-28 14:46:23.227446+07	2026-01-28 14:46:23.2246+07	2026-01-28 14:48:53.471348+07
4	4	4	132	2025	11	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 2, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 31/HK.810/R1W-A0100000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 224069040}], "informasi_pelanggan": {"alamat": "", "perwakilan": {"nama": "RICKYNELSON", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "Ricky Nelson", "email": "", "jabatan": "Direktur"}, "nama_pelanggan": "PT.MIFABERSAUDARA"}, "extraction_timestamp": "2026-01-28T11:50:35.132938", "kontak_person_telkom": {"nama": "Risma Handayani", "email": "risma.handayani@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6285172934286"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin (4 periode, dengan jadwal bulanan)", "method_type": "termin", "total_amount": 224069040, "termin_payments": [{"amount": 56017260, "period": "Maret 2026", "raw_text": "Auto-generated: Maret 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 1}, {"amount": 56017260, "period": "Juni 2026", "raw_text": "Auto-generated: Juni 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 2}, {"amount": 56017260, "period": "September 2026", "raw_text": "Auto-generated: September 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 3}, {"amount": 56017260, "period": "Desember 2026", "raw_text": "Auto-generated: Desember 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.017}	2	K.TEL. 31/HK.810/R1W-A0100000/2025	PT.MIFABERSAUDARA	\N	2026-01-01	2026-12-31	2	0	0	termin	4	0.00	224069040.00	224069040.00		RICKYNELSON	DIREKTUR	Ricky Nelson	Direktur	\N	\N	2026-01-01	2026-12-31	Risma Handayani	Account Manager	risma.handayani@telkom.co.id	+6285172934286	Pembayaran termin (4 periode, dengan jadwal bulanan)	4	224069040.00		[{"amount": 56017260, "period": "Maret 2026", "raw_text": "Auto-generated: Maret 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 1}, {"amount": 56017260, "period": "Juni 2026", "raw_text": "Auto-generated: Juni 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 2}, {"amount": 56017260, "period": "September 2026", "raw_text": "Auto-generated: September 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 3}, {"amount": 56017260, "period": "Desember 2026", "raw_text": "Auto-generated: Desember 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 4}]	0.00	\N	0.00	2026-01-28 11:50:35.132938+07	0.017	1	2026-01-28 14:42:50.67935+07	2026-01-28 14:42:50.676386+07	2026-01-28 14:47:16.423862+07
6	6	6	112	2026	10	{"jangka_waktu": {"akhir": "2027-09-08", "mulai": "2026-09-09"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 1}, "nomor_kontrak": "K.TEL. 56/HK.810/R1W-1D100000/2024", "rincian_layanan": [{"biaya_instalasi": 666000, "biaya_langganan_tahunan": 40799160}], "informasi_pelanggan": {"npwp": "0012479071010000492", "alamat": "Jl.Taman Siswa No.2,Geulanggang Baro,Kota Juang,Bireuen Regency,Aceh 24252", "perwakilan": {"nama": "M.YUSUF,S.Pd.,M.M", "jabatan": "KEPALASEKOLAHSMKNEGERI1BIREUN"}, "kontak_person": {"nama": "Bakri", "email": "bakribobob@gmail.com", "jabatan": "Bendahara", "telepon": "+6285261168534"}, "nama_pelanggan": "SMKNEGERIIBIREUN"}, "extraction_timestamp": "2026-01-28T14:50:58.741478", "kontak_person_telkom": {"nama": "Mushawir Ahmad Mudarso", "email": "mushawir.ahmad.mudarso@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6281167694378"}, "tata_cara_pembayaran": {"raw_text": "5.TATA CARA PEMBAYARAN One Time Charge TELKOM akanmengirim Official Receipt selambat-lambatnya pada tanggal10 (sepuluh) setiap bulannya ke alamat kontak person PELANGGAN yang dicantumkan dalam Kontrak Berlangganan ini. PELANGGAN harus melakukan pembayaran paling lambat pada tanggal 2O (dua puluh) setiap bulannya (Tanggal Jatuh Tempo) atau sesuai tanggal jatuh tempo yang tercantum di dalam tagihan (invoice) setiap bulannya,dengan cara transfer ke rekening bank TELKOM atau virtual account yang tercantum di dalam tagihan (invoice),kecuali ditentukan lain berdasarkan suatu instrumen tertulis yang diterbitkan oleh TELKOM. Seluruh biaya yang timbul dari dan/atau berhubungan dengan pembayaran tersebut merupakan tanggung jawab PELANGGAN sendiri. Valid Yes No Tgl :3010124 Nama 70101 Page1of7", "description": "One Time Charge terdeteksi ('one time charge')", "method_type": "one_time_charge", "total_amount": 0, "termin_payments": [], "total_termin_count": 0}, "processing_time_seconds": 0.011}	1	K.TEL. 56/HK.810/R1W-1D100000/2024	SMKNEGERIIBIREUN	0012479071010000492	2026-09-09	2027-09-08	4	1	0	one_time	\N	666000.00	40799160.00	41465160.00	Jl.Taman Siswa No.2,Geulanggang Baro,Kota Juang,Bireuen Regency,Aceh 24252	M.YUSUF,S.Pd.,M.M	KEPALASEKOLAHSMKNEGERI1BIREUN	Bakri	Bendahara	bakribobob@gmail.com	+6285261168534	2026-09-09	2027-09-08	Mushawir Ahmad Mudarso	Account Manager	mushawir.ahmad.mudarso@telkom.co.id	+6281167694378	One Time Charge terdeteksi ('one time charge')	0	0.00	5.TATA CARA PEMBAYARAN One Time Charge TELKOM akanmengirim Official Receipt selambat-lambatnya pada tanggal10 (sepuluh) setiap bulannya ke alamat kontak person PELANGGAN yang dicantumkan dalam Kontrak Berlangganan ini. PELANGGAN harus melakukan pembayaran paling lambat pada tanggal 2O (dua puluh) setiap bulannya (Tanggal Jatuh Tempo) atau sesuai tanggal jatuh tempo yang tercantum di dalam tagihan (invoice) setiap bulannya,dengan cara transfer ke rekening bank TELKOM atau virtual account yang tercantum di dalam tagihan (invoice),kecuali ditentukan lain berdasarkan suatu instrumen tertulis yang diterbitkan oleh TELKOM. Seluruh biaya yang timbul dari dan/atau berhubungan dengan pembayaran tersebut merupakan tanggung jawab PELANGGAN sendiri. Valid Yes No Tgl :3010124 Nama 70101 Page1of7	[]	0.00	\N	0.00	2026-01-28 14:50:58.741478+07	0.011	1	2026-01-28 14:54:34.181588+07	2026-01-28 14:54:34.176741+07	2026-01-28 14:54:34.176741+07
8	7	7	21	2025	1	{"jangka_waktu": {"akhir": "2026-12-05", "mulai": "2025-12-06"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 1, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 83/HK.810/R1W-1D100000/2024", "rincian_layanan": [{"biaya_instalasi": 166500, "biaya_langganan_tahunan": 9577080}], "informasi_pelanggan": {"npwp": "751501362101000", "alamat": "JIPNyak Makam,Lambhuk,KotaBanda Aceh", "perwakilan": {"nama": "RUDI YANTO", "jabatan": "FOUNDER"}, "kontak_person": {"nama": "Suharyono", "email": "marketing@klikdata.co.id", "jabatan": "PICIT", "telepon": "+6281210812389"}, "nama_pelanggan": "PT KLIK DATA INDONESIA"}, "extraction_timestamp": "2026-01-28T14:52:17.310066", "kontak_person_telkom": {"nama": "Abdi Iqram", "email": "abdi.iqram@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6282251999963"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran bulanan terdeteksi ('recurring')", "method_type": "recurring", "total_amount": 0, "termin_payments": [], "total_termin_count": 0}, "processing_time_seconds": 0.013}	1	K.TEL. 83/HK.810/R1W-1D100000/2024	PT KLIK DATA INDONESIA	751501362101000	2025-12-06	2026-12-05	1	0	0	recurring	\N	166500.00	9577080.00	9743580.00	JIPNyak Makam,Lambhuk,KotaBanda Aceh	RUDI YANTO	FOUNDER	Suharyono	PICIT	marketing@klikdata.co.id	+6281210812389	2025-12-06	2026-12-05	Abdi Iqram	Account Manager	abdi.iqram@telkom.co.id	+6282251999963	Pembayaran bulanan terdeteksi ('recurring')	0	0.00		[]	798090.00	13	10375170.00	2026-01-28 14:52:17.310066+07	0.013	1	2026-01-29 16:00:14.359257+07	2026-01-29 16:00:14.354245+07	2026-01-29 16:00:14.354245+07
7	8	8	134	2026	6	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 01.34/HK.810/R1W-1D100000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 386280000}], "informasi_pelanggan": {"alamat": "JL.SOEKARNO HATTA KM 2 GAMPONG MIBO BANDA ACEH", "perwakilan": {"nama": "dr.RIZA MULYADI,SpAn-FIPM", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "dr Riza Mulyadi SpAn-FIPM", "email": "ganangsetyohadi@gmail.com", "jabatan": "Direktur", "telepon": "+6285338573726"}, "nama_pelanggan": "RSUD MEURAXA BANDA ACEH"}, "extraction_timestamp": "2026-01-28T14:52:56.836676", "kontak_person_telkom": {"nama": "Muhammad Daniel Yuna", "email": "muhammad.daniel.yuna@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6281399009691"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin (4 periode)", "method_type": "termin", "total_amount": 386280000, "termin_payments": [{"amount": 96570000, "period": "Maret  2026", "raw_text": "Termin-1 Januari2025 - Maret2025 96.570.000,", "termin_number": 1}, {"amount": 96570000, "period": "April 2026", "raw_text": "Termin-2 April2025 - Juni2025 96.570.000,", "termin_number": 2}, {"amount": 96570000, "period": "September 2026", "raw_text": "Termin-3 Juli2025 - September2025 96.570.000", "termin_number": 3}, {"amount": 96570000, "period": "Desember 2026", "raw_text": "Termin-4 Oktober2025 - Desember2025 96.570.000,", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.013}	3	K.TEL. 01.34/HK.810/R1W-1D100000/2025	RSUD MEURAXA BANDA ACEH	\N	2026-01-01	2026-12-31	4	0	0	termin	4	0.00	386280000.00	386280000.00	JL.SOEKARNO HATTA KM 2 GAMPONG MIBO BANDA ACEH	dr.RIZA MULYADI,SpAn-FIPM	DIREKTUR	dr Riza Mulyadi SpAn-FIPM	Direktur	ganangsetyohadi@gmail.com	+6285338573726	2026-01-01	2026-12-31	Muhammad Daniel Yuna	Account Manager	muhammad.daniel.yuna@telkom.co.id	+6281399009691	Pembayaran termin (4 periode)	4	386280000.00		[{"amount": 96570000, "period": "Maret  2026", "raw_text": "Termin-1 Januari2025 - Maret2025 96.570.000,", "termin_number": 1}, {"amount": 96570000, "period": "April 2026", "raw_text": "Termin-2 April2025 - Juni2025 96.570.000,", "termin_number": 2}, {"amount": 96570000, "period": "September 2026", "raw_text": "Termin-3 Juli2025 - September2025 96.570.000", "termin_number": 3}, {"amount": 96570000, "period": "Desember 2026", "raw_text": "Termin-4 Oktober2025 - Desember2025 96.570.000,", "termin_number": 4}]	0.00	\N	0.00	2026-01-28 14:52:56.836676+07	0.013	1	2026-01-28 14:58:10.868476+07	2026-01-28 14:58:10.865517+07	2026-01-29 16:10:05.441066+07
\.


--
-- Data for Name: export_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.export_history (id, contract_id, export_target, export_path, status, notes, exported_at) FROM stdin;
\.


--
-- Data for Name: extraction_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.extraction_logs (id, job_id, level, message, details, created_at) FROM stdin;
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.files (id, original_filename, size_bytes, mime_type, uploaded_at, pdf_path) FROM stdin;
1	KONTRAK-PT-LKMS-MAHIRAH-MUAMALAH-2025-VALIDASI.pdf	797524	application/pdf	2026-01-28 11:46:46.80285+07	storage/uploads/94061891-3508-4b07-bf74-551c55026052_KONTRAK-PT-LKMS-MAHIRAH-MUAMALAH-2025-VALIDASI.pdf
2	KONTRAK SMK PENERBANGAN 2025 VALIDASI.pdf	757137	application/pdf	2026-01-28 11:48:29.013195+07	storage/uploads/edb6a821-9c8f-4cde-ad6e-ff7ba3adc82f_KONTRAK SMK PENERBANGAN 2025 VALIDASI.pdf
3	Kontrak PT MPG 2025.pdf	1414469	application/pdf	2026-01-28 11:49:12.413932+07	storage/uploads/1119f570-1c52-44c5-ab15-8f21055fe9cb_Kontrak PT MPG 2025.pdf
4	KONTRAK PT MIFA BERSAUDARA 2025 VALIDASI.pdf	658316	application/pdf	2026-01-28 11:49:51.449696+07	storage/uploads/b82355be-7869-4d87-9cbb-49fb992686e9_KONTRAK PT MIFA BERSAUDARA 2025 VALIDASI.pdf
5	KONTRAK POLTEKPEL 2025 TTD VALIDASI.pdf	519400	application/pdf	2026-01-28 11:50:35.149832+07	storage/uploads/3d48bb00-4b46-4538-a159-f8feb5dcd448_KONTRAK POLTEKPEL 2025 TTD VALIDASI.pdf
6	KB SMKN 1 BIREUN TTD 2024 VALIDASI.pdf	1778382	application/pdf	2026-01-28 14:49:30.219499+07	storage/uploads/85f98e2d-eb28-4351-b216-4276591bffbe_KB SMKN 1 BIREUN TTD 2024 VALIDASI.pdf
7	KONTRAK PT. KLIK DATA INDONESIA 2025 VALIDASI.pdf	725966	application/pdf	2026-01-28 14:50:58.807424+07	storage/uploads/c28e2039-9881-47d8-9adc-8285249b99b5_KONTRAK PT. KLIK DATA INDONESIA 2025 VALIDASI.pdf
8	KONTRAK RSU MEURAXA 2025 VALIDASI.pdf	717688	application/pdf	2026-01-28 14:52:17.32379+07	storage/uploads/ac545a92-f458-45e9-9de9-cb8b70e87ac9_KONTRAK RSU MEURAXA 2025 VALIDASI.pdf
\.


--
-- Data for Name: invoice_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoice_documents (id, invoice_type, term_payment_id, recurring_payment_id, payment_transaction_id, document_type, file_name, file_path, file_size, mime_type, uploaded_by_id, uploaded_at, notes) FROM stdin;
1	TERM	13	\N	1	BUPOT_PPH23	Latomstore _ Top Up Game Termurah.pdf	storage/invoices/term/13/64681ea4_Latomstore _ Top Up Game Termurah.pdf	41513	application/pdf	1	2026-01-28 15:08:29.732898+07	\N
\.


--
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_transactions (id, invoice_type, term_payment_id, recurring_payment_id, payment_date, amount, payment_method, reference_number, ppn_included, pph23_included, notes, created_by_id, created_at, updated_at) FROM stdin;
1	TERM	13	\N	2026-01-28 00:00:00+07	200000000.00	TRANSFER	TRF123	t	f	\N	1	2026-01-28 15:07:11.050453+07	2026-01-28 15:07:11.050453+07
2	TERM	13	\N	2026-01-28 00:00:00+07	20077540.00	CASH	TRF123	t	f	\N	1	2026-01-28 15:07:40.943844+07	2026-01-28 15:07:40.943844+07
\.


--
-- Data for Name: processing_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.processing_jobs (id, file_id, status, extracted_data, edited_data, ocr_artifacts, error_message, processing_started_at, processing_completed_at, processing_time_seconds, created_at, updated_at, reviewed_by_id, reviewed_at) FROM stdin;
1	1	CONFIRMED	{"jangka_waktu": {"akhir": "2027-02-23", "mulai": "2025-02-24"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 0, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 020057/HK.820/R1W-A0100000/2025 Nomor ID Pelanggan K.TEL.1286/HK.820/R1W-1D1J0000/2025", "rincian_layanan": [{"biaya_instalasi": 0.0, "tata_cara_pembayaran": null, "biaya_langganan_tahunan": 20113200.0}], "informasi_pelanggan": {"npwp": "83.546.158.3-101.000", "alamat": "JI.TGK H.MDAUDBEREUEH,KUTAALAM,BANDA ACEH", "perwakilan": {"nama": null, "jabatan": "NIK"}, "kontak_person": {"nama": "Dian Rizakanita", "email": null, "jabatan": "Kabag IT", "telepon": "0813-6049-9630"}, "nama_pelanggan": "PTLKMSMAHIRAMUAMALAH"}, "extraction_timestamp": "2026-01-28T11:48:28.963492", "kontak_person_telkom": {"nama": "Abdi Iqram", "email": "406090@telkom.co.id", "jabatan": "Account Manager", "telepon": "0822-7373-3914"}, "tata_cara_pembayaran": {"raw_text": null, "description": "Pembayaran termin (4 periode)", "method_type": "termin", "total_amount": 20113200.0, "termin_payments": [{"amount": 5028300.0, "period": "Maret 2025", "raw_text": "Termin-1 Maret 2025 5.028.300.,", "termin_number": 1}, {"amount": 5028300.0, "period": "Juni2025", "raw_text": "Termin-2 Juni2025 5.028.300.,", "termin_number": 2}, {"amount": 5028300.0, "period": "Oktober2025", "raw_text": "Termin-3 Oktober2025 5.028.300.,", "termin_number": 3}, {"amount": 5028300.0, "period": "Desember2025", "raw_text": "Termin-4 Desember2025 5.028.300.,", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.029}	{"jangka_waktu": {"akhir": "2027-02-23", "mulai": "2026-02-24"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 1, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 020057/HK.820/R1W-A0100000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 20113200}], "informasi_pelanggan": {"npwp": "835461583101000", "alamat": "JI.TGK H.MDAUDBEREUEH,KUTAALAM,BANDA ACEH", "perwakilan": {"nama": "Mufied Alkamal", "jabatan": "PLT Direktur Utama"}, "kontak_person": {"nama": "Dian Rizakanita", "email": "", "jabatan": "Kabag IT", "telepon": "+6281360499630"}, "nama_pelanggan": "PT LKMS MAHIRA MUAMALAH"}, "extraction_timestamp": "2026-01-28T11:48:28.963492", "kontak_person_telkom": {"nama": "Abdi Iqram", "email": "abdi.iqram@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6282251999963"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin (4 periode)", "method_type": "termin", "total_amount": 20113200, "termin_payments": [{"amount": 5028300, "period": "Maret 2026", "raw_text": "Termin-1 Maret 2025 5.028.300.,", "termin_number": 1}, {"amount": 5028300, "period": "Juni 2026", "raw_text": "Termin-2 Juni2025 5.028.300.,", "termin_number": 2}, {"amount": 5028300, "period": "Oktober 2026", "raw_text": "Termin-3 Oktober2025 5.028.300.,", "termin_number": 3}, {"amount": 5028300, "period": "Desember 2026", "raw_text": "Termin-4 Desember2025 5.028.300.,", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.029}	{"page_1": "storage/ocr_outputs/1_ocr_results/page_1_results/page_1_res.json", "page_2": "storage/ocr_outputs/1_ocr_results/page_2_results/page_2_res.json"}	\N	2026-01-28 11:46:46.837338+07	2026-01-28 11:48:28.973702+07	102.136364	2026-01-28 11:46:46.81308+07	2026-01-28 12:15:58.915506+07	1	2026-01-28 12:15:58.9155+07
2	2	CONFIRMED	{"jangka_waktu": {"akhir": "2025-12-31", "mulai": "2025-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 3, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 36.1/810/R1W-A01000000/2025", "rincian_layanan": [{"biaya_instalasi": 0.0, "tata_cara_pembayaran": null, "biaya_langganan_tahunan": 21578400.0}], "informasi_pelanggan": {"npwp": null, "alamat": "JL.BLANGBINTANG-KRUENGRAYAKM5ACEHBESAR", "perwakilan": {"nama": "HELFIANDI,S.Pd.,M.Pd", "jabatan": "KEPALASEKOLAH"}, "kontak_person": {"nama": "Helfiandi,S.Pd.,M.Pd", "email": null, "jabatan": "Kepala Sekolah", "telepon": null}, "nama_pelanggan": "SMKNPENERBANGANACEH"}, "extraction_timestamp": "2026-01-28T11:49:12.395698", "kontak_person_telkom": {"nama": "Risma Handayani, M.Si", "email": "403072@telkom.co.id", "jabatan": "Account Manager", "telepon": "0852-6002-7954"}, "tata_cara_pembayaran": {"raw_text": "5. TATA CARA PEMBAYARAN Pembayaran dilakukanolehPELANGGANkepada TELKOM secara:Recurring atau Perbulan Valid Yes No 同 2/0/ Nama :T.khain NIK 0r0098： Jabatan: Mbe  Paρe1nf2 the worid in your hand Nama J.LATANAN 2. PELANGGAN", "description": "Pembayaran bulanan terdeteksi ('recurring')", "method_type": "recurring", "total_amount": null, "termin_payments": null, "total_termin_count": null}, "processing_time_seconds": 0.01}	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 3, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 36.1/810/R1W-A01000000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 21578400}], "informasi_pelanggan": {"alamat": "JL.BLANGBINTANG-KRUENGRAYAKM5ACEHBESAR", "perwakilan": {"nama": "HELFIANDI,S.Pd.,M.Pd", "jabatan": "KEPALASEKOLAH"}, "kontak_person": {"nama": "Helfiandi,S.Pd.,M.Pd", "email": "", "jabatan": "Kepala Sekolah"}, "nama_pelanggan": "SMKN PENERBANGAN ACEH"}, "extraction_timestamp": "2026-01-28T11:49:12.395698", "kontak_person_telkom": {"nama": "Risma Handayani", "email": "risma.handayani@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6285172934286"}, "tata_cara_pembayaran": {"raw_text": "5. TATA CARA PEMBAYARAN Pembayaran dilakukanolehPELANGGANkepada TELKOM secara:Recurring atau Perbulan Valid Yes No 同 2/0/ Nama :T.khain NIK 0r0098： Jabatan: Mbe  Paρe1nf2 the worid in your hand Nama J.LATANAN 2. PELANGGAN", "description": "Pembayaran bulanan terdeteksi ('recurring')", "method_type": "recurring", "total_amount": 0, "termin_payments": [], "total_termin_count": 0}, "processing_time_seconds": 0.01}	{"page_1": "storage/ocr_outputs/2_ocr_results/page_1_results/page_1_res.json", "page_2": "storage/ocr_outputs/2_ocr_results/page_2_results/page_2_res.json"}	\N	2026-01-28 11:48:29.043627+07	2026-01-28 11:49:12.400467+07	43.35684	2026-01-28 11:48:29.033448+07	2026-01-28 11:58:29.722517+07	1	2026-01-28 11:58:29.722511+07
3	3	CONFIRMED	{"jangka_waktu": {"akhir": "2025-12-31", "mulai": "2025-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 1}, "nomor_kontrak": "K.TEL. 01.32/HK.810/R1W-1D100000/2025", "rincian_layanan": [{"biaya_instalasi": 0.0, "tata_cara_pembayaran": null, "biaya_langganan_tahunan": 896462640.0}], "informasi_pelanggan": {"npwp": null, "alamat": "JL.MEULABOHTAPAKTUAN,SUAKPUNTONGKABNAGANRAYA", "perwakilan": {"nama": "WANGFANG", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "Gao Xue Feng", "email": "ptmpg@china-cdto.com", "jabatan": "T&M Dept Manager", "telepon": null}, "nama_pelanggan": "PT.MEULABOHPOWER GENERATION"}, "extraction_timestamp": "2026-01-28T11:49:51.435089", "kontak_person_telkom": {"nama": "RismaHandayani,M.Si", "email": "403072@telkom.co.id", "jabatan": "Account Manager", "telepon": "0852-6002-7954"}, "tata_cara_pembayaran": {"raw_text": null, "description": "Pembayaran termin (4 periode, dengan jadwal bulanan)", "method_type": "termin", "total_amount": 896462640.0, "termin_payments": [{"amount": 224115660.0, "period": "Maret 2025", "raw_text": "Auto-generated: Maret 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 1}, {"amount": 224115660.0, "period": "Juni 2025", "raw_text": "Auto-generated: Juni 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 2}, {"amount": 224115660.0, "period": "September 2025", "raw_text": "Auto-generated: September 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 3}, {"amount": 224115660.0, "period": "Desember 2025", "raw_text": "Auto-generated: Desember 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.011}	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 1}, "nomor_kontrak": "K.TEL. 01.32/HK.810/R1W-1D100000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 896462640}], "informasi_pelanggan": {"alamat": "JL.MEULABOHTAPAKTUAN,SUAKPUNTONGKABNAGANRAYA", "perwakilan": {"nama": "WANGFANG", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "Gao Xue Feng", "email": "ptmpg@china-cdto.com", "jabatan": "T&M Dept Manager"}, "nama_pelanggan": "PT. MEULABOH POWER GENERATION"}, "extraction_timestamp": "2026-01-28T11:49:51.435089", "kontak_person_telkom": {"nama": "Risma Handayani", "email": "risma.handayani@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6285172934286"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin (4 periode, dengan jadwal bulanan)", "method_type": "termin", "total_amount": 896462640, "termin_payments": [{"amount": 224115660, "period": "Maret 2025", "raw_text": "Auto-generated: Maret 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 1}, {"amount": 224115660, "period": "Juni 2025", "raw_text": "Auto-generated: Juni 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 2}, {"amount": 224115660, "period": "September 2025", "raw_text": "Auto-generated: September 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 3}, {"amount": 224115660, "period": "Desember 2025", "raw_text": "Auto-generated: Desember 2025, dibagi rata dari total Rp 896,462,640", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.011}	{"page_1": "storage/ocr_outputs/3_ocr_results/page_1_results/page_1_res.json", "page_2": "storage/ocr_outputs/3_ocr_results/page_2_results/page_2_res.json"}	\N	2026-01-28 11:49:12.431808+07	2026-01-28 11:49:51.44118+07	39.009372	2026-01-28 11:49:12.42222+07	2026-01-28 14:46:23.236518+07	1	2026-01-28 14:46:23.236512+07
5	5	CONFIRMED	{"jangka_waktu": {"akhir": null, "mulai": null}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 53, "non_connectivity_telkom": 2}, "nomor_kontrak": "K.TEL. 43/HK.810/R1W-0A000000/2025", "rincian_layanan": [{"biaya_instalasi": 861457.68, "tata_cara_pembayaran": null, "biaya_langganan_tahunan": 0.0}], "informasi_pelanggan": {"npwp": "Alamat JL.LAKSAMANAMALAHAYATIKM19DESADURUNGKECMESJIDRAYAACEHBESAR", "alamat": "JL.LAKSAMANAMALAHAYATIKM19DESADURUNGKECMESJIDRAYAACEHBESAR", "perwakilan": {"nama": "3.LAYANAN", "jabatan": "batan"}, "kontak_person": {"nama": "Andi Aulia Arikha Setyo", "email": null, "jabatan": "PPK", "telepon": null}, "nama_pelanggan": "POLTEKPELMALAHAYATIACEH"}, "extraction_timestamp": "2026-01-28T11:51:25.546436", "kontak_person_telkom": {"nama": "Risma Handayani, M.Si", "email": "403072@telkom.co.id", "jabatan": "Account Manager", "telepon": "0852-6002-7954"}, "tata_cara_pembayaran": {"raw_text": null, "description": "Pembayaran termin terdeteksi (gagal ekstrak detail)", "method_type": "termin", "total_amount": null, "termin_payments": null, "total_termin_count": null}, "processing_time_seconds": 0.049}	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 53, "non_connectivity_telkom": 2}, "nomor_kontrak": "K.TEL. 43/HK.810/R1W-0A000000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 861457680}], "informasi_pelanggan": {"alamat": "JL.LAKSAMANAMALAHAYATIKM19DESADURUNGKECMESJIDRAYAACEHBESAR", "perwakilan": {"nama": "Andi Aulia Arikha Setyo", "jabatan": "PEJABAT PEMBUAT KOMITMEN"}, "kontak_person": {"nama": "Andi Aulia Arikha Setyo", "email": "", "jabatan": "PPK"}, "nama_pelanggan": "POLTEKPEL MALAHAYATI ACEH"}, "extraction_timestamp": "2026-01-28T11:51:25.546436", "kontak_person_telkom": {"nama": "Risma Handayani", "email": "risma.handayani@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6285172934286"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin terdeteksi (gagal ekstrak detail)", "method_type": "termin", "total_amount": 861457680, "termin_payments": [{"amount": 215364420, "period": "Februari 2026", "termin_number": 1}, {"amount": 215364420, "period": "April 2026", "termin_number": 2}, {"amount": 215364420, "period": "September 2026", "termin_number": 3}, {"amount": 215364420, "period": "Desember 2026", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.049}	{"page_1": "storage/ocr_outputs/5_ocr_results/page_1_results/page_1_res.json", "page_2": "storage/ocr_outputs/5_ocr_results/page_2_results/page_2_res.json"}	\N	2026-01-28 11:50:35.16191+07	2026-01-28 11:51:25.55877+07	50.39686	2026-01-28 11:50:35.1559+07	2026-01-28 14:31:37.487911+07	1	2026-01-28 14:31:37.487907+07
4	4	CONFIRMED	{"jangka_waktu": {"akhir": "2025-12-31", "mulai": "2025-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 2, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 31/HK.810/R1W-A0100000/2025", "rincian_layanan": [{"biaya_instalasi": 0.0, "tata_cara_pembayaran": null, "biaya_langganan_tahunan": 224069040.0}], "informasi_pelanggan": {"npwp": "MEULABOH", "alamat": "ARTIARCNAAEAARGCRANAARAAAABARARIER", "perwakilan": {"nama": "RICKYNELSON", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "PELANGGAN", "email": null, "jabatan": "Direktur", "telepon": null}, "nama_pelanggan": "PT.MIFABERSAUDARA"}, "extraction_timestamp": "2026-01-28T11:50:35.132938", "kontak_person_telkom": {"nama": null, "email": "403072@telkom.co.id", "jabatan": "Account Manager", "telepon": "0852-6002-7954"}, "tata_cara_pembayaran": {"raw_text": null, "description": "Pembayaran termin (4 periode, dengan jadwal bulanan)", "method_type": "termin", "total_amount": 224069040.0, "termin_payments": [{"amount": 56017260.0, "period": "Maret 2025", "raw_text": "Auto-generated: Maret 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 1}, {"amount": 56017260.0, "period": "Juni 2025", "raw_text": "Auto-generated: Juni 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 2}, {"amount": 56017260.0, "period": "September 2025", "raw_text": "Auto-generated: September 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 3}, {"amount": 56017260.0, "period": "Desember 2025", "raw_text": "Auto-generated: Desember 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.017}	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 2, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 31/HK.810/R1W-A0100000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 224069040}], "informasi_pelanggan": {"alamat": "", "perwakilan": {"nama": "RICKYNELSON", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "Ricky Nelson", "email": "", "jabatan": "Direktur"}, "nama_pelanggan": "PT.MIFABERSAUDARA"}, "extraction_timestamp": "2026-01-28T11:50:35.132938", "kontak_person_telkom": {"nama": "Risma Handayani", "email": "risma.handayani@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6285172934286"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin (4 periode, dengan jadwal bulanan)", "method_type": "termin", "total_amount": 224069040, "termin_payments": [{"amount": 56017260, "period": "Maret 2025", "raw_text": "Auto-generated: Maret 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 1}, {"amount": 56017260, "period": "Juni 2025", "raw_text": "Auto-generated: Juni 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 2}, {"amount": 56017260, "period": "September 2025", "raw_text": "Auto-generated: September 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 3}, {"amount": 56017260, "period": "Desember 2025", "raw_text": "Auto-generated: Desember 2025, dibagi rata dari total Rp 224,069,040", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.017}	{"page_1": "storage/ocr_outputs/4_ocr_results/page_1_results/page_1_res.json", "page_2": "storage/ocr_outputs/4_ocr_results/page_2_results/page_2_res.json"}	\N	2026-01-28 11:49:51.464855+07	2026-01-28 11:50:35.141948+07	43.677093	2026-01-28 11:49:51.456792+07	2026-01-28 14:42:50.686307+07	1	2026-01-28 14:42:50.686301+07
8	8	CONFIRMED	{"jangka_waktu": {"akhir": "2025-12-31", "mulai": "2025-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 01.34/HK.810/R1W-1D100000/2025", "rincian_layanan": [{"biaya_instalasi": 0.0, "tata_cara_pembayaran": null, "biaya_langganan_tahunan": 386280000.0}], "informasi_pelanggan": {"npwp": "Nama:T.Khair", "alamat": "JL.SOEKARNOHATTAKM2GAMPONGMIBOBANDAACEH", "perwakilan": {"nama": "dr.RIZA MULYADI,SpAn-FIPM", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "dr Riza Mulyadi SpAn-FIPM", "email": null, "jabatan": "Direktur", "telepon": null}, "nama_pelanggan": "RSUD MEURAXABANDA ACEH"}, "extraction_timestamp": "2026-01-28T14:52:56.836676", "kontak_person_telkom": {"nama": "Risma Handayani,M.Si", "email": "403072@telkom.co.id", "jabatan": "Account Manager", "telepon": "0852-6002-7954"}, "tata_cara_pembayaran": {"raw_text": null, "description": "Pembayaran termin (4 periode)", "method_type": "termin", "total_amount": 386280000.0, "termin_payments": [{"amount": 96570000.0, "period": "Januari2025 - Maret2025", "raw_text": "Termin-1 Januari2025 - Maret2025 96.570.000,", "termin_number": 1}, {"amount": 96570000.0, "period": "April2025 - Juni2025", "raw_text": "Termin-2 April2025 - Juni2025 96.570.000,", "termin_number": 2}, {"amount": 96570000.0, "period": "Juli2025 - September2025", "raw_text": "Termin-3 Juli2025 - September2025 96.570.000", "termin_number": 3}, {"amount": 96570000.0, "period": "Oktober2025 - Desember2025", "raw_text": "Termin-4 Oktober2025 - Desember2025 96.570.000,", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.013}	{"jangka_waktu": {"akhir": "2026-12-31", "mulai": "2026-01-01"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 01.34/HK.810/R1W-1D100000/2025", "rincian_layanan": [{"biaya_instalasi": 0, "biaya_langganan_tahunan": 386280000}], "informasi_pelanggan": {"alamat": "JL.SOEKARNO HATTA KM 2 GAMPONG MIBO BANDA ACEH", "perwakilan": {"nama": "dr.RIZA MULYADI,SpAn-FIPM", "jabatan": "DIREKTUR"}, "kontak_person": {"nama": "dr Riza Mulyadi SpAn-FIPM", "email": "", "jabatan": "Direktur"}, "nama_pelanggan": "RSUD MEURAXA BANDA ACEH"}, "extraction_timestamp": "2026-01-28T14:52:56.836676", "kontak_person_telkom": {"nama": "Muhammad Daniel Yuna", "email": "muhammad.daniel.yuna@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6281399009691"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran termin (4 periode)", "method_type": "termin", "total_amount": 386280000, "termin_payments": [{"amount": 96570000, "period": "Maret  2026", "raw_text": "Termin-1 Januari2025 - Maret2025 96.570.000,", "termin_number": 1}, {"amount": 96570000, "period": "April 2026", "raw_text": "Termin-2 April2025 - Juni2025 96.570.000,", "termin_number": 2}, {"amount": 96570000, "period": "September 2026", "raw_text": "Termin-3 Juli2025 - September2025 96.570.000", "termin_number": 3}, {"amount": 96570000, "period": "Desember 2026", "raw_text": "Termin-4 Oktober2025 - Desember2025 96.570.000,", "termin_number": 4}], "total_termin_count": 4}, "processing_time_seconds": 0.013}	{"page_1": "storage/ocr_outputs/8_ocr_results/page_1_results/page_1_res.json", "page_2": "storage/ocr_outputs/8_ocr_results/page_2_results/page_2_res.json"}	\N	2026-01-28 14:52:17.340693+07	2026-01-28 14:52:56.844139+07	39.503446	2026-01-28 14:52:17.331363+07	2026-01-28 14:58:10.879039+07	1	2026-01-28 14:58:10.879034+07
6	6	CONFIRMED	{"jangka_waktu": {"akhir": "2025-09-08", "mulai": "2024-09-09"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 1}, "nomor_kontrak": "K.TEL. 56/HK.810/R1W-1D100000/2024", "rincian_layanan": [{"biaya_instalasi": 666000.0, "tata_cara_pembayaran": null, "biaya_langganan_tahunan": 40799160.0}], "informasi_pelanggan": {"npwp": "00.124.790.7-101.000.0492", "alamat": "Jl.Taman Siswa No.2,Geulanggang Baro,Kota Juang,Bireuen Regency,Aceh 24252", "perwakilan": {"nama": "M.YUSUF,S.Pd.,M.M", "jabatan": "KEPALASEKOLAHSMKNEGERI1BIREUN"}, "kontak_person": {"nama": "Bakri", "email": "bakribobob@gmail.com", "jabatan": "Bendahara", "telepon": "+62852-6116-8534"}, "nama_pelanggan": "SMKNEGERIIBIREUN"}, "extraction_timestamp": "2026-01-28T14:50:58.741478", "kontak_person_telkom": {"nama": "rerre", "email": "403669@telkom.co.id", "jabatan": "Account Manager", "telepon": "0822-7408-0203"}, "tata_cara_pembayaran": {"raw_text": "5.TATA CARA PEMBAYARAN One Time Charge TELKOM akanmengirim Official Receipt selambat-lambatnya pada tanggal10 (sepuluh) setiap bulannya ke alamat kontak person PELANGGAN yang dicantumkan dalam Kontrak Berlangganan ini. PELANGGAN harus melakukan pembayaran paling lambat pada tanggal 2O (dua puluh) setiap bulannya (Tanggal Jatuh Tempo) atau sesuai tanggal jatuh tempo yang tercantum di dalam tagihan (invoice) setiap bulannya,dengan cara transfer ke rekening bank TELKOM atau virtual account yang tercantum di dalam tagihan (invoice),kecuali ditentukan lain berdasarkan suatu instrumen tertulis yang diterbitkan oleh TELKOM. Seluruh biaya yang timbul dari dan/atau berhubungan dengan pembayaran tersebut merupakan tanggung jawab PELANGGAN sendiri. Valid Yes No Tgl :3010124 Nama 70101 Page1of7", "description": "One Time Charge terdeteksi ('one time charge')", "method_type": "one_time_charge", "total_amount": null, "termin_payments": null, "total_termin_count": null}, "processing_time_seconds": 0.011}	{"jangka_waktu": {"akhir": "2027-09-08", "mulai": "2026-09-09"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 4, "non_connectivity_telkom": 1}, "nomor_kontrak": "K.TEL. 56/HK.810/R1W-1D100000/2024", "rincian_layanan": [{"biaya_instalasi": 666000, "biaya_langganan_tahunan": 40799160}], "informasi_pelanggan": {"npwp": "0012479071010000492", "alamat": "Jl.Taman Siswa No.2,Geulanggang Baro,Kota Juang,Bireuen Regency,Aceh 24252", "perwakilan": {"nama": "M.YUSUF,S.Pd.,M.M", "jabatan": "KEPALASEKOLAHSMKNEGERI1BIREUN"}, "kontak_person": {"nama": "Bakri", "email": "bakribobob@gmail.com", "jabatan": "Bendahara", "telepon": "+6285261168534"}, "nama_pelanggan": "SMKNEGERIIBIREUN"}, "extraction_timestamp": "2026-01-28T14:50:58.741478", "kontak_person_telkom": {"nama": "Mushawir Ahmad Mudarso", "email": "mushawir.ahmad.mudarso@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6281167694378"}, "tata_cara_pembayaran": {"raw_text": "5.TATA CARA PEMBAYARAN One Time Charge TELKOM akanmengirim Official Receipt selambat-lambatnya pada tanggal10 (sepuluh) setiap bulannya ke alamat kontak person PELANGGAN yang dicantumkan dalam Kontrak Berlangganan ini. PELANGGAN harus melakukan pembayaran paling lambat pada tanggal 2O (dua puluh) setiap bulannya (Tanggal Jatuh Tempo) atau sesuai tanggal jatuh tempo yang tercantum di dalam tagihan (invoice) setiap bulannya,dengan cara transfer ke rekening bank TELKOM atau virtual account yang tercantum di dalam tagihan (invoice),kecuali ditentukan lain berdasarkan suatu instrumen tertulis yang diterbitkan oleh TELKOM. Seluruh biaya yang timbul dari dan/atau berhubungan dengan pembayaran tersebut merupakan tanggung jawab PELANGGAN sendiri. Valid Yes No Tgl :3010124 Nama 70101 Page1of7", "description": "One Time Charge terdeteksi ('one time charge')", "method_type": "one_time_charge", "total_amount": 0, "termin_payments": [], "total_termin_count": 0}, "processing_time_seconds": 0.011}	{"page_1": "storage/ocr_outputs/6_ocr_results/page_1_results/page_1_res.json", "page_2": "storage/ocr_outputs/6_ocr_results/page_2_results/page_2_res.json"}	\N	2026-01-28 14:49:30.323409+07	2026-01-28 14:50:58.757683+07	88.434274	2026-01-28 14:49:30.24073+07	2026-01-28 14:54:34.187158+07	1	2026-01-28 14:54:34.187151+07
7	7	CONFIRMED	{"jangka_waktu": {"akhir": "2025-12-05", "mulai": "2024-12-06"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 0, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 83/HK.810/R1W-1D100000/2024", "rincian_layanan": [{"biaya_instalasi": 166500.0, "tata_cara_pembayaran": null, "biaya_langganan_tahunan": 9577080.0}], "informasi_pelanggan": {"npwp": "75.150.136.2-101.000", "alamat": "JIPNyak Makam,Lambhuk,KotaBanda Aceh", "perwakilan": {"nama": "RUDI YANTO", "jabatan": "FOUNDER"}, "kontak_person": {"nama": null, "email": "marketing@klikdata.co.id", "jabatan": "PICIT", "telepon": "0812-1081-2389"}, "nama_pelanggan": "PTKLIKDATAINDONESIA"}, "extraction_timestamp": "2026-01-28T14:52:17.310066", "kontak_person_telkom": {"nama": "Abdi iqram", "email": "406090@telkom.co.id", "jabatan": "Account Manager", "telepon": "0822-7373-3914"}, "tata_cara_pembayaran": {"raw_text": null, "description": "Pembayaran bulanan terdeteksi ('recurring')", "method_type": "recurring", "total_amount": null, "termin_payments": null, "total_termin_count": null}, "processing_time_seconds": 0.013}	{"jangka_waktu": {"akhir": "2026-12-05", "mulai": "2025-12-06"}, "layanan_utama": {"bundling": 0, "connectivity_telkom": 1, "non_connectivity_telkom": 0}, "nomor_kontrak": "K.TEL. 83/HK.810/R1W-1D100000/2024", "rincian_layanan": [{"biaya_instalasi": 166500, "biaya_langganan_tahunan": 9577080}], "informasi_pelanggan": {"npwp": "751501362101000", "alamat": "JIPNyak Makam,Lambhuk,KotaBanda Aceh", "perwakilan": {"nama": "RUDI YANTO", "jabatan": "FOUNDER"}, "kontak_person": {"nama": "Suharyono", "email": "marketing@klikdata.co.id", "jabatan": "PICIT", "telepon": "+6281210812389"}, "nama_pelanggan": "PT KLIK DATA INDONESIA"}, "extraction_timestamp": "2026-01-28T14:52:17.310066", "kontak_person_telkom": {"nama": "Abdi Iqram", "email": "abdi.iqram@telkom.co.id", "jabatan": "Account Manager", "telepon": "+6282251999963"}, "tata_cara_pembayaran": {"raw_text": "", "description": "Pembayaran bulanan terdeteksi ('recurring')", "method_type": "recurring", "total_amount": 0, "termin_payments": [], "total_termin_count": 0}, "processing_time_seconds": 0.013}	{"page_1": "storage/ocr_outputs/7_ocr_results/page_1_results/page_1_res.json", "page_2": "storage/ocr_outputs/7_ocr_results/page_2_results/page_2_res.json"}	\N	2026-01-28 14:50:58.833062+07	2026-01-28 14:52:17.314715+07	78.481653	2026-01-28 14:50:58.821166+07	2026-01-29 16:00:14.387353+07	1	2026-01-29 16:00:14.387345+07
\.


--
-- Data for Name: segments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.segments (id, name, code, is_active, created_at, updated_at) FROM stdin;
1	B2B TREG	B2B_TREG	t	2026-01-28 11:23:09.603005+07	2026-01-28 11:23:09.603005+07
2	Financial & Regional Banking	FIN_BANK	t	2026-01-28 11:23:09.603005+07	2026-01-28 11:23:09.603005+07
3	Financial & Welfare	FIN_WELF	t	2026-01-28 11:23:09.603005+07	2026-01-28 11:23:09.603005+07
4	Manufacturing & Infrastructure	MFG_INFRA	t	2026-01-28 11:23:09.603005+07	2026-01-28 11:23:09.603005+07
5	Regional 1	REG1	t	2026-01-28 11:23:09.603005+07	2026-01-28 11:23:09.603005+07
6	Tourism & Welfare	TOUR_WELF	t	2026-01-28 11:23:09.603005+07	2026-01-28 11:23:09.603005+07
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, email, password_hash, full_name, role, is_active, created_at, updated_at, last_login_at) FROM stdin;
2	bangaldo	bangaldo@gmail.com	$2b$12$ImCDbTYj1RaQuqWhb2JfvuOIzE1nwNdLtw1WN5BdDXy1OyStJyDda	Bang Aldo	STAFF	t	2026-01-28 11:17:06.250123+07	2026-01-28 11:17:06.250123+07	\N
3	kakdeci	kakdeci@gmail.com	$2b$12$E7UC0rNl8Uq5Hi48BycI9uZQJHmw1IS.6S6nMbKrNMXpadDMxEX0K	Kak Deci	STAFF	t	2026-01-28 11:17:29.794259+07	2026-01-28 11:17:29.794259+07	\N
1	paycol	paycol@telkom.co.id	$2b$12$thJa.qEmCz3J2Xz6OKCYa.YXUl7AP71N.gb8LxW3PVJcj6l1AeT8m	Ganang Setyo Hadi	MANAGER	t	2026-01-28 11:15:24.294483+07	2026-01-29 17:06:34.009518+07	2026-01-29 17:06:34.246329+07
\.


--
-- Data for Name: witels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.witels (id, code, name, is_active, created_at, updated_at) FROM stdin;
1	901	Aceh	t	2026-01-28 11:20:16.967077+07	2026-01-28 11:20:16.967077+07
\.


--
-- Name: account_managers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_managers_id_seq', 13, true);


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.accounts_id_seq', 134, true);


--
-- Name: contract_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contract_contacts_id_seq', 2, true);


--
-- Name: contract_recurring_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contract_recurring_payments_id_seq', 24, true);


--
-- Name: contract_term_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contract_term_payments_id_seq', 20, true);


--
-- Name: contracts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contracts_id_seq', 8, true);


--
-- Name: export_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.export_history_id_seq', 1, false);


--
-- Name: extraction_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.extraction_logs_id_seq', 1, false);


--
-- Name: files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.files_id_seq', 8, true);


--
-- Name: invoice_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.invoice_documents_id_seq', 1, true);


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_transactions_id_seq', 2, true);


--
-- Name: processing_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.processing_jobs_id_seq', 8, true);


--
-- Name: segments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.segments_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: witels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.witels_id_seq', 1, true);


--
-- Name: account_managers account_managers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_managers
    ADD CONSTRAINT account_managers_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: contract_contacts contract_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_contacts
    ADD CONSTRAINT contract_contacts_pkey PRIMARY KEY (id);


--
-- Name: contract_recurring_payments contract_recurring_payments_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_recurring_payments
    ADD CONSTRAINT contract_recurring_payments_invoice_number_key UNIQUE (invoice_number);


--
-- Name: contract_recurring_payments contract_recurring_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_recurring_payments
    ADD CONSTRAINT contract_recurring_payments_pkey PRIMARY KEY (id);


--
-- Name: contract_term_payments contract_term_payments_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_term_payments
    ADD CONSTRAINT contract_term_payments_invoice_number_key UNIQUE (invoice_number);


--
-- Name: contract_term_payments contract_term_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_term_payments
    ADD CONSTRAINT contract_term_payments_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: export_history export_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_history
    ADD CONSTRAINT export_history_pkey PRIMARY KEY (id);


--
-- Name: extraction_logs extraction_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_logs
    ADD CONSTRAINT extraction_logs_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: invoice_documents invoice_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_documents
    ADD CONSTRAINT invoice_documents_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: processing_jobs processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_pkey PRIMARY KEY (id);


--
-- Name: segments segments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segments
    ADD CONSTRAINT segments_name_key UNIQUE (name);


--
-- Name: segments segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.segments
    ADD CONSTRAINT segments_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: witels witels_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.witels
    ADD CONSTRAINT witels_code_key UNIQUE (code);


--
-- Name: witels witels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.witels
    ADD CONSTRAINT witels_pkey PRIMARY KEY (id);


--
-- Name: idx_crp_billing_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crp_billing_period ON public.contract_recurring_payments USING btree (period_year, period_month);


--
-- Name: idx_crp_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crp_due_date ON public.contract_recurring_payments USING btree (due_date);


--
-- Name: idx_crp_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crp_invoice_number ON public.contract_recurring_payments USING btree (invoice_number);


--
-- Name: idx_crp_invoice_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crp_invoice_status ON public.contract_recurring_payments USING btree (invoice_status);


--
-- Name: idx_ctp_billing_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ctp_billing_period ON public.contract_term_payments USING btree (period_year, period_month);


--
-- Name: idx_ctp_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ctp_due_date ON public.contract_term_payments USING btree (due_date);


--
-- Name: idx_ctp_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ctp_invoice_number ON public.contract_term_payments USING btree (invoice_number);


--
-- Name: idx_ctp_invoice_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ctp_invoice_status ON public.contract_term_payments USING btree (invoice_status);


--
-- Name: idx_doc_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_payment ON public.invoice_documents USING btree (payment_transaction_id);


--
-- Name: idx_doc_recurring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_recurring ON public.invoice_documents USING btree (recurring_payment_id);


--
-- Name: idx_doc_term; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_term ON public.invoice_documents USING btree (term_payment_id);


--
-- Name: idx_doc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_type ON public.invoice_documents USING btree (document_type);


--
-- Name: idx_doc_uploaded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_uploaded_at ON public.invoice_documents USING btree (uploaded_at);


--
-- Name: idx_payment_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_created_at ON public.payment_transactions USING btree (created_at);


--
-- Name: idx_payment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_date ON public.payment_transactions USING btree (payment_date);


--
-- Name: idx_payment_recurring; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_recurring ON public.payment_transactions USING btree (recurring_payment_id);


--
-- Name: idx_payment_term; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_term ON public.payment_transactions USING btree (term_payment_id);


--
-- Name: ix_account_managers_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_account_managers_id ON public.account_managers USING btree (id);


--
-- Name: ix_accounts_account_manager_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_account_manager_id ON public.accounts USING btree (account_manager_id);


--
-- Name: ix_accounts_account_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_accounts_account_number ON public.accounts USING btree (account_number);


--
-- Name: ix_accounts_assigned_officer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_assigned_officer_id ON public.accounts USING btree (assigned_officer_id);


--
-- Name: ix_accounts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_id ON public.accounts USING btree (id);


--
-- Name: ix_accounts_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_is_active ON public.accounts USING btree (is_active);


--
-- Name: ix_accounts_nipnas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_nipnas ON public.accounts USING btree (nipnas);


--
-- Name: ix_accounts_segment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_segment_id ON public.accounts USING btree (segment_id);


--
-- Name: ix_accounts_witel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_accounts_witel_id ON public.accounts USING btree (witel_id);


--
-- Name: ix_contract_contacts_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contract_contacts_contract_id ON public.contract_contacts USING btree (contract_id);


--
-- Name: ix_contract_recurring_payments_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contract_recurring_payments_contract_id ON public.contract_recurring_payments USING btree (contract_id);


--
-- Name: ix_contract_recurring_payments_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contract_recurring_payments_id ON public.contract_recurring_payments USING btree (id);


--
-- Name: ix_contract_term_payments_contract_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contract_term_payments_contract_id ON public.contract_term_payments USING btree (contract_id);


--
-- Name: ix_contract_term_payments_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contract_term_payments_id ON public.contract_term_payments USING btree (id);


--
-- Name: ix_contracts_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contracts_account_id ON public.contracts USING btree (account_id);


--
-- Name: ix_contracts_contract_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_contracts_contract_number ON public.contracts USING btree (contract_number);


--
-- Name: ix_contracts_contract_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contracts_contract_year ON public.contracts USING btree (contract_year);


--
-- Name: ix_contracts_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contracts_id ON public.contracts USING btree (id);


--
-- Name: ix_contracts_telkom_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contracts_telkom_contact_id ON public.contracts USING btree (telkom_contact_id);


--
-- Name: ix_export_history_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_export_history_id ON public.export_history USING btree (id);


--
-- Name: ix_extraction_logs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_extraction_logs_id ON public.extraction_logs USING btree (id);


--
-- Name: ix_files_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_files_id ON public.files USING btree (id);


--
-- Name: ix_processing_jobs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_processing_jobs_id ON public.processing_jobs USING btree (id);


--
-- Name: ix_segments_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_segments_id ON public.segments USING btree (id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: ix_witels_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_witels_id ON public.witels USING btree (id);


--
-- Name: contract_recurring_payments trg_recalc_recurring_breakdown; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recalc_recurring_breakdown BEFORE INSERT OR UPDATE ON public.contract_recurring_payments FOR EACH ROW WHEN ((new.amount IS NOT NULL)) EXECUTE FUNCTION public.recalculate_invoice_breakdown_trigger();


--
-- Name: contract_term_payments trg_recalc_term_breakdown; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recalc_term_breakdown BEFORE INSERT OR UPDATE ON public.contract_term_payments FOR EACH ROW WHEN ((new.amount IS NOT NULL)) EXECUTE FUNCTION public.recalculate_invoice_breakdown_trigger();


--
-- Name: contract_recurring_payments trg_update_recurring_invoice_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_recurring_invoice_status BEFORE UPDATE ON public.contract_recurring_payments FOR EACH ROW WHEN (((old.paid_amount IS DISTINCT FROM new.paid_amount) OR (old.ppn_paid IS DISTINCT FROM new.ppn_paid) OR (old.pph23_paid IS DISTINCT FROM new.pph23_paid))) EXECUTE FUNCTION public.update_invoice_status_trigger();


--
-- Name: contract_term_payments trg_update_term_invoice_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_term_invoice_status BEFORE UPDATE ON public.contract_term_payments FOR EACH ROW WHEN (((old.paid_amount IS DISTINCT FROM new.paid_amount) OR (old.ppn_paid IS DISTINCT FROM new.ppn_paid) OR (old.pph23_paid IS DISTINCT FROM new.pph23_paid))) EXECUTE FUNCTION public.update_invoice_status_trigger();


--
-- Name: accounts accounts_account_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_account_manager_id_fkey FOREIGN KEY (account_manager_id) REFERENCES public.account_managers(id) ON DELETE SET NULL;


--
-- Name: accounts accounts_assigned_officer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_assigned_officer_id_fkey FOREIGN KEY (assigned_officer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: accounts accounts_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: accounts accounts_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.segments(id) ON DELETE SET NULL;


--
-- Name: accounts accounts_witel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_witel_id_fkey FOREIGN KEY (witel_id) REFERENCES public.witels(id) ON DELETE SET NULL;


--
-- Name: contract_contacts contract_contacts_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_contacts
    ADD CONSTRAINT contract_contacts_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contract_contacts contract_contacts_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_contacts
    ADD CONSTRAINT contract_contacts_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contract_contacts contract_contacts_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_contacts
    ADD CONSTRAINT contract_contacts_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contract_recurring_payments contract_recurring_payments_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_recurring_payments
    ADD CONSTRAINT contract_recurring_payments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contract_recurring_payments contract_recurring_payments_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_recurring_payments
    ADD CONSTRAINT contract_recurring_payments_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: contract_recurring_payments contract_recurring_payments_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_recurring_payments
    ADD CONSTRAINT contract_recurring_payments_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id);


--
-- Name: contract_term_payments contract_term_payments_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_term_payments
    ADD CONSTRAINT contract_term_payments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contract_term_payments contract_term_payments_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_term_payments
    ADD CONSTRAINT contract_term_payments_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: contract_term_payments contract_term_payments_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_term_payments
    ADD CONSTRAINT contract_term_payments_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id);


--
-- Name: contracts contracts_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_confirmed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_confirmed_by_id_fkey FOREIGN KEY (confirmed_by_id) REFERENCES public.users(id);


--
-- Name: contracts contracts_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: contracts contracts_source_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_source_job_id_fkey FOREIGN KEY (source_job_id) REFERENCES public.processing_jobs(id);


--
-- Name: contracts contracts_telkom_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_telkom_contact_id_fkey FOREIGN KEY (telkom_contact_id) REFERENCES public.account_managers(id) ON DELETE SET NULL;


--
-- Name: export_history export_history_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_history
    ADD CONSTRAINT export_history_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id);


--
-- Name: extraction_logs extraction_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extraction_logs
    ADD CONSTRAINT extraction_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.processing_jobs(id);


--
-- Name: invoice_documents invoice_documents_payment_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_documents
    ADD CONSTRAINT invoice_documents_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE CASCADE;


--
-- Name: invoice_documents invoice_documents_recurring_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_documents
    ADD CONSTRAINT invoice_documents_recurring_payment_id_fkey FOREIGN KEY (recurring_payment_id) REFERENCES public.contract_recurring_payments(id) ON DELETE CASCADE;


--
-- Name: invoice_documents invoice_documents_term_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_documents
    ADD CONSTRAINT invoice_documents_term_payment_id_fkey FOREIGN KEY (term_payment_id) REFERENCES public.contract_term_payments(id) ON DELETE CASCADE;


--
-- Name: invoice_documents invoice_documents_uploaded_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_documents
    ADD CONSTRAINT invoice_documents_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id);


--
-- Name: payment_transactions payment_transactions_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: payment_transactions payment_transactions_recurring_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_recurring_payment_id_fkey FOREIGN KEY (recurring_payment_id) REFERENCES public.contract_recurring_payments(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_term_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_term_payment_id_fkey FOREIGN KEY (term_payment_id) REFERENCES public.contract_term_payments(id) ON DELETE CASCADE;


--
-- Name: processing_jobs processing_jobs_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: processing_jobs processing_jobs_reviewed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict dDuRhAm75yeu8LwStojb6dUGDtieFwqaLxzcbZjlOHK5UfraWkzaoH3eSx6z5xJ

