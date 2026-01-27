// Customer Information Card Component
import * as React from "react"
import { motion } from "motion/react"
import {
  Building2,
  User,
  Hash,
  MapPin,
  Phone,
  Briefcase,
  Users,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import type { Invoice } from "@/types/api"
import { safeRenderValue } from "./invoice-utils"
import {
  Skeleton,
  InfoRow,
  SectionHeader,
  HighlightCard,
  cardVariants,
} from "./InvoiceUIComponents"

interface CustomerInfoCardProps {
  invoice: Invoice | undefined
  isLoading: boolean
}

export const CustomerInfoCard: React.FC<CustomerInfoCardProps> = ({
  invoice,
  isLoading,
}) => {
  // Format NPWP with proper formatting
  const formatNPWP = (npwp: string | null | undefined): string => {
    if (!npwp) return "—"
    const digits = npwp.replace(/\D/g, "")
    if (digits.length !== 15 && digits.length !== 16) return npwp
    // Format: XX.XXX.XXX.X-XXX.XXX
    if (digits.length === 15) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12, 15)}`
    }
    // 16 digit NPWP format
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12, 16)}`
  }

  // Customer highlights
  const customerHighlights = [
    {
      label: "NPWP",
      value: formatNPWP(invoice?.npwp),
      helper: invoice?.npwp ? "Nomor Pokok Wajib Pajak" : "Belum tersedia",
      icon: Hash,
      monospace: true,
    },
    {
      label: "Witel",
      value: safeRenderValue(invoice?.witel_name),
      helper: "Wilayah Telekomunikasi",
      icon: Building2,
    },
    {
      label: "Segmen",
      value: safeRenderValue(invoice?.segment_name || invoice?.segment),
      helper: "Kategori pelanggan",
      icon: Briefcase,
    },
  ]

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ y: -4 }}
      transition={{ delay: 0.15 }}
    >
      <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
        <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
          <SectionHeader
            icon={Building2}
            tag="Pelanggan"
            title="Informasi Pelanggan"
            description="Data identitas dan informasi pelanggan"
            rightIcon={Users}
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
              {/* Hero section with customer name */}
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden rounded-3xl border border-rose-100/80 bg-gradient-to-br from-rose-50 via-white to-white p-4 shadow-inner"
              >
                <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-rose-100/60 blur-3xl" />
                <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-400">
                      Nama Pelanggan
                    </p>
                    <h3 className="text-xl font-bold text-slate-900">
                      {safeRenderValue(invoice?.customer_name)}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Detail identitas dan informasi kontak pelanggan pada invoice ini.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:max-w-xs">
                    {customerHighlights.map((highlight) => (
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

              {/* Detail sections */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Company Profile */}
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50/70 p-4 shadow-sm"
                >
                  <div className="absolute right-4 top-4 h-12 w-12 rounded-full bg-rose-100/40 blur-2xl" />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-rose-50 p-1.5 text-rose-500">
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-rose-400">
                          Profil
                        </p>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Informasi Perusahaan
                        </h4>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <InfoRow
                        label="Nama Pelanggan"
                        value={safeRenderValue(invoice?.customer_name)}
                        icon={User}
                      />
                      <InfoRow
                        label="NPWP"
                        value={formatNPWP(invoice?.npwp)}
                        icon={Hash}
                        monospace
                      />
                      <InfoRow
                        label="Alamat"
                        value={safeRenderValue(invoice?.customer_address)}
                        icon={MapPin}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Account Details */}
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50/70 p-4 shadow-sm"
                >
                  <div className="absolute left-4 top-4 h-12 w-12 rounded-full bg-rose-100/50 blur-2xl" />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-rose-50 p-1.5 text-rose-500">
                        <Briefcase className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-rose-400">
                          Detail
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
                        label="NIPNAS"
                        value={safeRenderValue(invoice?.nipnas)}
                        icon={Hash}
                        monospace
                      />
                      <InfoRow
                        label="Business Area"
                        value={safeRenderValue(invoice?.bus_area)}
                        icon={Building2}
                      />
                      {invoice?.account_manager_name && (
                        <InfoRow
                          label="Account Manager"
                          value={invoice.account_manager_name}
                          icon={User}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Notes section if available */}
              {invoice?.account_notes && (
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="rounded-full bg-amber-100 p-1.5 text-amber-600">
                      <Phone className="h-3.5 w-3.5" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">
                        Catatan Akun
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {invoice.account_notes}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default CustomerInfoCard
