import { z } from 'zod';

// NPWP validation - should be 15 digits
const npwpRegex = /^\d{15}$/;

// Email validation - make it properly optional
const emailSchema = z.union([
  z.string().email('Format email tidak valid'),
  z.string().length(0),
  z.undefined()
]).optional();

// Phone validation - Indonesian phone numbers
const phoneRegex = /^(\+62|62|0)[0-9]{8,12}$/;
const phoneSchema = z.union([
  z.string().regex(phoneRegex, 'Format nomor telepon tidak valid'),
  z.string().length(0),
  z.undefined()
]).optional();

// Date validation - YYYY-MM-DD format
const dateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  z.string().length(0),
  z.undefined()
]).optional();

// Currency/amount validation - moved inline to avoid unused variable

// Representative schema
const perwakilanSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
});

// Customer contact person schema
const kontakPersonPelangganSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
  email: emailSchema,
  telepon: phoneSchema,
});

// Customer information schema
const informasiPelangganSchema = z.object({
  nama_pelanggan: z.string()
    .max(255, 'Nama pelanggan terlalu panjang')
    .optional(),
  alamat: z.string()
    .max(500, 'Alamat terlalu panjang')
    .optional(),
  npwp: z.union([
    z.string().regex(npwpRegex, 'NPWP harus 15 digit angka'),
    z.string().length(0),
    z.undefined()
  ]).optional(),
  perwakilan: perwakilanSchema.optional(),
  kontak_person: kontakPersonPelangganSchema.optional(),
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

// Telkom contact person schema
const kontakPersonTelkomSchema = z.object({
  nama: z.string().optional(),
  jabatan: z.string().optional(),
  email: emailSchema,
  telepon: phoneSchema,
});

// Main services schema
const layananUtamaSchema = z.object({
  connectivity_telkom: z.number()
    .int('Harus berupa bilangan bulat')
    .min(0, 'Tidak boleh negatif'),
  non_connectivity_telkom: z.number()
    .int('Harus berupa bilangan bulat')
    .min(0, 'Tidak boleh negatif'),
  bundling: z.number()
    .int('Harus berupa bilangan bulat')
    .min(0, 'Tidak boleh negatif'),
});

// Termin payment schema
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
  raw_text: z.string().optional(),
});

// Payment method schema
const tataCaraPembayaranSchema = z.object({
  method_type: z.enum(['one_time_charge', 'recurring', 'termin'], {
    message: 'Tipe pembayaran wajib dipilih',
  }),
  description: z.string().optional(),
  termin_payments: z.array(terminPaymentSchema).optional(),
  total_termin_count: z.number().int().min(0).optional(),
  total_amount: z.number().min(0).optional(),
  raw_text: z.string().optional(),
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

// Service details schema
const rincianLayananSchema = z.object({
  biaya_instalasi: z.number().min(0, 'Biaya instalasi tidak boleh negatif'),
  biaya_langganan_tahunan: z.number().min(0, 'Biaya langganan tidak boleh negatif'),
  tata_cara_pembayaran: tataCaraPembayaranSchema.optional(),
});

// Main contract data schema
export const telkomContractDataSchema = z.object({
  informasi_pelanggan: informasiPelangganSchema.optional(),
  layanan_utama: layananUtamaSchema.optional(),
  rincian_layanan: z.array(rincianLayananSchema).optional(),
  tata_cara_pembayaran: tataCaraPembayaranSchema.optional(),
  kontak_person_telkom: kontakPersonTelkomSchema.optional(),
  jangka_waktu: jangkaWaktuSchema.optional(),
  extraction_timestamp: z.string().optional(),
  processing_time_seconds: z.number().optional(),
});

// Validation schema for required fields before confirmation
export const contractConfirmationSchema = telkomContractDataSchema.extend({
  informasi_pelanggan: informasiPelangganSchema.refine((data) => {
    return data?.nama_pelanggan && data.nama_pelanggan.trim().length > 0;
  }, {
    message: 'Nama pelanggan wajib diisi untuk konfirmasi',
  }),
  layanan_utama: layananUtamaSchema.refine((data) => {
    if (!data) return false;
    return data.connectivity_telkom + data.non_connectivity_telkom + data.bundling > 0;
  }, {
    message: 'Minimal harus ada 1 layanan',
  }),
});

// Export inferred TypeScript types from Zod schemas
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
  npwp: z.union([
    z.string().regex(npwpRegex, 'NPWP harus 15 digit angka'),
    z.string().length(0),
    z.undefined()
  ]).optional(),
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
        errors[path].push(err.message);
      });
      return errors;
    }
    return {};
  }
}

// Helper function to check if data is valid for confirmation
export function canConfirmContract(data: any): { canConfirm: boolean; errors: string[] } {
  try {
    contractConfirmationSchema.parse(data);
    return { canConfirm: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        canConfirm: false,
        errors: error.issues.map((err: any) => err.message),
      };
    }
    return { canConfirm: false, errors: ['Validation failed'] };
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