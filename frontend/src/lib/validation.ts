import { z } from 'zod';

// =============================================================================
// DATA PREPROCESSING UTILITIES
// =============================================================================

// Helper to convert null to undefined for consistent Zod handling
function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

// Enhanced NPWP cleaning with format validation supporting 15, 16, and 19-digit formats
function cleanNPWP(value: string): { cleaned: string; isValid: boolean; error?: string } {
  const input = value.trim();

  // Check if it matches expected NPWP format patterns
  const npwp15FormatRegex = /^(\d{2})\.(\d{3})\.(\d{3})\.(\d{1})-(\d{3})\.(\d{3})$/;           // 15-digit format
  const npwp19FormatRegex = /^(\d{2})\.(\d{3})\.(\d{3})\.(\d{1})-(\d{3})\.(\d{3})\.(\d{4})$/; // 19-digit format (company)
  const digits15Regex = /^\d{15}$/;
  const digits16Regex = /^\d{16}$/;
  const digits19Regex = /^\d{19}$/;

  // If it's already in pure digit format, validate and return
  if (digits15Regex.test(input) || digits16Regex.test(input) || digits19Regex.test(input)) {
    return { cleaned: input, isValid: true };
  }

  // Try to match 15-digit formatted NPWP pattern (most common)
  const format15Match = input.match(npwp15FormatRegex);
  if (format15Match) {
    const cleaned = format15Match.slice(1).join(''); // Join all captured groups
    return { cleaned, isValid: true };
  }

  // Try to match 19-digit formatted NPWP pattern (company format)
  const format19Match = input.match(npwp19FormatRegex);
  if (format19Match) {
    const cleaned = format19Match.slice(1).join(''); // Join all captured groups
    return { cleaned, isValid: true };
  }

  // If no format matches, try basic digit extraction with validation
  let cleaned = input.replace(/[^\d]/g, '');

  // Handle common OCR noise patterns only after format validation
  cleaned = cleaned.replace(/[Oo]/g, '0')
                  .replace(/[Il|]/g, '1')
                  .replace(/[S]/g, '5')
                  .replace(/[B]/g, '8');

  // Validate digit count - support 15, 16, and 19-digit formats
  if (cleaned.length === 0) {
    return { cleaned: '', isValid: true }; // Empty is valid (optional field)
  } else if (cleaned.length === 15 || cleaned.length === 16 || cleaned.length === 19) {
    return { cleaned, isValid: true };
  } else {
    return {
      cleaned: '',
      isValid: false,
      error: `NPWP memiliki ${cleaned.length} digit, harus 15, 16, atau 19 digit`
    };
  }
}

// Normalize Indonesian phone numbers to a consistent format
function normalizePhoneNumber(value: string): string {
  // Remove all non-digit characters except +
  const cleaned = value.replace(/[^+\d]/g, '');

  // Handle various Indonesian phone formats:
  // +62812345678, 62812345678, 0812345678, 812345678, (021)12345678
  if (cleaned.startsWith('+62')) {
    return cleaned; // Already in international format
  }
  if (cleaned.startsWith('62')) {
    return `+${cleaned}`; // Add + to make it international
  }
  if (cleaned.startsWith('0')) {
    return `+62${cleaned.slice(1)}`; // Replace 0 with +62
  }
  // Assume it's a local number starting with area code
  return `+62${cleaned}`;
}

// =============================================================================
// VALIDATION SCHEMAS WITH ROBUST NULL/UNDEFINED HANDLING
// =============================================================================

// Enhanced NPWP validation supporting 15-digit (legacy), 16-digit (NIK), and 19-digit (company) formats
const npwpLegacyRegex = /^\d{15}$/; // Legacy format: 15 digits
const npwpNewRegex = /^\d{16}$/;    // New format: 16 digits (NIK or 0+15digits)
const npwpCompanyRegex = /^\d{19}$/; // Company format: 19 digits

const npwpSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined || val === '') return undefined;
    const result = cleanNPWP(String(val));

    // Don't throw errors during preprocessing - return empty string for invalid NPWPs
    // This prevents crashes when loading bad OCR data
    // Validation errors will be caught by the main schema
    if (!result.isValid) {
      return undefined; // Silently convert invalid to undefined
    }

    return result.cleaned.length === 0 ? undefined : result.cleaned;
  },
  z.union([
    z.string().regex(npwpLegacyRegex, 'NPWP harus berisi 15 digit angka (format lama)'),
    z.string().regex(npwpNewRegex, 'NPWP/NIK harus berisi 16 digit angka (format baru)'),
    z.string().regex(npwpCompanyRegex, 'NPWP harus berisi 19 digit angka (format perusahaan)'),
    z.undefined()
  ]).optional()
);

// Email validation with proper null handling
const emailSchema = z.preprocess(
  (val) => nullToUndefined(val),
  z.union([
    z.string().email('Format email tidak valid'),
    z.string().length(0),
    z.undefined()
  ]).optional()
);

// Enhanced phone validation - comprehensive Indonesian phone number support
const phoneRegex = /^\+62[0-9]{8,13}$/; // International format: +62 followed by 8-13 digits
const phoneSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined || val === '') return undefined;
    const normalized = normalizePhoneNumber(String(val));
    return normalized.length <= 4 ? undefined : normalized; // Minimum viable phone length
  },
  z.union([
    z.string().regex(phoneRegex, 'Format nomor telepon tidak valid (gunakan format: 0812345678, +62812345678, atau 62812345678)'),
    z.undefined()
  ]).optional()
);

// Date validation - YYYY-MM-DD format with null handling
const dateSchema = z.preprocess(
  (val) => nullToUndefined(val),
  z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    z.string().length(0),
    z.undefined()
  ]).optional()
);

// Currency/amount validation - moved inline to avoid unused variable

// Representative schema with null handling
const perwakilanSchema = z.object({
  nama: z.preprocess(nullToUndefined, z.string().optional()),
  jabatan: z.preprocess(nullToUndefined, z.string().optional()),
});

// Customer contact person schema with null handling
const kontakPersonPelangganSchema = z.object({
  nama: z.preprocess(nullToUndefined, z.string().optional()),
  jabatan: z.preprocess(nullToUndefined, z.string().optional()),
  email: emailSchema,
  telepon: phoneSchema,
});

// Customer information schema with enhanced null handling
const informasiPelangganSchema = z.object({
  nama_pelanggan: z.preprocess(
    nullToUndefined,
    z.string().max(255, 'Nama pelanggan terlalu panjang').optional()
  ),
  alamat: z.preprocess(
    nullToUndefined,
    z.string().max(500, 'Alamat terlalu panjang').optional()
  ),
  npwp: npwpSchema,
  perwakilan: z.preprocess(nullToUndefined, perwakilanSchema.optional()),
  kontak_person: z.preprocess(nullToUndefined, kontakPersonPelangganSchema.optional()),
});

// Contract period schema
const jangkaWaktuSchema = z.object({
  mulai: dateSchema.optional(),
  akhir: dateSchema.optional(),
}).refine((data) => {
  if (data.mulai && data.akhir) {
    return new Date(data.mulai) < new Date(data.akhir);
  }
  return true;
}, {
  message: 'Tanggal akhir harus setelah tanggal mulai',
  path: ['akhir'],
});

// Telkom contact person schema with null handling
const kontakPersonTelkomSchema = z.object({
  nama: z.preprocess(nullToUndefined, z.string().optional()),
  jabatan: z.preprocess(nullToUndefined, z.string().optional()),
  email: emailSchema,
  telepon: phoneSchema,
});

