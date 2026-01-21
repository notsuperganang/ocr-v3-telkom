/**
 * Service Details Section for Contract Detail Page
 * Unified single card: Rincian Detail Layanan (period + cost breakdown)
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, DollarSign, Receipt, Clock, CreditCard, Repeat, ListChecks, Layers, MoreVertical, StickyNote, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { computeServiceBreakdown, type ServiceItem } from '@/lib/calculations';
import { formatIDR } from '@/lib/currency';
import { getStatusBadgeConfig } from '@/lib/termin-utils';
import { useTerminPayments } from '@/hooks/useContracts';
import type { TerminPaymentStatus } from '@/types/api';
import { TerminPaymentModal } from './TerminPaymentModal';
import { RecurringScheduleCard } from './RecurringScheduleCard';

interface ServiceDetailsSectionProps {
  contractId: number;
  serviceItems: ServiceItem[];
  startDate?: string | null;
  endDate?: string | null;
  paymentMethod?: {
    method_type?: 'one_time_charge' | 'recurring' | 'termin';
    description?: string | null;
    termin_payments?: Array<{
      termin_number?: number;
      period?: string | null;
      amount?: number;
      raw_text?: string | null;
    }> | null;
    total_termin_count?: number | null;
    total_amount?: number | null;
  } | null;
}

const sectionVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const subtlePulse = {
  pulse: {
    opacity: [0.9, 1, 0.9],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' as any },
  },
};

export function ServiceDetailsSection({ contractId, serviceItems, startDate, endDate, paymentMethod }: ServiceDetailsSectionProps) {
  if (!serviceItems || serviceItems.length === 0) return null;

  // Fetch termin payment management data from backend
  const { data: terminPaymentsData, isLoading: isLoadingTermins } = useTerminPayments(contractId);

  // State for modal management
  const [selectedTermin, setSelectedTermin] = useState<{ terminNumber: number; mode: 'paid' | 'note' | 'cancel' } | null>(null);

  const breakdown = computeServiceBreakdown(serviceItems, startDate, endDate);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try { return format(new Date(dateString), 'dd MMMM yyyy', { locale: id }); } catch { return '-'; }
  };

  const periodStart = formatDate(startDate);
  const periodEnd = formatDate(endDate);
  const showPeriod = periodStart !== '-' || periodEnd !== '-';

  const methodType = paymentMethod?.method_type || 'one_time_charge';
  const terminPayments = (paymentMethod?.termin_payments || []).filter(Boolean);
  const isTermin = methodType === 'termin';
  const isRecurring = methodType === 'recurring';
  const isOTC = methodType === 'one_time_charge';

  // Merge display data from final_data with backend termin payment data
  const mergedTerminData = terminPayments.map((tp, idx) => {
    const backendData = terminPaymentsData?.find(t => t.termin_number === (tp.termin_number ?? idx + 1));
    return {
      ...tp,
      status: backendData?.status || 'PENDING',
      paid_at: backendData?.paid_at,
      notes: backendData?.notes,
      id: backendData?.id,
    };
  });

  const methodLabelMap: Record<string, string> = {
    one_time_charge: 'One Time Charge',
    recurring: 'Recurring',
    termin: 'Termin',
  };
  const methodLabel = methodLabelMap[methodType] || methodType;
  const hasTotalAmount = (paymentMethod?.total_amount ?? 0) > 0;

  return (
    <motion.div
      variants={sectionVariants}
      initial="initial"
      animate="animate"
      className="relative"
    >
      <motion.span
        className="pointer-events-none absolute -top-10 right-0 h-48 w-48 rounded-full bg-rose-100 opacity-70 blur-3xl"
        variants={subtlePulse}
        animate="pulse"
      />
      <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
        <CardHeader className="relative border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
                <Receipt className="h-3.5 w-3.5" />
                Rincian Detail Layanan
              </span>
              <CardTitle className="text-2xl font-semibold text-slate-900">Ringkasan Biaya & Periode</CardTitle>
              <CardDescription className="text-sm text-slate-500 max-w-2xl">
                Detail biaya instalasi dan langganan tahunan (harga sudah termasuk PPN 11%) beserta jangka waktu kontrak.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3 sm:justify-end relative z-10">
              <div className="flex flex-col items-start rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-400">Net Kontrak</span>
                <span className="mt-1 text-base font-semibold text-slate-900">{formatIDR(breakdown.totals.overallContractValue.net)}</span>
              </div>
              <div className="flex flex-col items-start rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-400">PPN 11%</span>
                <span className="mt-1 text-base font-semibold text-slate-900">{formatIDR(breakdown.totals.overallContractValue.vat)}</span>
              </div>
              <div className="flex flex-col items-start rounded-2xl border border-rose-200 bg-white px-4 py-3 shadow-sm ring-1 ring-rose-200/50">
                <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-500">Total Kontrak</span>
                <span className="mt-1 text-base font-bold text-rose-700">{formatIDR(breakdown.totals.overallContractValue.total)}</span>
              </div>
              {showPeriod && (
                <div className="flex flex-col items-start rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                  <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-400">Durasi</span>
                  <span className="mt-1 text-base font-semibold text-slate-900">{breakdown.periodMonths ? `${breakdown.periodMonths} bulan` : '—'}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-10 bg-white p-6 lg:p-8">
          {/* Period + Costs Grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Period Section */}
            {showPeriod && (
              <motion.div whileHover={{ y: -4 }} className="relative flex flex-col gap-4 rounded-2xl border border-rose-100/80 bg-gradient-to-br from-rose-50 via-white to-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/70 p-2 shadow-inner shadow-rose-100"><Calendar className="h-4 w-4 text-rose-500" /></span>
                  <h3 className="text-sm font-semibold tracking-wide text-slate-900">Jangka Waktu Kontrak</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-400">Mulai</p>
                    <p className="text-sm font-medium text-slate-900">{periodStart}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-400">Berakhir</p>
                    <p className="text-sm font-medium text-slate-900">{periodEnd}</p>
                  </div>
                </div>
                {breakdown.periodMonths !== undefined && breakdown.periodMonths > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-600">
                    <Clock className="h-3.5 w-3.5" />
                    Durasi {breakdown.periodMonths} bulan
                  </div>
                )}
              </motion.div>
            )}

            {/* Cost Summary Section */}
            <motion.div whileHover={{ y: -4 }} className="relative flex flex-col gap-5 rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50 p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/70 p-2 shadow-inner shadow-rose-100"><DollarSign className="h-4 w-4 text-rose-500" /></span>
                <h3 className="text-sm font-semibold tracking-wide text-slate-900">Detail Biaya Layanan</h3>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {/* Installation */}
                <div className="group rounded-xl border border-white/80 bg-white/80 p-4 shadow-sm transition hover:border-rose-200">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><DollarSign className="h-3.5 w-3.5" /></span>
                    Instalasi
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Net</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.installation.net)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">PPN</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.installation.vat)}</span></div>
                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-1"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-rose-700">{formatIDR(breakdown.totals.installation.total)}</span></div>
                  </div>
                </div>
                {/* Monthly */}
                <div className="group rounded-xl border border-white/80 bg-white/80 p-4 shadow-sm transition hover:border-rose-200">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><Calendar className="h-3.5 w-3.5" /></span>
                    Bulanan
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Net</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.monthly.net)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">PPN</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.monthly.vat)}</span></div>
                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-1"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-rose-700">{formatIDR(breakdown.totals.monthly.total)}</span></div>
                  </div>
                </div>
                {/* Yearly */}
                <div className="group rounded-xl border border-white/80 bg-white/80 p-4 shadow-sm transition hover:border-rose-200">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><Calendar className="h-3.5 w-3.5" /></span>
                    Tahunan
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Net</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.yearly.net)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">PPN</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.yearly.vat)}</span></div>
                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-1"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-rose-700">{formatIDR(breakdown.totals.yearly.total)}</span></div>
                  </div>
                </div>
                {/* Overall */}
                <div className="group rounded-xl border-2 border-rose-300 bg-gradient-to-br from-white via-white to-rose-50 p-4 shadow-md">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-500">
                    <span className="rounded-full bg-rose-100 p-1 text-rose-600"><DollarSign className="h-3.5 w-3.5" /></span>
                    Nilai Kontrak
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Net</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.overallContractValue.net)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">PPN</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.overallContractValue.vat)}</span></div>
                    <div className="flex justify-between border-t-2 border-dashed border-rose-300 pt-1"><span className="font-bold text-rose-700">Total</span><span className="font-bold text-rose-700">{formatIDR(breakdown.totals.overallContractValue.total)}</span></div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-rose-100/70 bg-white/80 p-4 text-xs leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-800">Catatan PPN:</p>
                <p className="mt-1">
                  Semua angka merupakan harga final <strong>sudah termasuk PPN 11%</strong> (reverse calculation ke Net + PPN). Nilai Kontrak = Instalasi + Langganan Tahunan.
                </p>
              </div>
            </motion.div>
          </div>

          {/* Payment Method Section */}
          <motion.div
            whileHover={{ y: -4 }}
            className="relative overflow-hidden rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50 p-6 shadow-sm"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose-100/50 blur-3xl" />
            <div className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3 max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-rose-500">
                  <CreditCard className="h-3.5 w-3.5" />
                  Tata Cara Pembayaran
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    {methodLabel}
                    {isRecurring && <Repeat className="h-4 w-4 text-rose-500" />}
                    {isTermin && <ListChecks className="h-4 w-4 text-rose-500" />}
                    {isOTC && <DollarSign className="h-4 w-4 text-rose-500" />}
                  </h3>
                  {paymentMethod?.description && (
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      {paymentMethod.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Summary Chips differ by type */}
              {!isTermin && (
                <div className={`grid gap-3 ${hasTotalAmount ? 'grid-cols-2' : 'grid-cols-1'} sm:auto-cols-max sm:grid-flow-col`}>
                  <div className="flex flex-col items-start rounded-xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
                    <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-400">Metode</span>
                    <span className="mt-1 text-sm font-semibold text-slate-900">{methodLabel}</span>
                  </div>
                  {hasTotalAmount ? (
                    <div className="flex flex-col items-start rounded-xl border border-rose-200 bg-white/80 px-4 py-3 shadow-sm">
                      <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-500">Total</span>
                      <span className="mt-1 text-sm font-bold text-rose-700">{formatIDR(paymentMethod!.total_amount!)}</span>
                    </div>
                  ) : null}
                </div>
              )}

              {isTermin && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col rounded-xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
                    <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-400">Metode</span>
                    <span className="mt-1 text-sm font-semibold text-slate-900">{methodLabel}</span>
                  </div>
                  <div className="flex flex-col rounded-xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
                    <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-400">Termin</span>
                    <span className="mt-1 text-sm font-semibold text-slate-900">{terminPayments.length}</span>
                  </div>
                  {paymentMethod?.total_amount && paymentMethod.total_amount > 0 && (
                    <div className="flex flex-col rounded-xl border border-rose-200 bg-white/80 px-4 py-3 shadow-sm">
                      <span className="text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-rose-500">Total</span>
                      <span className="mt-1 text-sm font-bold text-rose-700">{formatIDR(paymentMethod.total_amount)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Body for different methods */}
            {isOTC && (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><Layers className="h-3.5 w-3.5" /></span>
                    Komponen
                  </p>
                  <ul className="space-y-2 text-xs">
                    <li className="flex justify-between"><span className="text-slate-500">Instalasi</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.installation.total)}</span></li>
                    <li className="flex justify-between"><span className="text-slate-500">Langganan Tahunan</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.yearly.total)}</span></li>
                    <li className="flex justify-between border-t border-dashed border-slate-200 pt-1"><span className="font-semibold text-slate-700">Total Kontrak</span><span className="font-bold text-rose-700">{formatIDR(breakdown.totals.overallContractValue.total)}</span></li>
                  </ul>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><DollarSign className="h-3.5 w-3.5" /></span>
                    Breakdown Net/PPN
                  </p>
                  <ul className="space-y-2 text-xs">
                    <li className="flex justify-between"><span className="text-slate-500">Net</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.overallContractValue.net)}</span></li>
                    <li className="flex justify-between"><span className="text-slate-500">PPN</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.overallContractValue.vat)}</span></li>
                    <li className="flex justify-between border-t border-dashed border-slate-200 pt-1"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-rose-700">{formatIDR(breakdown.totals.overallContractValue.total)}</span></li>
                  </ul>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><CreditCard className="h-3.5 w-3.5" /></span>
                    Metode Pembayaran
                  </p>
                  <p className="text-sm font-medium text-slate-900">One Time Charge dibayarkan penuh di awal berdasarkan nilai kontrak.</p>
                </div>
              </div>
            )}

            {isRecurring && (
              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><Calendar className="h-3.5 w-3.5" /></span>
                    Bulanan (Gross)
                  </p>
                  <ul className="space-y-2 text-xs">
                    <li className="flex justify-between"><span className="text-slate-500">Net</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.monthly.net)}</span></li>
                    <li className="flex justify-between"><span className="text-slate-500">PPN</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.monthly.vat)}</span></li>
                    <li className="flex justify-between border-t border-dashed border-slate-200 pt-1"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-rose-700">{formatIDR(breakdown.totals.monthly.total)}</span></li>
                  </ul>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><Calendar className="h-3.5 w-3.5" /></span>
                    Tahunan (Gross)
                  </p>
                  <ul className="space-y-2 text-xs">
                    <li className="flex justify-between"><span className="text-slate-500">Net</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.yearly.net)}</span></li>
                    <li className="flex justify-between"><span className="text-slate-500">PPN</span><span className="font-medium text-slate-700">{formatIDR(breakdown.totals.yearly.vat)}</span></li>
                    <li className="flex justify-between border-t border-dashed border-slate-200 pt-1"><span className="font-semibold text-slate-700">Total</span><span className="font-bold text-rose-700">{formatIDR(breakdown.totals.yearly.total)}</span></li>
                  </ul>
                </div>
                <div className="rounded-xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <p className="mb-2 flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-slate-400">
                    <span className="rounded-full bg-rose-50 p-1 text-rose-500"><Repeat className="h-3.5 w-3.5" /></span>
                    Mekanisme
                  </p>
                  <p className="text-sm font-medium text-slate-900">Pembayaran dilakukan secara periodik (recurring) sesuai siklus tagihan (bulanan) selama masa kontrak.</p>
                </div>
              </div>
            )}

            {isRecurring && (
              <div id="recurring-section" className="scroll-mt-6">
                <RecurringScheduleCard contractId={contractId} />
              </div>
            )}

            {isTermin && (
              <div id="termin-section" className="mt-2 space-y-4 scroll-mt-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-rose-400">
                  <ListChecks className="h-3.5 w-3.5 text-rose-500" />
                  Jadwal Termin
                  {isLoadingTermins && <span className="text-[0.5rem] text-slate-400">(Memuat...)</span>}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {mergedTerminData.map((tp, idx) => {
                    const label = tp.period || tp.raw_text || (tp.termin_number ? `Termin ${tp.termin_number}` : `Termin ${idx + 1}`);
                    const terminNumber = tp.termin_number ?? idx + 1;
                    const statusConfig = getStatusBadgeConfig(tp.status as TerminPaymentStatus);
                    const isPaid = tp.status === 'PAID';
                    const hasNotes = !!tp.notes;

                    return (
                      <motion.div
                        key={tp.id || idx}
                        whileHover={{ y: -3 }}
                        className={`group relative overflow-hidden rounded-xl p-4 shadow-sm ${
                          isPaid
                            ? 'border-green-200 bg-green-50/50'
                            : 'border-rose-100/70 bg-white/80'
                        }`}
                      >
                        {/* Header with termin number and kebab menu */}
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className={`text-[0.55rem] font-semibold uppercase tracking-[0.25em] ${
                                isPaid ? 'text-green-500' : 'text-rose-400'
                              }`}>
                                Termin {terminNumber}
                              </p>
                              <Badge variant={statusConfig.variant} className={`h-5 text-[0.5rem] ${statusConfig.className}`}>
                                {isPaid && <CheckCircle2 className="mr-1 h-2.5 w-2.5" />}
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-slate-900 break-words">{label}</p>
                          </div>

                          {/* Kebab menu for actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {!isPaid && (
                                <DropdownMenuItem
                                  onClick={() => setSelectedTermin({ terminNumber, mode: 'paid' })}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Tandai sebagai lunas
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setSelectedTermin({ terminNumber, mode: 'note' })}
                              >
                                <StickyNote className="mr-2 h-4 w-4" />
                                Ubah catatan
                              </DropdownMenuItem>
                              {!isPaid && tp.status !== 'CANCELLED' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setSelectedTermin({ terminNumber, mode: 'cancel' })}
                                    className="text-red-600 focus:text-white focus:bg-red-600"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Batalkan termin
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Amount display */}
                        {tp.amount !== undefined && tp.amount !== null && tp.amount > 0 && (
                          <div className={`mt-3 flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-xs ${
                            isPaid
                              ? 'border-green-200 bg-green-50/60'
                              : 'border-rose-200 bg-rose-50/60'
                          }`}>
                            <span className="text-slate-500">Jumlah</span>
                            <span className={`font-semibold ${isPaid ? 'text-green-700' : 'text-rose-700'}`}>{formatIDR(tp.amount)}</span>
                          </div>
                        )}

                        {/* Payment info and notes indicator */}
                        {(isPaid || hasNotes) && (
                          <div className="mt-3 space-y-1.5 text-[0.65rem]">
                            {isPaid && tp.paid_at && (
                              <div className="flex items-center gap-1.5 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Lunas • {formatDate(tp.paid_at)}</span>
                              </div>
                            )}
                            {hasNotes && (
                              <div className="flex items-start gap-1.5 text-slate-500">
                                <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span className="text-xs leading-relaxed break-words">{tp.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </CardContent>
      </Card>

      {/* Termin Payment Management Modal */}
      {selectedTermin && (
        <TerminPaymentModal
          open={!!selectedTermin}
          onClose={() => setSelectedTermin(null)}
          mode={selectedTermin.mode}
          contractId={contractId}
          terminNumber={selectedTermin.terminNumber}
          terminData={terminPaymentsData?.find(t => t.termin_number === selectedTermin.terminNumber)}
          periodLabel={
            mergedTerminData.find(t => (t.termin_number ?? 0) === selectedTermin.terminNumber)?.period ||
            mergedTerminData.find(t => (t.termin_number ?? 0) === selectedTermin.terminNumber)?.raw_text ||
            `Termin ${selectedTermin.terminNumber}`
          }
          amount={mergedTerminData.find(t => (t.termin_number ?? 0) === selectedTermin.terminNumber)?.amount || 0}
        />
      )}
    </motion.div>
  );
}
