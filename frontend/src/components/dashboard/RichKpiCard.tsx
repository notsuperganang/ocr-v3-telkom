// Rich KPI Card component for dashboard with pie chart visualization
import * as React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

// Design tokens matching DashboardPage
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

// Chart data interface
export interface ChartDataItem {
  name: string;
  value: number;
  color: string;
  percentage?: number;
  [key: string]: string | number | undefined;
}

// Metric item interface
export interface MetricItem {
  label: string;
  value: string;
  type?: 'default' | 'success' | 'warning' | 'info';
  icon?: React.ReactNode;
}

// Progress bar interface
export interface ProgressBarData {
  value: number; // 0-100
  label: string;
  showPercentage?: boolean;
}

// Rich KPI Descriptor interface
export interface RichKpiDescriptor {
  id: string;
  label: string;
  formattedValue: string;
  icon: React.ReactNode;
  chartData?: ChartDataItem[];
  keyMetrics?: MetricItem[];
  detailMetrics?: MetricItem[];
  progressBar?: ProgressBarData;
}

interface RichKpiCardProps {
  descriptor: RichKpiDescriptor;
  loading?: boolean;
}

// Custom label for pie chart
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Don't show label for very small slices

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

export const RichKpiCard: React.FC<RichKpiCardProps> = ({ descriptor, loading }) => {
  const {
    label,
    formattedValue,
    icon,
    chartData,
    keyMetrics,
    detailMetrics,
    progressBar,
  } = descriptor;

  // Get metric type styling
  const getMetricStyle = (type: MetricItem['type'] = 'default') => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-[#d71920] bg-rose-50 border-rose-200';
    }
  };

  // Get progress bar color based on value
  const getProgressBarColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -4,
        transition: { duration: 0.2 },
      }}
      className="group h-full"
    >
      <MotionCard
        className={cn(
          designTokens.radius.xl,
          designTokens.border,
          designTokens.surface.base,
          designTokens.shadow.sm,
          "overflow-hidden transition-all duration-200 group-hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)] h-full flex flex-col"
        )}
      >
        {/* Header Section */}
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
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

        <CardContent className="space-y-4 flex-1 flex flex-col">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              {/* Visualization + Key Metrics Section */}
              <div className="grid grid-cols-2 gap-4">
                {/* Pie Chart */}
                {chartData && chartData.length > 0 && (
                  <div className="flex items-center justify-center">
                    {/* Check if all values are zero */}
                    {chartData.every(item => item.value === 0) ? (
                      <div className="flex flex-col items-center justify-center h-[280px] text-center px-4">
                        <div className="w-32 h-32 rounded-full border-4 border-dashed border-muted-foreground/30 flex items-center justify-center mb-2">
                          <span className="text-4xl text-muted-foreground/50">0</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Belum ada pembayaran
                        </p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomLabel}
                            outerRadius={110}
                            innerRadius={55}
                            fill="#8884d8"
                            dataKey="value"
                            strokeWidth={2}
                            stroke="#fff"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) =>
                              new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              }).format(value)
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}

                {/* Key Metrics Grid */}
                {keyMetrics && keyMetrics.length > 0 && (
                  <div className="flex flex-col justify-center gap-3">
                    {keyMetrics.map((metric, index) => (
                      <div
                        key={index}
                        className={cn(
                          "rounded-lg border p-2.5 transition-all hover:shadow-sm",
                          getMetricStyle(metric.type)
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {metric.icon && <div className="text-sm">{metric.icon}</div>}
                          <div className="flex-1 min-w-0">
                            <div className="text-[0.65rem] font-medium uppercase tracking-wider opacity-80">
                              {metric.label}
                            </div>
                            <div className="text-sm font-bold tabular-nums truncate">
                              {metric.value}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress Bar Section */}
              {progressBar && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{progressBar.label}</span>
                    {progressBar.showPercentage !== false && (
                      <span className="font-bold tabular-nums text-foreground">
                        {progressBar.value.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      className={cn(
                        "h-full transition-all duration-500 ease-out rounded-full",
                        getProgressBarColor(progressBar.value)
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, progressBar.value))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Detail Metrics Section */}
              {detailMetrics && detailMetrics.length > 0 && (
                <div className="space-y-2 border-t border-border/40 pt-4">
                  <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Detail Breakdown
                  </div>
                  <div className="space-y-2.5">
                    {detailMetrics.map((metric, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 py-1">
                        <div className="flex items-center gap-2">
                          {metric.icon && <div className="text-muted-foreground">{metric.icon}</div>}
                          <span className="text-sm text-muted-foreground">{metric.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-[#d71920] text-right tabular-nums">
                          {metric.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </MotionCard>
    </motion.div>
  );
};
