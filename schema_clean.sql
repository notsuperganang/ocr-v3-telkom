CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE public.export_history (
    id integer NOT NULL,
    contract_id integer NOT NULL,
    export_target public.exporttarget NOT NULL,
    export_path character varying,
    status character varying,
    notes text,
    exported_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.extraction_logs (
    id integer NOT NULL,
    job_id integer NOT NULL,
    level character varying NOT NULL,
    message text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE public.files (
    id integer NOT NULL,
    original_filename character varying NOT NULL,
    size_bytes bigint NOT NULL,
    mime_type character varying NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now(),
    pdf_path character varying NOT NULL
);
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
CREATE TABLE public.segments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50),
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE public.witels (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
