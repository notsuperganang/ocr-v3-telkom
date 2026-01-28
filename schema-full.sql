--
-- PostgreSQL database dump
--

\restrict rF61bZtp7klWjZmWEf5He1Hev37UXgftd8zlJlndeDIY5a0UakSJm0QmvuOyY64

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

\unrestrict rF61bZtp7klWjZmWEf5He1Hev37UXgftd8zlJlndeDIY5a0UakSJm0QmvuOyY64

