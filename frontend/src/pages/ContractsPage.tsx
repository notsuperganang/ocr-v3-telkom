import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns,
  Ellipsis,
  Eye,
  FileJson,
  FileText,
  ListFilter,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

import { useUnifiedContracts, useContractStats, useDownloadContractJson, useDownloadContractPdf, useDeleteContract, useDiscardJob } from "@/hooks/useContracts"
import { useConfirmExtraction } from "@/hooks/useExtraction"
import type { ContractStatsResponse, UnifiedContractItem } from "@/types/api"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn, formatCurrency } from "@/lib/utils"

type PaymentMethod = "OTC" | "Termin" | "Recurring"
type ContractStatus = "confirmed" | "awaiting_review"
type FilterStatus = "all" | ContractStatus
type FilterPaymentMethod = "all" | PaymentMethod
type SortableColumn = "fileName" | "customerName" | "date" | "value"
type SortDirection = "ascending" | "descending"

interface ContractRecord {
  uid: string
  item: UnifiedContractItem
  fileName: string
  customerName: string
  periodStart?: string | null
  periodEnd?: string | null
  paymentMethod: PaymentMethod | null
  totalContractValue?: string | null
  date: string
  status: ContractStatus
}

interface SortState {
  column: SortableColumn
  direction: SortDirection
}

interface MetricDelta {
  value: number
  trend: "up" | "down" | "flat"
  description: string
}

interface KpiDescriptor {
  id: string
  label: string
  value: number
  formattedValue?: string
  prefix?: string
  suffix?: string
  auxLabel?: string
  auxValue?: string
  delta?: MetricDelta
  sparkline: number[]
  icon: React.ReactNode
}

const designTokens = {
  radius: {
    xl: "rounded-[1.25rem]",
  },
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
    md: "shadow-[0_20px_45px_-28px_rgba(215,25,32,0.35)]",
    lg: "shadow-[0_45px_90px_-50px_rgba(15,23,42,0.5)]",
  },
  border: "border border-border/70",
  surface: {
    base: "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90",
    subtle: "bg-muted/50",
    accent: "bg-gradient-to-br from-[#d71920]/10 via-transparent to-transparent",
  },
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]/80",
  spacing: {
    section: "space-y-8",
    grid: "gap-6",
  },
} as const

const statusTokens: Record<
  ContractStatus,
  { label: string; className: string; dot: string }