// Main services schema
const layananUtamaSchema = z.object({
  connectivity_telkom: z.coerce.number().int('Harus berupa bilangan bulat').min(0, 'Tidak boleh negatif').default(0),
  non_connectivity_telkom: z.coerce.number().int('Harus berupa bilangan bulat').min(0, 'Tidak boleh negatif').default(0),
  bundling: z.coerce.number().int('Harus berupa bilangan bulat').min(0, 'Tidak boleh negatif').default(0),
}).transform((data) => ({
  connectivity_telkom: data.connectivity_telkom ?? 0,
  non_connectivity_telkom: data.non_connectivity_telkom ?? 0,
  bundling: data.bundling ?? 0,
}));

// Termin payment schema with null handling
const terminPaymentSchema = z.object({
  termin_number: z.number()
    .int('Harus berupa bilangan bulat')
    .min(1, 'Nomor termin minimal 1'),
  period: z.string()
    .min(1, 'Periode pembayaran wajib diisi'),
  amount: z.number()
    .min(0, 'Jumlah tidak boleh negatif')
    .refine((val) => val > 0, {
      message: 'Jumlah pembayaran harus lebih dari 0',
    }),
  raw_text: z.preprocess(nullToUndefined, z.string().optional()),
});

// Payment method schema with enhanced null handling
const tataCaraPembayaranSchema = z.object({
  method_type: z.enum(['one_time_charge', 'recurring', 'termin'], {
    message: 'Tipe pembayaran wajib dipilih',
  }).default('one_time_charge'),
  description: z.preprocess(nullToUndefined, z.string().optional()),
  termin_payments: z.preprocess(
    (val) => {
      // Convert null to empty array for proper default handling
      if (val === null || val === undefined) return [];
      return Array.isArray(val) ? val : [];
    },
    z.array(terminPaymentSchema).default([])
  ),
  total_termin_count: z.preprocess(
    nullToUndefined,
    z.coerce.number().int().min(0).optional()
  ),
  total_amount: z.preprocess(
    nullToUndefined,
    z.coerce.number().min(0).optional()
  ),
  raw_text: z.preprocess(nullToUndefined, z.string().optional()),
}).refine((data) => {
  // If method is termin, must have termin_payments
  if (data.method_type === 'termin') {
    return data.termin_payments && data.termin_payments.length > 0;
  }
  return true;
}, {
  message: 'Pembayaran termin harus memiliki minimal 1 pembayaran',
  path: ['termin_payments'],
}).refine((data) => {
  // For termin payments, validate termin numbers are sequential
  if (data.method_type === 'termin' && data.termin_payments) {
    const sortedTermins = [...data.termin_payments].sort((a, b) => a.termin_number - b.termin_number);
    for (let i = 0; i < sortedTermins.length; i++) {
      if (sortedTermins[i].termin_number !== i + 1) {
        return false;
      }
    }
  }
  return true;
}, {
  message: 'Nomor termin harus berurutan mulai dari 1',
  path: ['termin_payments'],
});

// Service details schema with proper nested null handling
const rincianLayananSchema = z.object({
  biaya_instalasi: z.coerce.number().min(0, 'Biaya instalasi tidak boleh negatif').default(0),
  biaya_langganan_tahunan: z.coerce.number().min(0, 'Biaya langganan tidak boleh negatif').default(0),
  tata_cara_pembayaran: z.preprocess(
    nullToUndefined,
    tataCaraPembayaranSchema.nullable().optional()
  ),
}).transform((data) => ({
  biaya_instalasi: data.biaya_instalasi ?? 0,
  biaya_langganan_tahunan: data.biaya_langganan_tahunan ?? 0,
  tata_cara_pembayaran: data.tata_cara_pembayaran,
}));

