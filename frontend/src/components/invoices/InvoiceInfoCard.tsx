// Invoice Information Card Component
import * as React from "react"
import { motion } from "motion/react"
import {
  FileText,
  Hash,
  Calendar,
  CreditCard,
  Clock,
  Layers,
  Building2,
  UserRound,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Invoice, InvoiceType } from "@/types/api"
import {
  formatDate,
  formatPeriod,
  safeRenderValue,
} from "./invoice-utils"
import {
  Skeleton,
  StatusBadge,
  InfoRow,
  SectionHeader,
  HighlightCard,
  cardVariants,
} from "./InvoiceUIComponents"

interface InvoiceInfoCardProps {
  invoice: Invoice | undefined
  invoiceType: InvoiceType
  isLoading: boolean
}

export const InvoiceInfoCard: React.FC<InvoiceInfoCardProps> = ({
  invoice,
  invoiceType,
  isLoading,
}) => {
  // Calculate days until due or days overdue
  const getDueDateInfo = () => {
    if (!invoice?.due_date) return null
    const dueDate = new Date(invoice.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)

    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} hari lewat`, isOverdue: true }
    } else if (diffDays === 0) {
      return { text: "Jatuh tempo hari ini", isOverdue: false }
    } else {
      return { text: `${diffDays} hari lagi`, isOverdue: false }
    }
  }

  const dueDateInfo = getDueDateInfo()

  // Key highlights for the invoice
  const invoiceHighlights = [
    {
      label: "No. Invoice",
      value: safeRenderValue(invoice?.invoice_number),
      helper: invoice?.invoice_number ? "Nomor unik invoice" : "Belum digenerate",
      icon: Hash,
      monospace: true,
    },
    {
      label: "Jatuh Tempo",
      value: formatDate(invoice?.due_date),
      helper: dueDateInfo?.text || "Tanggal pembayaran",
      icon: Calendar,
    },
    {
      label: "Periode",
      value: formatPeriod(invoice?.period_month, invoice?.period_year),
      helper: "Periode penagihan",
      icon: Clock,
    },
  ]

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ y: -4 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
        <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
          <SectionHeader
            icon={FileText}
            tag="Invoice"
            title="Informasi Invoice"
            description="Detail tagihan dan informasi pembayaran"
            rightIcon={Layers}
          />
        </CardHeader>
        <CardContent className="space-y-4 bg-white p-5">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ) : (
            <>
              {/* Hero section with invoice number and status */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden rounded-3xl border border-rose-100/80 bg-gradient-to-br from-rose-50 via-white to-white p-4 shadow-inner"
              >
                <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-rose-100/60 blur-3xl" />
                <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-400">
                      Nomor Invoice
                    </p>
                    <h3 className="text-2xl font-bold text-slate-900 font-mono tracking-wide">
                      {safeRenderValue(invoice?.invoice_number)}
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      {invoice && <StatusBadge status={invoice.invoice_status} size="lg" />}
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          invoiceType === "TERM"
                            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                            : "bg-violet-100 text-violet-700 border-violet-200"
                        )}
                      >
                        {invoiceType === "TERM" ? "Termin" : "Recurring"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end">
                    {invoiceHighlights.map((highlight) => (
                      <HighlightCard
                        key={highlight.label}
                        label={highlight.label}
                        value={highlight.value}
                        helper={highlight.helper}
                        icon={highlight.icon}
                        monospace={highlight.monospace}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Detail grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Contract Info */}
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50/70 p-4 shadow-sm"
                >
                  <div className="absolute right-4 top-4 h-12 w-12 rounded-full bg-rose-100/40 blur-2xl" />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-rose-50 p-1.5 text-rose-500">
                        <CreditCard className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-rose-400">
                          Referensi
                        </p>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Informasi Kontrak
                        </h4>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <InfoRow
                        label="No. Kontrak"
                        value={safeRenderValue(invoice?.contract_number)}
                        icon={Hash}
                        monospace
                      />
                      <InfoRow
                        label="Periode Kontrak"
                        value={
                          invoice?.contract_start_date && invoice?.contract_end_date
                            ? `${formatDate(invoice.contract_start_date)} - ${formatDate(invoice.contract_end_date)}`
                            : "—"
                        }
                        icon={Calendar}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Account Info */}
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50/70 p-4 shadow-sm"
                >
                  <div className="absolute left-4 top-4 h-12 w-12 rounded-full bg-rose-100/50 blur-2xl" />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-rose-50 p-1.5 text-rose-500">
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-rose-400">
                          Akun
                        </p>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Informasi Akun
                        </h4>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <InfoRow
                        label="No. Akun"
                        value={safeRenderValue(invoice?.account_number)}
                        icon={Hash}
                        monospace
                      />
                      <InfoRow
                        label="Witel"
                        value={safeRenderValue(invoice?.witel_name)}
                        icon={Building2}
                      />
                      <InfoRow
                        label="Segmen"
                        value={safeRenderValue(invoice?.segment_name || invoice?.segment)}
                        icon={Layers}
                      />
                      {invoice?.assigned_officer_name && (
                        <InfoRow
                          label="Petugas"
                          value={invoice.assigned_officer_name}
                          icon={UserRound}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Due date warning if overdue */}
              {dueDateInfo?.isOverdue && invoice?.invoice_status !== "PAID" && invoice?.invoice_status !== "CANCELLED" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-2 text-red-700">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Invoice ini sudah lewat jatuh tempo {dueDateInfo.text}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default InvoiceInfoCard
