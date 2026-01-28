// API Types for Telkom Contract Extractor

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: string;
  user_id: number;
}

export type UserRole = "STAFF" | "MANAGER";

export interface UserInfo {
  user_id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  authenticated: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export interface UpdateProfileRequest {
  email?: string;
  full_name?: string;
}

export interface UpdateProfileResponse {
  message: string;
  user: UserInfo;
}

// User Management Types (Admin)
export interface UserResponse {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  email?: string;
  full_name?: string;
  role?: UserRole;
}

export interface ChangeUserPasswordRequest {
  new_password: string;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  database: {
    status: string;
    tables?: string[];
  };
  authentication: string;
  ocr_service: string;
}

export interface UploadResponse {
  job_id: number;
  file_id: number;
  filename: string;
  message: string;
}

export interface BatchUploadResponse {
  uploaded_files: UploadResponse[];
  total_files: number;
  message: string;
}

export interface ManualEntryResponse {
  job_id: number;
  file_id: number | null;
  message: string;
  source: string;
  prefilled_account_id: number | null;
}

export interface JobStatusResponse {
  job_id: number;
  file_id: number | null;
  filename: string;
  status: string;
  progress_message: string;
  processing_time_seconds?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  is_manual_entry?: boolean;
}

export interface JobDataResponse {
  job_id: number;
  file_id: number | null;
  filename: string;
  status: string;
  extracted_data?: any;
  edited_data?: any;
  ocr_artifacts?: Record<string, string>;
  has_data: boolean;
  is_manual_entry?: boolean;
}

export interface ConfirmJobRequest {
  account_id?: number | null;
  contract_year: number;
  telkom_contact_id?: number | null;
}

export interface ConfirmJobResponse {
  message: string;
  job_id: number;
  contract_id: number;
  confirmed_at: string;
}

export interface ContractSummary {
  id: number;
  file_id: number;
  source_job_id: number;
  filename: string;
  contract_number?: string | null;
  confirmed_by: string;
  confirmed_at: string;
  created_at: string;
  contract_start_date?: string;
  contract_end_date?: string;
  payment_method?: string;
  customer_name?: string;
}

export interface ContractListResponse {
  contracts: ContractSummary[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface UnifiedContractItem {
  item_type: 'contract' | 'job';
  status: 'confirmed' | 'awaiting_review';
  id: number;
  file_id: number;
  source_job_id?: number | null;
  filename: string;
  contract_number?: string | null;
  customer_name?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  payment_method?: string | null;
  total_contract_value?: string | null;
  contract_year?: number | null;
  account?: AccountBrief | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface UnifiedContractListResponse {
  items: UnifiedContractItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface UserBrief {
  id: number;
  username: string;
  full_name?: string | null;
}

export interface AccountBrief {
  id: number;
  name: string;
  account_number?: string | null;
  assigned_officer?: UserBrief | null;
}

export interface ContractDetail {
  id: number;
  file_id: number;
  source_job_id: number;
  filename: string;
  contract_number?: string | null;
  final_data: any;
  version: number;
  // Account linkage fields
  account_id?: number | null;
  contract_year: number;
  telkom_contact_id?: number | null;
  // Account object with details
  account?: AccountBrief | null;
  confirmed_by: string;
  confirmed_at: string;
  created_at: string;
  updated_at: string;
  file_size_bytes: number;
  processing_time_seconds?: number;
}

export interface ContractStatsResponse {
  total_contracts: number;
  contracts_this_month: number;
  total_contract_value: string; // String representation of Decimal
  avg_processing_time_sec: number | null;
  success_rate: number;
  total_connectivity_services: number;
  total_non_connectivity_services: number;
  total_bundling_services: number;
  payment_methods: Record<string, number>; // e.g., {"termin": 10, "recurring": 5}
}

export interface ApiError {
  detail: string;
}

export type JobStatus = 'queued' | 'processing' | 'extracted' | 'awaiting_review' | 'confirmed' | 'failed';

// Termin Payment Types
export type TerminPaymentStatus = 'PENDING' | 'DUE' | 'OVERDUE' | 'PAID' | 'CANCELLED';

export interface TerminPayment {
  id: number;
  contract_id: number;
  termin_number: number;
  period_label: string;
  period_year: number;
  period_month: number;
  original_amount: string;
  amount: string;
  status: TerminPaymentStatus;
  paid_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateTerminPaymentRequest {
  status?: TerminPaymentStatus;
  paid_at?: string | null;
  notes?: string | null;
  amount?: string | null;
}

// Recurring Payment Types
export interface RecurringPayment {
  id: number;
  contract_id: number;
  cycle_number: number;
  period_label: string;
  period_year: number;
  period_month: number;
  original_amount: string;
  amount: string;
  status: TerminPaymentStatus; // Reuse same status enum
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateRecurringPaymentRequest {
  status?: TerminPaymentStatus;
  paid_at?: string | null;
  notes?: string | null;
}

// Dashboard Types
export interface DashboardOverview {
  total_contracts: number;
  contracts_this_month: number;
  contracts_last_month: number;
  total_contract_value: string;
  avg_contract_value: string;
  avg_processing_time_sec: number | null;
  median_processing_time_sec: number | null;
}

export interface TerminUpcomingItem {
  contract_id: number;
  customer_name: string;
  period_start: string | null;
  period_end: string | null;
  termin_number: number;
  termin_period_label: string;
  termin_period_year: number;
  termin_period_month: number;
  amount: string;
  status: string;
}

export interface TerminUpcomingResponse {
  total_contracts: number;
  total_amount: string;
  items: TerminUpcomingItem[];
}

export interface RecurringCurrentMonthItem {
  contract_id: number;
  customer_name: string;
  period_start: string | null;
  period_end: string | null;
  cycle_number: number;
  period_year: number;
  period_month: number;
  period_label: string;
  amount: string;
  status: string;
}

export interface RecurringCurrentMonthResponse {
  year: number;
  month: number;
  total_contracts: number;
  total_amount: string;
  items: RecurringCurrentMonthItem[];
}

export interface DashboardFinancialSummary {
  // Card 1: Total Termin Cost
  total_termin_cost: string;
  total_termin_contracts: number;
  termin_paid_amount: string;
  termin_unpaid_amount: string;

  // Card 2: Total Recurring Cost
  total_recurring_cost: string;
  total_recurring_contracts: number;
  recurring_monthly_avg: string;
  recurring_active_cycles: number;

  // Card 3: One-Time Charge Total
  total_one_time_cost: string;
  total_one_time_contracts: number;
  one_time_avg_per_contract: string;

  // Card 4: 90-Day Projection
  projection_90_days: string;
  projection_contracts_count: number;
  projection_termin: string;
  projection_recurring: string;

  // Card 5: Collected This Month
  collected_this_month: string;
  collected_count: number;
  collected_termin: string;
  collected_recurring: string;
  collection_target: string;
  outstanding_amount: string;

  // Card 6: Collection Rate
  collection_rate: number;
  on_time_count: number;
  late_count: number;
  outstanding_count: number;
  overall_collection_rate: number;
  total_payment_count: number;
}

// ============================================================================
// Master Data Types (Segments, Witels, Account Managers, Accounts)
// ============================================================================

// Segment Types
export interface SegmentResponse {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SegmentCreate {
  name: string;
  code?: string;
}

export interface SegmentUpdate {
  name?: string;
  code?: string;
}

export interface SegmentListResponse {
  segments: SegmentResponse[];
  total: number;
}

// Witel Types
export interface WitelResponse {
  id: number;
  code: string;
  name: string;
  region?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WitelCreate {
  code: string;
  name: string;
  region?: string;
}

export interface WitelUpdate {
  code?: string;
  name?: string;
  region?: string;
}

export interface WitelListResponse {
  witels: WitelResponse[];
  total: number;
}

// Account Manager Types
export interface AccountManagerResponse {
  id: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountManagerCreate {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
}

export interface AccountManagerUpdate {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
}

export interface AccountManagerListResponse {
  account_managers: AccountManagerResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Account Types (with nested entities)
export interface SegmentBrief {
  id: number;
  name: string;
  code: string | null;
}

export interface WitelBrief {
  id: number;
  code: string;
  name: string;
}

export interface AccountManagerBrief {
  id: number;
  name: string;
  title: string | null;
}

export interface AccountResponse {
  id: number;
  account_number: string | null;
  name: string;
  nipnas: string | null;
  bus_area: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  segment: SegmentBrief | null;
  witel: WitelBrief | null;
  account_manager: AccountManagerBrief | null;
  assigned_officer: UserBrief | null;
  creator: UserBrief | null;
  contract_count: number | null;
}

export interface AccountCreate {
  account_number?: string;
  name: string;
  nipnas?: string;
  bus_area?: string;
  segment_id?: number;
  witel_id?: number;
  account_manager_id?: number;
  assigned_officer_id?: number;
  notes?: string;
}

export interface AccountUpdate {
  account_number?: string;
  name?: string;
  nipnas?: string;
  bus_area?: string;
  segment_id?: number;
  witel_id?: number;
  account_manager_id?: number;
  assigned_officer_id?: number;
  notes?: string;
}

export interface AccountListResponse {
  accounts: AccountResponse[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AccountContractBrief {
  id: number;
  contract_year: number;
  contract_number: string | null;
  customer_name: string | null;
  period_start: string | null;
  period_end: string | null;
  payment_method: string | null;
  total_contract_value: string;
  created_at: string;
}

export interface AccountContractsResponse {
  account_id: number;
  account_name: string;
  contracts: AccountContractBrief[];
  total: number;
  page: number;
  per_page: number;
}

export interface SegmentDistribution {
  segment_id: number;
  segment_name: string;
  account_count: number;
  contract_count: number;
  percentage: number;
}

export interface OfficerDistribution {
  officer_id: number;
  officer_username: string;
  officer_full_name: string | null;
  account_count: number;
  contract_count: number;
  percentage: number;
}

export interface MonthlyGrowth {
  month: string;
  count: number;
}

export interface AccountStatsSummary {
  total_accounts: number;
  active_accounts: number;
  inactive_accounts: number;
  accounts_this_month: number;
  accounts_last_month: number;
  segment_distribution: SegmentDistribution[];
  officer_distribution: OfficerDistribution[];
  monthly_growth: MonthlyGrowth[];
}

// =====================
// Invoice Management Types
// =====================

export type InvoiceType = 'TERM' | 'RECURRING';

export type InvoiceStatus = 
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'PAID_PENDING_PPH23'
  | 'PAID_PENDING_PPN'
  | 'OVERDUE'
  | 'CANCELLED';

export type PaymentDueStatus = 'PENDING' | 'DUE' | 'OVERDUE' | 'PAID' | 'CANCELLED';

export type DocumentType = 
  | 'BUKTI_BAYAR'
  | 'BUPOT_PPH23'
  | 'BUKTI_BAYAR_PPH'
  | 'BUKTI_BAYAR_PPN'
  | 'INVOICE_PDF'
  | 'FAKTUR_PAJAK'
  | 'OTHER';

export type PaymentMethod = 
  | 'TRANSFER'
  | 'CASH'
  | 'GIRO'
  | 'CHECK'
  | 'VIRTUAL_ACCOUNT'
  | 'OTHER';

export interface Invoice {
  id: string;
  invoice_type: InvoiceType;
  invoice_number: string | null;
  contract_id: number;
  invoice_sequence: number | null;
  termin_number: number | null;
  cycle_number: number | null;
  invoice_status: InvoiceStatus;
  payment_due_status: PaymentDueStatus;
  original_payment_date: string | null;
  due_date: string | null;
  period_month: number | null;
  period_year: number | null;
  original_amount: string | null;
  amount: string | null;
  base_amount: string | null;
  ppn_amount: string | null;
  pph_amount: string | null;
  net_payable_amount: string | null;
  paid_amount: string | null;
  outstanding_amount: string | null;
  payment_progress_pct: number;
  ppn_paid: boolean;
  pph23_paid: boolean;
  legacy_is_paid: boolean;
  sent_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by: string | null;
  // Contract Info
  contract_number: string | null;
  customer_name: string | null;
  npwp: string | null;
  customer_address: string | null;
  witel_id: number | null;
  witel_name: string | null;
  segment: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  // Account Info (new fields)
  account_number: string | null;
  bus_area: string | null;
  nipnas: string | null;
  segment_name: string | null;
  account_manager_name: string | null;
  assigned_officer_name: string | null;
  account_notes: string | null;
}

export interface InvoiceSummary {
  total_invoices: number;
  total_amount: string;
  total_paid: string;
  total_outstanding: string;
  overdue_count: number;
}

export interface InvoiceListResponse {
  data: Invoice[];
  summary: InvoiceSummary;
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface InvoiceFilters {
  year: number;
  month: number;
  status?: InvoiceStatus | InvoiceStatus[];
  witel_id?: number;
  segment?: string;
  customer_name?: string;
  contract_number?: string;
  page?: number;
  limit?: number;
}

export interface PaymentTransaction {
  id: string;
  invoice_type: InvoiceType;
  term_payment_id: string | null;
  recurring_payment_id: string | null;
  payment_date: string;
  amount: string;
  payment_method: PaymentMethod | null;
  reference_number: string | null;
  ppn_included: boolean;
  pph23_included: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDocument {
  id: string;
  invoice_type: InvoiceType;
  term_payment_id: string | null;
  recurring_payment_id: string | null;
  payment_transaction_id: string | null;
  document_type: DocumentType;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
}

export interface InvoiceDetailResponse {
  invoice: Invoice;
  payments: PaymentTransaction[];
  documents: InvoiceDocument[];
  contract: {
    id: number;
    contract_number: string | null;
    customer_name: string | null;
    witel_name: string | null;
    segment: string | null;
  };
}

export interface AddPaymentRequest {
  payment_date: string;
  amount: number;
  payment_method?: PaymentMethod;
  reference_number?: string;
  ppn_included?: boolean;
  pph23_included?: boolean;
  notes?: string;
}

export interface AddPaymentResponse {
  success: boolean;
  payment_id: string;
  invoice_updated: {
    paid_amount: string;
    outstanding_amount: string;
    invoice_status: InvoiceStatus;
  };
}

export interface UploadDocumentRequest {
  document_type: DocumentType;
  payment_transaction_id?: string;
  notes?: string;
}

export interface UploadDocumentResponse {
  success: boolean;
  document_id: string;
  file_path: string;
  file_size: number;
}

export interface UpdateInvoiceStatusRequest {
  invoice_status: 'SENT' | 'CANCELLED';
  notes?: string;
}

export interface UpdateInvoiceStatusResponse {
  success: boolean;
  invoice: {
    id: string;
    invoice_status: InvoiceStatus;
    sent_date: string | null;
    notes: string | null;
  };
}

export interface SendInvoiceRequest {
  recipient_email: string;
  cc_emails?: string[];
  subject?: string;
  message?: string;
}

export interface SendInvoiceResponse {
  success: boolean;
  email_sent: boolean;
  sent_date: string;
}