// Main contract data schema
export const telkomContractDataSchema = z.object({
  informasi_pelanggan: informasiPelangganSchema.nullable().optional(),
  layanan_utama: layananUtamaSchema.nullable().optional(),
  rincian_layanan: z.array(rincianLayananSchema).default([]),
  tata_cara_pembayaran: tataCaraPembayaranSchema.nullable().optional(),
  kontak_person_telkom: kontakPersonTelkomSchema.nullable().optional(),
  jangka_waktu: jangkaWaktuSchema.nullable().optional(),
  extraction_timestamp: z.string().optional(),
  processing_time_seconds: z.coerce.number().optional(),
}).transform((data) => ({
  ...data,
  rincian_layanan: Array.isArray(data.rincian_layanan) ? data.rincian_layanan : [],
  layanan_utama: data.layanan_utama || { connectivity_telkom: 0, non_connectivity_telkom: 0, bundling: 0 },
  tata_cara_pembayaran: data.tata_cara_pembayaran || { method_type: 'one_time_charge' as const, termin_payments: [] },
}));

// Validation schema for required fields before confirmation
export const contractConfirmationSchema = telkomContractDataSchema.refine((data) => {
  return data.informasi_pelanggan?.nama_pelanggan && data.informasi_pelanggan.nama_pelanggan.trim().length > 0;
}, {
  message: 'Nama pelanggan wajib diisi untuk konfirmasi',
  path: ['informasi_pelanggan', 'nama_pelanggan'],
}).refine((data) => {
  const services = data.layanan_utama || { connectivity_telkom: 0, non_connectivity_telkom: 0, bundling: 0 };
  return services.connectivity_telkom + services.non_connectivity_telkom + services.bundling > 0;
}, {
  message: 'Minimal harus ada 1 layanan',
  path: ['layanan_utama'],
});

// =============================================================================
// SIMPLE FORM VALIDATION SCHEMA (for React Hook Form)
// =============================================================================

// Simple form validation schema that matches pure TypeScript interfaces
// No preprocessing, no transforms - just clean validation for React Hook Form

const formPerwakilanSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
});

const formKontakPersonPelangganSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
  email: z.string().optional(),
  telepon: z.string().optional(),
});

const formInformasiPelangganSchema = z.object({
  nama_pelanggan: z.string().optional(),
  alamat: z.string().optional(),
  npwp: z.string().optional().refine((val) => {
    // Explicitly handle empty/undefined/null - all are valid (optional field)
    if (val === undefined || val === null || val === '') return true;
    if (typeof val !== 'string') return false;

    const digits = val.replace(/\D/g, '');
    // Empty after cleaning is also valid (e.g., field had only non-digit chars)
    if (digits === '') return true;

    // If has digits, must be exactly 15, 16, or 19 digits
    return digits.length === 15 || digits.length === 16 || digits.length === 19;
  }, {
    message: 'NPWP harus 15, 16, atau 19 digit (atau kosongkan jika tidak ada)'
  }),
  perwakilan: formPerwakilanSchema.optional(),
  kontak_person: formKontakPersonPelangganSchema.optional(),
});

const formLayananUtamaSchema = z.object({
  connectivity_telkom: z.number().int().min(0),
  non_connectivity_telkom: z.number().int().min(0),
  bundling: z.number().int().min(0),
});

const formTerminPaymentSchema = z.object({
  termin_number: z.number().int().min(1),
  period: z.string()
    .min(1, 'Periode pembayaran wajib diisi')
    .regex(
      /^[A-Za-z]+\s+\d{4}$/,
      'Format periode harus "Bulan YYYY" (contoh: Januari 2025, Februari 2025)'
    ),
  amount: z.number().min(0),
  raw_text: z.string().optional(),
});

const formTataCaraPembayaranSchema = z.object({
  method_type: z.enum(['one_time_charge', 'recurring', 'termin']),
  description: z.string().optional(),
  termin_payments: z.array(formTerminPaymentSchema),
  total_termin_count: z.number().int().min(0).optional(),
  total_amount: z.number().min(0).optional(),
  raw_text: z.string().optional(),
});

const formRincianLayananSchema = z.object({
  biaya_instalasi: z.number().min(0),
  biaya_langganan_tahunan: z.number().min(0),
  tata_cara_pembayaran: formTataCaraPembayaranSchema.optional(),
});

