/**
 * InvoiceCustomerSummaryCard.tsx
 * 
 * A unified component that merges Invoice and Customer information into a single card.
 * This refactor eliminates data redundancy (e.g., Witel, Segment appearing in both cards)
 * and organizes information into logical sections following Atomic UI principles.
 * 
 * Benefits of this refactor:
 * - Single source of truth: No duplicate fields displayed
 * - Better UX: Related information grouped logically
 * - Reduced bundle size: One component instead of two
 * - Improved maintainability: Centralized prop interface
 * - Atomic design: Reusable sub-components for flexibility
 */

import * as React from "react"
import { motion } from "motion/react"
import {
  FileText,
  Hash,
  Calendar,
  Clock,
  Building2,
  User,
  MapPin,
  Briefcase,
  CreditCard,
  Users,
  FileCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { InvoiceStatus } from "@/types/api"
import { formatDate, formatPeriod, safeRenderValue } from "./invoice-utils"
import {
  Skeleton,
  StatusBadge,
  InfoRow,
  SectionHeader,
  HighlightCard,
  cardVariants,
} from "./InvoiceUIComponents"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Core data structure for the unified invoice-customer summary.
 * Designed for scalability with optional fields for flexibility.
 */
export interface InvoiceCustomerData {
  // Section A: Invoice Info
  invoiceNumber: string | null
  status: InvoiceStatus
  period: string | null
  periodMonth?: number
  periodYear?: number
  dueDate: string | null
  invoiceType?: "TERM" | "RECURRING"

  // Section B: Customer Info
  customerName: string | null
  npwp: string | null
  accountNumber: string | null
  witel: string | null
  segment: string | null
  address: string | null
  nipnas?: string | null
  busArea?: string | null

  // Section C: Business/Contract Context
  contractNumber: string | null
  contractPeriodStart: string | null
  contractPeriodEnd: string | null
  accountManager: string | null
  pic: string | null
}

export interface InvoiceCustomerSummaryCardProps {
  data: InvoiceCustomerData | undefined
  isLoading?: boolean
  className?: string
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Formats NPWP with proper Indonesian tax ID format
 */
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

/**
 * Formats date to DD-MM-YYYY format
 */
const formatDateNumeric = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—"
  try {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  } catch {
    return "—"
  }
}

/**
 * Calculates days until due or days overdue
 */
const getDueDateInfo = (dueDate: string | null) => {
  if (!dueDate) return null
  const dueDateObj = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDateObj.setHours(0, 0, 0, 0)

  const diffTime = dueDateObj.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)} hari lewat`, isOverdue: true }
  } else if (diffDays === 0) {
    return { text: "Jatuh tempo hari ini", isOverdue: false }
  } else {
    return { text: `${diffDays} hari lagi`, isOverdue: false }
  }
}

// =============================================================================
// ATOMIC SUB-COMPONENTS
// =============================================================================

/**
 * Section wrapper with consistent styling and animation
 */
interface SectionBoxProps {
  icon: LucideIcon
  tagText: string
  title: string
  children: React.ReactNode
}

const SectionBox: React.FC<SectionBoxProps> = ({
  icon: Icon,
  tagText,
  title,
  children,
}) => (
  <motion.div
    whileHover={{ y: -2 }}
    transition={{ duration: 0.2 }}
    className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-white via-white to-rose-50/70 p-3 shadow-sm"
  >
    <div className="relative space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-rose-50 p-1 text-rose-500">
          <Icon className="h-3 w-3" />
        </span>
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-rose-400">
            {tagText}
          </p>
          <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        </div>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  </motion.div>
)

/**
 * Hero section displaying the primary identifier (invoice number + customer)
 */
interface HeroSectionProps {
  data: InvoiceCustomerData
  dueDateInfo: { text: string; isOverdue: boolean } | null
}

const HeroSection: React.FC<HeroSectionProps> = ({ data, dueDateInfo }) => {
  const highlights = [
    {
      label: "Jatuh Tempo",
      value: formatDate(data.dueDate),
      helper: dueDateInfo?.text || "Tanggal pembayaran",
      icon: Calendar,
    },
    {
      label: "Periode",
      value: data.period || formatPeriod(data.periodMonth, data.periodYear),
      helper: "Periode penagihan",
      icon: Clock,
    },
    {
      label: "Pelanggan",
      value: safeRenderValue(data.customerName),
      helper: safeRenderValue(data.segment),
      icon: Building2,
    },
  ]

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-rose-50 via-white to-white p-3 shadow-sm"
    >
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-rose-400">
            Nomor Invoice
          </p>
          <h3 className="font-mono text-xl font-bold tracking-wide text-slate-900">
            {safeRenderValue(data.invoiceNumber)}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} size="lg" />
            {data.invoiceType && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-medium",
                  data.invoiceType === "TERM"
                    ? "border-indigo-200 bg-indigo-100 text-indigo-700"
                    : "border-violet-200 bg-violet-100 text-violet-700"
                )}
              >
                {data.invoiceType === "TERM" ? "Termin" : "Recurring"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          {highlights.map((hl) => (
            <HighlightCard
              key={hl.label}
              label={hl.label}
              value={hl.value}
              helper={hl.helper}
              icon={hl.icon}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const InvoiceCustomerSummaryCard: React.FC<InvoiceCustomerSummaryCardProps> = ({
  data,
  isLoading = false,
  className,
}) => {
  const dueDateInfo = data ? getDueDateInfo(data.dueDate) : null

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ y: -2 }}
      transition={{ delay: 0.1 }}
      className={className}
    >
      <Card className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <CardHeader className="border-b border-gray-200 bg-gradient-to-br from-white via-white to-rose-50 p-6">
          <SectionHeader
            icon={FileText}
            tag="Ringkasan"
            title="Informasi Invoice & Pelanggan"
            description="Detail tagihan, identitas pelanggan, dan konteks bisnis"
            rightIcon={Users}
          />
        </CardHeader>
        <CardContent className="space-y-3 bg-white p-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : data ? (
            <>
              {/* Hero: Invoice Number + Status + Key Highlights */}
              <HeroSection data={data} dueDateInfo={dueDateInfo} />

              {/* Three-column grid with custom widths: narrower invoice, wider contract */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.8fr_1fr_1.2fr]">
                {/* Section A: Invoice Info - Narrower */}
                <SectionBox
                  icon={FileCheck}
                  tagText="Invoice"
                  title="Detail Tagihan"
                >
                  <InfoRow
                    label="No. Invoice"
                    value={safeRenderValue(data.invoiceNumber)}
                    icon={Hash}
                    monospace
                  />
                  <InfoRow
                    label="Jatuh Tempo"
                    value={formatDate(data.dueDate)}
                    icon={Calendar}
                  />
                  <InfoRow
                    label="Periode"
                    value={data.period || formatPeriod(data.periodMonth, data.periodYear)}
                    icon={Clock}
                  />
                </SectionBox>

                {/* Section B: Customer Info */}
                <SectionBox
                  icon={Building2}
                  tagText="Pelanggan"
                  title="Identitas Pelanggan"
                >
                  <InfoRow
                    label="Nama"
                    value={safeRenderValue(data.customerName)}
                    icon={User}
                  />
                  <InfoRow
                    label="NPWP"
                    value={formatNPWP(data.npwp)}
                    icon={Hash}
                    monospace
                  />
                  <InfoRow
                    label="Segmen"
                    value={safeRenderValue(data.segment)}
                    icon={Briefcase}
                  />
                  {data.address && (
                    <InfoRow
                      label="Alamat"
                      value={safeRenderValue(data.address)}
                      icon={MapPin}
                    />
                  )}
                </SectionBox>

                {/* Section C: Business/Contract Context - Wider */}
                <SectionBox
                  icon={CreditCard}
                  tagText="Kontrak"
                  title="Konteks Bisnis"
                >
                  <InfoRow
                    label="No. Kontrak"
                    value={safeRenderValue(data.contractNumber)}
                    icon={Hash}
                    monospace
                  />
                  <InfoRow
                    label="Periode Kontrak"
                    value={
                      data.contractPeriodStart && data.contractPeriodEnd
                        ? `${formatDateNumeric(data.contractPeriodStart)} s/d ${formatDateNumeric(data.contractPeriodEnd)}`
                        : "—"
                    }
                    icon={Calendar}
                  />
                  {data.accountManager && (
                    <InfoRow
                      label="Account Manager"
                      value={data.accountManager}
                      icon={User}
                    />
                  )}
                  {data.pic && (
                    <InfoRow
                      label="PIC"
                      value={data.pic}
                      icon={User}
                    />
                  )}
                </SectionBox>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Data tidak tersedia
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Loading skeleton for the summary card
 */
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-3">
    <Skeleton className="h-24 w-full" />
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
)

export default InvoiceCustomerSummaryCard
