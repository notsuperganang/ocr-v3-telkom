// Invoice Detail Page - Refactored with modular components
import * as React from "react"
import { useParams } from "react-router-dom"
import { XCircle } from "lucide-react"
import { toast } from "sonner"
import { motion } from "motion/react"

import { useInvoiceDetail, useSendInvoice } from "@/hooks/useInvoices"
import type { Invoice, InvoiceType } from "@/types/api"

import { Button } from "@/components/ui/button"

import AddPaymentModal from "@/components/AddPaymentModal"
import UploadDocumentModal from "@/components/UploadDocumentModal"
import EditNotesModal from "@/components/EditNotesModal"

// Import modular invoice components
import {
  InvoiceHeroHeader,
  InvoiceCustomerSummaryCard,
  PaymentBreakdownCard,
  PaymentHistoryCard,
  DocumentsCard,
  ActionsCard,
  telkomColors,
  staggerContainer,
  formatPeriod,
} from "@/components/invoices"
import type { InvoiceCustomerData } from "@/components/invoices"

// Animation variants for page
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

/**
 * Maps the Invoice API response to the unified InvoiceCustomerData structure
 */
const mapInvoiceToSummaryData = (
  invoice: Invoice,
  invoiceType: InvoiceType
): InvoiceCustomerData => ({
  // Section A: Invoice Info
  invoiceNumber: invoice.invoice_number,
  status: invoice.invoice_status,
  period: formatPeriod(invoice.period_month, invoice.period_year),
  periodMonth: invoice.period_month ?? undefined,
  periodYear: invoice.period_year ?? undefined,
  dueDate: invoice.due_date,
  invoiceType: invoiceType,

  // Section B: Customer Info
  customerName: invoice.customer_name,
  npwp: invoice.npwp,
  accountNumber: invoice.account_number,
  witel: invoice.witel_name,
  segment: invoice.segment_name || invoice.segment,
  address: invoice.customer_address,
  nipnas: invoice.nipnas,
  busArea: invoice.bus_area,

  // Section C: Business/Contract Context
  contractNumber: invoice.contract_number,
  contractPeriodStart: invoice.contract_start_date,
  contractPeriodEnd: invoice.contract_end_date,
  accountManager: invoice.account_manager_name,
  pic: invoice.assigned_officer_name,
})

// Main Page Component
export default function InvoiceDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>()

  const invoiceType = (type?.toUpperCase() || "TERM") as InvoiceType
  const invoiceId = id || ""

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = React.useState(false)
  const [showDocumentModal, setShowDocumentModal] = React.useState(false)
  const [showNotesModal, setShowNotesModal] = React.useState(false)

  // Fetch data
  const { data, isLoading, isError, refetch } = useInvoiceDetail(invoiceType, invoiceId)
  const sendInvoiceMutation = useSendInvoice()

  const invoice = data?.invoice
  const payments = data?.payments || []
  const documents = data?.documents || []

  // Handle send invoice
  const handleSendInvoice = async () => {
    if (!invoice) return
    try {
      await sendInvoiceMutation.mutateAsync({
        invoiceType,
        id: invoiceId,
      })
      toast.success("Invoice berhasil dikirim")
    } catch {
      toast.error("Gagal mengirim invoice")
    }
  }

  // Handle cancel invoice
  const handleCancelInvoice = async () => {
    if (!invoice) return
    // TODO: Backend doesn't have cancel endpoint yet
    toast.error("Fitur pembatalan invoice belum tersedia")
  }

  // Error state
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
    <motion.div
      className="flex flex-col gap-6 p-6 lg:p-8 min-h-screen"
      style={{ backgroundColor: telkomColors.gray50 }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Hero Header */}
      <InvoiceHeroHeader
        invoice={invoice}
        invoiceType={invoiceType}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onSendInvoice={handleSendInvoice}
        isSending={sendInvoiceMutation.isPending}
      />

      {/* Main Content Grid */}
      <motion.div
        className="grid gap-6 lg:grid-cols-3"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Left Column - Main Content (2/3) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Unified Invoice & Customer Summary Card */}
          <InvoiceCustomerSummaryCard
            data={invoice ? mapInvoiceToSummaryData(invoice, invoiceType) : undefined}
            isLoading={isLoading}
          />

          {/* Payment Breakdown */}
          <PaymentBreakdownCard invoice={invoice} isLoading={isLoading} />

          {/* Payment History */}
          <PaymentHistoryCard
            invoice={invoice}
            payments={payments}
            isLoading={isLoading}
            onAddPayment={() => setShowPaymentModal(true)}
            onRefresh={() => refetch()}
          />

          {/* Documents */}
          <DocumentsCard
            invoice={invoice}
            documents={documents}
            isLoading={isLoading}
            onUploadDocument={() => setShowDocumentModal(true)}
          />
        </div>

        {/* Right Column - Actions Sidebar (1/3) */}
        <div className="flex flex-col gap-6">
          <div className="sticky top-4 flex flex-col gap-6">
            <ActionsCard
              invoice={invoice}
              isLoading={isLoading}
              isSending={sendInvoiceMutation.isPending}
              isCancelling={false}
              onSendInvoice={handleSendInvoice}
              onCancelInvoice={handleCancelInvoice}
              onAddPayment={() => setShowPaymentModal(true)}
              onUploadDocument={() => setShowDocumentModal(true)}
              onEditNotes={() => setShowNotesModal(true)}
            />

            {/* Notes Card */}
            {invoice?.notes && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl border border-rose-100/80 bg-white p-5 shadow-lg shadow-rose-100/40"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-rose-500">
                      Catatan
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Catatan Invoice
                  </h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {invoice.notes}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

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

      <EditNotesModal
        open={showNotesModal}
        onOpenChange={setShowNotesModal}
        invoiceType={invoiceType}
        invoiceId={invoiceId}
        currentNotes={invoice?.notes}
        onSuccess={() => {
          refetch()
          setShowNotesModal(false)
        }}
      />
    </motion.div>
  )
}
