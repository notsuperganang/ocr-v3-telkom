import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, TrendingUp, TrendingDown } from 'lucide-react';
import { apiClient } from '@/services/api';
import type { AccountStatsSummary, SegmentDistribution, OfficerDistribution } from '@/types/api';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { staggerContainer, staggerItem } from '@/lib/motion';

// Design tokens (from ContractsPage pattern)
const designTokens = {
  radius: { xl: "rounded-[1.25rem]" },
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
    md: "shadow-[0_20px_45px_-28px_rgba(215,25,32,0.35)]",
  },
  border: "border border-border/70",
  surface: {
    base: "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90",
  },
} as const;

// Helper function to create sparkline path
function createSparklinePath(data: number[]): string {
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

// Total Accounts KPI Card - Memoized to prevent unnecessary re-renders
const TotalAccountsKpiCard = memo(({ stats }: { stats: AccountStatsSummary }) => {
  const growthCount = stats.accounts_this_month;
  const trend = growthCount > 0 ? 'up' : growthCount < 0 ? 'down' : 'neutral';

  return (
    <motion.div 
      variants={staggerItem}
      whileHover={{
        y: -4,
        transition: { duration: 0.2 },
      }}
      className="group"
    >
      <Card className={`${designTokens.radius.xl} ${designTokens.shadow.sm} ${designTokens.border} ${designTokens.surface.base} overflow-hidden transition-all duration-200 group-hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)]`}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-1">
          <div className="flex flex-col gap-2">
            <CardDescription className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Total Akun Aktif
            </CardDescription>
            <CardTitle className="flex items-baseline gap-2 text-3xl font-semibold">
              <span className="font-bold tabular-nums text-[#d71920]">{stats.active_accounts}</span>
            </CardTitle>
          </div>
          <div className="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-[#d71920]/10 to-transparent shadow-inner">
            <Building2 className="size-6 text-[#d71920]" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-2">
            {/* Sparkline graph */}
            <div className="flex items-end justify-end">
              <svg
                viewBox="0 0 48 18"
                role="presentation"
                aria-hidden="true"
                className="h-8 w-full overflow-visible transition-colors text-[#d71920]"
              >
                <path
                  d={createSparklinePath(stats.monthly_growth.map(d => d.count))}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {/* Additional info section */}
            <div className="flex items-center justify-between border-t border-border/40 pt-3">
              <div className="flex items-center gap-1.5">
                {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
                <span className="text-xs text-muted-foreground">Bulan ini</span>
              </div>
              <span className={`text-xs font-semibold ${trend === 'up' ? 'text-green-700' : trend === 'down' ? 'text-red-700' : 'text-[#d71920]'}`}>
                {growthCount > 0 ? '+' : ''}{growthCount} akun
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// Custom label for pie chart
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="#1f2937"
      stroke="#ffffff"
      strokeWidth="3"
      paintOrder="stroke"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Segment Pie Chart Component - Memoized for performance
const SegmentPieChart = memo(({ data }: { data: SegmentDistribution[] }) => {
  // Color palette for segments (matching DashboardPage)
  const COLORS = [
    '#e11d48', // Rose-600
    '#3b82f6', // Blue-500
    '#10b981', // Green-500
    '#f59e0b', // Amber-500
    '#8b5cf6', // Violet-500
    '#ec4899', // Pink-500
    '#06b6d4', // Cyan-500
    '#f97316', // Orange-500
  ];

  const chartData = data.map((item, index) => ({
    name: item.segment_name,
    value: item.account_count,
    contractCount: item.contract_count,
    color: COLORS[index % COLORS.length],
    percentage: item.percentage,
  }));

  return (
    <motion.div 
      variants={staggerItem} 
      className="h-full group"
      whileHover={{
        y: -4,
        transition: { duration: 0.2 },
      }}
    >
      <Card className={`${designTokens.radius.xl} ${designTokens.shadow.sm} ${designTokens.border} ${designTokens.surface.base} h-full overflow-hidden transition-all duration-200 group-hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)]`}>
        <CardContent className="p-3 h-full flex flex-col">
          <h3 className="text-base font-semibold mb-1">Distribusi Segment</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius="65%"
                innerRadius="40%"
                dataKey="value"
                strokeWidth={2}
                stroke="#fff"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name: string, props: any) =>
                  `${value.toLocaleString('id-ID')} akun, ${props.payload.contractCount.toLocaleString('id-ID')} kontrak`
                }
              />
            </PieChart>
          </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// Officer Distribution Chart Component - Memoized for performance
const OfficerDistributionChart = memo(({ data }: { data: OfficerDistribution[] }) => {
  const chartData = data.slice(0, 8).map(item => ({
    name: item.officer_full_name || item.officer_username,
    value: item.account_count,
    contractCount: item.contract_count,
  }));

  return (
    <motion.div 
      variants={staggerItem}
      whileHover={{
        y: -4,
        transition: { duration: 0.2 },
      }}
      className="group"
    >
      <Card className={`${designTokens.radius.xl} ${designTokens.shadow.sm} ${designTokens.border} ${designTokens.surface.base} overflow-hidden transition-all duration-200 group-hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)]`}>
        <CardContent className="p-3">
          <h3 className="text-base font-semibold mb-1">Distribusi Petugas</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="name" type="category" width={100} stroke="#6b7280" />
              <Tooltip
                formatter={(value: number, _name: string, props: any) =>
                  `${value} akun, ${props.payload.contractCount} kontrak`
                }
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                }}
              />
              <Bar dataKey="value" fill="#d71920" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// Dashboard Skeleton - Memoized
const DashboardSkeleton = memo(() => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="space-y-6">
        <div className="h-48 rounded-xl bg-muted/50 animate-pulse" />
        <div className="h-80 rounded-xl bg-muted/50 animate-pulse" />
      </div>
      <div className="h-full min-h-[500px] rounded-xl bg-muted/50 animate-pulse" />
    </div>
  );
});

// Main Dashboard Component
export function AccountKpiDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['account-stats'],
    queryFn: () => apiClient.getAccountStats(),
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!stats) return null;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 lg:grid-cols-2 lg:items-start gap-3 mb-3"
    >
      {/* Left Column */}
      <div className="flex flex-col space-y-3">
        <TotalAccountsKpiCard stats={stats} />
        <OfficerDistributionChart data={stats.officer_distribution} />
      </div>

      {/* Right Column */}
      <div className="flex flex-col h-full">
        <SegmentPieChart data={stats.segment_distribution} />
      </div>
    </motion.div>
  );
}
