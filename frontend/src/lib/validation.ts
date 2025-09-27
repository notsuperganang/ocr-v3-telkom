import { z } from 'zod';

// =============================================================================
// DATA PREPROCESSING UTILITIES
// =============================================================================

// Helper to convert null to undefined for consistent Zod handling
function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

// Enhanced NPWP cleaning with format validation
function cleanNPWP(value: string): { cleaned: string; isValid: boolean; error?: string } {
  const input = value.trim();

  // Check if it matches expected NPWP format patterns
  const npwpFormatRegex = /^(\d{2})\.(\d{3})\.(\d{3})\.(\d{1})-(\d{3})\.(\d{3})$/;
  const nikFormatRegex = /^\d{16}$/;
  const digitsOnlyRegex = /^\d{15}$/;

  // If it's already 16 digits (NIK format), return as-is
  if (nikFormatRegex.test(input)) {
    return { cleaned: input, isValid: true };
  }

  // If it's already 15 digits, return as-is
  if (digitsOnlyRegex.test(input)) {
    return { cleaned: input, isValid: true };
  }

  // Try to match formatted NPWP pattern
  const formatMatch = input.match(npwpFormatRegex);
  if (formatMatch) {
    const cleaned = formatMatch.slice(1).join(''); // Join all captured groups
    if (cleaned.length === 15) {
      return { cleaned, isValid: true };
    } else {
      return {
        cleaned: '',
        isValid: false,
        error: `NPWP memiliki ${cleaned.length} digit, harus 15 digit`
      };
    }
  }

  // If no format matches, try basic digit extraction with validation
  let cleaned = input.replace(/[^\d]/g, '');

  // Handle common OCR noise patterns only after format validation
  cleaned = cleaned.replace(/[Oo]/g, '0')
                  .replace(/[Il|]/g, '1')
                  .replace(/[S]/g, '5')
                  .replace(/[B]/g, '8');

  // Validate digit count
  if (cleaned.length === 0) {
    return { cleaned: '', isValid: true }; // Empty is valid (optional field)
  } else if (cleaned.length === 15 || cleaned.length === 16) {
    return { cleaned, isValid: true };
  } else {
    return {
      cleaned: '',
      isValid: false,
      error: `NPWP memiliki ${cleaned.length} digit, harus 15 atau 16 digit`
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

// Enhanced NPWP validation supporting both legacy (15-digit) and new (16-digit) formats
const npwpLegacyRegex = /^\d{15}$/; // Legacy format: 15 digits
const npwpNewRegex = /^\d{16}$/;    // New format: 16 digits (NIK or 0+15digits)

const npwpSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined || val === '') return undefined;
    const cleaned = cleanNPWP(String(val));
    return cleaned.length === 0 ? undefined : cleaned;
  },
  z.union([
    z.string().regex(npwpLegacyRegex, 'NPWP harus berisi 15 digit angka (format lama)'),
    z.string().regex(npwpNewRegex, 'NPWP/NIK harus berisi 16 digit angka (format baru)'),
    z.undefined()
  ]).optional().refine((val) => {
    if (!val) return true; // Allow empty/undefined
    const length = val.length;
    return length === 15 || length === 16;
  }, {
    message: 'NPWP harus berisi 15 digit (format lama) atau 16 digit (NIK/format baru)'
  })
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
  termin_payments: z.array(terminPaymentSchema).default([]),
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
// FORM VALIDATION SCHEMAS (WITHOUT PREPROCESSING FOR REACT HOOK FORM)
// =============================================================================

// Simple schemas without preprocessing for React Hook Form compatibility
const simpleNpwpSchema = z.string().optional();
const simpleEmailSchema = z.string().email('Format email tidak valid').optional().or(z.literal(''));
const simplePhoneSchema = z.string().optional();

const simplePerwakilanSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
});

const simpleKontakPersonPelangganSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
  email: simpleEmailSchema,
  telepon: simplePhoneSchema,
});

const simpleInformasiPelangganSchema = z.object({
  nama_pelanggan: z.string().max(255, 'Nama pelanggan terlalu panjang').optional(),
  alamat: z.string().max(500, 'Alamat terlalu panjang').optional(),
  npwp: simpleNpwpSchema,
  perwakilan: simplePerwakilanSchema.optional(),
  kontak_person: simpleKontakPersonPelangganSchema.optional(),
});

const simpleJangkaWaktuSchema = z.object({
  mulai: z.string().optional(),
  akhir: z.string().optional(),
});

const simpleKontakPersonTelkomSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
  email: simpleEmailSchema,
  telepon: simplePhoneSchema,
});

const simpleLayananUtamaSchema = z.object({
  connectivity_telkom: z.number().int().min(0).default(0),
  non_connectivity_telkom: z.number().int().min(0).default(0),
  bundling: z.number().int().min(0).default(0),
});

const simpleTerminPaymentSchema = z.object({
  termin_number: z.number().int().min(1),
  period: z.string().min(1),
  amount: z.number().min(0),
  raw_text: z.string().optional(),
});

const simpleTataCaraPembayaranSchema = z.object({
  method_type: z.enum(['one_time_charge', 'recurring', 'termin']).default('one_time_charge'),
  description: z.string().optional(),
  termin_payments: z.array(simpleTerminPaymentSchema).default([]),
  total_termin_count: z.number().int().min(0).optional(),
  total_amount: z.number().min(0).optional(),
  raw_text: z.string().optional(),
});

const simpleRincianLayananSchema = z.object({
  biaya_instalasi: z.number().min(0).default(0),
  biaya_langganan_tahunan: z.number().min(0).default(0),
  tata_cara_pembayaran: simpleTataCaraPembayaranSchema.optional(),
});

// Form schema for React Hook Form (without preprocessing)
export const telkomContractFormSchema = z.object({
  informasi_pelanggan: simpleInformasiPelangganSchema.nullable().optional(),
  layanan_utama: simpleLayananUtamaSchema.nullable().optional(),
  rincian_layanan: z.array(simpleRincianLayananSchema).default([]),
  tata_cara_pembayaran: simpleTataCaraPembayaranSchema.nullable().optional(),
  kontak_person_telkom: simpleKontakPersonTelkomSchema.nullable().optional(),
  jangka_waktu: simpleJangkaWaktuSchema.nullable().optional(),
  extraction_timestamp: z.string().optional(),
  processing_time_seconds: z.number().optional(),
});

// Export inferred TypeScript types from Zod schemas
export type TelkomContractData = z.infer<typeof telkomContractDataSchema>;
export type TelkomContractFormData = z.infer<typeof telkomContractFormSchema>;
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
  // Format NPWP as XX.XXX.XXX.X-XXX.XXX
  const cleaned = npwp.replace(/\D/g, '');
  if (cleaned.length !== 15) return cleaned;

  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}.${cleaned.slice(8, 9)}-${cleaned.slice(9, 12)}.${cleaned.slice(12, 15)}`;
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