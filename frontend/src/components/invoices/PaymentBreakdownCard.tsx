// Payment Breakdown Card Component
import * as React from "react"
import { motion } from "motion/react"
import { Calculator, TrendingUp, Wallet, DollarSign } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/utils"
import type { Invoice } from "@/types/api"
import {
  Skeleton,
  TaxStatus,
  cardVariants,
} from "./InvoiceUIComponents"

interface PaymentBreakdownCardProps {
  invoice: Invoice | undefined
  isLoading: boolean
}

export const PaymentBreakdownCard: React.FC<PaymentBreakdownCardProps> = ({
  invoice,
  isLoading,
}) => {
  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ y: -2 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <CardHeader className="relative border-b border-gray-200 bg-gradient-to-br from-white via-white to-rose-50 p-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
              <Calculator className="h-3.5 w-3.5" />
              Pembayaran
            </span>
            <h3 className="text-xl font-semibold text-slate-900">Rincian Pembayaran</h3>
            <p className="text-sm text-slate-500 max-w-2xl">
              Perhitungan PPh 23 Withholding - Pelanggan membayar Net Payable
            </p>
          </div>
        </CardHeader>
        <CardContent className="bg-white p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {/* Amount Breakdown - Grid Layout */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Tax Calculation Card */}
                <motion.div
                  whileHover={{ y: -4 }}
                  className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm"
                >
                  <p className="mb-3 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500">
                      <Calculator className="h-3.5 w-3.5" />
                    </span>
                    Perhitungan Pajak
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">DPP</span>
                      <span className="font-medium text-slate-700">
                        {formatCurrency(invoice?.base_amount || "0", { compact: false })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">PPN 11%</span>
                      <span className="font-medium text-slate-700">
                        {formatCurrency(invoice?.ppn_amount || "0", { compact: false })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-2">
                      <span className="font-semibold text-slate-700">Total Invoice</span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(invoice?.amount || "0", { compact: false })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">PPh 23 (2%)</span>
                      <span className="font-medium text-red-600">
                        - {formatCurrency(invoice?.pph_amount || "0", { compact: false })}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Net Payable Highlight */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="rounded-xl border-2 border-rose-300 bg-gradient-to-br from-white via-white to-rose-50 p-4 shadow-md"
                >
                  <p className="mb-3 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-500">
                    <span className="rounded-full bg-rose-100 p-1 text-rose-600">
                      <DollarSign className="h-3.5 w-3.5" />
                    </span>
                    Net Payable
                  </p>
                  <div className="space-y-3">
                    <p className="text-3xl font-bold text-rose-700">
                      {formatCurrency(invoice?.net_payable_amount || "0", { compact: false })}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Jumlah yang dibayar pelanggan (Total Invoice - PPh 23)
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Payment Progress Section */}
              <motion.div
                whileHover={{ y: -4 }}
                className="rounded-xl border border-emerald-100/70 bg-gradient-to-br from-white via-white to-emerald-50 p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <span className="rounded-full bg-white/70 p-2 shadow-inner shadow-emerald-100">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </span>
                  Status Pembayaran
                </div>

                {/* Payment Amounts Grid */}
                <div className="grid gap-4 mb-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-2">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-1">
                      Sudah Dibayar
                    </p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(invoice?.paid_amount || "0", { compact: false })}
                    </p>
                  </div>
                  <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/60 px-3 py-2">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-orange-400 mb-1">
                      Outstanding
                    </p>
                    <p className="text-lg font-bold text-orange-600">
                      {formatCurrency(invoice?.outstanding_amount || "0", { compact: false })}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Progress Pembayaran</span>
                    <span className="font-bold text-emerald-700">
                      {Math.round(invoice?.payment_progress_pct || 0)}%
                    </span>
                  </div>
                  <Progress
                    value={invoice?.payment_progress_pct || 0}
                    className="h-2.5"
                  />
                </div>
              </motion.div>

              {/* Tax Status & Info Section */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Tax Status */}
                <motion.div
                  whileHover={{ y: -4 }}
                  className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm"
                >
                  <p className="mb-3 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500">
                      <Wallet className="h-3.5 w-3.5" />
                    </span>
                    Status Pajak
                  </p>
                  <div className="flex items-center gap-6">
                    <TaxStatus label="PPN" paid={invoice?.ppn_paid || false} />
                    <TaxStatus label="PPh 23" paid={invoice?.pph23_paid || false} />
                  </div>
                </motion.div>

                {/* Info Note */}
                <div className="rounded-xl border border-rose-100/70 bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
                  <p className="font-semibold text-slate-800 mb-1">Catatan:</p>
                  <p>
                    PPh 23 (2%) dipotong oleh pelanggan dan disetor langsung ke kantor pajak.
                    Customer membayar Net Payable.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default PaymentBreakdownCard
