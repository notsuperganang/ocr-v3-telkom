// Invoice utilities and shared constants
import type { InvoiceStatus, DocumentType } from "@/types/api"

// Design tokens for consistent styling
export const designTokens = {
  radius: {
    xl: "rounded-[1.25rem]",
    lg: "rounded-xl",
    "2xl": "rounded-2xl",
    "3xl": "rounded-3xl",
  },
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
    card: "shadow-lg shadow-rose-100/40",
  },
  border: "border border-border/70",
  surface: {
    base: "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90",
  },
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]/80",
} as const

// Telkom color palette
export const telkomColors = {
  primary: "#E60012",
  primaryDark: "#D30019",
  gray50: "#FAFAFA",
  gray100: "#F5F5F5",
  gray200: "#EEEEEE",
  gray300: "#E0E0E0",
  gray600: "#757575",
  gray700: "#616161",
  gray800: "#424242",
  success: "#4CAF50",
  warning: "#FF9800",
  white: "#FFFFFF",
} as const

// Invoice status styling
export const invoiceStatusStyles: Record<
  InvoiceStatus,
  { label: string; className: string; dot: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-gray-100 text-gray-700 border-gray-200",
    dot: "bg-gray-500",
  },
  SENT: {
    label: "Terkirim",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  PARTIALLY_PAID: {
    label: "Dibayar Sebagian",
    className: "bg-orange-100 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  PAID: {
    label: "Lunas",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  PAID_PENDING_PPH23: {
    label: "Lunas - Menunggu PPh23",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
  },
  PAID_PENDING_PPN: {
    label: "Lunas - Menunggu PPN",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  OVERDUE: {
    label: "Jatuh Tempo",
    className: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-500",
  },
}

// Document type labels
export const documentTypeLabels: Record<DocumentType, string> = {
  BUKTI_BAYAR: "Bukti Bayar",
  BUPOT_PPH23: "BUPOT PPh 23",
  BUKTI_BAYAR_PPH: "Bukti Bayar PPh",
  BUKTI_BAYAR_PPN: "Bukti Bayar PPN",
  INVOICE_PDF: "Invoice PDF",
  FAKTUR_PAJAK: "Faktur Pajak",
  OTHER: "Lainnya",
}

// Helper functions
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatPeriod(month: number | null | undefined, year: number | null | undefined): string {
  // Return empty string instead of "—" to hide the chip when no period data
  if (!month || !year) return ""
  const date = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date)
}

export function safeRenderValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value || "—"
  if (typeof value === "number") return value.toString()
  if (typeof value === "object") {
    if ("nama" in value && value.nama) return String(value.nama)
    if ("name" in value && value.name) return String(value.name)
    if ("value" in value && value.value) return String(value.value)
    return "—"
  }
  return String(value)
}
