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
  TrendingUp,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Circle
} from 'lucide-react';
import { useTerminUpcoming, useRecurringAll, useFinancialSummary } from '@/hooks/useContracts';
import { cn } from '@/lib/utils';
import { STATUS_INFO, STATUS_ORDER } from '@/lib/termin-utils';
import type { TerminUpcomingItem } from '@/types/api';
import { RichKpiCard, type RichKpiDescriptor } from '@/components/dashboard/RichKpiCard';

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
  richContent?: Array<{ label: string; value: string }>;
  colSpan?: number; // For 2-column cards
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
    richContent,
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
                {richContent && richContent.length > 0 ? (
                  // Rich content with multiple items
                  richContent.map((item, index) => (
                    <div key={index} className="flex items-start justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className="text-xs font-semibold text-[#d71920] text-right">{item.value}</span>
                    </div>
                  ))
                ) : (
                  // Simple aux label/value
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{auxLabel}</span>
                    <span className="text-xs font-semibold text-[#d71920] text-right">{auxValue}</span>
                  </div>
                )}
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

// Type for consolidated termin item (contract with termin range)
interface ConsolidatedTerminItem {
  contract_id: number;
  customer_name: string;
  period_start: string | null;
  period_end: string | null;
  termin_start: number;
  termin_end: number;
  period_label: string;
  total_amount: number;
  item_count: number;
}

// Type for grouped termin data
interface GroupedTerminData {
  status: 'OVERDUE' | 'DUE' | 'PENDING';
  items: ConsolidatedTerminItem[];
  count: number;
  totalAmount: number;
}

// Helper function to consolidate termin items by contract and consecutive termin numbers
function consolidateTerminByContract(items: TerminUpcomingItem[]): ConsolidatedTerminItem[] {
  // Group by contract_id first
  const byContract = items.reduce((acc, item) => {
    if (!acc[item.contract_id]) {
      acc[item.contract_id] = [];
    }
    acc[item.contract_id].push(item);
    return acc;
  }, {} as Record<number, TerminUpcomingItem[]>);

  const consolidated: ConsolidatedTerminItem[] = [];

  // For each contract, sort by termin number and create consolidated entry
  Object.entries(byContract).forEach(([contractId, contractItems]) => {
    // Sort by termin number
    contractItems.sort((a, b) => a.termin_number - b.termin_number);

    const firstItem = contractItems[0];
    const lastItem = contractItems[contractItems.length - 1];
    const totalAmount = contractItems.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);

    consolidated.push({
      contract_id: parseInt(contractId),
      customer_name: firstItem.customer_name,
      period_start: firstItem.period_start,
      period_end: firstItem.period_end,
      termin_start: firstItem.termin_number,
      termin_end: lastItem.termin_number,
      period_label: firstItem.termin_number === lastItem.termin_number
        ? firstItem.termin_period_label
        : `${firstItem.termin_period_label} - ${lastItem.termin_period_label}`,
      total_amount: totalAmount,
      item_count: contractItems.length,
    });
  });

  return consolidated;
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
    items: consolidateTerminByContract(groups[status].items),
    count: groups[status].items.length,
    totalAmount: groups[status].totalAmount,
  }));
}

// Type for consolidated recurring item (contract with month range)
interface ConsolidatedRecurringItem {
  contract_id: number;
  customer_name: string;
  period_start: string | null;
  period_end: string | null;
  cycle_start: number;
  cycle_end: number;
  period_label: string;
  total_amount: number;
  item_count: number;
}

// Type for grouped recurring data
interface GroupedRecurringData {
  status: 'OVERDUE' | 'DUE' | 'PENDING';
  items: ConsolidatedRecurringItem[];
  count: number;
  totalAmount: number;
}