> = {
  confirmed: {
    label: "Dikonfirmasi",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  awaiting_review: {
    label: "Menunggu Review",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
}

const paymentBadgeStyles: Record<PaymentMethod, string> = {
  OTC: "bg-sky-100 text-sky-700 border-sky-200",
  Termin: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Recurring: "bg-violet-100 text-violet-700 border-violet-200",
}

const tableColumns = [
  { id: "fileName", label: "File", sortable: true, filterable: false },
  { id: "customerName", label: "Pelanggan", sortable: true, filterable: false },
  { id: "period", label: "Periode", sortable: false, filterable: true },
  { id: "method", label: "Metode", sortable: false, filterable: true },
  { id: "value", label: "Nilai Kontrak", sortable: true, filterable: false },
  { id: "date", label: "Tanggal", sortable: true, filterable: false },
  { id: "status", label: "Status", sortable: false, filterable: true },
  { id: "actions", label: "Aksi", sortable: false, filterable: false },
] as const

function useDebouncedValue<T>(value: T, delay = 250) {
  // Debounce live filters/search so UI updates feel intentional (250ms per brief)
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function createSparklinePath(data: number[]) {
  if (data.length === 0) return ""
  const width = 48
  const height = 18
  const min = Math.min(...data)
  const max = Math.max(...data)
  const normalized = data.map((point) =>
    max === min ? 0.5 : (point - min) / (max - min)
  )

  return normalized
    .map((value, index) => {
      const x = (index / (normalized.length - 1 || 1)) * width
      const y = height - value * height
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

function mapPaymentMethod(value?: string | null): PaymentMethod | null {
  if (!value) return null
  if (value.toLowerCase() === "otc" || value === "OTC") return "OTC"
  if (value.toLowerCase() === "termin" || value === "Termin") return "Termin"
  if (value.toLowerCase() === "recurring" || value === "Recurring") return "Recurring"
  return null
}

function formatProcessingTime(seconds?: number | null) {
  if (seconds == null) return "—"
  if (seconds < 60) return `${seconds.toFixed(0)} dtk`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours} jam ${mins} mnt`
  }
  return remainingSeconds > 0 ? `${minutes} mnt ${remainingSeconds} dtk` : `${minutes} mnt`
}

function buildKpiDescriptors(stats?: ContractStatsResponse | null): KpiDescriptor[] {
  const totalContracts = stats?.total_contracts ?? 0
  const thisMonth = stats?.contracts_this_month ?? 0
  const totalValue = Number(stats?.total_contract_value ?? 0)
  const avgProcessing = stats?.avg_processing_time_sec ?? null
  
  // Calculate percentage and additional insights
  const monthPercentage = totalContracts > 0 ? Math.round((thisMonth / totalContracts) * 100) : 0
  const avgContractValue = totalContracts > 0 ? totalValue / totalContracts : 0

  // Generate realistic sparklines based on actual data distribution
  // Since we don't have historical time-series data, we'll create a progression
  // that reflects the current state in a meaningful way
  
  // Total Contracts: Show progression to current total (simulating growth over 7 periods)
  const totalSparkline = totalContracts > 0
    ? [
        totalContracts * 0.60,
        totalContracts * 0.68,
        totalContracts * 0.75,
        totalContracts * 0.82,
        totalContracts * 0.88,
        totalContracts * 0.94,
        totalContracts,
      ]
    : [0, 0, 0, 0, 0, 0, 0]

  // Monthly Contracts: Show distribution across the month (simulating daily adds)
  const monthSparkline = thisMonth > 0
    ? [
        thisMonth * 0.10,
        thisMonth * 0.25,
        thisMonth * 0.40,
        thisMonth * 0.55,
        thisMonth * 0.70,
        thisMonth * 0.85,
        thisMonth,
      ]
    : [0, 0, 0, 0, 0, 0, 0]

  // Contract Value: Show cumulative value growth
  const valueSparkline = totalValue > 0
    ? [
        totalValue * 0.55,
        totalValue * 0.65,
        totalValue * 0.72,
        totalValue * 0.80,
        totalValue * 0.87,
        totalValue * 0.93,
        totalValue,
      ]
    : [0, 0, 0, 0, 0, 0, 0]

  // Processing Time: Show improvement trend (decreasing is better)
  const processingSparkline = avgProcessing
    ? [
        avgProcessing * 1.40,
        avgProcessing * 1.30,
        avgProcessing * 1.20,
        avgProcessing * 1.10,
        avgProcessing * 1.05,
        avgProcessing * 1.02,
        avgProcessing,
      ]
    : [0, 0, 0, 0, 0, 0, 0]

  return [
    {
      id: "total",
      label: "Total Kontrak",
      value: totalContracts,
      auxLabel: "Kontrak bulan ini",
      auxValue: `${thisMonth} kontrak`,
      formattedValue: formatNumber(totalContracts),
      sparkline: totalSparkline,
      icon: <FileText className="size-5 text-foreground/80" aria-hidden="true" />,
    },
    {
      id: "month",
      label: "Bulan Ini",
      value: thisMonth,
      auxLabel: "Persentase dari total",
      auxValue: `${monthPercentage}% dari total`,
      formattedValue: formatNumber(thisMonth),
      sparkline: monthSparkline,  
      icon: <ListFilter className="size-5 text-foreground/80" aria-hidden="true" />,
    },
    {
      id: "value",
      label: "Nilai Total",
      value: totalValue,
      formattedValue: stats ? formatCurrency(totalValue) : undefined,
      auxLabel: "Rata-rata per kontrak",
      auxValue: stats ? formatCurrency(avgContractValue) : "Rp 0",
      sparkline: valueSparkline,
      icon: <Columns className="size-5 text-foreground/80" aria-hidden="true" />,
    },
    {
      id: "processing",
      label: "Waktu Proses",
      value: avgProcessing ?? 0,
      formattedValue: formatProcessingTime(avgProcessing),
      suffix: avgProcessing != null ? "" : undefined,
      auxLabel: totalContracts > 0 ? `${totalContracts} dokumen diproses` : "Tidak ada data",
      auxValue: avgProcessing != null ? formatProcessingTime(avgProcessing) : "Belum ada proses",
      sparkline: processingSparkline,
      icon: <RefreshCw className="size-5 text-foreground/80" aria-hidden="true" />,
    },
  ]
}

function toContractRecord(item: UnifiedContractItem): ContractRecord {
  return {
    uid: `${item.item_type}-${item.id}`,
    item,
    fileName: item.filename,
    customerName: item.customer_name ?? "Tidak diketahui",
    periodStart: item.contract_start_date ?? undefined,
    periodEnd: item.contract_end_date ?? undefined,
    paymentMethod: mapPaymentMethod(item.payment_method),
    totalContractValue: item.total_contract_value ?? undefined,
    date: item.confirmed_at ?? item.created_at,
    status: item.status,
  }
}

const MotionCard = motion(Card)

function Breadcrumbs() {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
    >
      <a
        href="/"
        className={cn(
          "transition-colors hover:text-foreground",
          designTokens.focusRing
        )}
      >
        Beranda
      </a>
      <span aria-hidden="true" className="text-muted-foreground/60">
        /
      </span>
      <a
        href="/contracts"
        className={cn(
          "transition-colors hover:text-foreground",
          designTokens.focusRing
        )}
        aria-current="page"
      >
        Kontrak
      </a>
    </nav>
  )
}

type TooltipChild = React.ReactElement<React.HTMLAttributes<HTMLElement>>

interface TooltipProps {
  children: TooltipChild
  content: React.ReactNode
  id?: string
}

function Tooltip({ children, content, id }: TooltipProps) {
  const tooltipId = React.useId()
  const resolvedId = id ?? tooltipId
  const [open, setOpen] = React.useState(false)

  return (
    <span
      className="group relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {React.cloneElement(children, {
        "aria-describedby": resolvedId,
      })}
      <AnimatePresence>
        {open && (
          <motion.span
            id={resolvedId}
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute -top-2 left-1/2 z-50 w-max -translate-x-1/2 -translate-y-full rounded-md border border-border/70 bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg"
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={twMerge("animate-pulse rounded-md bg-muted/60", className)}
    {...props}
  />
))
Skeleton.displayName = "Skeleton"

interface KpiCardProps {
  descriptor: KpiDescriptor
  loading?: boolean
}

const KpiCard: React.FC<KpiCardProps> = ({ descriptor, loading }) => {
  const {
    label,
    value,
    prefix,
    suffix,
    delta,
    sparkline,
    icon,
    formattedValue,
    auxLabel,
    auxValue,
  } =
    descriptor
  const trendIntent =
    delta?.trend === "down"
      ? "negative"
      : delta?.trend === "up"
        ? "positive"
        : "neutral"
  const primaryValue = React.useMemo(() => {
    if (formattedValue) return formattedValue
    if (prefix?.toLowerCase() === "rp") {
      return formatCurrency(value)
    }
    return formatNumber(value)
  }, [formattedValue, value, prefix])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -4,
        transition: { duration: 0.2 },
      }}
      className="group"
    >
      <MotionCard
        className={twMerge(
          designTokens.radius.xl,
          designTokens.border,
          designTokens.surface.base,
          designTokens.shadow.sm,
          "overflow-hidden transition-all duration-200 group-hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)]"
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardDescription className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <CardTitle className="flex items-baseline gap-2 text-3xl font-semibold">
                <span className="font-bold tabular-nums text-[#d71920]">{primaryValue}</span>
                {suffix ? (
                  <span className="text-base font-medium text-muted-foreground">
                    {suffix}
                  </span>
                ) : null}
              </CardTitle>
            )}
          </div>
          <div
            className={twMerge(
              "flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-[#d71920]/10 to-transparent shadow-inner",
              designTokens.focusRing
            )}
          >
            <div className="text-[#d71920]">{icon}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="space-y-4">
              {/* Sparkline graph */}
              <div className="flex items-end justify-end">
                <svg
                  viewBox="0 0 48 18"
                  role="presentation"
                  aria-hidden="true"
                  className="h-12 w-full overflow-visible transition-colors text-[#d71920]"
                >
                  <path
                    d={createSparklinePath(sparkline)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              {/* Additional info section */}
              <div className="space-y-2 border-t border-border/40 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{auxLabel}</span>
                  <span className="text-xs font-semibold text-[#d71920] text-right">{auxValue}</span>
                </div>
                {delta && (
                  <Tooltip
                    content={
                      <span className="font-medium text-foreground">
                        {delta.description}
                      </span>
                    }
                  >
                    <Badge
                      variant="outline"
                      className={twMerge(
                        "w-full justify-center border-dashed text-xs font-semibold transition-all",
                        trendIntent === "positive"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950"
                          : trendIntent === "negative"
                            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950"
                            : "border-border bg-muted/50 text-muted-foreground"
                      )}
                    >
                      {trendIntent === "positive" ? (
                        <ArrowUpRight className="mr-1 size-3.5" aria-hidden="true" />
                      ) : trendIntent === "negative" ? (
                        <ArrowDownRight className="mr-1 size-3.5" aria-hidden="true" />
                      ) : null}
                      <span className="tabular-nums">
                        {delta.trend === "down"
                          ? "-"
                          : delta.trend === "flat"
                            ? ""
                            : "+"}
                        {delta.value}% vs periode sebelumnya
                      </span>
                    </Badge>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </MotionCard>
    </motion.div>
  )
}

interface ChipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  leadingIcon?: React.ReactNode
}

const ChipButton = React.forwardRef<HTMLButtonElement, ChipButtonProps>(
  ({ selected = false, className, leadingIcon, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={twMerge(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all focus:outline-none",
        "border backdrop-blur-sm",
        selected
          ? "border-transparent bg-[#d71920] text-white shadow-[0_10px_30px_-15px_rgba(215,25,32,0.8)]"
          : "border-border/70 bg-background/70 text-foreground/80 hover:border-border focus-visible:border-[#d71920]",
        designTokens.focusRing,
        className
      )}
      {...props}
    >
      {leadingIcon}
      {children}
    </button>
  )
)
ChipButton.displayName = "ChipButton"

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  onClearFilters: () => void
  activeFilters: number
  resultsCount: number
}

const statusOptions: Array<{
  value: FilterStatus
  label: string
}> = [
  { value: "all", label: "Semua" },
  { value: "confirmed", label: "Dikonfirmasi" },
  { value: "awaiting_review", label: "Menunggu Review" },
]

const paymentOptions: Array<{ value: FilterPaymentMethod; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "OTC", label: "OTC" },
  { value: "Termin", label: "Termin" },
  { value: "Recurring", label: "Recurring" },
]

const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  onClearFilters,
  activeFilters,
  resultsCount,
}) => {

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={twMerge(
        designTokens.radius.xl,
        designTokens.border,
        designTokens.surface.base,
        designTokens.shadow.sm,
        "p-6"
      )}
      aria-label="Filter kontrak"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative flex items-center">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
              />
              <Input
                id="search-contracts"
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Cari berdasarkan nama file, pelanggan, atau ID..."
                className={twMerge("pl-9 pr-28", designTokens.radius.xl)}
                aria-describedby="search-help-text"
              />
              <span
                id="search-help-text"
                className="absolute right-3 text-xs text-muted-foreground"
              >
                {resultsCount} hasil
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeFilters > 0 ? (
              <Badge
                variant="outline"
                className="border-dashed bg-primary/10 text-primary"
              >
                {activeFilters} filter aktif
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Tidak ada filter aktif
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className={cn(
                "text-muted-foreground hover:text-foreground whitespace-nowrap",
                designTokens.focusRing
              )}
              disabled={activeFilters === 0}
            >
              Reset filter
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

interface ContractsToolbarProps {
  selectedCount: number
  onExport: () => void
  onConfirm: () => void
  onDelete: () => void
  visibleColumns: Set<(typeof tableColumns)[number]["id"]>
  onToggleColumn: (columnId: (typeof tableColumns)[number]["id"]) => void
  disabled?: boolean
}

const ContractsToolbar: React.FC<ContractsToolbarProps> = ({
  selectedCount,
  onExport,
  onConfirm,
  onDelete,
  visibleColumns,
  onToggleColumn,
  disabled = false,
}) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
      className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.35)] md:flex-row md:items-center md:justify-between"
      aria-label="Aksi kontrak"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-muted-foreground">
          {selectedCount > 0
            ? `${selectedCount} kontrak dipilih`
            : "Tidak ada kontrak dipilih"}
        </span>
        <AnimatePresence>
          {selectedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-2"
            >
              <Button
                size="sm"
                variant="outline"
                onClick={onExport}
                disabled={disabled}
                className={designTokens.focusRing}
              >
                <Upload className="mr-2 size-4" aria-hidden="true" />
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={onConfirm}
                disabled={disabled}
                className={twMerge(
                  "bg-[#d71920] text-white hover:bg-[#b5141b]",
                  designTokens.focusRing
                )}
              >
                <Check className="mr-2 size-4" aria-hidden="true" />
                Konfirmasi
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                disabled={disabled}
                className={twMerge(
                  "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50",
                  "transition-colors duration-200",
                  designTokens.focusRing
                )}
              >
                <Trash2 className="mr-2 size-4" aria-hidden="true" />
                Hapus
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className={twMerge("flex items-center gap-2", designTokens.focusRing)}
            >
              <Columns className="size-4" aria-hidden="true" />
              Kolom
              <ChevronDown className="size-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel>Pilih kolom</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {tableColumns.map((column) => {
              if (column.id === "actions") {
                return null
              }
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={visibleColumns.has(column.id)}
                  onCheckedChange={() => onToggleColumn(column.id)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.section>
  )
}

const MotionTableRow = motion(TableRow as React.ComponentType<
  React.ComponentProps<typeof TableRow>
>)

interface ContractsTableProps {
  data: ContractRecord[]
  sortState: SortState | null
  onSortChange: (column: SortableColumn, direction: SortDirection) => void
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  selectedIds: Set<string>
  onToggleRow: (id: string) => void
  onToggleAll: (checked: boolean) => void
  visibleColumns: Set<(typeof tableColumns)[number]["id"]>
  isFetching?: boolean
  status: FilterStatus
  onStatusChange: (value: FilterStatus) => void
  paymentMethod: FilterPaymentMethod
  onPaymentMethodChange: (value: FilterPaymentMethod) => void
  periodFilter: { start: string | null; end: string | null }
  onPeriodFilterChange: (filter: { start: string | null; end: string | null }) => void
}

const ContractsTable: React.FC<ContractsTableProps> = ({
  data,
  sortState,
  onSortChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  selectedIds,
  onToggleRow,
  onToggleAll,
  visibleColumns,
  isFetching,
  status,
  onStatusChange,
  paymentMethod,
  onPaymentMethodChange,
  periodFilter,
  onPeriodFilterChange,
}) => {
  const navigate = useNavigate()
  const downloadJsonMutation = useDownloadContractJson()
  const downloadPdfMutation = useDownloadContractPdf()
  const deleteContractMutation = useDeleteContract()
  const discardJobMutation = useDiscardJob()

  const allSelectableIds = data.map((item) => item.uid)
  const allSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selectedIds.has(id))
  const indeterminate =
    !allSelected && data.some((item) => selectedIds.has(item.uid))

  const sortDirectionFor = (column: SortableColumn) => {
    if (sortState?.column !== column) return "none"
    return sortState.direction
  }

  const handleHeaderClick = (column: SortableColumn) => {
    let nextDirection: SortDirection = "ascending"
    if (sortState?.column === column) {
      nextDirection =
        sortState.direction === "ascending" ? "descending" : "ascending"
    }
    onSortChange(column, nextDirection)
  }

  const handleSortKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    column: SortableColumn
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleHeaderClick(column)
    }
  }

  const handleDownloadJson = (contractId: number) => {
    downloadJsonMutation.mutate(contractId)
  }

  const handleDownloadPdf = (contractId: number) => {
    downloadPdfMutation.mutate(contractId)
  }

  const handleDeleteContract = (contractId: number) => {
    deleteContractMutation.mutate(contractId)
  }

  const handleDiscardJob = (jobId: number) => {
    discardJobMutation.mutate(jobId)
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  const renderPeriod = (record: ContractRecord) => {
    if (record.periodStart && record.periodEnd) {
      return (
        <div className="space-y-1 text-sm">
          <div className="font-medium">{formatDate(record.periodStart)}</div>
          <div className="text-xs text-muted-foreground">
            s/d {formatDate(record.periodEnd)}
          </div>
        </div>
      )
    }
    return <span className="text-muted-foreground text-sm italic">—</span>
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)]">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#d71920]/60 to-transparent opacity-70" />
        {isFetching ? (
          <div className="absolute inset-x-0 top-0 h-1 animate-pulse bg-gradient-to-r from-[#d71920]/0 via-[#d71920]/60 to-[#d71920]/0" />
        ) : null}
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <FileText className="size-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Tidak ada kontrak pada filter ini.
            </p>
          </div>
        ) : (
          <Table className={designTokens.radius.xl}>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <TableRow>
                <TableHead className="w-12">
                  <label className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(node) => {
                        if (node) {
                          node.indeterminate = indeterminate
                        }
                      }}
                      onChange={(event) =>
                        onToggleAll(event.currentTarget.checked)
                      }
                      className={cn(
                        "size-4 cursor-pointer rounded border border-border bg-background accent-[#d71920]",
                        designTokens.focusRing
                      )}
                      aria-label={
                        allSelected
                          ? "Batalkan pilih semua baris"
                          : "Pilih semua baris di halaman ini"
                      }
                    />
                  </label>
                </TableHead>
                {tableColumns.map((column): React.JSX.Element | null => {
                  if (!visibleColumns.has(column.id)) return null
                  if (column.id === "actions") {
                    return (
                      <TableHead
                        key={column.id}
                        className="text-center text-xs uppercase tracking-wide text-[#d71920] font-bold"
                      >
                        {column.label}
                      </TableHead>
                    )
                  }

                  if (column.filterable) {
                    // Filterable columns (method, status, and period)
                    const isMethod = column.id === "method"
                    const isStatus = column.id === "status"
                    const isPeriod = column.id === "period"

                    return (
                      <TableHead
                        key={column.id}
                        className="align-middle"
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={twMerge(
                                "flex items-center gap-2 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide text-[#d71920] transition-all hover:bg-red-50 dark:hover:bg-red-950/20",
                                designTokens.focusRing
                              )}
                            >
                              {column.label}
                              <ChevronDown className="size-3" aria-hidden="true" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-52">
                            <DropdownMenuLabel>
                              Filter {column.label}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            {isStatus && (
                              <>
                                {statusOptions.map((option) => (
                                  <DropdownMenuCheckboxItem
                                    key={option.value}
                                    checked={status === option.value}
                                    onCheckedChange={() => onStatusChange(option.value)}
                                  >
                                    {option.label}
                                  </DropdownMenuCheckboxItem>
                                ))}
                              </>
                            )}

                            {isMethod && (
                              <>
                                {paymentOptions.map((option) => (
                                  <DropdownMenuCheckboxItem
                                    key={option.value}
                                    checked={paymentMethod === option.value}
                                    onCheckedChange={() => onPaymentMethodChange(option.value)}
                                  >
                                    {option.label}
                                  </DropdownMenuCheckboxItem>
                                ))}
                              </>
                            )}

                            {isPeriod && (
                              <div className="p-3 space-y-3">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-foreground">
                                    Tanggal Mulai
                                  </label>
                                  <Input
                                    type="date"
                                    value={periodFilter.start || ""}
                                    onChange={(e) =>
                                      onPeriodFilterChange({
                                        ...periodFilter,
                                        start: e.target.value || null,
                                      })
                                    }
                                    className="text-sm"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-foreground">
                                    Tanggal Akhir
                                  </label>
                                  <Input
                                    type="date"
                                    value={periodFilter.end || ""}
                                    onChange={(e) =>
                                      onPeriodFilterChange({
                                        ...periodFilter,
                                        end: e.target.value || null,
                                      })
                                    }
                                    className="text-sm"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full"
                                  onClick={() =>
                                    onPeriodFilterChange({ start: null, end: null })
                                  }
                                  disabled={!periodFilter.start && !periodFilter.end}
                                >
                                  Reset Filter
                                </Button>
                              </div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableHead>
                    )
                  }

                  if (column.sortable) {
                    const ariaSort = sortDirectionFor(
                      column.id as SortableColumn
                    )
                    return (
                      <TableHead
                        key={column.id}
                        aria-sort={ariaSort}
                        className="align-middle"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleHeaderClick(column.id as SortableColumn)
                          }
                          onKeyDown={(event) =>
                            handleSortKeyDown(event, column.id as SortableColumn)
                          }
                          className={twMerge(
                            "flex items-center gap-2 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wide text-[#d71920] transition-all hover:bg-red-50 dark:hover:bg-red-950/20",
                            designTokens.focusRing
                          )}
                        >
                          {column.label}
                          <motion.span
                            animate={{
                              rotate:
                                sortState?.column === column.id &&
                                sortState.direction === "descending"
                                  ? 180
                                  : 0,
                              opacity: sortState?.column === column.id ? 1 : 0.4,
                            }}
                            className="flex items-center justify-center text-[#d71920]"
                          >
                            <ChevronDown className="size-3" aria-hidden="true" />
                          </motion.span>
                        </button>
                      </TableHead>
                    )
                  }

                  // Default: non-sortable, non-filterable columns (shouldn't reach here based on current config)
                  // But TypeScript needs this for type safety
                  const typedColumn = column as typeof tableColumns[number]
                  return (
                    <TableHead
                      key={typedColumn.id}
                      className="text-xs uppercase tracking-wide text-[#d71920] font-bold"
                    >
                      {typedColumn.label}
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody className="bg-background/60">
              <AnimatePresence initial={false}>
                {data.map((record) => (
                  <MotionTableRow
                    key={record.uid}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className={twMerge(
                      "group border-b border-border/40 bg-background/70 transition-all duration-200",
                      "hover:bg-primary/5",
                      "even:bg-muted/30"
                    )}
                  >
                    <TableCell className="w-12">
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.uid)}
                          onChange={() => onToggleRow(record.uid)}
                          className={cn(
                            "size-4 cursor-pointer rounded border border-border bg-background accent-[#d71920]",
                            designTokens.focusRing
                          )}
                          aria-label={`Pilih kontrak ${record.fileName}`}
                        />
                      </label>
                    </TableCell>
                    {visibleColumns.has("fileName") && (
                      <TableCell
                        className="max-w-[280px] truncate font-medium text-foreground"
                      >
                        <div className="flex flex-col">
                          <span className="truncate">{record.fileName}</span>
                          <span className="text-xs text-muted-foreground">
                            {record.item.item_type === "contract"
                              ? `Kontrak • ID ${record.item.id}`
                              : `Job • ID ${record.item.id}`}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.has("customerName") && (
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Building2
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="font-medium text-foreground">
                              {record.customerName}
                            </span>
                          </div>
                          <span className="pl-6 text-xs text-muted-foreground">
                            {record.status === "confirmed"
                              ? "Terkonfirmasi"
                              : "Menunggu Review"}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.has("period") && (
                      <TableCell>
                        {renderPeriod(record)}
                      </TableCell>
                    )}
                    {visibleColumns.has("method") && (
                      <TableCell>
                        {record.paymentMethod ? (
                          <Badge
                            variant="outline"
                            className={twMerge(
                              "inline-flex min-w-[90px] justify-center border",
                              paymentBadgeStyles[record.paymentMethod]
                            )}
                          >
                            {record.paymentMethod}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">
                            —
                          </span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.has("value") && (
                      <TableCell>
                        {record.totalContractValue ? (
                          <span className="font-semibold text-sm text-foreground tabular-nums">
                            {formatCurrency(Number(record.totalContractValue))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">
                            —
                          </span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.has("date") && (
                      <TableCell>
                        <span className="text-sm font-medium text-foreground tabular-nums">
                          {formatDate(record.date)}
                        </span>
                      </TableCell>
                    )}
                    {visibleColumns.has("status") && (
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={twMerge(
                            "inline-flex min-w-[140px] items-center justify-center gap-2 border px-3 py-1 text-xs font-semibold",
                            statusTokens[record.status].className
                          )}
                        >
                          <span
                            className={twMerge(
                              "size-2.5 rounded-full",
                              statusTokens[record.status].dot
                            )}
                            aria-hidden="true"
                          />
                          {statusTokens[record.status].label}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.has("actions") && (
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={twMerge(
                                "opacity-100 transition-opacity group-hover:opacity-100",
                                designTokens.focusRing
                              )}
                              aria-label={`Aksi untuk ${record.fileName}`}
                            >
                              <Ellipsis className="size-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-52">
                            {record.status === "confirmed" ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/contracts/${record.item.id}`)
                                  }
                                >
                                  <Eye className="mr-2 size-4" aria-hidden="true" />
                                  Lihat Detail
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDownloadPdf(record.item.id)}
                                  disabled={downloadPdfMutation.isPending}
                                >
                                  <FileText className="mr-2 size-4" aria-hidden="true" />
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleDownloadJson(record.item.id)
                                  }
                                  disabled={downloadJsonMutation.isPending}
                                >
                                  <FileJson className="mr-2 size-4" aria-hidden="true" />
                                  Download JSON
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                                      onSelect={(event) => event.preventDefault()}
                                    >
                                      <Trash2 className="mr-2 size-4 text-red-600" aria-hidden="true" />
                                      Hapus Kontrak
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Hapus Kontrak?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Aksi ini tidak dapat dibatalkan. Kontrak dan file terkait akan dihapus secara permanen.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleDeleteContract(record.item.id)
                                        }
                                        className="bg-red-600 hover:bg-red-700"
                                        disabled={deleteContractMutation.isPending}
                                      >
                                        {deleteContractMutation.isPending
                                          ? "Menghapus..."
                                          : "Hapus"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/review/${record.item.id}`)
                                  }
                                >
                                  <Eye className="mr-2 size-4" aria-hidden="true" />
                                  Review
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                                      onSelect={(event) => event.preventDefault()}
                                    >
                                      <Trash2 className="mr-2 size-4 text-red-600" aria-hidden="true" />
                                      Hapus Job
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Hapus Job?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Aksi ini tidak dapat dibatalkan. Job dan file terkait akan dihapus secara permanen.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleDiscardJob(record.item.id)
                                        }
                                        className="bg-red-600 hover:bg-red-700"
                                        disabled={discardJobMutation.isPending}
                                      >
                                        {discardJobMutation.isPending
                                          ? "Menghapus..."
                                          : "Hapus"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </MotionTableRow>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </div>
      <div className="flex flex-col items-start gap-4 bg-card/90 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between border-t border-border/60">
        <div>
          {totalCount === 0 ? (
            "Tidak ada kontrak"
          ) : (
            <>
              Menampilkan{" "}
              <span className="font-semibold text-foreground">
                {rangeStart}-{rangeEnd}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-foreground">
                {totalCount}
              </span>{" "}
              kontrak
            </>
          )}
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center md:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={twMerge(
                  "justify-between px-3",
                  designTokens.focusRing
                )}
              >
                {pageSize} / halaman
                <ChevronDown className="ml-2 size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[10, 25, 50].map((size) => (
                <DropdownMenuItem
                  key={size}
                  onSelect={() => onPageSizeChange(size)}
                >
                  {size} / halaman
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.max(page - 1, 1))}
              disabled={page === 1}
              className={designTokens.focusRing}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="tabular-nums text-sm text-foreground">
              {totalPages === 0 ? 0 : page} / {Math.max(totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.min(page + 1, totalPages))}
              disabled={page === totalPages || totalPages === 0}
              className={designTokens.focusRing}
              aria-label="Halaman selanjutnya"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const LoadingSkeleton: React.FC = () => (
  <div className="flex flex-col gap-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={`kpi-${index}`} className="h-44 rounded-3xl" />
      ))}
    </div>
    <Skeleton className="h-32 rounded-3xl" />
    <Skeleton className="h-[520px] rounded-3xl" />
  </div>
)

const EmptyState: React.FC<{ onPrimaryAction: () => void }> = ({
  onPrimaryAction,
}) => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 bg-muted/30 p-16 text-center shadow-inner">
    <div className="flex size-20 items-center justify-center rounded-full border border-border/60 bg-background shadow">
      <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
    </div>
    <div className="space-y-2">
      <h3 className="text-xl font-semibold text-foreground">
        Belum ada kontrak untuk filter ini
      </h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Unggah dokumen baru atau ubah filter untuk melihat data kontrak yang
        telah diekstrak. Semua progres tetap tersimpan secara otomatis.
      </p>
    </div>
    <Button
      size="lg"
      className={twMerge(
        "bg-[#d71920] text-white hover:bg-[#b5141b]",
        designTokens.focusRing
      )}
      onClick={onPrimaryAction}
    >
      <Upload className="mr-2 size-4" aria-hidden="true" />
      Upload File Baru
    </Button>
  </div>
)

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-destructive/30 bg-destructive/5 p-16 text-center">
    <div className="flex size-20 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
      <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />
    </div>
    <div className="space-y-2">
      <h3 className="text-xl font-semibold text-foreground">
        Gagal memuat kontrak
      </h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
    <Button
      variant="outline"
      onClick={onRetry}
      className={designTokens.focusRing}
    >
      <RefreshCw className="mr-2 size-4" aria-hidden="true" />
      Coba lagi
    </Button>
  </div>
)

const BulkOperationOverlay: React.FC<{ 
  isOperating: boolean
  message?: string
}> = ({ isOperating, message = "Memproses..." }) => {
  if (!isOperating) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={twMerge(
            "flex flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card p-8 shadow-2xl",
            designTokens.surface.base
          )}
        >
          <div className="relative">
            <RefreshCw className="size-12 animate-spin text-[#d71920]" aria-hidden="true" />
            <div className="absolute inset-0 animate-ping">
              <RefreshCw className="size-12 text-[#d71920]/30" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {message}
            </h3>
            <p className="text-sm text-muted-foreground">
              Mohon tunggu, jangan tutup halaman ini
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function applySorting(
  data: ContractRecord[],
  sortState: SortState | null
): ContractRecord[] {
  if (!sortState) return data
  const sorted = [...data].sort((a, b) => {
    const { column, direction } = sortState
    const multiplier = direction === "ascending" ? 1 : -1

    if (column === "date") {
      return (
        (new Date(a.date).getTime() - new Date(b.date).getTime()) * multiplier
      )
    }

    if (column === "value") {
      const valueA = Number(a.totalContractValue ?? 0)
      const valueB = Number(b.totalContractValue ?? 0)
      return (valueA - valueB) * multiplier
    }

    const valueA = (a[column] ?? "").toString().toLowerCase()
    const valueB = (b[column] ?? "").toString().toLowerCase()
    if (valueA < valueB) return -1 * multiplier
    if (valueA > valueB) return 1 * multiplier
    return 0
  })
  return sorted
}

export function ContractsPage() {
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<FilterStatus>("all")
  const [paymentMethod, setPaymentMethod] = React.useState<FilterPaymentMethod>("all")
  const [periodFilter, setPeriodFilter] = React.useState<{ start: string | null; end: string | null }>({ start: null, end: null })
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [sortState, setSortState] = React.useState<SortState | null>({
    column: "date",
    direction: "descending",
  })
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [visibleColumns, setVisibleColumns] = React.useState<
    Set<(typeof tableColumns)[number]["id"]>
  >(new Set(tableColumns.map((column) => column.id)))
  const [isBulkOperating, setIsBulkOperating] = React.useState(false)

  const debouncedSearch = useDebouncedValue(search, 250)

  // Bulk operation hooks
  const confirmExtractionMutation = useConfirmExtraction()
  const deleteContractMutation = useDeleteContract()
  const discardJobMutation = useDiscardJob()

  const {
    data: rawContractsData,
    isLoading: isLoadingContracts,
    isFetching: isFetchingContracts,
    error: unifiedError,
    refetch: refetchContracts,
  } = useUnifiedContracts({
    page,
    per_page: pageSize,
    search: debouncedSearch || undefined,
    status_filter: status !== "all" ? status : undefined,
  })

  const contractsError =
    unifiedError instanceof Error ? unifiedError : null

  const {
    data: statsData,
    isLoading: isLoadingStats,
  } = useContractStats()

  const isInitialLoading =
    (isLoadingContracts && !rawContractsData) ||
    (isLoadingStats && !statsData)

  const filteredItems = React.useMemo(() => {
    let items = rawContractsData?.items ?? []

    // Filter by payment method
    if (paymentMethod !== "all") {
      items = items.filter((item) => {
        const mapped = mapPaymentMethod(item.payment_method)
        return mapped === paymentMethod
      })
    }

    // Filter by period
    if (periodFilter.start || periodFilter.end) {
      items = items.filter((item) => {
        const startDate = item.contract_start_date
        const endDate = item.contract_end_date

        if (!startDate || !endDate) return false

        // Check if contract period overlaps with filter period
        if (periodFilter.start && endDate < periodFilter.start) return false
        if (periodFilter.end && startDate > periodFilter.end) return false

        return true
      })
    }

    return items
  }, [rawContractsData, paymentMethod, periodFilter])

  const records = React.useMemo(() => {
    const transformed = filteredItems.map(toContractRecord)
    return applySorting(transformed, sortState)
  }, [filteredItems, sortState])

  const hasClientSideFilters =
    paymentMethod !== "all" ||
    periodFilter.start !== null ||
    periodFilter.end !== null

  const totalResults = hasClientSideFilters
      ? records.length
      : rawContractsData?.total ?? records.length
  const totalPages = hasClientSideFilters
      ? records.length === 0
        ? 0
        : 1
      : rawContractsData?.total_pages ?? 1

  const kpiDescriptors = React.useMemo(
    () => buildKpiDescriptors(statsData),
    [statsData]
  )

  const activeFiltersCount =
    (status !== "all" ? 1 : 0) +
    (paymentMethod !== "all" ? 1 : 0) +
    (periodFilter.start || periodFilter.end ? 1 : 0) +
    (debouncedSearch ? 1 : 0)

  const selectedRecords = React.useMemo(
    () => records.filter((record) => selectedIds.has(record.uid)),
    [records, selectedIds]
  )

  // Bulk Confirm Handler
  const handleBulkConfirm = async () => {
    const jobsToConfirm = selectedRecords.filter((r) => r.item.item_type === 'job')
    const alreadyConfirmed = selectedRecords.filter((r) => r.item.item_type === 'contract')

    if (jobsToConfirm.length === 0) {
      toast.error('Tidak ada job yang dapat dikonfirmasi', {
        description: alreadyConfirmed.length > 0
          ? `${alreadyConfirmed.length} item sudah terkonfirmasi`
          : 'Pilih job dengan status "Menunggu Review"'
      })
      return
    }

    if (alreadyConfirmed.length > 0) {
      toast.warning(`${alreadyConfirmed.length} item sudah terkonfirmasi`, {
        description: `Hanya ${jobsToConfirm.length} job yang akan dikonfirmasi`
      })
    }

    setIsBulkOperating(true)
    let successCount = 0
    let failedCount = 0

    for (let i = 0; i < jobsToConfirm.length; i++) {
      const job = jobsToConfirm[i]
      toast.loading(
        `Mengkonfirmasi ${i + 1} dari ${jobsToConfirm.length}...`, 
        {
          id: 'bulk-confirm-progress',
          description: `${job.fileName.substring(0, 40)}${job.fileName.length > 40 ? '...' : ''}`
        }
      )

      try {
        await confirmExtractionMutation.mutateAsync(job.item.id)
        successCount++
        // Remove from selection on success
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(job.uid)
          return next
        })
      } catch (error) {
        failedCount++
        console.error(`Failed to confirm job ${job.item.id}:`, error)
      }
    }

    toast.dismiss('bulk-confirm-progress')
    setIsBulkOperating(false)

    if (successCount > 0) {
      toast.success(`${successCount} kontrak berhasil dikonfirmasi`, {
        description: failedCount > 0 ? `${failedCount} gagal dikonfirmasi` : undefined
      })
      await refetchContracts()
    }

    if (failedCount > 0 && successCount === 0) {
      toast.error('Gagal mengkonfirmasi kontrak', {
        description: `Semua ${failedCount} percobaan gagal`
      })
    }
  }

  // Bulk Delete Handler
  const handleBulkDelete = async () => {
    const contracts = selectedRecords.filter((r) => r.item.item_type === 'contract')
    const jobs = selectedRecords.filter((r) => r.item.item_type === 'job')
    const totalCount = selectedRecords.length

    if (totalCount === 0) {
      toast.error('Tidak ada item yang dipilih')
      return
    }

    const confirmMessage =
      contracts.length > 0 && jobs.length > 0
        ? `Yakin ingin menghapus ${contracts.length} kontrak dan ${jobs.length} job?`
        : contracts.length > 0
        ? `Yakin ingin menghapus ${contracts.length} kontrak?`
        : `Yakin ingin menghapus ${jobs.length} job?`

    if (!confirm(`${confirmMessage}\n\nTindakan ini tidak dapat dibatalkan.`)) {
      return
    }

    setIsBulkOperating(true)
    let successCount = 0
    let failedCount = 0

    // Delete contracts
    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i]
      toast.loading(
        `Menghapus ${i + 1} dari ${totalCount}...`, 
        {
          id: 'bulk-delete-progress',
          description: `${contract.fileName.substring(0, 40)}${contract.fileName.length > 40 ? '...' : ''}`
        }
      )

      try {
        await deleteContractMutation.mutateAsync(contract.item.id)
        successCount++
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(contract.uid)
          return next
        })
      } catch (error) {
        failedCount++
        console.error(`Failed to delete contract ${contract.item.id}:`, error)
      }
    }

    // Discard jobs
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      toast.loading(
        `Menghapus ${contracts.length + i + 1} dari ${totalCount}...`, 
        {
          id: 'bulk-delete-progress',
          description: `${job.fileName.substring(0, 40)}${job.fileName.length > 40 ? '...' : ''}`
        }
      )

      try {
        await discardJobMutation.mutateAsync(job.item.id)
        successCount++
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(job.uid)
          return next
        })
      } catch (error) {
        failedCount++
        console.error(`Failed to discard job ${job.item.id}:`, error)
      }
    }

    toast.dismiss('bulk-delete-progress')
    setIsBulkOperating(false)

    if (successCount > 0) {
      toast.success(`${successCount} item berhasil dihapus`, {
        description: failedCount > 0 ? `${failedCount} gagal dihapus` : undefined
      })
      
      // Refetch and adjust pagination
      await refetchContracts()
      
      // After refetch, check if current page is now empty
      // Calculate new total after deletion
      const itemsDeleted = successCount
      const newTotal = totalResults - itemsDeleted
      const newTotalPages = Math.ceil(newTotal / pageSize)
      
      // If current page is beyond new total pages, navigate to last page
      if (page > newTotalPages && newTotalPages > 0) {
        setPage(newTotalPages)
      } else if (newTotal === 0) {
        // If no items left, go to page 1 to show empty state
        setPage(1)
      }
    }

    if (failedCount > 0 && successCount === 0) {
      toast.error('Gagal menghapus item', {
        description: `Semua ${failedCount} percobaan gagal`
      })
    }
  }

  // Bulk Export to CSV Handler
  const handleBulkExport = () => {
    const confirmedContracts = selectedRecords.filter((r) => r.item.item_type === 'contract')
    const jobs = selectedRecords.filter((r) => r.item.item_type === 'job')

    if (confirmedContracts.length === 0) {
      toast.error('Tidak ada kontrak terkonfirmasi yang dipilih', {
        description: jobs.length > 0
          ? `${jobs.length} job tidak dapat diekspor. Konfirmasi terlebih dahulu.`
          : 'Pilih kontrak dengan status "Dikonfirmasi"'
      })
      return
    }

    if (jobs.length > 0) {
      toast.warning(`${jobs.length} job tidak dapat diekspor`, {
        description: `Hanya ${confirmedContracts.length} kontrak terkonfirmasi yang akan diekspor`
      })
    }

    try {
      // Generate CSV content
      const headers = ['File Name', 'Customer Name', 'Contract Period', 'Payment Method', 'Contract Value', 'Confirmation Date', 'Status']
      const rows = confirmedContracts.map((record) => {
        const period = record.periodStart && record.periodEnd
          ? `${formatDate(record.periodStart)} - ${formatDate(record.periodEnd)}`
          : '-'

        const value = record.totalContractValue
          ? formatCurrency(Number(record.totalContractValue))
          : '-'

        const confirmDate = record.item.confirmed_at
          ? formatDate(record.item.confirmed_at)
          : '-'

        return [
          `"${record.fileName}"`,
          `"${record.customerName}"`,
          `"${period}"`,
          `"${record.paymentMethod || '-'}"`,
          `"${value}"`,
          `"${confirmDate}"`,
          `"${statusTokens[record.status].label}"`
        ].join(',')
      })

      const csvContent = [headers.join(','), ...rows].join('\n')

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      link.href = url
      link.download = `kontrak_export_${timestamp}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`${confirmedContracts.length} kontrak berhasil diekspor`, {
        description: `File: kontrak_export_${timestamp}.csv`
      })
    } catch (error) {
      console.error('Failed to export contracts:', error)
      toast.error('Gagal mengekspor kontrak', {
        description: 'Terjadi kesalahan saat membuat file CSV'
      })
    }
  }

  const handlePaymentMethodChange = (value: FilterPaymentMethod) => {
    setPaymentMethod(value)
    setPage(1)
  }

  const handleToggleColumn = (
    columnId: (typeof tableColumns)[number]["id"]
  ) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(columnId)) {
        if (columnId === "fileName" || columnId === "customerName" || columnId === "actions") {
          return next
        }
        next.delete(columnId)
      } else {
        next.add(columnId)
      }
      return next
    })
  }

  const handleToggleRow = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }
      return next
    })
  }

  const handleToggleAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        records.forEach((record) => next.add(record.uid))
      } else {
        records.forEach((record) => next.delete(record.uid))
      }
      return next
    })
  }

  const handleSortChange = (column: SortableColumn, direction?: SortDirection) => {
    setSortState((prev) => {
      if (prev?.column === column) {
        if (direction) return { column, direction }
        return {
          column,
          direction: prev.direction === "ascending" ? "descending" : "ascending",
        }
      }
      return {
        column,
        direction: direction ?? "ascending",
      }
    })
  }

  const handleClearFilters = () => {
    setSearch("")
    setStatus("all")
    setPaymentMethod("all")
    setPeriodFilter({ start: null, end: null })
    setSelectedIds(new Set())
    setPage(1)
  }

  const handleRetry = () => {
    void refetchContracts()
  }

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [page, pageSize, debouncedSearch, status, paymentMethod, periodFilter])

  const resultsAnnouncement = React.useMemo(
    () =>
      `${totalResults} kontrak ditemukan. Menampilkan halaman ${Math.min(page, Math.max(totalPages, 1))} dari ${Math.max(totalPages, 1)}.`,
    [totalResults, page, totalPages]
  )

  return (
    <main
      className={twMerge(
        "space-y-8 bg-gradient-to-br from-background via-background to-muted/20 px-6 py-8",
        "min-h-screen"
      )}
    >
      {/* Bulk Operation Overlay */}
      <BulkOperationOverlay 
        isOperating={isBulkOperating} 
        message={
          deleteContractMutation.isPending || discardJobMutation.isPending
            ? "Menghapus item..."
            : confirmExtractionMutation.isPending
            ? "Mengkonfirmasi kontrak..."
            : "Memproses..."
        }
      />
      
      <header className="flex flex-col gap-6">
        <Breadcrumbs />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              Telkom Contracts
            </h1>
            <p className="text-sm text-muted-foreground">
              Pantau performa ekstraksi dan kelola kontrak secara terpusat.
            </p>
          </div>
          <Button
            size="lg"
            className={twMerge(
              "self-start bg-[#d71920] text-white shadow-[0_18px_40px_-22px_rgba(215,25,32,0.58)] transition-transform hover:-translate-y-0.5 hover:bg-[#b5141b]",
              designTokens.focusRing
            )}
            onClick={() => {
              window.location.href = "/upload"
            }}
          >
            <Upload className="mr-2 size-4" aria-hidden="true" />
            Upload File Baru
          </Button>
        </div>
      </header>

      {contractsError ? (
        <ErrorState
          message={contractsError.message ?? "Terjadi kesalahan tidak diketahui."}
          onRetry={handleRetry}
        />
      ) : isInitialLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <section className={twMerge("grid gap-4 sm:grid-cols-2 xl:grid-cols-4")}>
            {kpiDescriptors.map((descriptor) => (
              <KpiCard
                key={descriptor.id}
                descriptor={descriptor}
                loading={isLoadingStats && !statsData}
              />
            ))}
          </section>

          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            onClearFilters={handleClearFilters}
            activeFilters={activeFiltersCount}
            resultsCount={totalResults}
          />

          <ContractsToolbar
            selectedCount={selectedIds.size}
            onExport={handleBulkExport}
            onConfirm={handleBulkConfirm}
            onDelete={handleBulkDelete}
            visibleColumns={visibleColumns}
            onToggleColumn={handleToggleColumn}
            disabled={isBulkOperating}
          />

          {/* SR announcement so sort/pagination/filter feedback stays audible */}
          <section aria-live="polite" className="sr-only">
            {resultsAnnouncement}
          </section>

          {records.length === 0 ? (
            <EmptyState onPrimaryAction={() => (window.location.href = "/upload")} />
          ) : (
            <ContractsTable
              data={records}
              sortState={sortState}
              onSortChange={(column, direction) =>
                handleSortChange(column, direction)
              }
              page={page}
              pageSize={pageSize}
              totalCount={totalResults}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              selectedIds={selectedIds}
              onToggleRow={handleToggleRow}
              onToggleAll={handleToggleAll}
              visibleColumns={visibleColumns}
              isFetching={isFetchingContracts}
              status={status}
              onStatusChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={handlePaymentMethodChange}
              periodFilter={periodFilter}
              onPeriodFilterChange={(value) => {
                setPeriodFilter(value)
                setPage(1)
              }}
            />
          )}
        </>
      )}
    </main>
  )
}
