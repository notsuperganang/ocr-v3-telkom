/**
 * KPI Card Component
 *
 * Reusable animated card for displaying key performance indicators
 * with Telkom branding and smooth micro-interactions.
 *
 * HOW TO ADD A NEW KPI CARD:
 * 1. Import this component: import { KpiCard } from '@/components/contracts/KpiCard'
 * 2. Use in your grid:
 *    <KpiCard
 *      label="Your Metric"
 *      value="123"
 *      subtitle="Description"
 *      icon={<YourIcon className="w-5 h-5" />}
 *      trend={{ value: 12, direction: 'up' }}
 *      isLoading={false}
 *    />
 * 3. Wrap multiple cards in motion.div with staggerContainer variant for entrance animation
 */

import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface TrendData {
  value: number; // Percentage change
  direction: 'up' | 'down' | 'neutral';
  label?: string; // Optional label like "vs last month"
}

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: TrendData;
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  subtitle,
  icon,
  trend,
  isLoading = false,
  className,
}: KpiCardProps) {
  // Determine trend color
  const getTrendColor = () => {
    if (!trend) return '';
    switch (trend.direction) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  // Get trend icon
  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="w-3 h-3" />;
      case 'down':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  if (isLoading) {
    return (
      <Card className={cn('relative overflow-hidden', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{
        y: -2,
        transition: {
          duration: 0.2,
        },
      }}
      className={className}
    >
      <Card className="relative overflow-hidden border-border hover:border-primary/20 transition-colors duration-200 h-full">
        {/* Subtle gradient background accent */}
        <div className="absolute top-0 right-0 w-32 h-32 gradient-telkom-red-subtle opacity-50 rounded-full -translate-y-1/2 translate-x-1/2" />

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>

          {/* Icon with Telkom red accent */}
          <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary">
            {icon}
          </div>
        </CardHeader>

        <CardContent className="space-y-2 relative z-10">
          {/* Main value */}
          <div className="text-3xl font-bold text-foreground tracking-tight">
            {value}
          </div>

          {/* Subtitle */}
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>

          {/* Trend indicator */}
          {trend && (
            <div className={cn('flex items-center gap-1 text-xs font-medium', getTrendColor())}>
              {getTrendIcon()}
              <span>
                {Math.abs(trend.value)}% {trend.label || 'dari bulan lalu'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
