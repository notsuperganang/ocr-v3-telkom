// Actions Card Component (Sidebar)
import * as React from "react"
import { motion } from "motion/react"
import {
  Send,
  Plus,
  Upload,
  FileText,
  XCircle,
  RotateCcw,
  Settings,
  Zap,
  FileEdit,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Invoice } from "@/types/api"
import { Skeleton, cardVariants } from "./InvoiceUIComponents"
import { apiService } from "@/services/api"
import { toast } from "sonner"

interface ActionsCardProps {
  invoice: Invoice | undefined
  isLoading: boolean
  isSending: boolean
  isCancelling: boolean
  isUncancelling: boolean
  onSendInvoice: () => void
  onCancelInvoice: () => void
  onUncancelInvoice: () => void
  onAddPayment: () => void
  onUploadDocument: () => void
  onEditNotes: () => void
}

export const ActionsCard: React.FC<ActionsCardProps> = ({
  invoice,
  isLoading,
  isSending,
  isCancelling,
  isUncancelling,
  onSendInvoice,
  onCancelInvoice,
  onUncancelInvoice,
  onAddPayment,
  onUploadDocument,
  onEditNotes,
}) => {
  const isDraft = invoice?.invoice_status === "DRAFT"
  const isPaid = invoice?.invoice_status === "PAID"
  const isCancelled = invoice?.invoice_status === "CANCELLED"
  const canModify = !isPaid && !isCancelled

  // Check if payment amount is already fulfilled (even if waiting for BUPOT)
  const outstandingAmount = parseFloat(invoice?.outstanding_amount || "0")
  const canAddPayment =
    canModify && outstandingAmount > 1 // Allow payment only if outstanding > Rp 1

  // Handle view contract in new tab
  const handleViewContract = async () => {
    if (!invoice?.contract_id) return
    
    try {
      // Fetch the PDF with authentication
      const pdfBlob = await apiService.getContractPdfStream(invoice.contract_id)
      
      // Create a blob URL and open it in a new tab
      const blobUrl = URL.createObjectURL(pdfBlob)
      window.open(blobUrl, '_blank')
      
      // Clean up the blob URL after a delay to allow the browser to load it
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
    } catch (error) {
      console.error('Failed to open contract PDF:', error)
      toast.error('Gagal membuka kontrak PDF')
    }
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ y: -2 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm h-full">
        <CardHeader className="border-b border-gray-200 bg-gradient-to-br from-white via-white to-rose-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-rose-500">
                <Zap className="h-3 w-3" />
                Aksi
              </span>
            </div>
            <span className="rounded-full bg-white/80 p-1.5 shadow-inner shadow-rose-100">
              <Settings className="h-4 w-4 text-rose-500" />
            </span>
          </div>
          <CardTitle className="text-base font-semibold text-slate-900 mt-2">
            Aksi Cepat
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white p-3 space-y-3 flex flex-col">
          {isLoading ? (
            <div className="space-y-3 flex-1">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              {/* Send Invoice - only for DRAFT */}
              {isDraft && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    className="w-full justify-start bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-md h-12 text-base"
                    onClick={onSendInvoice}
                    disabled={isSending}
                  >
                    <Send className="mr-2 size-5" />
                    {isSending ? "Mengirim..." : "Kirim Invoice"}
                  </Button>
                </motion.div>
              )}

              {/* Add Payment - only show if outstanding amount > 1 */}
              {canAddPayment && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full justify-start border-2 border-slate-200 hover:bg-slate-600 hover:border-slate-600 hover:text-white font-semibold h-12 text-base transition-all"
                    onClick={onAddPayment}
                  >
                    <Plus className="mr-2 size-5" />
                    Tambah Pembayaran
                  </Button>
                </motion.div>
              )}

              {/* Upload Document */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full justify-start border-2 border-slate-200 hover:bg-slate-600 hover:border-slate-600 hover:text-white font-semibold h-12 text-base transition-all"
                  onClick={onUploadDocument}
                >
                  <Upload className="mr-2 size-5" />
                  Upload Dokumen
                </Button>
              </motion.div>

              {/* View Contract */}
              {invoice?.contract_id && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full justify-start border-2 border-slate-200 hover:bg-slate-600 hover:border-slate-600 hover:text-white font-semibold h-12 text-base transition-all"
                    onClick={handleViewContract}
                  >
                    <FileText className="mr-2 size-5" />
                    Lihat Kontrak
                  </Button>
                </motion.div>
              )}

              {/* Edit Notes */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full justify-start border-2 border-blue-200 hover:bg-blue-600 hover:border-blue-600 hover:text-white font-semibold h-12 text-base transition-all"
                  onClick={onEditNotes}
                >
                  <FileEdit className="mr-2 size-5" />
                  Edit Catatan
                </Button>
              </motion.div>

              {/* Cancel Invoice */}
              {canModify && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full justify-start border-2 border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300 font-semibold h-12 text-base"
                    onClick={onCancelInvoice}
                    disabled={isCancelling}
                  >
                    <XCircle className="mr-2 size-5" />
                    {isCancelling ? "Membatalkan..." : "Batalkan Invoice"}
                  </Button>
                </motion.div>
              )}

              {/* Uncancel Invoice - only visible when CANCELLED */}
              {isCancelled && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full justify-start border-2 border-amber-200 text-amber-700 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-300 font-semibold h-12 text-base"
                    onClick={onUncancelInvoice}
                    disabled={isUncancelling}
                  >
                    <RotateCcw className="mr-2 size-5" />
                    {isUncancelling ? "Memproses..." : "Batalkan Pembatalan"}
                  </Button>
                </motion.div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default ActionsCard
