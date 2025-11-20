--
-- PostgreSQL database dump
--

\restrict MH0m3pJGg8nGyaCg3rOpxkcePhqfPJ3L23RpgS6JTHg1NieyyhpaVFiJlbFAcSd

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
-- Name: exporttarget; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.exporttarget AS ENUM (
    'JSON',
    'EXCEL'
);


ALTER TYPE public.exporttarget OWNER TO postgres;

--
-- Name: jobstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.jobstatus AS ENUM (
    'QUEUED',
    'PROCESSING',
    'EXTRACTED',
    'AWAITING_REVIEW',
    'CONFIRMED',
    'FAILED'
);


ALTER TYPE public.jobstatus OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: contract_term_payments; Type: TABLE; Schema: public; Owner: postgres
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
    status text DEFAULT 'PENDING'::text NOT NULL,
    paid_at timestamp with time zone,
    notes text,
    created_by text,
    updated_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_contract_term_payments_period_month CHECK (((period_month >= 1) AND (period_month <= 12))),
    CONSTRAINT ck_contract_term_payments_period_year CHECK (((period_year >= 2000) AND (period_year <= 2100))),
    CONSTRAINT ck_contract_term_payments_status CHECK ((status = ANY (ARRAY['PENDING'::text, 'DUE'::text, 'OVERDUE'::text, 'PAID'::text, 'CANCELLED'::text]))),
    CONSTRAINT ck_contract_term_payments_termin_number CHECK ((termin_number >= 1))
);


ALTER TABLE public.contract_term_payments OWNER TO postgres;

--
-- Name: TABLE contract_term_payments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contract_term_payments IS 'Normalized termin payment tracking table for operational reminders and status management';


--
-- Name: COLUMN contract_term_payments.termin_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.termin_number IS 'Termin sequence number (1, 2, 3, ...)';


--
-- Name: COLUMN contract_term_payments.period_label; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.period_label IS 'Original period string (e.g., "Maret 2025")';


--
-- Name: COLUMN contract_term_payments.period_year; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.period_year IS 'Extracted year (e.g., 2025)';


--
-- Name: COLUMN contract_term_payments.period_month; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.period_month IS 'Extracted month 1-12 (Januari-Desember)';


--
-- Name: COLUMN contract_term_payments.original_amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.original_amount IS 'Original amount from extraction';


--
-- Name: COLUMN contract_term_payments.amount; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.amount IS 'Current editable amount';


--
-- Name: COLUMN contract_term_payments.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.status IS 'PENDING/DUE/OVERDUE/PAID/CANCELLED';


--
-- Name: COLUMN contract_term_payments.paid_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.paid_at IS 'Timestamp when marked as paid';


--
-- Name: COLUMN contract_term_payments.notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.notes IS 'Additional notes or comments';


--
-- Name: COLUMN contract_term_payments.created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.created_by IS 'User who created this record';


--
-- Name: COLUMN contract_term_payments.updated_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.updated_by IS 'User who last updated this record';


--
-- Name: COLUMN contract_term_payments.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.created_at IS 'Creation timestamp';


--
-- Name: COLUMN contract_term_payments.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contract_term_payments.updated_at IS 'Last update timestamp';


--
-- Name: contract_term_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contract_term_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contract_term_payments_id_seq OWNER TO postgres;

--
-- Name: contract_term_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contract_term_payments_id_seq OWNED BY public.contract_term_payments.id;


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id integer NOT NULL,
    source_job_id integer NOT NULL,
    file_id integer NOT NULL,
    final_data jsonb NOT NULL,
    version integer,
    confirmed_by character varying,
    confirmed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    customer_name character varying(500),
    customer_npwp character varying(50),
    period_start date,
    period_end date,
    service_connectivity integer DEFAULT 0 NOT NULL,
    service_non_connectivity integer DEFAULT 0 NOT NULL,
    service_bundling integer DEFAULT 0 NOT NULL,
    payment_method character varying(20),
    termin_count integer,
    installation_cost numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    annual_subscription_cost numeric(18,2) DEFAULT '0'::numeric NOT NULL,
    total_contract_value numeric(18,2) DEFAULT '0'::numeric NOT NULL,
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
    extraction_timestamp timestamp with time zone,
    contract_processing_time_sec double precision
);


ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: COLUMN contracts.termin_payments_raw; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contracts.termin_payments_raw IS 'Raw termin payment snapshot from OCR extraction (not operational data)';


--
-- Name: contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contracts_id_seq OWNER TO postgres;

--
-- Name: contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contracts_id_seq OWNED BY public.contracts.id;


--
-- Name: export_history; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.export_history OWNER TO postgres;

--
-- Name: export_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.export_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.export_history_id_seq OWNER TO postgres;

--
-- Name: export_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.export_history_id_seq OWNED BY public.export_history.id;