const formJangkaWaktuSchema = z.object({
  mulai: z.string().optional(),
  akhir: z.string().optional(),
});

const formKontakPersonTelkomSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
  email: z.string().optional(),
  telepon: z.string().optional(),
});

// Clean form validation schema - matches TelkomContractFormData interface exactly
export const telkomContractFormSchema = z.object({
  informasi_pelanggan: formInformasiPelangganSchema.optional(),
  layanan_utama: formLayananUtamaSchema.optional(),
  rincian_layanan: z.array(formRincianLayananSchema),
  tata_cara_pembayaran: formTataCaraPembayaranSchema.optional(),
  kontak_person_telkom: formKontakPersonTelkomSchema.optional(),
  jangka_waktu: formJangkaWaktuSchema.optional(),
  extraction_timestamp: z.string().optional(),
  processing_time_seconds: z.number().optional(),
}) satisfies z.ZodType<TelkomContractFormData>;

// =============================================================================
// PURE FORM TYPES (for React Hook Form - no Zod preprocessing)
// =============================================================================

// Pure form interfaces without Zod complexity - for React Hook Form
export interface FormPerwakilan {
  nama?: string;
  jabatan?: string;
}

export interface FormKontakPersonPelanggan {
  nama?: string;
  jabatan?: string;
  email?: string;
  telepon?: string;
}

export interface FormInformasiPelanggan {
  nama_pelanggan?: string;
  alamat?: string;
  npwp?: string;
  perwakilan?: FormPerwakilan;
  kontak_person?: FormKontakPersonPelanggan;
}

export interface FormLayananUtama {
  connectivity_telkom: number;
  non_connectivity_telkom: number;
  bundling: number;
}

export interface FormTerminPayment {
  termin_number: number;
  period: string;
  amount: number;
  raw_text?: string;
}

export interface FormTataCaraPembayaran {
  method_type: 'one_time_charge' | 'recurring' | 'termin';
  description?: string;
  termin_payments: FormTerminPayment[];
  total_termin_count?: number;
  total_amount?: number;
  raw_text?: string;
}

export interface FormRincianLayanan {
  biaya_instalasi: number;
  biaya_langganan_tahunan: number;
  tata_cara_pembayaran?: FormTataCaraPembayaran;
}

export interface FormJangkaWaktu {
  mulai?: string;
  akhir?: string;
}

export interface FormKontakPersonTelkom {
  nama?: string;
  jabatan?: string;
  email?: string;
  telepon?: string;
}

// Main form data interface - pure TypeScript, no Zod inference
export interface TelkomContractFormData {
  informasi_pelanggan?: FormInformasiPelanggan;
  layanan_utama?: FormLayananUtama;
  rincian_layanan: FormRincianLayanan[];
  tata_cara_pembayaran?: FormTataCaraPembayaran;
  kontak_person_telkom?: FormKontakPersonTelkom;
  jangka_waktu?: FormJangkaWaktu;
  extraction_timestamp?: string;
  processing_time_seconds?: number;
}

// =============================================================================
// DATA TRANSFORMATION UTILITIES
// =============================================================================

