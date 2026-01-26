import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Minus,
  Plus,
  RefreshCw,
  Send,
  Upload,
  User,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { motion } from "motion/react"
import { twMerge } from "tailwind-merge"

import { useInvoiceDetail, useUpdateInvoiceStatus } from "@/hooks/useInvoices"
import type {
  InvoiceStatus,
  InvoiceType,
  PaymentTransaction,
  InvoiceDocument,
  DocumentType,
} from "@/types/api"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn, formatCurrency } from "@/lib/utils"

import AddPaymentModal from "@/components/AddPaymentModal"
import UploadDocumentModal from "@/components/UploadDocumentModal"

// Design tokens
const designTokens = {
  radius: {
    xl: "rounded-[1.25rem]",
    lg: "rounded-xl",
  },
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
  },
  border: "border border-border/70",
  surface: {
    base: "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90",
  },
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]/80",
} as const

// Invoice status styling
const invoiceStatusStyles: Record<
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

const documentTypeLabels: Record<DocumentType, string> = {
  BUKTI_BAYAR: "Bukti Bayar",
  BUPOT_PPH23: "BUPOT PPh 23",
  BUKTI_BAYAR_PPH: "Bukti Bayar PPh",
  BUKTI_BAYAR_PPN: "Bukti Bayar PPN",
  INVOICE_PDF: "Invoice PDF",
  FAKTUR_PAJAK: "Faktur Pajak",
  OTHER: "Lainnya",
}

// Helper functions
function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

// Components
const MotionCard = motion(Card)

function Breadcrumbs({ invoiceNumber }: { invoiceNumber?: string | null }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
    >
      <a href="/" className={cn("transition-colors hover:text-foreground", designTokens.focusRing)}>
        Beranda
      </a>
      <span aria-hidden="true" className="text-muted-foreground/60">/</span>
      <a href="/invoices" className={cn("transition-colors hover:text-foreground", designTokens.focusRing)}>
        Invoice
      </a>
      <span aria-hidden="true" className="text-muted-foreground/60">/</span>
      <span className="text-foreground" aria-current="page">
        {invoiceNumber || "Detail"}
      </span>
    </nav>
  )
}

const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={twMerge("animate-pulse rounded-md bg-muted/60", className)} {...props} />
)

interface StatusBadgeProps {
  status: InvoiceStatus
  size?: "sm" | "lg"
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "sm" }) => {
  const style = invoiceStatusStyles[status] || invoiceStatusStyles.DRAFT
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        style.className,
        size === "lg" && "px-3 py-1 text-sm"
      )}
    >
      <span className={cn("rounded-full", style.dot, size === "lg" ? "size-2" : "size-1.5")} aria-hidden="true" />
      {style.label}
    </Badge>
  )
}

interface TaxStatusProps {
  label: string
  paid: boolean
}

const TaxStatus: React.FC<TaxStatusProps> = ({ label, paid }) => (
  <div className="flex items-center gap-2">
    {paid ? (
      <CheckCircle2 className="size-4 text-emerald-500" />
    ) : (
      <XCircle className="size-4 text-red-500" />
    )}
    <span className={cn("text-sm", paid ? "text-emerald-700" : "text-red-700")}>
      {label} {paid ? "✓" : "✗"}
    </span>
  </div>
)

