/**
 * Currency formatting utilities for Indonesian Rupiah
 * Formats: Rp 3.063.000 (dots for thousands, no decimals)
 * Reference: https://en.wikipedia.org/wiki/Indonesian_rupiah
 */

/**
 * Format number as Indonesian Rupiah with dot thousand separators
 * @param amount - Numeric value to format
 * @returns Formatted string like "Rp 3.063.000"
 */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse a number from various input formats
 * Handles null, undefined, strings, and numbers
 * @param value - Value to parse
 * @returns Parsed number or 0 if invalid
 */
export function parseAmount(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d,-]/g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
