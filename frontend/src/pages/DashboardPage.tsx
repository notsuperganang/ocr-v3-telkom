// Dashboard overview page
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Banknote,
  Clock,
  ArrowRight,
  Upload,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useDashboardOverview, useTerminUpcoming } from '@/hooks/useContracts';
import { cn } from '@/lib/utils';
import { STATUS_INFO, STATUS_ORDER } from '@/lib/termin-utils';
import type { TerminUpcomingItem } from '@/types/api';

// Design tokens matching ContractsPage
const designTokens = {
  radius: {
    xl: "rounded-[1.25rem]",
  },
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
  },
  border: "border border-border/70",
  surface: {
    base: "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90",
  },
  focusRing:
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]/80",
} as const;

const MotionCard = motion(Card);

// Skeleton component for loading states
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted/60", className)} />
  );
}

// KPI Descriptor interface
interface KpiDescriptor {
  id: string;
  label: string;
  value: number | string;
  formattedValue?: string;
  auxLabel?: string;
  auxValue?: string;
  sparkline: number[];
  icon: React.ReactNode;
}

// KPI Card component matching ContractsPage style
interface KpiCardProps {
  descriptor: KpiDescriptor;
  loading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ descriptor, loading }) => {
  const {
    label,
    formattedValue,
    auxLabel,
    auxValue,
    sparkline,
    icon,
  } = descriptor;

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
        className={cn(
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
                <span className="font-bold tabular-nums text-[#d71920]">{formattedValue}</span>
              </CardTitle>
            )}
          </div>
          <div
            className={cn(
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
              </div>
            </div>
          )}
        </CardContent>
      </MotionCard>
    </motion.div>
  );
};

