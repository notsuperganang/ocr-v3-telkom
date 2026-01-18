/**
 * Zod validation schemas for Master Data CRUD operations
 * Segments, Witels, Account Managers, and Accounts
 */

import { z } from 'zod';

// ============================================================================
// Segment Validation Schemas
// ============================================================================

export const segmentCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama segment harus diisi')
    .max(100, 'Nama segment maksimal 100 karakter'),
  code: z
    .string()
    .max(50, 'Kode segment maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
});

export const segmentUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama segment harus diisi')
    .max(100, 'Nama segment maksimal 100 karakter')
    .optional(),
  code: z
    .string()
    .max(50, 'Kode segment maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
});

export type SegmentCreateInput = z.infer<typeof segmentCreateSchema>;
export type SegmentUpdateInput = z.infer<typeof segmentUpdateSchema>;

// ============================================================================
// Witel Validation Schemas
// ============================================================================

export const witelCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'Kode witel harus diisi')
    .max(50, 'Kode witel maksimal 50 karakter'),
  name: z
    .string()
    .min(1, 'Nama witel harus diisi')
    .max(200, 'Nama witel maksimal 200 karakter'),
  region: z
    .string()
    .max(100, 'Region maksimal 100 karakter')
    .optional()
    .or(z.literal('')),
});

export const witelUpdateSchema = z.object({
  code: z
    .string()
    .min(1, 'Kode witel harus diisi')
    .max(50, 'Kode witel maksimal 50 karakter')
    .optional(),
  name: z
    .string()
    .min(1, 'Nama witel harus diisi')
    .max(200, 'Nama witel maksimal 200 karakter')
    .optional(),
  region: z
    .string()
    .max(100, 'Region maksimal 100 karakter')
    .optional()
    .or(z.literal('')),
});

export type WitelCreateInput = z.infer<typeof witelCreateSchema>;
export type WitelUpdateInput = z.infer<typeof witelUpdateSchema>;

// ============================================================================
// Account Manager Validation Schemas
// ============================================================================

export const accountManagerCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama Account Manager harus diisi')
    .max(255, 'Nama maksimal 255 karakter'),
  title: z
    .string()
    .max(255, 'Jabatan maksimal 255 karakter')
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .email('Format email tidak valid')
    .max(255, 'Email maksimal 255 karakter')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Nomor telepon maksimal 50 karakter')
    .regex(/^[0-9+\-\s()]*$/, 'Format nomor telepon tidak valid')
    .optional()
    .or(z.literal('')),
});

export const accountManagerUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama Account Manager harus diisi')
    .max(255, 'Nama maksimal 255 karakter')
    .optional(),
  title: z
    .string()
    .max(255, 'Jabatan maksimal 255 karakter')
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .email('Format email tidak valid')
    .max(255, 'Email maksimal 255 karakter')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .max(50, 'Nomor telepon maksimal 50 karakter')
    .regex(/^[0-9+\-\s()]*$/, 'Format nomor telepon tidak valid')
    .optional()
    .or(z.literal('')),
});

export type AccountManagerCreateInput = z.infer<typeof accountManagerCreateSchema>;
export type AccountManagerUpdateInput = z.infer<typeof accountManagerUpdateSchema>;

// ============================================================================
// Account Validation Schemas
// ============================================================================

export const accountCreateSchema = z.object({
  account_number: z
    .string()
    .max(50, 'Nomor account maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
  name: z
    .string()
    .min(1, 'Nama customer harus diisi')
    .max(500, 'Nama customer maksimal 500 karakter'),
  nipnas: z
    .string()
    .max(50, 'NIPNAS maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
  bus_area: z
    .string()
    .max(50, 'Business area maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
  segment_id: z
    .number()
    .int()
    .positive('Segment ID harus positif')
    .optional()
    .nullable(),
  witel_id: z
    .number()
    .int()
    .positive('Witel ID harus positif')
    .optional()
    .nullable(),
  account_manager_id: z
    .number()
    .int()
    .positive('Account Manager ID harus positif')
    .optional()
    .nullable(),
  assigned_officer_id: z
    .number()
    .int()
    .positive('Assigned Officer ID harus positif')
    .optional()
    .nullable(),
  notes: z
    .string()
    .optional()
    .or(z.literal('')),
});

export const accountUpdateSchema = z.object({
  account_number: z
    .string()
    .max(50, 'Nomor account maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
  name: z
    .string()
    .min(1, 'Nama customer harus diisi')
    .max(500, 'Nama customer maksimal 500 karakter')
    .optional(),
  nipnas: z
    .string()
    .max(50, 'NIPNAS maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
  bus_area: z
    .string()
    .max(50, 'Business area maksimal 50 karakter')
    .optional()
    .or(z.literal('')),
  segment_id: z
    .number()
    .int()
    .positive('Segment ID harus positif')
    .optional()
    .nullable(),
  witel_id: z
    .number()
    .int()
    .positive('Witel ID harus positif')
    .optional()
    .nullable(),
  account_manager_id: z
    .number()
    .int()
    .positive('Account Manager ID harus positif')
    .optional()
    .nullable(),
  assigned_officer_id: z
    .number()
    .int()
    .positive('Assigned Officer ID harus positif')
    .optional()
    .nullable(),
  notes: z
    .string()
    .optional()
    .or(z.literal('')),
});

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
