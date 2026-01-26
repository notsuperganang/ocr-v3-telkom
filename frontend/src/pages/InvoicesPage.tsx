import * as React from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowDownRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ListFilter,
  Receipt,
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
  loading?: boolean
  variant?: "default" | "danger"
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardDescription className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {title}
            </CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <CardTitle className="flex items-baseline gap-2 text-3xl font-semibold">
                <span className={cn(
                  "font-bold tabular-nums",
                  variant === "danger" ? "text-red-600" : "text-[#d71920]"
                )}>
                  {value}
                </span>
              </CardTitle>
            )}
          </div>
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-2xl border shadow-inner",
              variant === "danger"
                ? "border-red-200 bg-gradient-to-br from-red-500/10 to-transparent"
                : "border-border/60 bg-gradient-to-br from-[#d71920]/10 to-transparent",
              designTokens.focusRing
            )}
          >
            <div className={variant === "danger" ? "text-red-600" : "text-[#d71920]"}>
              {icon}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="space-y-2 border-t border-border/40 pt-3">
              {subtitle && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                </div>
              )}
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

// Main Page Component
export default function InvoicesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Current date for defaults
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Initialize URL params if not present
  React.useEffect(() => {
    const hasYearParam = searchParams.has("year")
    const hasMonthParam = searchParams.has("month")
    
    if (!hasYearParam || !hasMonthParam) {
      const params = new URLSearchParams(searchParams)
      if (!hasYearParam) params.set("year", currentYear.toString())
      if (!hasMonthParam) params.set("month", currentMonth.toString())
      setSearchParams(params, { replace: true })
    }
  }, []) // Only run on mount

  // Derive all filter state directly from URL params (single source of truth)
  const year = React.useMemo(() => {
    const y = searchParams.get("year")
    return y ? parseInt(y, 10) : currentYear
  }, [searchParams, currentYear])

  const month = React.useMemo(() => {
    const m = searchParams.get("month")
    return m ? parseInt(m, 10) : currentMonth
  }, [searchParams, currentMonth])

  const statusFilter = React.useMemo<InvoiceStatus[]>(() => {
    const s = searchParams.get("status")
    return s ? (s.split(",") as InvoiceStatus[]) : []
  }, [searchParams])

  const officerFilter = React.useMemo(() => {
    return searchParams.get("officer") || ""
  }, [searchParams])

  const searchQuery = React.useMemo(() => {
    return searchParams.get("search") || ""
  }, [searchParams])

  const page = React.useMemo(() => {
    const p = searchParams.get("page")
    return p ? parseInt(p, 10) : 1
  }, [searchParams])

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

  // Helper to update URL params
  const updateSearchParams = React.useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams)
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  // Fetch data
  const { data, isLoading, isError, refetch } = useInvoices(filters)
  const exportMutation = useExportInvoices()

  // Generate unique officer options from invoice data
  const officerOptions = React.useMemo(() => {
    if (!data?.data) return []
    const officers = new Set<string>()
    data.data.forEach((invoice) => {
      if (invoice.assigned_officer_name) {
        officers.add(invoice.assigned_officer_name)
      }
    })
    return Array.from(officers).sort()
  }, [data])

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

  // Filter update handlers
  const handleYearChange = React.useCallback((newYear: string) => {
    updateSearchParams({ year: newYear, page: null })
  }, [updateSearchParams])

  const handleMonthChange = React.useCallback((newMonth: string) => {
    updateSearchParams({ month: newMonth, page: null })
  }, [updateSearchParams])

  const handleSearchChange = React.useCallback((query: string) => {
    updateSearchParams({ search: query || null, page: null })
  }, [updateSearchParams])

  const toggleStatus = React.useCallback((status: InvoiceStatus) => {
    const currentStatuses = statusFilter
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status]
    
    updateSearchParams({
      status: newStatuses.length > 0 ? newStatuses.join(",") : null,
      page: null,
    })
  }, [statusFilter, updateSearchParams])

  const clearStatusFilter = React.useCallback(() => {
    updateSearchParams({ status: null, page: null })
  }, [updateSearchParams])

  const handleOfficerChange = React.useCallback((officer: string) => {
    updateSearchParams({ officer: officer || null, page: null })
  }, [updateSearchParams])

  const clearOfficerFilter = React.useCallback(() => {
    updateSearchParams({ officer: null, page: null })
  }, [updateSearchParams])

  const handlePageChange = React.useCallback((newPage: number) => {
    updateSearchParams({ page: newPage.toString() })
  }, [updateSearchParams])

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

  // Pagination
  const totalPages = data?.pagination.total_pages || 1
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-6">
          <Breadcrumbs />
          <div className="flex items-center gap-4">
            <div
              className={twMerge(
                'flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-[#d71920]/10 to-transparent shadow-inner',
                designTokens.focusRing
              )}
            >
              <Receipt className="size-7 text-[#d71920]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-foreground">Manajemen Invoice</h1>
              <p className="text-sm text-muted-foreground">
                Kelola invoice termin dan recurring untuk periode {getMonthName(month)} {year}
              </p>
            </div>
          </div>
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
          value={isLoading ? "..." : formatCurrency(data?.summary.total_outstanding || "0")}
          subtitle="Belum dibayar"
          icon={<Wallet className="size-5 text-foreground/80" />}
          loading={isLoading}
        />
        <KpiCard
          title="Dibayar"
          value={isLoading ? "..." : formatCurrency(data?.summary.total_paid || "0")}
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
                  onValueChange={handleMonthChange}
                >
                  <SelectTrigger className="w-[140px] hover:bg-accent hover:text-accent-foreground">
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
                  onValueChange={handleYearChange}
                >
                  <SelectTrigger className="w-[100px] hover:bg-accent hover:text-accent-foreground">
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
                      <DropdownMenuItem onClick={clearStatusFilter}>
                        Reset Filter
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Officer Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ListFilter className="size-4" />
                    Petugas
                    {officerFilter && (
                      <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">
                        1
                      </Badge>
                    )}
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Filter Petugas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleOfficerChange("")}>
                    Semua Petugas
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {officerOptions.map((officer) => (
                    <DropdownMenuCheckboxItem
                      key={officer}
                      checked={officerFilter === officer}
                      onCheckedChange={() => handleOfficerChange(officer)}
                    >
                      {officer}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {officerFilter && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={clearOfficerFilter}>
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
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Table */}
      {isError ? (
        <Card className={cn(designTokens.radius.xl, designTokens.border, designTokens.surface.base)}>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <AlertTriangle className="size-12 text-red-500" />
              <p className="text-muted-foreground">Gagal memuat data invoice</p>
              <Button variant="outline" onClick={() => refetch()}>
                Coba Lagi
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)]">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#d71920]/60 to-transparent opacity-70" />
            {isLoading && (
              <div className="absolute inset-x-0 top-0 h-1 animate-pulse bg-gradient-to-r from-[#d71920]/0 via-[#d71920]/60 to-[#d71920]/0" />
            )}
            <Table className={designTokens.radius.xl}>
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                  <TableRow className="hover:bg-transparent border-b border-border/70">
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">No. Invoice</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Bus Area</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">No. Akun</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Pelanggan</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">NIPNAS</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Segmen</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Witel</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Total</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">AM</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Petugas</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Progress</TableHead>
                    <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide text-[#d71920] font-bold">Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-background/60">
                  {isLoading ? (
                    // Loading skeleton
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-2 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      </TableRow>
                    ))
                  ) : data?.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="h-32 text-center">
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
                        className="group border-b border-border/40 bg-background/70 transition-all duration-200 hover:bg-primary/5 even:bg-muted/30 cursor-pointer"
                        onClick={() => handleRowClick(invoice)}
                      >
                        <TableCell className="font-medium text-foreground">
                          {invoice.invoice_number || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invoice.bus_area || "—"}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">
                          {invoice.account_number || "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium text-foreground">
                          {invoice.customer_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invoice.nipnas || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invoice.segment_name || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invoice.witel_name || "—"}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(invoice.amount || "0", { compact: false })}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                          {invoice.account_manager_name || "—"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm font-medium text-foreground">
                          {invoice.assigned_officer_name || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.invoice_status} />
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
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground italic">
                          {invoice.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
          </div>

          {/* Pagination */}
            {data && data.pagination.total_pages > 1 && (
              <div className="flex flex-col items-start gap-4 bg-card/90 p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between border-t border-border/60">
                <div>
                  {data.pagination.total === 0 ? (
                    "Tidak ada invoice"
                  ) : (
                    <>
                      Menampilkan{" "}
                      <span className="font-semibold text-foreground">
                        {(page - 1) * 50 + 1}-{Math.min(page * 50, data.pagination.total)}
                      </span>{" "}
                      dari{" "}
                      <span className="font-semibold text-foreground">
                        {data.pagination.total}
                      </span>{" "}
                      invoice
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={!canPrev}
                    className={designTokens.focusRing}
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Prev
                  </Button>
                  <span className="tabular-nums text-sm text-foreground">
                    {totalPages === 0 ? 0 : page} / {Math.max(totalPages, 1)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={!canNext}
                    className={designTokens.focusRing}
                    aria-label="Halaman selanjutnya"
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  )
}
