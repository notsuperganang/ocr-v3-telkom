// Import and re-export Zod-inferred types as the single source of truth
// These are generated from the validation schemas in @/lib/validation
import type {
  TelkomContractData as ZodTelkomContractData,
  InformasiPelanggan as ZodInformasiPelanggan,
  LayananUtama as ZodLayananUtama,
  RincianLayanan as ZodRincianLayanan,
  TataCaraPembayaran as ZodTataCaraPembayaran,
  TerminPayment as ZodTerminPayment,
  JangkaWaktu as ZodJangkaWaktu,
  KontakPersonTelkom as ZodKontakPersonTelkom,
  Perwakilan as ZodPerwakilan,
  KontakPersonPelanggan as ZodKontakPersonPelanggan,
} from '@/lib/validation';

// Re-export with original names
export type TelkomContractData = ZodTelkomContractData;
export type InformasiPelanggan = ZodInformasiPelanggan;
export type LayananUtama = ZodLayananUtama;
export type RincianLayanan = ZodRincianLayanan;
export type TataCaraPembayaran = ZodTataCaraPembayaran;
export type TerminPayment = ZodTerminPayment;
export type JangkaWaktu = ZodJangkaWaktu;
export type KontakPersonTelkom = ZodKontakPersonTelkom;
export type Perwakilan = ZodPerwakilan;
export type KontakPersonPelanggan = ZodKontakPersonPelanggan;

// Extended types for our frontend forms
export interface ExtractionFormData extends TelkomContractData {
  // Form-specific fields for better UX
  _isDirty?: boolean;
  _lastSaved?: string;
}

// Form field change tracking
export type FieldPath = string;
export type FormFieldChange = {
  path: FieldPath;
  value: any;
  timestamp: number;
};

// UI-specific types for the review page
export interface ReviewPageState {
  isLoading: boolean;
  isSaving: boolean;
  isConfirming: boolean;
  hasUnsavedChanges: boolean;
  currentPage: number; // PDF page (1 or 2)
  zoomLevel: number; // PDF zoom (0.75, 1, 1.25, etc.)
}

// Payment method form types for better type safety
export type PaymentMethodType = TataCaraPembayaran['method_type'];

export interface PaymentFormData {
  method_type: PaymentMethodType;
  description?: string;
  termin_payments: TerminPayment[];
}

// Enhanced job data response with typed extraction data
export interface TypedJobDataResponse {
  job_id: number;
  file_id: number;
  filename: string;
  status: string;
  extracted_data?: TelkomContractData;
  edited_data?: TelkomContractData;
  ocr_artifacts?: Record<string, string>;
  has_data: boolean;
}

// Form validation error types
export interface ValidationError {
  field: string;
  message: string;
  type: 'required' | 'format' | 'min' | 'max' | 'custom';
}

export interface FormErrors {
  [key: string]: ValidationError[];
}

// Currency formatting utilities type
export interface CurrencyFormatOptions {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

// Date format utilities type
export interface DateFormatOptions {
  format?: string;
  locale?: string;
}

// Export helper types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// PDF viewer related types
export interface PdfViewerState {
  numPages?: number;
  currentPage: number;
  scale: number;
  isLoading: boolean;
  error?: string;
}

export interface PdfPageProps {
  pageNumber: number;
  scale: number;
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
}