// Main Page Component
export default function InvoiceDetailPage() {
  const navigate = useNavigate()
  const { type, id } = useParams<{ type: string; id: string }>()
  
  const invoiceType = (type?.toUpperCase() || "TERM") as InvoiceType
  const invoiceId = id || ""

  // Modals
  const [showPaymentModal, setShowPaymentModal] = React.useState(false)
  const [showDocumentModal, setShowDocumentModal] = React.useState(false)

  // Fetch data
  const { data, isLoading, isError, refetch } = useInvoiceDetail(invoiceType, invoiceId)
  const updateStatusMutation = useUpdateInvoiceStatus()

  const invoice = data?.invoice
  const payments = data?.payments || []
  const documents = data?.documents || []

  // Handle send invoice
  const handleSendInvoice = async () => {
    if (!invoice) return
    try {
      await updateStatusMutation.mutateAsync({
        invoiceType,
        id: invoiceId,
        data: { invoice_status: "SENT" },
      })
      toast.success("Invoice berhasil dikirim")
    } catch {
      toast.error("Gagal mengirim invoice")
    }
  }

  // Handle cancel invoice
  const handleCancelInvoice = async () => {
    if (!invoice) return
    try {
      await updateStatusMutation.mutateAsync({
        invoiceType,
        id: invoiceId,
        data: { invoice_status: "CANCELLED", notes: "Cancelled by user" },
      })
      toast.success("Invoice dibatalkan")
    } catch {
      toast.error("Gagal membatalkan invoice")
    }
  }

  if (isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <XCircle className="size-12 text-red-500" />
        <p className="text-muted-foreground">Gagal memuat data invoice</p>
        <Button variant="outline" onClick={() => refetch()}>
          Coba Lagi
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/invoices")}
              className="shrink-0"
            >
              <ArrowLeft className="size-5" />
              <span className="sr-only">Kembali</span>
            </Button>
            <Breadcrumbs invoiceNumber={invoice?.invoice_number} />
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              {isLoading ? <Skeleton className="h-8 w-64" /> : invoice?.invoice_number || "Invoice Detail"}
            </h1>
            {invoice && <StatusBadge status={invoice.invoice_status} size="lg" />}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("mr-2 size-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          {invoice?.invoice_status === "DRAFT" && (
            <Button
              size="sm"
              onClick={handleSendInvoice}
              disabled={updateStatusMutation.isPending}
            >
              <Send className="mr-2 size-4" />
              Kirim Invoice
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Main Content */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Invoice & Customer Info */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Invoice Info */}
            <MotionCard
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(designTokens.radius.lg, designTokens.border, designTokens.surface.base)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  Informasi Invoice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Nomor Invoice</span>
                      <span className="text-sm font-medium">{invoice?.invoice_number || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tipe</span>
                      <Badge variant="outline" className={cn(
                        "font-medium",
                        invoiceType === "TERM"
                          ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                          : "bg-violet-100 text-violet-700 border-violet-200"
                      )}>
                        {invoiceType === "TERM" ? "Termin" : "Recurring"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">No. Kontrak</span>
                      <span className="text-sm font-medium">{invoice?.contract_number || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Jatuh Tempo</span>
                      <span className="text-sm font-medium">{formatDate(invoice?.due_date || null)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Periode</span>
                      <span className="text-sm font-medium">
                        {invoice?.billing_month}/{invoice?.billing_year}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </MotionCard>

            {/* Customer Info */}
            <MotionCard
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(designTokens.radius.lg, designTokens.border, designTokens.surface.base)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="size-4" />
                  Informasi Pelanggan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-sm text-muted-foreground">Nama</span>
                      <p className="font-medium">{invoice?.customer_name || "—"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">NPWP</span>
                      <p className="font-mono text-sm">{invoice?.npwp || "—"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Alamat</span>
                      <p className="text-sm">{invoice?.customer_address || "—"}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </MotionCard>
          </div>

          {/* Amount Breakdown */}
          <MotionCard
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(designTokens.radius.lg, designTokens.border, designTokens.surface.base)}
          >
            <CardHeader>
              <CardTitle className="text-base">Rincian Pembayaran (PPh 23 Withholding)</CardTitle>
              <CardDescription>
                Pelanggan membayar Net Payable (Total dikurangi PPh 23 yang dipotong)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Amount (DPP)</span>
                      <span>{formatCurrency(invoice?.base_amount || "0", { compact: false })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">PPN 11%</span>
                      <span>{formatCurrency(invoice?.ppn_amount || "0", { compact: false })}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total Invoice</span>
                      <span>{formatCurrency(invoice?.amount || "0", { compact: false })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>PPh 23 (2% withheld)</span>
                      <span>- {formatCurrency(invoice?.pph_amount || "0", { compact: false })}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Net Payable</span>
                      <span className="text-primary">
                        {formatCurrency(invoice?.net_payable_amount || "0", { compact: false })}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sudah Dibayar</span>
                      <span className="text-emerald-600 font-medium">
                        {formatCurrency(invoice?.paid_amount || "0", { compact: false })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Outstanding</span>
                      <span className="text-orange-600">
                        {formatCurrency(invoice?.outstanding_amount || "0", { compact: false })}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress Pembayaran</span>
                      <span className="font-medium">
                        {Math.round(invoice?.payment_progress_pct || 0)}%
                      </span>
                    </div>
                    <Progress value={invoice?.payment_progress_pct || 0} className="h-3" />
                  </div>

                  {/* Tax Status */}
                  <div className="flex items-center gap-6 pt-2">
                    <TaxStatus label="PPN" paid={invoice?.ppn_paid || false} />
                    <TaxStatus label="PPh 23" paid={invoice?.pph23_paid || false} />
                  </div>

                  <p className="text-xs text-muted-foreground italic pt-2">
                    Catatan: Customer membayar Net Payable (Total - PPh 23 yang dipotong)
                  </p>
                </div>
              )}
            </CardContent>
          </MotionCard>

          {/* Payment History */}
          <MotionCard
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(designTokens.radius.lg, designTokens.border, designTokens.surface.base)}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Riwayat Pembayaran</CardTitle>
                <CardDescription>{payments.length} pembayaran tercatat</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setShowPaymentModal(true)}
                disabled={
                  invoice?.invoice_status === "PAID" ||
                  invoice?.invoice_status === "CANCELLED"
                }
              >
                <Plus className="mr-2 size-4" />
                Tambah Pembayaran
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Clock className="size-10 text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">Belum ada pembayaran</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment, index) => (
                    <PaymentCard key={payment.id} payment={payment} index={index + 1} />
                  ))}
                </div>
              )}
            </CardContent>
          </MotionCard>

          {/* Documents */}
          <MotionCard
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn(designTokens.radius.lg, designTokens.border, designTokens.surface.base)}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Dokumen Invoice</CardTitle>
                <CardDescription>{documents.length} dokumen</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDocumentModal(true)}
              >
                <Upload className="mr-2 size-4" />
                Upload Dokumen
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="size-10 text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">Belum ada dokumen</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload bukti bayar, BUPOT, atau dokumen lainnya
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {documents.map((doc) => (
                    <DocumentCard key={doc.id} document={doc} />
                  ))}
                </div>
              )}
            </CardContent>
          </MotionCard>
        </div>

        {/* Right Column - Actions Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Quick Actions */}
          <MotionCard
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(designTokens.radius.lg, designTokens.border, designTokens.surface.base)}
          >
            <CardHeader>
              <CardTitle className="text-base">Aksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice?.invoice_status === "DRAFT" && (
                <Button
                  className="w-full justify-start"
                  onClick={handleSendInvoice}
                  disabled={updateStatusMutation.isPending}
                >
                  <Send className="mr-2 size-4" />
                  Kirim Invoice
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowPaymentModal(true)}
                disabled={
                  invoice?.invoice_status === "PAID" ||
                  invoice?.invoice_status === "CANCELLED"
                }
              >
                <Plus className="mr-2 size-4" />
                Tambah Pembayaran
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowDocumentModal(true)}
              >
                <Upload className="mr-2 size-4" />
                Upload Dokumen
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Download className="mr-2 size-4" />
                Download PDF
              </Button>
              {invoice?.invoice_status !== "PAID" &&
                invoice?.invoice_status !== "CANCELLED" && (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleCancelInvoice}
                    disabled={updateStatusMutation.isPending}
                  >
                    <XCircle className="mr-2 size-4" />
                    Batalkan Invoice
                  </Button>
                )}
            </CardContent>
          </MotionCard>

          {/* Required Documents Checklist */}
          <MotionCard
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(designTokens.radius.lg, designTokens.border, designTokens.surface.base)}
          >
            <CardHeader>
              <CardTitle className="text-base">Dokumen Diperlukan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DocumentChecklist
                label="Bukti Bayar"
                uploaded={documents.some((d) => d.document_type === "BUKTI_BAYAR")}
              />
              <DocumentChecklist
                label="BUPOT PPh 23"
                uploaded={documents.some((d) => d.document_type === "BUPOT_PPH23")}
                warning={!invoice?.pph23_paid}
              />
              <DocumentChecklist
                label="Invoice PDF"
                uploaded={documents.some((d) => d.document_type === "INVOICE_PDF")}
              />
              <DocumentChecklist
                label="Faktur Pajak"
                uploaded={documents.some((d) => d.document_type === "FAKTUR_PAJAK")}
              />
            </CardContent>
          </MotionCard>

          {/* Notes */}
          {invoice?.notes && (
            <MotionCard
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(designTokens.radius.lg, designTokens.border, designTokens.surface.base)}
            >
              <CardHeader>
                <CardTitle className="text-base">Catatan</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </CardContent>
            </MotionCard>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        invoiceType={invoiceType}
        invoiceId={invoiceId}
        invoice={invoice}
        onSuccess={() => {
          refetch()
          setShowPaymentModal(false)
        }}
      />

      <UploadDocumentModal
        open={showDocumentModal}
        onOpenChange={setShowDocumentModal}
        invoiceType={invoiceType}
        invoiceId={invoiceId}
        payments={payments}
        onSuccess={() => {
          refetch()
          setShowDocumentModal(false)
        }}
      />
    </div>
  )
}

