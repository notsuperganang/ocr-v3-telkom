import * as React from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  ListFilter,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { motion } from "motion/react"
import { twMerge } from "tailwind-merge"

import { useInvoices, useExportInvoices } from "@/hooks/useInvoices"
import type { Invoice, InvoiceStatus, InvoiceFilters } from "@/types/api"

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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { cn, formatCurrency } from "@/lib/utils"

// Design tokens
const designTokens = {
  radius: {
    xl: "rounded-[1.25rem]",
  },
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
    md: "shadow-[0_20px_45px_-28px_rgba(215,25,32,0.35)]",
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

// Helper functions
function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

function getMonthName(month: number): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ]
  return months[month - 1] || ""
}

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

// Components
const MotionCard = motion(Card)

function Breadcrumbs() {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
    >
      <a href="/" className={cn("transition-colors hover:text-foreground", designTokens.focusRing)}>
        Beranda
      </a>
      <span aria-hidden="true" className="text-muted-foreground/60">/</span>
      <span className="text-foreground" aria-current="page">Invoice</span>
    </nav>
  )
}

const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={twMerge("animate-pulse rounded-md bg-muted/60", className)} {...props} />
)

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  loading?: boolean
  variant?: "default" | "danger"
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  loading,
  variant = "default",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group"
    >
      <MotionCard
        className={twMerge(
          designTokens.radius.xl,
          designTokens.border,
          designTokens.surface.base,
          designTokens.shadow.sm,
          "overflow-hidden transition-all duration-200 group-hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)]",
          variant === "danger" && "border-red-200 bg-red-50/50"
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div className="flex flex-col gap-1">
            <CardDescription className="text-sm font-medium">{title}</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <CardTitle className={cn("text-2xl font-bold", variant === "danger" && "text-red-600")}>
                {value}
              </CardTitle>
            )}
          </div>
          <div className={cn(
            "rounded-lg p-2",
            variant === "danger" ? "bg-red-100" : "bg-muted/50"
          )}>
            {icon}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              trend === "up" && "text-emerald-600",
              trend === "down" && "text-red-600",
              trend === "neutral" && "text-muted-foreground"
            )}>
              {trend === "up" && <ArrowUpRight className="size-3" />}
              {trend === "down" && <ArrowDownRight className="size-3" />}
              <span>{trendValue}</span>
            </div>
          )}
        </CardContent>
      </MotionCard>
    </motion.div>
  )
}

interface StatusBadgeProps {
  status: InvoiceStatus
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const style = invoiceStatusStyles[status] || invoiceStatusStyles.DRAFT
  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1.5 font-medium", style.className)}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" />
      {style.label}
    </Badge>
  )
}

interface InvoiceTypeBadgeProps {
  type: "TERM" | "RECURRING"
}

const InvoiceTypeBadge: React.FC<InvoiceTypeBadgeProps> = ({ type }) => {
  const isTermin = type === "TERM"
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        isTermin
          ? "bg-indigo-100 text-indigo-700 border-indigo-200"
          : "bg-violet-100 text-violet-700 border-violet-200"
      )}
    >
      {isTermin ? "Termin" : "Recurring"}
    </Badge>
  )
}