// Transform backend data (with nulls, complex types) to clean form data
export function backendToForm(backendData: TelkomContractData): TelkomContractFormData {
  return {
    informasi_pelanggan: backendData.informasi_pelanggan ? {
      nama_pelanggan: backendData.informasi_pelanggan.nama_pelanggan || '',
      alamat: backendData.informasi_pelanggan.alamat || '',
      npwp: backendData.informasi_pelanggan.npwp || '',
      perwakilan: backendData.informasi_pelanggan.perwakilan ? {
        nama: backendData.informasi_pelanggan.perwakilan.nama || '',
        jabatan: backendData.informasi_pelanggan.perwakilan.jabatan || '',
      } : undefined,
      kontak_person: backendData.informasi_pelanggan.kontak_person ? {
        nama: backendData.informasi_pelanggan.kontak_person.nama || '',
        jabatan: backendData.informasi_pelanggan.kontak_person.jabatan || '',
        email: backendData.informasi_pelanggan.kontak_person.email || '',
        telepon: backendData.informasi_pelanggan.kontak_person.telepon || '',
      } : undefined,
    } : undefined,

    layanan_utama: backendData.layanan_utama ? {
      connectivity_telkom: backendData.layanan_utama.connectivity_telkom || 0,
      non_connectivity_telkom: backendData.layanan_utama.non_connectivity_telkom || 0,
      bundling: backendData.layanan_utama.bundling || 0,
    } : {
      connectivity_telkom: 0,
      non_connectivity_telkom: 0,
      bundling: 0,
    },

    rincian_layanan: Array.isArray(backendData.rincian_layanan)
      ? backendData.rincian_layanan.map(item => ({
          biaya_instalasi: item.biaya_instalasi || 0,
          biaya_langganan_tahunan: item.biaya_langganan_tahunan || 0,
          tata_cara_pembayaran: item.tata_cara_pembayaran ? {
            method_type: item.tata_cara_pembayaran.method_type || 'one_time_charge',
            description: item.tata_cara_pembayaran.description || '',
            termin_payments: Array.isArray(item.tata_cara_pembayaran.termin_payments)
              ? item.tata_cara_pembayaran.termin_payments.map(termin => ({
                  termin_number: termin.termin_number,
                  period: termin.period,
                  amount: termin.amount,
                  raw_text: termin.raw_text || '',
                }))
              : [],
            total_termin_count: item.tata_cara_pembayaran.total_termin_count || 0,
            total_amount: item.tata_cara_pembayaran.total_amount || 0,
            raw_text: item.tata_cara_pembayaran.raw_text || '',
          } : undefined,
        }))
      : [],

    tata_cara_pembayaran: backendData.tata_cara_pembayaran ? {
      method_type: backendData.tata_cara_pembayaran.method_type || 'one_time_charge',
      description: backendData.tata_cara_pembayaran.description || '',
      termin_payments: Array.isArray(backendData.tata_cara_pembayaran.termin_payments)
        ? backendData.tata_cara_pembayaran.termin_payments.map(termin => ({
            termin_number: termin.termin_number,
            period: termin.period,
            amount: termin.amount,
            raw_text: termin.raw_text || '',
          }))
        : [],
      total_termin_count: backendData.tata_cara_pembayaran.total_termin_count || 0,
      total_amount: backendData.tata_cara_pembayaran.total_amount || 0,
      raw_text: backendData.tata_cara_pembayaran.raw_text || '',
    } : {
      method_type: 'one_time_charge' as const,
      description: '',
      termin_payments: [],
      total_termin_count: 0,
      total_amount: 0,
      raw_text: '',
    },

    kontak_person_telkom: backendData.kontak_person_telkom ? {
      nama: backendData.kontak_person_telkom.nama || '',
      jabatan: backendData.kontak_person_telkom.jabatan || '',
      email: backendData.kontak_person_telkom.email || '',
      telepon: backendData.kontak_person_telkom.telepon || '',
    } : undefined,

    jangka_waktu: backendData.jangka_waktu ? {
      mulai: backendData.jangka_waktu.mulai || '',
      akhir: backendData.jangka_waktu.akhir || '',
    } : undefined,

    extraction_timestamp: backendData.extraction_timestamp,
    processing_time_seconds: backendData.processing_time_seconds,
  };
}

// Transform clean form data back to backend format
export function formToBackend(formData: TelkomContractFormData): TelkomContractData {
  // Convert form data back to backend format
  // This will go through the main telkomContractDataSchema validation with preprocessing
  return telkomContractDataSchema.parse(formData);
}

// =============================================================================
// ZOD INFERRED TYPES (for backend validation)
// =============================================================================

