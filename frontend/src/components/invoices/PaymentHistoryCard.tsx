// Payment History Card Component
import * as React from "react"
import { motion } from "motion/react"
import { Clock, Plus, History, CreditCard, Hash, Calendar, Edit2, Trash2, User } from "lucide-react"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatCurrency } from "@/lib/utils"
import type { Invoice, PaymentTransaction } from "@/types/api"
import { formatDateTime, formatDate } from "./invoice-utils"
import {
  Skeleton,
  TaxStatus,
  SectionHeader,
  EmptyState,
  cardVariants,
} from "./InvoiceUIComponents"
import EditPaymentModal from "@/components/EditPaymentModal"
import { useDeletePayment } from "@/hooks/useInvoices"

interface PaymentHistoryCardProps {
  invoice: Invoice | undefined
  payments: PaymentTransaction[]
  isLoading: boolean
  onAddPayment: () => void
  onRefresh?: () => void
}

// Payment Card sub-component
interface PaymentCardProps {
  payment: PaymentTransaction
  index: number
  invoice: Invoice | undefined
  onRefresh: () => void
}

const PaymentCard: React.FC<PaymentCardProps> = ({ payment, index, invoice, onRefresh }) => {
  const [showEditModal, setShowEditModal] = React.useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = React.useState(false)
  const deletePaymentMutation = useDeletePayment()

  const handleDelete = async () => {
    try {
      await deletePaymentMutation.mutateAsync(parseInt(payment.id))
      toast.success("Pembayaran berhasil dihapus")
      onRefresh()
    } catch (error) {
      toast.error("Gagal menghapus pembayaran")
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ y: -2 }}
        className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-sm font-bold">
              #{index}
            </span>
            <div>
              <span className="font-semibold text-slate-900">Pembayaran #{index}</span>
              <p className="text-xs text-slate-500">
                Tanggal Bayar: {formatDate(payment.payment_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-emerald-600">
              {formatCurrency(payment.amount, { compact: false })}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => setShowEditModal(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => setShowDeleteAlert(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-500">Metode:</span>
            <span className="font-medium text-slate-700">
              {payment.payment_method || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-500">Dibuat oleh:</span>
            <span className="font-medium text-slate-700">
              {payment.created_by || "—"}
            </span>
          </div>
          {payment.reference_number && (
            <div className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500">Ref:</span>
              <span className="font-mono text-sm text-slate-700">
                {payment.reference_number}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-500">Dicatat:</span>
            <span className="font-medium text-slate-700">
              {formatDateTime(payment.created_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
          <TaxStatus label="PPN" paid={payment.ppn_included} />
          {/* <TaxStatus label="PPh 23" paid={payment.pph23_included} /> */}
        </div>

        {payment.notes && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Catatan:</p>
            <p className="text-sm text-slate-700">{payment.notes}</p>
          </div>
        )}
      </motion.div>

      {/* Edit Payment Modal */}
      <EditPaymentModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        payment={payment}
        invoice={invoice}
        onSuccess={() => {
          setShowEditModal(false)
          onRefresh()
        }}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pembayaran sebesar{" "}
              <span className="font-bold text-slate-900">
                {formatCurrency(payment.amount, { compact: false })}
              </span>
              ? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePaymentMutation.isPending}
            >
              {deletePaymentMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export const PaymentHistoryCard: React.FC<PaymentHistoryCardProps> = ({
  invoice,
  payments,
  isLoading,
  onAddPayment,
  onRefresh,
}) => {
  // Check if payment amount is already fulfilled (even if waiting for BUPOT)
  const outstandingAmount = parseFloat(invoice?.outstanding_amount || "0")
  const canAddPayment =
    invoice?.invoice_status !== "PAID" &&
    invoice?.invoice_status !== "CANCELLED" &&
    outstandingAmount > 1 // Allow payment only if outstanding > Rp 1 (account for rounding)

  // Callback to force refresh (passed to PaymentCard)
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh()
    }
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ y: -2 }}
      transition={{ delay: 0.25 }}
    >
      <Card className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-200 bg-gradient-to-br from-white via-white to-rose-50 p-3">
          <div className="flex flex-row items-start justify-between">
            <SectionHeader
              icon={History}
              tag="Riwayat"
              title="Riwayat Pembayaran"
              description={`${payments.length} pembayaran tercatat`}
            />
            {canAddPayment && (
              <Button
                size="sm"
                onClick={onAddPayment}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                <Plus className="mr-2 size-4" />
                Tambah Pembayaran
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="bg-white p-3">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Belum ada pembayaran"
              description="Klik tombol 'Tambah Pembayaran' untuk mencatat pembayaran baru"
            />
          ) : (
            <div className="space-y-3">
              {payments.map((payment, index) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  index={index + 1}
                  invoice={invoice}
                  onRefresh={handleRefresh}
                />
              ))}

              {/* Summary */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">
                      Total {payments.length} Pembayaran
                    </span>
                  </div>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(invoice?.paid_amount || "0", { compact: false })}
                  </span>
                </div>
              </motion.div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default PaymentHistoryCard