// Main Page Component
export default function InvoicesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Current date for defaults
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Filter state from URL params
  const [year, setYear] = React.useState(() => {
    const y = searchParams.get("year")
    return y ? parseInt(y, 10) : currentYear
  })
  const [month, setMonth] = React.useState(() => {
    const m = searchParams.get("month")
    return m ? parseInt(m, 10) : currentMonth
  })
  const [statusFilter, setStatusFilter] = React.useState<InvoiceStatus[]>(() => {
    const s = searchParams.get("status")
    return s ? (s.split(",") as InvoiceStatus[]) : []
  })
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get("search") || "")
  const [page, setPage] = React.useState(() => {
    const p = searchParams.get("page")
    return p ? parseInt(p, 10) : 1
  })

  const debouncedSearch = useDebouncedValue(searchQuery, 300)

  // Build filters
  const filters: InvoiceFilters = React.useMemo(() => ({
    year,
    month,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    customer_name: debouncedSearch || undefined,
    page,
    limit: 50,
  }), [year, month, statusFilter, debouncedSearch, page])

  // Update URL when filters change
  React.useEffect(() => {
    const params = new URLSearchParams()
    params.set("year", year.toString())
    params.set("month", month.toString())
    if (statusFilter.length > 0) params.set("status", statusFilter.join(","))
    if (searchQuery) params.set("search", searchQuery)
    if (page > 1) params.set("page", page.toString())
    setSearchParams(params, { replace: true })
  }, [year, month, statusFilter, searchQuery, page, setSearchParams])

  // Fetch data
  const { data, isLoading, isError, refetch } = useInvoices(filters)
  const exportMutation = useExportInvoices()

  // Generate year options (last 5 years + next year)
  const yearOptions = React.useMemo(() => {
    const years: number[] = []
    for (let y = currentYear + 1; y >= currentYear - 5; y--) {
      years.push(y)
    }
    return years
  }, [currentYear])

  // Handle export
  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync({ filters, format: "xlsx" })
      toast.success("Invoice berhasil diekspor")
    } catch {
      toast.error("Gagal mengekspor invoice")
    }
  }

  // Handle row click
  const handleRowClick = (invoice: Invoice) => {
    navigate(`/invoices/${invoice.invoice_type.toLowerCase()}/${invoice.id}`)
  }

  // Status filter options
  const statusOptions: { value: InvoiceStatus; label: string }[] = [
    { value: "DRAFT", label: "Draft" },
    { value: "SENT", label: "Terkirim" },
    { value: "PARTIALLY_PAID", label: "Dibayar Sebagian" },
    { value: "PAID", label: "Lunas" },
    { value: "PAID_PENDING_PPH23", label: "Menunggu PPh23" },
    { value: "OVERDUE", label: "Jatuh Tempo" },
    { value: "CANCELLED", label: "Dibatalkan" },
  ]

  const toggleStatus = (status: InvoiceStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
    setPage(1)
  }

  // Pagination
  const totalPages = data?.pagination.total_pages || 1
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Breadcrumbs />
          <h1 className="text-3xl font-bold tracking-tight">Invoice Management</h1>
          <p className="text-muted-foreground">
            Kelola invoice termin dan recurring untuk periode {getMonthName(month)} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("mr-2 size-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportMutation.isPending || isLoading}
          >
            <Download className="mr-2 size-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Invoice"
          value={isLoading ? "..." : formatNumber(data?.summary.total_invoices || 0)}
          subtitle={isLoading ? undefined : formatCurrency(data?.summary.total_amount || "0")}
          icon={<FileText className="size-5 text-foreground/80" />}
          loading={isLoading}
        />
        <KpiCard
          title="Outstanding"
          value={isLoading ? "..." : formatCurrency(data?.summary.outstanding_amount || "0")}
          subtitle="Belum dibayar"
          icon={<Wallet className="size-5 text-foreground/80" />}
          loading={isLoading}
        />
        <KpiCard
          title="Dibayar"
          value={isLoading ? "..." : formatCurrency(data?.summary.paid_amount || "0")}
          subtitle="Pembayaran diterima"
          icon={<ArrowDownRight className="size-5 text-emerald-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Jatuh Tempo"
          value={isLoading ? "..." : formatNumber(data?.summary.overdue_count || 0)}
          subtitle="Invoice overdue"
          icon={<AlertTriangle className="size-5 text-red-600" />}
          loading={isLoading}
          variant={data?.summary.overdue_count ? "danger" : "default"}
        />
      </div>

      {/* Filters */}
      <Card className={cn(designTokens.radius.xl, designTokens.border, designTokens.surface.base)}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {/* Period Selector */}
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                <Select
                  value={month.toString()}
                  onValueChange={(v) => {
                    setMonth(parseInt(v, 10))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {getMonthName(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={year.toString()}
                  onValueChange={(v) => {
                    setYear(parseInt(v, 10))
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ListFilter className="size-4" />
                    Status
                    {statusFilter.length > 0 && (
                      <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">
                        {statusFilter.length}
                      </Badge>
                    )}
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusOptions.map((opt) => (
                    <DropdownMenuCheckboxItem
                      key={opt.value}
                      checked={statusFilter.includes(opt.value)}
                      onCheckedChange={() => toggleStatus(opt.value)}
                    >
                      {opt.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {statusFilter.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setStatusFilter([])}>
                        Reset Filter
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari pelanggan, nomor invoice..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table */}
      <Card className={cn(designTokens.radius.xl, designTokens.border, designTokens.surface.base)}>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <AlertTriangle className="size-12 text-red-500" />
              <p className="text-muted-foreground">Gagal memuat data invoice</p>
              <Button variant="outline" onClick={() => refetch()}>
                Coba Lagi
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">No. Invoice</TableHead>
                    <TableHead className="whitespace-nowrap">Tipe</TableHead>
                    <TableHead className="whitespace-nowrap">Pelanggan</TableHead>
                    <TableHead className="whitespace-nowrap">No. Kontrak</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Dibayar</TableHead>
                    <TableHead className="whitespace-nowrap">Progress</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Jatuh Tempo</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    // Loading skeleton
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-2 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="size-10 text-muted-foreground/50" />
                          <p className="text-muted-foreground">
                            Tidak ada invoice untuk periode ini
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.data.map((invoice) => (
                      <TableRow
                        key={`${invoice.invoice_type}-${invoice.id}`}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => handleRowClick(invoice)}
                      >
                        <TableCell className="font-medium">
                          {invoice.invoice_number || "—"}
                        </TableCell>
                        <TableCell>
                          <InvoiceTypeBadge type={invoice.invoice_type} />
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {invoice.customer_name || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.contract_number || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.amount || "0", { compact: false })}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(invoice.paid_amount || "0", { compact: false })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={invoice.payment_progress_pct}
                              className="h-2 w-16"
                            />
                            <span className="text-xs text-muted-foreground">
                              {Math.round(invoice.payment_progress_pct)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.invoice_status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(invoice.due_date)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRowClick(invoice)
                            }}
                          >
                            <Eye className="size-4" />
                            <span className="sr-only">Lihat Detail</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!isError && data && data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between border-t border-border/70 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Halaman {page} dari {totalPages} ({data.pagination.total} invoice)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!canPrev}
                >
                  <ChevronLeft className="size-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!canNext}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
