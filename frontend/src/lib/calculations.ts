/**
 * Business calculation utilities for contract service details
 * Includes VAT calculations (fixed 11%) and period computations
 * 
 * IMPORTANT: biaya_instalasi and biaya_langganan_tahunan from extraction
 * are GROSS amounts (final prices including 11% VAT). We reverse-calculate
 * to extract net amounts and VAT components.
 * 
 * Reference: Indonesia VAT at 11% since April 1, 2022 (https://setkab.go.id/)
 */

import { differenceInMonths, parseISO, isValid } from 'date-fns';
import { parseAmount } from './currency';

/**
 * Fixed VAT rate for Indonesia (11%)
 * DO NOT CHANGE - this is the legally mandated rate
 */
// const VAT_RATE = 0.11;

/**
 * Service item structure (matches backend RincianLayanan)
 */
export interface ServiceItem {
  kategori?: string | null;
  jenis_layanan?: string | null;
  nama_layanan?: string | null;
  nama?: string | null;
  deskripsi?: string | null;
  biaya_instalasi?: number | string | null;
  biaya_langganan_tahunan?: number | string | null;
  satuan?: string | null;
}

/**
 * Breakdown for a single cost component (installation, monthly, or yearly)
 */
export interface CostBreakdown {
  net: number;
  vat: number;
  total: number;
}

/**
 * Complete breakdown for a single service item
 */
export interface ServiceItemBreakdown {
  // Original item
  item: ServiceItem;

  // Installation costs
  installation: CostBreakdown;

  // Monthly costs (derived from yearly)
  monthly: CostBreakdown;

  // Yearly costs
  yearly: CostBreakdown;

  // Item total (installation + yearly subscription)
  itemTotal: CostBreakdown;
}

/**
 * Aggregated totals across all service items
 */
export interface AggregateTotals {
  installation: CostBreakdown;
  monthly: CostBreakdown;
  yearly: CostBreakdown;
  overallContractValue: CostBreakdown;
}

/**
 * Complete service breakdown with per-item and aggregate data
 */
export interface ServiceBreakdown {
  items: ServiceItemBreakdown[];
  totals: AggregateTotals;
  periodMonths?: number;
}

/**
 * Calculate net and VAT from gross amount (reverse calculation)
 * Input gross amount already includes 11% VAT
 * Formula: net = gross / 1.11, vat = gross - net, total = gross
 */
function calculateFromGross(gross: number): CostBreakdown {
  const net = Math.round(gross / 1.11);
  const vat = gross - net;
  const total = gross;

  return { net, vat, total };
}

/**
 * Calculate monthly cost from yearly gross amount (divided by 12, rounded)
 * Input yearly amount already includes VAT
 */
function calculateMonthlyCost(yearlyGross: number): CostBreakdown {
  const monthlyGross = Math.round(yearlyGross / 12);
  return calculateFromGross(monthlyGross);
}

/**
 * Compute complete breakdown for a single service item
 * NOTE: biaya_instalasi and biaya_langganan_tahunan are GROSS amounts (including 11% VAT)
 */
function computeItemBreakdown(item: ServiceItem): ServiceItemBreakdown {
  const installationGross = parseAmount(item.biaya_instalasi ?? 0);
  const yearlyGross = parseAmount(item.biaya_langganan_tahunan ?? 0);

  // Use reverse calculation since input amounts already include VAT
  const installation = calculateFromGross(installationGross);
  const yearly = calculateFromGross(yearlyGross);
  const monthly = calculateMonthlyCost(yearlyGross);

  // Item total = installation + yearly subscription (both gross amounts)
  const itemTotalGross = installationGross + yearlyGross;
  const itemTotal = calculateFromGross(itemTotalGross);

  return {
    item,
    installation,
    monthly,
    yearly,
    itemTotal,
  };
}

/**
 * Aggregate all service items into totals
 */
function aggregateBreakdowns(itemBreakdowns: ServiceItemBreakdown[]): AggregateTotals {
  const totals = {
    installationNet: 0,
    installationVat: 0,
    monthlyNet: 0,
    monthlyVat: 0,
    yearlyNet: 0,
    yearlyVat: 0,
  };

  itemBreakdowns.forEach((breakdown) => {
    totals.installationNet += breakdown.installation.net;
    totals.installationVat += breakdown.installation.vat;
    totals.monthlyNet += breakdown.monthly.net;
    totals.monthlyVat += breakdown.monthly.vat;
    totals.yearlyNet += breakdown.yearly.net;
    totals.yearlyVat += breakdown.yearly.vat;
  });

  // Overall contract value = total installation + total yearly subscription
  const overallNet = totals.installationNet + totals.yearlyNet;
  const overallVat = totals.installationVat + totals.yearlyVat;

  return {
    installation: {
      net: totals.installationNet,
      vat: totals.installationVat,
      total: totals.installationNet + totals.installationVat,
    },
    monthly: {
      net: totals.monthlyNet,
      vat: totals.monthlyVat,
      total: totals.monthlyNet + totals.monthlyVat,
    },
    yearly: {
      net: totals.yearlyNet,
      vat: totals.yearlyVat,
      total: totals.yearlyNet + totals.yearlyVat,
    },
    overallContractValue: {
      net: overallNet,
      vat: overallVat,
      total: overallNet + overallVat,
    },
  };
}

/**
 * Compute complete service breakdown with VAT calculations
 * @param items - Array of service items from contract
 * @param startDate - Contract start date (YYYY-MM-DD or ISO string)
 * @param endDate - Contract end date (YYYY-MM-DD or ISO string)
 * @returns Complete breakdown with per-item and aggregate data
 */
export function computeServiceBreakdown(
  items: ServiceItem[],
  startDate?: string | null,
  endDate?: string | null
): ServiceBreakdown {
  const itemBreakdowns = items.map(computeItemBreakdown);
  const totals = aggregateBreakdowns(itemBreakdowns);

  // Calculate period months if both dates provided
  let periodMonths: number | undefined;
  if (startDate && endDate) {
    periodMonths = diffInMonths(startDate, endDate);
  }

  return {
    items: itemBreakdowns,
    totals,
    periodMonths,
  };
}

/**
 * Calculate difference in months between two dates
 * Uses corresponding-date rule (e.g., Jan 15 to Feb 15 = 1 month)
 * @param start - Start date (YYYY-MM-DD or ISO string)
 * @param end - End date (YYYY-MM-DD or ISO string)
 * @returns Number of months difference, or 0 if dates invalid
 */
export function diffInMonths(start: string, end: string): number {
  try {
    const startDate = parseISO(start);
    const endDate = parseISO(end);

    if (!isValid(startDate) || !isValid(endDate)) {
      return 0;
    }

    // Raw whole month difference using date-fns corresponding-date logic
    let months = differenceInMonths(endDate, startDate);

    // If there are leftover days beyond the whole-month boundary, treat it as an extra month for display
    // Example: 2024-09-09 to 2025-09-08 (364 days) should display 12 months instead of 11.
    // We'll detect this by adding the computed months to startDate and seeing if we hit endDate exactly.
    const boundary = new Date(startDate);
    boundary.setMonth(boundary.getMonth() + months);

    if (boundary < endDate) {
      months += 1; // partial month counts as a full month visually
    }

    // Ensure that any positive span is at least 1 month
    if (months === 0 && endDate > startDate) {
      months = 1;
    }

    return Math.max(0, months);
  } catch {
    return 0;
  }
}
