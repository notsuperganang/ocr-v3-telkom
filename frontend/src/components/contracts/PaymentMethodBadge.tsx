/**
 * Payment Method Badge Component
 *
 * Styled badge with color-coded variants for different payment methods
 * Provides consistent visual distinction across the application.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PaymentMethod = 'OTC' | 'Termin' | 'Recurring' | string;

interface PaymentMethodBadgeProps {
  method: PaymentMethod;
  className?: string;
}

export function PaymentMethodBadge({ method, className }: PaymentMethodBadgeProps) {
  // Normalize payment method for consistent comparison
  const normalizedMethod = method?.toUpperCase();

  // All payment methods use neutral styling
  const getBadgeVariant = () => {
    return 'bg-muted text-muted-foreground hover:bg-muted/80';
  };

  // Display label (capitalize properly)
  const getDisplayLabel = () => {
    if (!method) return '-';
    if (normalizedMethod === 'OTC') return 'OTC';
    return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  };

  if (!method) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        getBadgeVariant(),
        'font-medium transition-colors duration-150 min-w-[80px] justify-center',
        className
      )}
    >
      {getDisplayLabel()}
    </Badge>
  );
}
