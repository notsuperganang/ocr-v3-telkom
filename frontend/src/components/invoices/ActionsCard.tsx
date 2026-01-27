// Actions Card Component (Sidebar)
import * as React from "react"
import { motion } from "motion/react"
import {
  Send,
  Plus,
  Upload,
  Download,
  XCircle,
  Settings,
  Zap,
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

interface ActionsCardProps {
  invoice: Invoice | undefined
  isLoading: boolean
  isSending: boolean
  isCancelling: boolean
  onSendInvoice: () => void
  onCancelInvoice: () => void
  onAddPayment: () => void
  onUploadDocument: () => void
}

export const ActionsCard: React.FC<ActionsCardProps> = ({
  invoice,
  isLoading,
  isSending,
  isCancelling,
  onSendInvoice,
  onCancelInvoice,
  onAddPayment,
  onUploadDocument,
}) => {
  const isDraft = invoice?.invoice_status === "DRAFT"
  const isPaid = invoice?.invoice_status === "PAID"
  const isCancelled = invoice?.invoice_status === "CANCELLED"
  const canModify = !isPaid && !isCancelled

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ y: -4 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
        <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-rose-500">
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
        <CardContent className="bg-white p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              {/* Send Invoice - only for DRAFT */}
              {isDraft && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full justify-start bg-rose-600 hover:bg-rose-700 text-white"
                    onClick={onSendInvoice}
                    disabled={isSending}
                  >
                    <Send className="mr-2 size-4" />
                    {isSending ? "Mengirim..." : "Kirim Invoice"}
                  </Button>
                </motion.div>
              )}

              {/* Add Payment */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 hover:bg-slate-50"
                  onClick={onAddPayment}
                  disabled={!canModify}
                >
                  <Plus className="mr-2 size-4" />
                  Tambah Pembayaran
                </Button>
              </motion.div>

              {/* Upload Document */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 hover:bg-slate-50"
                  onClick={onUploadDocument}
                >
                  <Upload className="mr-2 size-4" />
                  Upload Dokumen
                </Button>
              </motion.div>

              {/* Download PDF */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  className="w-full justify-start border-slate-200 hover:bg-slate-50"
                >
                  <Download className="mr-2 size-4" />
                  Download PDF
                </Button>
              </motion.div>

              {/* Cancel Invoice */}
              {canModify && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={onCancelInvoice}
                    disabled={isCancelling}
                  >
                    <XCircle className="mr-2 size-4" />
                    {isCancelling ? "Membatalkan..." : "Batalkan Invoice"}
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
