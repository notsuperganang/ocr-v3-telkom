// Invoice Hero Header Component
import * as React from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "motion/react"
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Send,
  Calendar,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Invoice, InvoiceType } from "@/types/api"
import { formatDate, formatDateTime, formatPeriod, safeRenderValue } from "./invoice-utils"
import { StatusBadge, Skeleton } from "./InvoiceUIComponents"

interface InvoiceHeroHeaderProps {
  invoice: Invoice | undefined
  invoiceType: InvoiceType
  isLoading: boolean
  onRefresh: () => void
  onSendInvoice: () => void
  isSending: boolean
}

export const InvoiceHeroHeader: React.FC<InvoiceHeroHeaderProps> = ({
  invoice,
  invoiceType,
  isLoading,
  onRefresh,
  onSendInvoice,
  isSending,
}) => {
  const navigate = useNavigate()

  // Breadcrumbs
  const Breadcrumbs = () => (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-sm font-medium text-slate-500"
    >
      <a
        href="/"
        className="transition-colors hover:text-slate-900"
      >
        Beranda
      </a>
      <span aria-hidden="true" className="text-slate-300">/</span>
      <a
        href="/invoices"
        className="transition-colors hover:text-slate-900"
      >
        Invoice
      </a>
      <span aria-hidden="true" className="text-slate-300">/</span>
      <span className="text-slate-900" aria-current="page">
        {invoice?.invoice_number || "Detail"}
      </span>
    </nav>
  )

  // Hero chips data
  const heroChips = [
    { label: "Tipe", value: invoiceType === "TERM" ? "Termin" : "Recurring" },
    ...(invoice?.account_number ? [{ label: "Akun", value: invoice.account_number }] : []),
    ...(invoice?.witel_name ? [{ label: "Witel", value: invoice.witel_name }] : []),
    { label: "Periode", value: formatPeriod(invoice?.billing_month, invoice?.billing_year) },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-rose-50 shadow-sm"
    >
      {/* Background glow */}
      <motion.span
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-rose-100 opacity-80 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 0.9, 0.7] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex flex-col gap-6 p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left side - Title and info */}
          <div className="flex flex-col gap-4">
            {/* Back button and badge */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/invoices")}
                className="hover:bg-white/70 transition-colors border border-transparent hover:border-rose-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              {isLoading ? (
                <Skeleton className="h-6 w-48" />
              ) : (
                <Breadcrumbs />
              )}
            </div>

            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-rose-600 shadow-sm ring-1 ring-rose-100">
                <Sparkles className="w-4 h-4" />
                Invoice Telkom
              </div>
            </div>

            {/* Invoice Number and Status */}
            <div>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-80" />
                  <Skeleton className="h-5 w-48" />
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl font-mono">
                    {safeRenderValue(invoice?.invoice_number)}
                  </h1>
                  <p className="mt-2 text-base text-slate-600">
                    {safeRenderValue(invoice?.customer_name)}
                  </p>
                </>
              )}
            </div>

            {/* Info chips */}
            {!isLoading && (
              <div className="mt-2 flex flex-wrap gap-2">
                {heroChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm"
                  >
                    <span className="text-slate-400">{chip.label}</span>
                    <span className="text-slate-800">{chip.value}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Date info row */}
            {!isLoading && (
              <div className="mt-3 flex items-center gap-4 text-sm text-slate-600 overflow-x-auto">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Jatuh Tempo:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(invoice?.due_date)}
                  </span>
                </div>
                {invoice?.sent_date && (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Send className="w-4 h-4 text-slate-400" />
                    <span>Dikirim:</span>
                    <span className="text-slate-800">{formatDateTime(invoice.sent_date)}</span>
                  </div>
                )}
                {invoice?.assigned_officer_name && (
                  <div className="flex items-center gap-2 font-semibold text-rose-600 whitespace-nowrap">
                    <User className="w-4 h-4" />
                    <span>Petugas:</span>
                    <span className="text-slate-500 font-normal">
                      {invoice.assigned_officer_name}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side - Status and Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <>
                {invoice && <StatusBadge status={invoice.invoice_status} size="lg" />}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="border-white/80 bg-white/90 text-slate-600 hover:bg-white hover:text-slate-900"
                >
                  <RefreshCw className={cn("mr-2 size-4", isLoading && "animate-spin")} />
                  Refresh
                </Button>

                {invoice?.invoice_status === "DRAFT" && (
                  <Button
                    size="sm"
                    onClick={onSendInvoice}
                    disabled={isSending}
                    className="bg-rose-600 hover:bg-rose-700 text-white shadow-md"
                  >
                    <Send className="mr-2 size-4" />
                    {isSending ? "Mengirim..." : "Kirim Invoice"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  )
}

export default InvoiceHeroHeader
