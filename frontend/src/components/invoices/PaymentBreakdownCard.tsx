// Payment Breakdown Card Component
import * as React from "react"
import { motion } from "motion/react"
import { Calculator, TrendingUp, Wallet } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils"
import type { Invoice } from "@/types/api"
import {
  Skeleton,
  TaxStatus,
  SectionHeader,
  InfoCardItem,
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
      whileHover={{ y: -4 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
        <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
          <SectionHeader
            icon={Calculator}
            tag="Pembayaran"
            title="Rincian Pembayaran"
            description="Perhitungan PPh 23 Withholding - Pelanggan membayar Net Payable"
            rightIcon={Wallet}
          />
        </CardHeader>
        <CardContent className="bg-white p-5">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Amount breakdown */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Calculator className="h-4 w-4 text-slate-500" />
                  Perhitungan Nilai
                </div>

                <div className="space-y-2">
                  <InfoCardItem
                    label="Base Amount (DPP)"
                    value={formatCurrency(invoice?.base_amount || "0", { compact: false })}
                  />
                  <InfoCardItem
                    label="PPN 11%"
                    value={formatCurrency(invoice?.ppn_amount || "0", { compact: false })}
                  />
                  <Separator className="my-2" />
                  <InfoCardItem
                    label="Total Invoice"
                    value={
                      <span className="font-bold">
                        {formatCurrency(invoice?.amount || "0", { compact: false })}
                      </span>
                    }
                    className="font-medium"
                  />
                  <InfoCardItem
                    label="PPh 23 (2% dipotong)"
                    value={
                      <span className="text-red-600">
                        - {formatCurrency(invoice?.pph_amount || "0", { compact: false })}
                      </span>
                    }
                  />
                </div>
              </motion.div>

              {/* Net Payable highlight */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="rounded-2xl border-2 border-rose-200 bg-gradient-to-r from-rose-50 to-white p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                      Net Payable
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Jumlah yang dibayar pelanggan
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-rose-600">
                    {formatCurrency(invoice?.net_payable_amount || "0", { compact: false })}
                  </p>
                </div>
              </motion.div>

              {/* Payment Status */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <TrendingUp className="h-4 w-4" />
                  Status Pembayaran
                </div>

                <div className="space-y-2">
                  <InfoCardItem
                    label="Sudah Dibayar"
                    value={
                      <span className="text-emerald-600 font-bold">
                        {formatCurrency(invoice?.paid_amount || "0", { compact: false })}
                      </span>
                    }
                  />
                  <InfoCardItem
                    label="Outstanding"
                    value={
                      <span className="text-orange-600 font-bold">
                        {formatCurrency(invoice?.outstanding_amount || "0", { compact: false })}
                      </span>
                    }
                  />
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress Pembayaran</span>
                    <span className="font-semibold">
                      {Math.round(invoice?.payment_progress_pct || 0)}%
                    </span>
                  </div>
                  <Progress
                    value={invoice?.payment_progress_pct || 0}
                    className="h-3"
                  />
                </div>
              </motion.div>

              {/* Tax Status */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-slate-100 bg-white p-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                  <Wallet className="h-4 w-4" />
                  Status Pajak
                </div>
                <div className="flex items-center gap-6">
                  <TaxStatus label="PPN" paid={invoice?.ppn_paid || false} />
                  <TaxStatus label="PPh 23" paid={invoice?.pph23_paid || false} />
                </div>
              </motion.div>

              {/* Info note */}
              <p className="text-xs text-muted-foreground italic px-1">
                * PPh 23 (2%) dipotong oleh pelanggan dan disetor langsung ke kantor pajak.
                Customer membayar Net Payable = Total Invoice - PPh 23.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default PaymentBreakdownCard