--
-- Name: extraction_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.extraction_logs (
    id integer NOT NULL,
    job_id integer NOT NULL,
    level character varying NOT NULL,
    message text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.extraction_logs OWNER TO postgres;

--
-- Name: extraction_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.extraction_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.extraction_logs_id_seq OWNER TO postgres;

--
-- Name: extraction_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.extraction_logs_id_seq OWNED BY public.extraction_logs.id;


--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (
    id integer NOT NULL,
    original_filename character varying NOT NULL,
    size_bytes bigint NOT NULL,
    mime_type character varying NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    pdf_path character varying NOT NULL
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.files_id_seq OWNER TO postgres;

--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- Name: processing_jobs; Type: TABLE; Schema: public; Owner: postgres
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
    reviewed_by character varying,
    reviewed_at timestamp with time zone
);


ALTER TABLE public.processing_jobs OWNER TO postgres;

--
-- Name: processing_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.processing_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.processing_jobs_id_seq OWNER TO postgres;

--
-- Name: processing_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.processing_jobs_id_seq OWNED BY public.processing_jobs.id;


--
-- Name: contract_term_payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_term_payments ALTER COLUMN id SET DEFAULT nextval('public.contract_term_payments_id_seq'::regclass);


--
-- Name: contracts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts ALTER COLUMN id SET DEFAULT nextval('public.contracts_id_seq'::regclass);


--
-- Name: export_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_history ALTER COLUMN id SET DEFAULT nextval('public.export_history_id_seq'::regclass);


--
-- Name: extraction_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extraction_logs ALTER COLUMN id SET DEFAULT nextval('public.extraction_logs_id_seq'::regclass);


--
-- Name: files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- Name: processing_jobs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_jobs ALTER COLUMN id SET DEFAULT nextval('public.processing_jobs_id_seq'::regclass);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: contract_term_payments contract_term_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_term_payments
    ADD CONSTRAINT contract_term_payments_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: export_history export_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_history
    ADD CONSTRAINT export_history_pkey PRIMARY KEY (id);


--
-- Name: extraction_logs extraction_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extraction_logs
    ADD CONSTRAINT extraction_logs_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: processing_jobs processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_pkey PRIMARY KEY (id);


--
-- Name: contract_term_payments uq_contract_term_payments_contract_termin; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_term_payments
    ADD CONSTRAINT uq_contract_term_payments_contract_termin UNIQUE (contract_id, termin_number);


--
-- Name: idx_contract_term_payments_contract_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_term_payments_contract_id ON public.contract_term_payments USING btree (contract_id);


--
-- Name: idx_contract_term_payments_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_term_payments_period ON public.contract_term_payments USING btree (period_year, period_month);


--
-- Name: idx_contract_term_payments_status_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contract_term_payments_status_period ON public.contract_term_payments USING btree (status, period_year, period_month);


--
-- Name: ix_contracts_confirmed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_confirmed_at ON public.contracts USING btree (confirmed_at DESC);


--
-- Name: ix_contracts_confirmed_at_value; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_confirmed_at_value ON public.contracts USING btree (confirmed_at, total_contract_value);


--
-- Name: ix_contracts_customer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_customer_name ON public.contracts USING btree (customer_name);


--
-- Name: ix_contracts_customer_npwp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_customer_npwp ON public.contracts USING btree (customer_npwp);


--
-- Name: ix_contracts_extraction_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_extraction_timestamp ON public.contracts USING btree (extraction_timestamp DESC);


--
-- Name: ix_contracts_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_id ON public.contracts USING btree (id);


--
-- Name: ix_contracts_payment_method; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_payment_method ON public.contracts USING btree (payment_method);


--
-- Name: ix_contracts_payment_termin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_payment_termin ON public.contracts USING btree (payment_method, termin_total_count, termin_total_amount);


--
-- Name: ix_contracts_period_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_period_start ON public.contracts USING btree (period_start DESC);


--
-- Name: ix_contracts_total_value; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_contracts_total_value ON public.contracts USING btree (total_contract_value DESC);


--
-- Name: ix_export_history_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_export_history_id ON public.export_history USING btree (id);


--
-- Name: ix_extraction_logs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_extraction_logs_id ON public.extraction_logs USING btree (id);


--
-- Name: ix_files_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_files_id ON public.files USING btree (id);


--
-- Name: ix_processing_jobs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_processing_jobs_id ON public.processing_jobs USING btree (id);


--
-- Name: contracts contracts_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: contracts contracts_source_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_source_job_id_fkey FOREIGN KEY (source_job_id) REFERENCES public.processing_jobs(id);


--
-- Name: export_history export_history_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_history
    ADD CONSTRAINT export_history_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id);


--
-- Name: extraction_logs extraction_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extraction_logs
    ADD CONSTRAINT extraction_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.processing_jobs(id);


--
-- Name: contract_term_payments fk_contract_term_payments_contract_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_term_payments
    ADD CONSTRAINT fk_contract_term_payments_contract_id FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: processing_jobs processing_jobs_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.processing_jobs
    ADD CONSTRAINT processing_jobs_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- PostgreSQL database dump complete
--

\unrestrict MH0m3pJGg8nGyaCg3rOpxkcePhqfPJ3L23RpgS6JTHg1NieyyhpaVFiJlbFAcSd