// Create sparkline path from data points
function createSparklinePath(data: number[]) {
  if (data.length === 0) return "";
  const width = 48;
  const height = 18;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const normalized = data.map((point) =>
    max === min ? 0.5 : (point - min) / (max - min)
  );

  return normalized
    .map((value, index) => {
      const x = (index / (normalized.length - 1 || 1)) * width;
      const y = height - value * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

// Helper function to format currency
function formatCurrency(value: string | number, compact: boolean = false): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Rp 0';

  if (compact) {
    if (num >= 1000000000) {
      return `Rp ${(num / 1000000000).toFixed(1)} M`;
    } else if (num >= 1000000) {
      return `Rp ${(num / 1000000).toFixed(1)} Jt`;
    } else if (num >= 1000) {
      return `Rp ${(num / 1000).toFixed(1)} Rb`;
    }
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Helper function to format processing time
function formatProcessingTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '-';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes > 0) {
    return `${minutes} mnt ${remainingSeconds} dtk`;
  }
  return `${remainingSeconds} dtk`;
}

// Helper function to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Type for grouped termin data
interface GroupedTerminData {
  status: 'OVERDUE' | 'DUE' | 'PENDING';
  items: TerminUpcomingItem[];
  count: number;
  totalAmount: number;
}

// Helper function to group termin items by status
function groupTerminByStatus(items: TerminUpcomingItem[]): GroupedTerminData[] {
  const groups: Record<string, { items: TerminUpcomingItem[]; totalAmount: number }> = {
    OVERDUE: { items: [], totalAmount: 0 },
    DUE: { items: [], totalAmount: 0 },
    PENDING: { items: [], totalAmount: 0 },
  };

  items.forEach((item) => {
    const status = item.status as 'OVERDUE' | 'DUE' | 'PENDING';
    if (groups[status]) {
      groups[status].items.push(item);
      groups[status].totalAmount += parseFloat(item.amount || '0');
    }
  });

  return STATUS_ORDER.map((status) => ({
    status,
    items: groups[status].items,
    count: groups[status].items.length,
    totalAmount: groups[status].totalAmount,
  }));
}

// Dummy data for Recurring section
const DUMMY_RECURRING_DATA = [
  {
    contract_id: 13,
    customer_name: 'SMK Negeri 1 Jakarta',
    period_start: '2024-01-01',
    period_end: '2026-12-31',
    month_number: 12,
    month_label: 'Desember 2025',
    amount: '3017260',
  },
  {
    contract_id: 14,
    customer_name: 'SMK Negeri 2 Bandung',
    period_start: '2025-01-01',
    period_end: '2026-12-31',
    month_number: 6,
    month_label: 'Juni 2025',
    amount: '1017260',
  },
  {
    contract_id: 15,
    customer_name: 'SMK Negeri 3 Surabaya',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    month_number: 9,
    month_label: 'September 2025',
    amount: '6017260',
  },
  {
    contract_id: 16,
    customer_name: 'SMK Negeri 4 Medan',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    month_number: 9,
    month_label: 'September 2025',
    amount: '5017260',
  },
  {
    contract_id: 17,
    customer_name: 'SMK Negeri 5 Semarang',
    period_start: '2024-01-01',
    period_end: '2025-12-31',
    month_number: 6,
    month_label: 'Juni 2025',
    amount: '2017260',
  },
  {
    contract_id: 18,
    customer_name: 'SMK Negeri 6 Makassar',
    period_start: '2024-01-01',
    period_end: '2025-12-31',
    month_number: 6,
    month_label: 'Juni 2025',
    amount: '4017260',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();

  // Fetch dashboard data
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: terminData, isLoading: terminLoading } = useTerminUpcoming(30);

  // State for accordion expanded sections (default: all expanded)
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(['OVERDUE', 'DUE', 'PENDING']));

  // Group termin data by status
  const groupedTerminData = React.useMemo(() => {
    if (!terminData?.items) return [];
    return groupTerminByStatus(terminData.items);
  }, [terminData]);

  // Toggle accordion section
  const toggleSection = (status: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  // Navigate to contract detail termin section
  const handleTerminRowClick = (contractId: number) => {
    navigate(`/contracts/${contractId}#termin-section`);
  };

  // Calculate MoM comparison for contracts
  const momDiff = overview
    ? overview.contracts_this_month - overview.contracts_last_month
    : 0;
  const momText = momDiff >= 0 ? `+${momDiff} kontrak` : `${momDiff} kontrak`;

  // Calculate percentage change vs last month
  const percentChange = overview && overview.contracts_last_month > 0
    ? ((overview.contracts_this_month - overview.contracts_last_month) / overview.contracts_last_month * 100).toFixed(1)
    : '0';

  // Calculate recurring dummy totals
  const recurringTotalContracts = DUMMY_RECURRING_DATA.length;
  const recurringTotalAmount = DUMMY_RECURRING_DATA.reduce(
    (sum, item) => sum + parseFloat(item.amount),
    0
  );

  // Build KPI descriptors for enhanced cards
  const kpiDescriptors: KpiDescriptor[] = React.useMemo(() => {
    const totalContracts = overview?.total_contracts ?? 0;
    const thisMonth = overview?.contracts_this_month ?? 0;
    const totalValue = parseFloat(overview?.total_contract_value || '0');
    const avgValue = parseFloat(overview?.avg_contract_value || '0');
    const avgProcessing = overview?.avg_processing_time_sec ?? null;
    const medianProcessing = overview?.median_processing_time_sec ?? null;

    // Generate sparklines based on data progression
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
      : [0, 0, 0, 0, 0, 0, 0];

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
      : [0, 0, 0, 0, 0, 0, 0];

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
      : [0, 0, 0, 0, 0, 0, 0];

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
      : [0, 0, 0, 0, 0, 0, 0];

    return [
      {
        id: 'total',
        label: 'Total Kontrak',
        value: totalContracts,
        formattedValue: totalContracts.toString(),
        auxLabel: 'vs bulan lalu',
        auxValue: `${percentChange}%`,
        sparkline: totalSparkline,
        icon: <FileText className="size-5 text-foreground/80" aria-hidden="true" />,
      },
      {
        id: 'month',
        label: 'Kontrak Bulan Ini',
        value: thisMonth,
        formattedValue: thisMonth.toString(),
        auxLabel: 'MoM',
        auxValue: momText,
        sparkline: monthSparkline,
        icon: <TrendingUp className="size-5 text-foreground/80" aria-hidden="true" />,
      },
      {
        id: 'value',
        label: 'Nilai Total Kontrak',
        value: totalValue,
        formattedValue: formatCurrency(totalValue, true),
        auxLabel: 'Rata-rata/kontrak',
        auxValue: formatCurrency(avgValue, true),
        sparkline: valueSparkline,
        icon: <Banknote className="size-5 text-foreground/80" aria-hidden="true" />,
      },
      {
        id: 'processing',
        label: 'Waktu Proses',
        value: avgProcessing ?? 0,
        formattedValue: formatProcessingTime(avgProcessing),
        auxLabel: 'Median',
        auxValue: formatProcessingTime(medianProcessing),
        sparkline: processingSparkline,
        icon: <Clock className="size-5 text-foreground/80" aria-hidden="true" />,
      },
    ];
  }, [overview, percentChange, momText]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Beranda {'>'} Dashboard
          </div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Ringkasan aktivitas pemrosesan kontrak
          </p>
        </div>
        <Button
          onClick={() => navigate('/upload')}
          className="bg-[#d71920] hover:bg-[#b81419] text-white"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload File Baru
        </Button>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiDescriptors.map((descriptor) => (
          <KpiCard
            key={descriptor.id}
            descriptor={descriptor}
            loading={overviewLoading}
          />
        ))}
      </section>

      {/* Bottom Row - Termin & Recurring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Termin Jatuh Tempo with Accordion */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">
                  Termin Jatuh Tempo
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Termin belum lunas dalam 30 hari ke depan
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                className="bg-[#d71920] hover:bg-[#b81419] text-white"
                onClick={() => navigate('/contracts?payment_method=termin')}
              >
                Lihat Semua
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {groupedTerminData.map((group) => {
                const info = STATUS_INFO[group.status];
                return (
                  <motion.div
                    key={group.status}
                    whileHover={{ y: -2 }}
                    className={cn(
                      "rounded-xl border p-3 cursor-pointer transition-all",
                      info.bgColor,
                      info.borderColor,
                      expandedSections.has(group.status) && "ring-2 ring-offset-1",
                      group.status === 'OVERDUE' && expandedSections.has(group.status) && "ring-red-400",
                      group.status === 'DUE' && expandedSections.has(group.status) && "ring-amber-400",
                      group.status === 'PENDING' && expandedSections.has(group.status) && "ring-slate-400"
                    )}
                    onClick={() => toggleSection(group.status)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{info.icon}</span>
                      <span className={cn("text-[0.65rem] font-semibold uppercase tracking-wider", info.color)}>
                        {info.shortLabel}
                      </span>
                    </div>
                    <div className={cn("text-2xl font-bold", info.color)}>
                      {terminLoading ? '--' : group.count}
                    </div>
                    <div className="text-[0.65rem] text-muted-foreground mt-0.5">
                      {terminLoading ? '-' : formatCurrency(group.totalAmount, true)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <ScrollArea className="h-[350px]">
              {terminLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Memuat data...</div>
                </div>
              ) : groupedTerminData.every(g => g.count === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                  <div className="text-muted-foreground">
                    Belum ada termin yang jatuh tempo dalam 30 hari ke depan.
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pr-3">
                  {groupedTerminData.map((group) => {
                    const info = STATUS_INFO[group.status];
                    const isExpanded = expandedSections.has(group.status);

                    if (group.count === 0) return null;

                    return (
                      <div key={group.status} className="border rounded-lg overflow-hidden">
                        {/* Accordion Header */}
                        <button
                          onClick={() => toggleSection(group.status)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 text-left transition-colors",
                            info.bgColor,
                            "hover:opacity-90"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className={cn("w-4 h-4", info.color)} />
                            ) : (
                              <ChevronRight className={cn("w-4 h-4", info.color)} />
                            )}
                            <span className={cn("text-sm font-semibold", info.color)}>
                              {info.label} ({group.count})
                            </span>
                          </div>
                          <span className={cn("text-sm font-medium", info.color)}>
                            {formatCurrency(group.totalAmount, true)}
                          </span>
                        </button>

                        {/* Accordion Content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Table className="table-fixed">
                                <TableHeader>
                                  <TableRow className="bg-muted/30">
                                    <TableHead className="text-xs py-2 w-[50%]">Pelanggan</TableHead>
                                    <TableHead className="text-xs py-2 w-[30%]">Termin</TableHead>
                                    <TableHead className="text-xs py-2 text-right w-[20%]">Nilai</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map((item, index) => (
                                    <TableRow
                                      key={`${item.contract_id}-${item.termin_number}-${index}`}
                                      onClick={() => handleTerminRowClick(item.contract_id)}
                                      className={cn(
                                        "cursor-pointer transition-colors",
                                        "hover:bg-muted/50",
                                        group.status === 'OVERDUE' && "hover:bg-red-50"
                                      )}
                                    >
                                      <TableCell className="py-2">
                                        <div className="font-medium text-sm truncate" title={item.customer_name}>
                                          {item.customer_name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          ID {item.contract_id}
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2">
                                        <div className="font-medium text-sm">Termin {item.termin_number}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {item.termin_period_label}
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2 text-right">
                                        <div className="font-medium text-sm">
                                          {formatCurrency(item.amount, true)}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recurring Bulan Ini */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">
                  Recurring Bulan Ini
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Tagihan berkala yang jatuh tempo pada bulan berjalan
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                className="bg-[#d71920] hover:bg-[#b81419] text-white"
                onClick={() => navigate('/contracts?payment_method=recurring')}
              >
                Lihat Semua
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Summary Stats */}
            <div className="mt-4">
              <div className="text-3xl font-bold text-[#d71920]">
                {recurringTotalContracts} Kontrak
              </div>
              <p className="text-sm text-muted-foreground">
                Total nominal: {formatCurrency(recurringTotalAmount, true)}
              </p>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">
                      <div className="flex items-center gap-1">
                        Pelanggan
                        <FileText className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">
                      <div className="flex items-center gap-1">
                        Periode
                        <Calendar className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">Bulan Ke-</TableHead>
                    <TableHead className="text-xs text-right">Nilai Tagihan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DUMMY_RECURRING_DATA.map((item) => (
                    <TableRow key={item.contract_id}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Kontrak ID {item.contract_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(item.period_start)}</div>
                        <div className="text-xs text-muted-foreground">
                          s/d {formatDate(item.period_end)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.month_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.month_label}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium text-sm">
                          {formatCurrency(item.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(item.amount, true)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