// Sub-components
interface PaymentCardProps {
  payment: PaymentTransaction
  index: number
}

const PaymentCard: React.FC<PaymentCardProps> = ({ payment, index }) => (
  <div className="rounded-lg border border-border/60 p-4 space-y-3">
    <div className="flex items-center justify-between">
      <span className="font-medium">Pembayaran #{index}</span>
      <span className="text-sm text-muted-foreground">{formatDateTime(payment.payment_date)}</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">Jumlah</span>
      <span className="font-bold text-lg text-emerald-600">
        {formatCurrency(payment.amount, { compact: false })}
      </span>
    </div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Metode</span>
      <span>{payment.payment_method || "—"}</span>
    </div>
    {payment.reference_number && (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">No. Referensi</span>
        <span className="font-mono">{payment.reference_number}</span>
      </div>
    )}
    <div className="flex items-center gap-4 pt-2">
      <TaxStatus label="PPN" paid={payment.ppn_included} />
      <TaxStatus label="PPh 23" paid={payment.pph23_included} />
    </div>
    {payment.notes && (
      <p className="text-sm text-muted-foreground pt-2 border-t border-border/50">
        {payment.notes}
      </p>
    )}
  </div>
)

interface DocumentCardProps {
  document: InvoiceDocument
}

const DocumentCard: React.FC<DocumentCardProps> = ({ document }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
    <div className="rounded-lg bg-muted/50 p-2">
      <FileText className="size-5 text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate">{document.file_name}</p>
      <p className="text-xs text-muted-foreground">
        {documentTypeLabels[document.document_type]} • {formatDateTime(document.uploaded_at)}
      </p>
    </div>
    <Button variant="ghost" size="icon" asChild>
      <a href={document.file_path} target="_blank" rel="noopener noreferrer">
        <Download className="size-4" />
        <span className="sr-only">Download</span>
      </a>
    </Button>
  </div>
)

interface DocumentChecklistProps {
  label: string
  uploaded: boolean
  warning?: boolean
}

const DocumentChecklist: React.FC<DocumentChecklistProps> = ({ label, uploaded, warning }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm">{label}</span>
    {uploaded ? (
      <CheckCircle2 className="size-4 text-emerald-500" />
    ) : warning ? (
      <span className="text-xs text-amber-600 flex items-center gap-1">
        <Clock className="size-3" />
        Menunggu
      </span>
    ) : (
      <Minus className="size-4 text-muted-foreground/50" />
    )}
  </div>
)