// Helper function to consolidate recurring items by contract and consecutive months
function consolidateRecurringByContract(items: TerminUpcomingItem[]): ConsolidatedRecurringItem[] {
  // Group by contract_id first
  const byContract = items.reduce((acc, item) => {
    if (!acc[item.contract_id]) {
      acc[item.contract_id] = [];
    }
    acc[item.contract_id].push(item);
    return acc;
  }, {} as Record<number, TerminUpcomingItem[]>);

  const consolidated: ConsolidatedRecurringItem[] = [];

  // For each contract, sort by cycle number and create consolidated entry
  Object.entries(byContract).forEach(([contractId, contractItems]) => {
    // Sort by cycle number
    contractItems.sort((a, b) => a.termin_number - b.termin_number);

    const firstItem = contractItems[0];
    const lastItem = contractItems[contractItems.length - 1];
    const totalAmount = contractItems.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);

    consolidated.push({
      contract_id: parseInt(contractId),
      customer_name: firstItem.customer_name,
      period_start: firstItem.period_start,
      period_end: firstItem.period_end,
      cycle_start: firstItem.termin_number,
      cycle_end: lastItem.termin_number,
      period_label: firstItem.termin_number === lastItem.termin_number 
        ? firstItem.termin_period_label 
        : `${firstItem.termin_period_label} - ${lastItem.termin_period_label}`,
      total_amount: totalAmount,
      item_count: contractItems.length,
    });
  });

  return consolidated;
}

// Helper function to group recurring items by status
function groupRecurringByStatus(items: TerminUpcomingItem[]): GroupedRecurringData[] {
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
    items: consolidateRecurringByContract(groups[status].items),
    count: groups[status].items.length,
    totalAmount: groups[status].totalAmount,
  }));
}

