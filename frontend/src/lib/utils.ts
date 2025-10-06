import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format number as Indonesian Rupiah currency
 * @param value - Number or string representation of value
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "Rp 1,5 M" or "Rp 1.234.567")
 */
export function formatCurrency(
  value: number | string,
  options: {
    compact?: boolean; // Use compact notation (M, B, T)
    showDecimals?: boolean; // Show decimal places for compact
  } = {}
): string {
  const { compact = true, showDecimals = true } = options;

  // Convert string to number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Handle invalid values
  if (isNaN(numValue)) {
    return 'Rp 0';
  }

  // Compact notation for large numbers
  if (compact && numValue >= 1_000_000) {
    if (numValue >= 1_000_000_000_000) {
      // Triliun
      const formatted = showDecimals
        ? (numValue / 1_000_000_000_000).toFixed(1)
        : Math.round(numValue / 1_000_000_000_000);
      return `Rp ${formatted} T`;
    } else if (numValue >= 1_000_000_000) {
      // Miliar
      const formatted = showDecimals
        ? (numValue / 1_000_000_000).toFixed(1)
        : Math.round(numValue / 1_000_000_000);
      return `Rp ${formatted} M`;
    } else {
      // Juta
      const formatted = showDecimals
        ? (numValue / 1_000_000).toFixed(1)
        : Math.round(numValue / 1_000_000);
      return `Rp ${formatted} Jt`;
    }
  }

  // Full format with Indonesian thousand separators (dots)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}
