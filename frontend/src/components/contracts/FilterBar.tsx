/**
 * Filter Bar Component
 *
 * Search and filter controls for the contracts table.
 * Supports filtering by payment method and clearing all filters.
 * Stores filter state in URL query params for shareability.
 */

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { fadeIn } from '@/lib/motion';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedPaymentMethods: string[];
  onPaymentMethodToggle: (method: string) => void;
  onClearFilters: () => void;
  className?: string;
}

const PAYMENT_METHODS = [
  { value: 'OTC', label: 'OTC' },
  { value: 'Termin', label: 'Termin' },
  { value: 'Recurring', label: 'Recurring' },
];

export function FilterBar({
  search,
  onSearchChange,
  selectedPaymentMethods,
  onPaymentMethodToggle,
  onClearFilters,
  className,
}: FilterBarProps) {
  const hasActiveFilters = search || selectedPaymentMethods.length > 0;

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className={cn('space-y-4', className)}
    >
      {/* Search Input */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Cari berdasarkan nama file atau nama pelanggan..."
            className="pl-10 pr-4 w-full focus-visible:ring-primary"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Cari kontrak"
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              variant="outline"
              size="default"
              onClick={onClearFilters}
              className="gap-2 whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              Hapus Filter
            </Button>
          </motion.div>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground font-medium">
          Metode Pembayaran:
        </span>
        {PAYMENT_METHODS.map((method) => {
          const isSelected = selectedPaymentMethods.includes(method.value);

          return (
            <Badge
              key={method.value}
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer select-none transition-all duration-150',
                isSelected
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'hover:bg-primary/10 hover:text-primary hover:border-primary/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
              )}
              onClick={() => onPaymentMethodToggle(method.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPaymentMethodToggle(method.value);
                }
              }}
              tabIndex={0}
              role="checkbox"
              aria-checked={isSelected}
              aria-label={`Filter ${method.label}`}
            >
              {method.label}
            </Badge>
          );
        })}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-muted-foreground"
        >
          {selectedPaymentMethods.length > 0 && (
            <span>
              Menampilkan:{' '}
              <span className="font-medium text-foreground">
                {selectedPaymentMethods.join(', ')}
              </span>
            </span>
          )}
          {search && selectedPaymentMethods.length > 0 && <span> • </span>}
          {search && (
            <span>
              Pencarian:{' '}
              <span className="font-medium text-foreground">&quot;{search}&quot;</span>
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