export function DashboardPage() {
  const navigate = useNavigate();

  // Fetch dashboard data
  const { data: terminData, isLoading: terminLoading } = useTerminUpcoming(30);
  const { data: recurringData, isLoading: recurringLoading } = useRecurringAll();
  const { data: financialSummary, isLoading: financialLoading } = useFinancialSummary();

  // State for accordion expanded sections (default: all expanded)
  const [expandedTerminSections, setExpandedTerminSections] = React.useState<Set<string>>(new Set(['OVERDUE', 'DUE', 'PENDING']));
  const [expandedRecurringSections, setExpandedRecurringSections] = React.useState<Set<string>>(new Set(['OVERDUE', 'DUE', 'PENDING']));

  // Group termin data by status
  const groupedTerminData = React.useMemo(() => {
    if (!terminData?.items) return [];
    return groupTerminByStatus(terminData.items);
  }, [terminData]);

  // Group recurring data by status
  const groupedRecurringData = React.useMemo(() => {
    if (!recurringData?.items) return [];
    return groupRecurringByStatus(recurringData.items);
  }, [recurringData]);

  // Toggle accordion section for termin
  const toggleTerminSection = (status: string) => {
    setExpandedTerminSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  // Toggle accordion section for recurring
  const toggleRecurringSection = (status: string) => {
    setExpandedRecurringSections((prev) => {
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

  // Navigate to contract detail recurring section
  const handleRecurringRowClick = (contractId: number) => {
    navigate(`/contracts/${contractId}#recurring-section`);
  };

  // Build KPI descriptors for financial summary cards
  const kpiDescriptors: KpiDescriptor[] = React.useMemo(() => {
    if (!financialSummary) return [];

    // Helper to generate sparkline
    const generateSparkline = (value: number) => {
      if (value === 0) return [0, 0, 0, 0, 0, 0, 0];
      return [
        value * 0.60,
        value * 0.68,
        value * 0.75,
        value * 0.82,
        value * 0.88,
        value * 0.94,
        value,
      ];
    };

    const terminTotal = parseFloat(financialSummary.total_termin_cost || '0');
    const recurringTotal = parseFloat(financialSummary.total_recurring_cost || '0');
    const oneTimeTotal = parseFloat(financialSummary.total_one_time_cost || '0');
    const projection = parseFloat(financialSummary.projection_90_days || '0');

    return [
      // Card 1: Total Termin Cost
      {
        id: 'termin-cost',
        label: 'Total Biaya Termin',
        value: terminTotal,
        formattedValue: formatCurrency(terminTotal, true),
        sparkline: generateSparkline(terminTotal),
        icon: <Banknote className="size-5 text-foreground/80" aria-hidden="true" />,
        auxLabel: `${financialSummary.total_termin_contracts} kontrak`,
        auxValue: `Terbayar: ${formatCurrency(financialSummary.termin_paid_amount, true)}`,
      },
      // Card 2: Total Recurring Cost
      {
        id: 'recurring-cost',
        label: 'Total Biaya Recurring',
        value: recurringTotal,
        formattedValue: formatCurrency(recurringTotal, true),
        sparkline: generateSparkline(recurringTotal),
        icon: <TrendingUp className="size-5 text-foreground/80" aria-hidden="true" />,
        auxLabel: `${financialSummary.total_recurring_contracts} kontrak`,
        auxValue: `Avg/bulan: ${formatCurrency(financialSummary.recurring_monthly_avg, true)}`,
      },
      // Card 3: One-Time Charge Total
      {
        id: 'one-time-cost',
        label: 'Total Biaya Sekali Bayar',
        value: oneTimeTotal,
        formattedValue: formatCurrency(oneTimeTotal, true),
        sparkline: generateSparkline(oneTimeTotal),
        icon: <FileText className="size-5 text-foreground/80" aria-hidden="true" />,
        auxLabel: `${financialSummary.total_one_time_contracts} kontrak`,
        auxValue: `Avg/kontrak: ${formatCurrency(financialSummary.one_time_avg_per_contract, true)}`,
      },
      // Card 4: 90-Day Projection
      {
        id: 'projection',
        label: 'Proyeksi 90 Hari',
        value: projection,
        formattedValue: formatCurrency(projection, true),
        sparkline: generateSparkline(projection),
        icon: <Clock className="size-5 text-foreground/80" aria-hidden="true" />,
        auxLabel: `${financialSummary.projection_contracts_count} kontrak`,
        auxValue: `Termin: ${formatCurrency(financialSummary.projection_termin, true)}`,
      },
    ];
  }, [financialSummary]);

  // Build Rich KPI descriptor for Card 5: Collected This Month
  const collectedCardDescriptor: RichKpiDescriptor | null = React.useMemo(() => {
    if (!financialSummary) return null;

    const collected = parseFloat(financialSummary.collected_this_month || '0');
    const collectedTermin = parseFloat(financialSummary.collected_termin || '0');
    const collectedRecurring = parseFloat(financialSummary.collected_recurring || '0');
    const target = parseFloat(financialSummary.collection_target || '0');
    const outstanding = parseFloat(financialSummary.outstanding_amount || '0'); // Use backend value
    const percentage = target > 0 ? (collected / target) * 100 : 0;

    // Calculate percentages for chart
    const terminPercent = collected > 0 ? (collectedTermin / collected) * 100 : 0;
    const recurringPercent = collected > 0 ? (collectedRecurring / collected) * 100 : 0;

    return {
      id: 'collected',
      label: 'Terkumpul Bulan Ini',
      formattedValue: formatCurrency(collected, true),
      icon: <Banknote className="size-5 text-foreground/80" aria-hidden="true" />,
      chartData: [
        {
          name: 'Termin',
          value: collectedTermin,
          color: '#e11d48', // rose-600
          percentage: terminPercent,
        },
        {
          name: 'Recurring',
          value: collectedRecurring,
          color: '#3b82f6', // blue-500
          percentage: recurringPercent,
        },
      ],
      keyMetrics: [
        {
          label: 'Tercapai',
          value: `${percentage.toFixed(1)}%`,
          type: percentage >= 80 ? 'success' : percentage >= 50 ? 'warning' : 'default',
          icon: percentage >= 80 ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />,
        },
        {
          label: 'Outstanding',
          value: formatCurrency(outstanding, true),
          type: outstanding > 0 ? 'warning' : 'success',
          icon: <Circle className="size-4" />,
        },
      ],
      detailMetrics: [
        {
          label: 'Jumlah pembayaran',
          value: `${financialSummary.collected_count} pembayaran`,
        },
        {
          label: `Termin (${terminPercent.toFixed(0)}%)`,
          value: formatCurrency(collectedTermin, true),
        },
        {
          label: `Recurring (${recurringPercent.toFixed(0)}%)`,
          value: formatCurrency(collectedRecurring, true),
        },
        {
          label: 'Target total',
          value: formatCurrency(target, true),
        },
      ],
    };
  }, [financialSummary]);

  // Build Rich KPI descriptor for Card 6: Collection Rate
  const collectionRateDescriptor: RichKpiDescriptor | null = React.useMemo(() => {
    if (!financialSummary) return null;

    const onTimeCount = financialSummary.on_time_count;
    const lateCount = financialSummary.late_count;
    const outstandingCount = financialSummary.outstanding_count;
    const totalPayments = financialSummary.total_payment_count; // Use backend total (includes PENDING)
    const overallCollectionRate = financialSummary.overall_collection_rate; // All-time rate

    // Calculate percentages for chart (based on total_payment_count)
    const onTimePercent = totalPayments > 0 ? (onTimeCount / totalPayments) * 100 : 0;
    const latePercent = totalPayments > 0 ? (lateCount / totalPayments) * 100 : 0;
    const outstandingPercent = totalPayments > 0 ? (outstandingCount / totalPayments) * 100 : 0;

    // Calculate success rate (on-time percentage)
    const successRate = totalPayments > 0 ? (onTimeCount / totalPayments) * 100 : 0;

    return {
      id: 'collection-rate',
      label: 'Tingkat Penagihan',
      formattedValue: `${overallCollectionRate.toFixed(1)}%`,
      icon: <TrendingUp className="size-5 text-foreground/80" aria-hidden="true" />,
      chartData: [
        {
          name: 'Tepat Waktu',
          value: onTimeCount,
          color: '#10b981', // green-500
          percentage: onTimePercent,
        },
        {
          name: 'Terlambat',
          value: lateCount,
          color: '#f59e0b', // amber-500
          percentage: latePercent,
        },
        {
          name: 'Outstanding',
          value: outstandingCount,
          color: '#ef4444', // red-500
          percentage: outstandingPercent,
        },
      ],
      keyMetrics: [
        {
          label: 'Collection Rate',
          value: `${overallCollectionRate.toFixed(1)}%`,
          type: overallCollectionRate >= 80 ? 'success' : overallCollectionRate >= 50 ? 'warning' : 'default',
          icon: <TrendingUp className="size-4" />,
        },
        {
          label: 'Total Pembayaran',
          value: `${totalPayments} items`,
          type: 'info',
          icon: <Circle className="size-4" />,
        },
        {
          label: 'Success Rate',
          value: `${successRate.toFixed(1)}%`,
          type: successRate >= 80 ? 'success' : successRate >= 50 ? 'warning' : 'default',
          icon: <CheckCircle2 className="size-4" />,
        },
        {
          label: 'Outstanding',
          value: `${outstandingCount} tagihan`,
          type: outstandingCount > 0 ? 'warning' : 'success',
          icon: <AlertCircle className="size-4" />,
        },
      ],
      progressBar: {
        value: overallCollectionRate,
        label: 'Collection Rate Progress',
        showPercentage: true,
      },
      detailMetrics: [
        {
          label: `Tepat waktu (${onTimePercent.toFixed(0)}%)`,
          value: `${onTimeCount} pembayaran`,
          icon: <CheckCircle2 className="size-3.5 text-green-600" />,
        },
        {
          label: `Terlambat (${latePercent.toFixed(0)}%)`,
          value: `${lateCount} pembayaran`,
          icon: <AlertTriangle className="size-3.5 text-amber-600" />,
        },
        {
          label: `Outstanding (${outstandingPercent.toFixed(0)}%)`,
          value: `${outstandingCount} tagihan`,
          icon: <AlertCircle className="size-3.5 text-red-600" />,
        },
      ],
    };
  }, [financialSummary]);

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
        {/* Top 4 cards - regular KPI cards */}
        {kpiDescriptors.map((descriptor) => (
          <div key={descriptor.id}>
            <KpiCard
              descriptor={descriptor}
              loading={financialLoading}
            />
          </div>
        ))}

        {/* Card 5: Collected This Month - Rich KPI Card with pie chart (2 columns) */}
        {collectedCardDescriptor && (
          <div className="lg:col-span-2">
            <RichKpiCard
              descriptor={collectedCardDescriptor}
              loading={financialLoading}
            />
          </div>
        )}

        {/* Card 6: Collection Rate - Rich KPI Card with pie chart and progress bar (2 columns) */}
        {collectionRateDescriptor && (
          <div className="lg:col-span-2">
            <RichKpiCard
              descriptor={collectionRateDescriptor}
              loading={financialLoading}
            />
          </div>
        )}
      </section>

      {/* Bottom Row - Termin & Recurring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Termin Jatuh Tempo with Accordion */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">
                  Status Pembayaran Termin
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitoring termin terlambat, jatuh tempo, dan akan datang
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
                      expandedTerminSections.has(group.status) && "ring-2 ring-offset-1",
                      group.status === 'OVERDUE' && expandedTerminSections.has(group.status) && "ring-red-400",
                      group.status === 'DUE' && expandedTerminSections.has(group.status) && "ring-amber-400",
                      group.status === 'PENDING' && expandedTerminSections.has(group.status) && "ring-slate-400"
                    )}
                    onClick={() => toggleTerminSection(group.status)}
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
                    const isExpanded = expandedTerminSections.has(group.status);

                    if (group.count === 0) return null;

                    return (
                      <div key={group.status} className="border rounded-lg overflow-hidden">
                        {/* Accordion Header */}
                        <button
                          onClick={() => toggleTerminSection(group.status)}
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
                                      key={`${item.contract_id}-${item.termin_start}-${item.termin_end}-${index}`}
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
                                        <div className="font-medium text-sm">
                                          {item.termin_start === item.termin_end
                                            ? `Termin ${item.termin_start}`
                                            : `Termin ${item.termin_start} - ${item.termin_end}`}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {item.period_label}
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2 text-right">
                                        <div className="font-medium text-sm">
                                          {formatCurrency(item.total_amount.toString(), true)}
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
                  Status Pembayaran Recurring
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitoring recurring terlambat, jatuh tempo, dan akan datang
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

            {/* Summary Cards */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {groupedRecurringData.map((group) => {
                const info = STATUS_INFO[group.status];
                return (
                  <motion.div
                    key={group.status}
                    whileHover={{ y: -2 }}
                    className={cn(
                      "rounded-xl border p-3 cursor-pointer transition-all",
                      info.bgColor,
                      info.borderColor,
                      expandedRecurringSections.has(group.status) && "ring-2 ring-offset-1",
                      group.status === 'OVERDUE' && expandedRecurringSections.has(group.status) && "ring-red-400",
                      group.status === 'DUE' && expandedRecurringSections.has(group.status) && "ring-amber-400",
                      group.status === 'PENDING' && expandedRecurringSections.has(group.status) && "ring-slate-400"
                    )}
                    onClick={() => toggleRecurringSection(group.status)}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{info.icon}</span>
                      <span className={cn("text-[0.65rem] font-semibold uppercase tracking-wider", info.color)}>
                        {info.shortLabel}
                      </span>
                    </div>
                    <div className={cn("text-2xl font-bold", info.color)}>
                      {recurringLoading ? '--' : group.count}
                    </div>
                    <div className="text-[0.65rem] text-muted-foreground mt-0.5">
                      {recurringLoading ? '-' : formatCurrency(group.totalAmount, true)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <ScrollArea className="h-[350px]">
              {recurringLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Memuat data...</div>
                </div>
              ) : groupedRecurringData.every(g => g.count === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
                  <div className="text-muted-foreground">
                    Tidak ada tagihan recurring.
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pr-3">
                  {groupedRecurringData.map((group) => {
                    const info = STATUS_INFO[group.status];
                    const isExpanded = expandedRecurringSections.has(group.status);

                    if (group.count === 0) return null;

                    return (
                      <div key={group.status} className="border rounded-lg overflow-hidden">
                        {/* Accordion Header */}
                        <button
                          onClick={() => toggleRecurringSection(group.status)}
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
                                    <TableHead className="text-xs py-2 w-[30%]">Bulan Ke-</TableHead>
                                    <TableHead className="text-xs py-2 text-right w-[20%]">Nilai</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map((item, index) => (
                                    <TableRow
                                      key={`${item.contract_id}-${item.cycle_start}-${item.cycle_end}-${index}`}
                                      onClick={() => handleRecurringRowClick(item.contract_id)}
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
                                        <div className="font-medium text-sm">
                                          {item.cycle_start === item.cycle_end 
                                            ? `Bulan ${item.cycle_start}` 
                                            : `Bulan ${item.cycle_start} - ${item.cycle_end}`}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {item.period_label}
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-2 text-right">
                                        <div className="font-medium text-sm">
                                          {formatCurrency(item.total_amount.toString(), true)}
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
      </div>
    </div>
  );
}