// Export inferred TypeScript types from Zod schemas (for backend use)
export type TelkomContractData = z.infer<typeof telkomContractDataSchema>;
export type InformasiPelanggan = z.infer<typeof informasiPelangganSchema>;
export type LayananUtama = z.infer<typeof layananUtamaSchema>;
export type RincianLayanan = z.infer<typeof rincianLayananSchema>;
export type TataCaraPembayaran = z.infer<typeof tataCaraPembayaranSchema>;
export type TerminPayment = z.infer<typeof terminPaymentSchema>;
export type JangkaWaktu = z.infer<typeof jangkaWaktuSchema>;
export type KontakPersonTelkom = z.infer<typeof kontakPersonTelkomSchema>;
export type Perwakilan = z.infer<typeof perwakilanSchema>;
export type KontakPersonPelanggan = z.infer<typeof kontakPersonPelangganSchema>;

// Individual field validation schemas for real-time validation
export const fieldValidationSchemas = {
  nama_pelanggan: z.string().min(1, 'Nama pelanggan wajib diisi'),
  alamat: z.string().min(1, 'Alamat wajib diisi'),
  npwp: npwpSchema,
  email: emailSchema,
  telepon: phoneSchema,
  connectivity_telkom: z.number().int().min(0),
  non_connectivity_telkom: z.number().int().min(0),
  bundling: z.number().int().min(0),
  biaya_instalasi: z.number().min(0),
  biaya_langganan_tahunan: z.number().min(0),
  tanggal_mulai: dateSchema,
  tanggal_akhir: dateSchema,
};

// Helper function to validate individual fields
export function validateField(fieldName: string, value: any): { success: boolean; error?: string } {
  const schema = fieldValidationSchemas[fieldName as keyof typeof fieldValidationSchemas];
  if (!schema) {
    return { success: true };
  }

  try {
    schema.parse(value);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || 'Invalid value' };
    }
    return { success: false, error: 'Validation failed' };
  }
}

// Helper function to get all validation errors for a form
export function getFormErrors(data: any): Record<string, string[]> {
  try {
    telkomContractDataSchema.parse(data);
    return {};
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((err: any) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        // Provide more user-friendly error messages
        const message = err.message === 'Required' ? 'Field ini wajib diisi' : err.message;
        errors[path].push(message);
      });
      return errors;
    }
    return { general: ['Terjadi kesalahan validasi'] };
  }
}

// Helper function to check if data is valid for confirmation
export function canConfirmContract(data: any): { canConfirm: boolean; errors: string[] } {
  try {
    contractConfirmationSchema.parse(data);
    return { canConfirm: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const friendlyErrors = error.issues.map((err: any) => {
        // Convert path to more readable format
        const path = err.path.join(' → ');
        return path ? `${path}: ${err.message}` : err.message;
      });
      return {
        canConfirm: false,
        errors: friendlyErrors,
      };
    }
    return { canConfirm: false, errors: ['Terjadi kesalahan validasi'] };
  }
}

// Currency formatting helper
export function formatCurrency(amount: number, options: { locale?: string; currency?: string } = {}): string {
  const { locale = 'id-ID', currency = 'IDR' } = options;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// NPWP formatting helper
export function formatNPWP(npwp: string): string {
  const cleaned = npwp.replace(/\D/g, '');

  // Format 15-digit NPWP: XX.XXX.XXX.X-XXX.XXX
  if (cleaned.length === 15) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}.${cleaned.slice(8, 9)}-${cleaned.slice(9, 12)}.${cleaned.slice(12, 15)}`;
  }

  // Format 19-digit NPWP: XX.XXX.XXX.X-XXX.XXX.XXXX
  if (cleaned.length === 19) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}.${cleaned.slice(8, 9)}-${cleaned.slice(9, 12)}.${cleaned.slice(12, 15)}.${cleaned.slice(15, 19)}`;
  }

  // For 16-digit (NIK) or other lengths, return as-is
  return cleaned;
}

// Phone formatting helper
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('0')) {
    return `+62${cleaned.slice(1)}`;
  }
  return cleaned;
}