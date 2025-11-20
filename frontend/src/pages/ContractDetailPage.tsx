// Contract Detail Page with Telkom branding and smooth animations
import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  FileText,
  CreditCard,
  Download,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  Hash,
  DollarSign,
  Users,
  Settings,
  UserRound,
  AlertCircle,
  Sparkles,
  History,
  ClipboardList,
  Layers,
  ArrowUpRight,
  Pencil,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useContract, useDownloadContractJson } from '@/hooks/useContracts';
import { formatNPWP, formatPhone } from '@/lib/validation';
import { ServiceDetailsSection } from '@/components/contracts/ServiceDetailsSection';
import { apiService } from '@/services/api';

// Animation variants
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const cardVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  hover: { y: -2, transition: { duration: 0.2 } }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Telkom color palette
const telkomColors = {
  primary: '#E60012',      // Telkom red
  primaryDark: '#D30019',  // Darker red
  gray50: '#FAFAFA',       // Light gray background
  gray100: '#F5F5F5',      // Card background
  gray200: '#EEEEEE',      // Border
  gray300: '#E0E0E0',      // Divider
  gray600: '#757575',      // Secondary text
  gray700: '#616161',      // Medium gray
  gray800: '#424242',      // Primary text
  success: '#4CAF50',      // Success green
  warning: '#FF9800',      // Warning orange
  white: '#FFFFFF',
};

// Helper function to safely render value
const safeRenderValue = (value: any): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'object') {
    // If it's an object, try to find meaningful fields to display
    if (value.nama) return value.nama;
    if (value.name) return value.name;
    if (value.value) return value.value;
    // Otherwise return empty string to avoid React error
    return '-';
  }
  return String(value);
};

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper function to format file size
const formatFileSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, 'dd MMMM yyyy, HH:mm', { locale: id });
};

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d,-]/g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const MONTH_NAME_MAP: Record<string, number> = {
  januari: 0,
  jan: 0,
  febuari: 1,
  februari: 1,
  feb: 1,
  maret: 2,
  mar: 2,
  mart: 2,
  april: 3,
  apr: 3,
  mei: 4,
  may: 4,
  juni: 5,
  jun: 5,
  july: 6,
  juli: 6,
  jul: 6,
  agustus: 7,
  agst: 7,
  agu: 7,
  agt: 7,
  september: 8,
  sept: 8,
  sep: 8,
  oktober: 9,
  okt: 9,
  october: 9,
  november: 10,
  nov: 10,
  desember: 11,
  december: 11,
  des: 11,
  dec: 11,
};

const parseTerminPeriod = (period?: string | null): Date | null => {
  if (!period || typeof period !== 'string') return null;
  let normalized = period.normalize('NFKD');
  normalized = normalized.replace(/([A-Za-z])([0-9])/g, '$1 $2');
  normalized = normalized.replace(/([0-9])([A-Za-z])/g, '$1 $2');
  normalized = normalized.replace(/[^A-Za-z0-9]+/g, ' ').trim();
  if (!normalized) return null;

  const tokens = normalized.split(/\s+/);
  let monthIndex: number | undefined;
  let year: number | undefined;

  tokens.forEach((token) => {
    if (monthIndex === undefined) {
      const lower = token.toLowerCase();
      if (MONTH_NAME_MAP.hasOwnProperty(lower)) {
        monthIndex = MONTH_NAME_MAP[lower];
        return;
      }
    }

    if (year === undefined) {
      const numeric = parseInt(token, 10);
      if (!Number.isNaN(numeric) && numeric > 1900) {
        year = numeric;
      }
    }
  });

  if (monthIndex === undefined || year === undefined) {
    return null;
  }

  return new Date(Date.UTC(year, monthIndex, 1));
};

type ServiceItem = {
  kategori?: string | null;
  jenis_layanan?: string | null;
  nama_layanan?: string | null;
  nama?: string | null;
  deskripsi?: string | null;
  biaya_instalasi?: number | string | null;
  biaya_langganan_tahunan?: number | string | null;
  satuan?: string | null;
};

type QuickStatValue = string | { primary: string; secondary?: string };

type QuickStat = {
  label: string;
  value: QuickStatValue;
  icon: LucideIcon;
  accent: string;
};

const isComplexStatValue = (value: QuickStatValue): value is { primary: string; secondary?: string } =>
  typeof value === 'object' && value !== null && 'primary' in value;

type TimelineEvent = {
  label: string;
  timestamp: string;
  description?: string;
  icon: LucideIcon;
};

type TerminSummary = {
  termin_number?: number;
  period?: string;
  raw_text?: string;
};

type TerminWithDate = {
  item: TerminSummary;
  date: Date | null;
};

export function ContractDetailPage() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  
  const { data: contract, isLoading, error } = useContract(Number(contractId));
  const downloadJsonMutation = useDownloadContractJson();

  // Scroll to termin section when navigating from Dashboard
  React.useEffect(() => {
    if (!isLoading && contract && window.location.hash === '#termin-section') {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        const element = document.getElementById('termin-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [isLoading, contract]);

  const handleDownloadJson = () => {
    if (contract) {
      downloadJsonMutation.mutate(contract.id);
    }
  };

  const handleViewPdf = async () => {
    if (contract) {
      try {
        const blob = await apiService.getContractPdfStream(contract.id);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');

        // Clean up the URL after a delay to allow the new tab to load
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } catch (error) {
        console.error('Failed to open PDF:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-10 h-10 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error ? 'Gagal memuat detail kontrak' : 'Kontrak tidak ditemukan'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const contractData = contract.final_data;
  const customerInfo = contractData?.informasi_pelanggan || {};
  const serviceInfo = contractData?.layanan_utama || {};
  const paymentInfo = contractData?.tata_cara_pembayaran || {};
  const contactInfo = contractData?.kontak_person_telkom || {};
  const telkomContactName = safeRenderValue(contactInfo.nama);
  const telkomContactRole = safeRenderValue(contactInfo.jabatan);
  const telkomContactEmail = safeRenderValue(contactInfo.email);
  const telkomContactPhone = safeRenderValue(contactInfo.telepon);
  const telkomContactFieldConfig: Array<{
    key: string;
    label: string;
    value: string;
    icon: LucideIcon;
    span: string;
    monospace?: boolean;
  }> = [
    { key: 'nama', label: 'Nama', value: telkomContactName, icon: UserRound, span: 'sm:col-span-1' },
    { key: 'jabatan', label: 'Jabatan', value: telkomContactRole, icon: ClipboardList, span: 'sm:col-span-1' },
    { key: 'email', label: 'Email', value: telkomContactEmail, icon: Mail, span: 'sm:col-span-2' },
    { key: 'telepon', label: 'Telepon', value: telkomContactPhone, icon: Phone, span: 'sm:col-span-2', monospace: true },
  ];
  const telkomContactFields = telkomContactFieldConfig.filter((field) => field.value !== '-');
  const hasTelkomContact = telkomContactName !== '-';
  const timeInfo = contractData?.jangka_waktu || {};

  const getRawString = (value: unknown): string => {
    const raw = safeRenderValue(value);
    if (!raw || raw === '-') {
      return '';
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : '';
  };

  const displayValueOrDash = (value: unknown): string => {
    const raw = getRawString(value);
    return raw.length > 0 ? raw : '-';
  };

  const customerNameDisplay = displayValueOrDash(customerInfo.nama_pelanggan);
  const customerAddressDisplay = displayValueOrDash(customerInfo.alamat);
  const npwpRaw = getRawString(customerInfo.npwp);
  const formattedNPWP = npwpRaw ? formatNPWP(npwpRaw) : '';
  const customerNPWP = formattedNPWP.length > 0 ? formattedNPWP : npwpRaw || '-';

  const representativeName = displayValueOrDash(customerInfo?.perwakilan?.nama);
  const representativeTitle = displayValueOrDash(customerInfo?.perwakilan?.jabatan);

  const contactPersonName = displayValueOrDash(customerInfo?.kontak_person?.nama);
  const contactPersonTitle = displayValueOrDash(customerInfo?.kontak_person?.jabatan);
  const contactPersonEmailRaw = getRawString(customerInfo?.kontak_person?.email);
  const contactPersonEmail = contactPersonEmailRaw ? contactPersonEmailRaw.toLowerCase() : '-';
  const contactPersonPhoneRaw = getRawString(customerInfo?.kontak_person?.telepon);
  const formattedContactPhone = contactPersonPhoneRaw ? formatPhone(contactPersonPhoneRaw) : '';
  const contactPersonPhone = formattedContactPhone.length > 0 ? formattedContactPhone : contactPersonPhoneRaw || '-';

  const profileHighlights: Array<{
    label: string;
    value: string;
    helper: string;
    icon: LucideIcon;
    monospace?: boolean;
  }> = [
    {
      label: 'NPWP',
      value: customerNPWP,
      helper: customerNPWP === '-' ? 'Belum tersedia pada dokumen' : 'Nomor Pokok Wajib Pajak',
      icon: Hash,
      monospace: true,
    },
    {
      label: 'Perwakilan',
      value: representativeName,
      helper: representativeTitle === '-' ? 'Jabatan belum tersedia' : representativeTitle,
      icon: Users,
    },
    {
      label: 'Kontak Person',
      value: contactPersonName,
      helper: contactPersonPhone === '-' ? 'Telepon belum tersedia' : `Telepon ${contactPersonPhone}`,
      icon: Phone,
    },
  ];

  const profileDetails: Array<{ label: string; value: string; icon: LucideIcon; monospace?: boolean }> = [
    { label: 'Nama Pelanggan', value: customerNameDisplay, icon: UserRound },
    { label: 'Alamat', value: customerAddressDisplay, icon: MapPin },
    { label: 'NPWP', value: customerNPWP, icon: Hash, monospace: true },
  ];

  const representativeDetails: Array<{ label: string; value: string; icon: LucideIcon }> = [
    { label: 'Nama', value: representativeName, icon: Users },
    { label: 'Jabatan', value: representativeTitle, icon: ClipboardList },
  ];

  const contactPersonDetails: Array<{ label: string; value: string; icon: LucideIcon; monospace?: boolean }> = [
    { label: 'Nama', value: contactPersonName, icon: Users },
    { label: 'Jabatan', value: contactPersonTitle, icon: ClipboardList },
    { label: 'Email', value: contactPersonEmail, icon: Mail },
    { label: 'Telepon', value: contactPersonPhone, icon: Phone, monospace: true },
  ];

  const serviceItems: ServiceItem[] = Array.isArray(contractData?.rincian_layanan)
    ? (contractData.rincian_layanan as ServiceItem[])
    : [];

  const totalInstallation = serviceItems.reduce<number>(
    (sum, item) => sum + parseAmount(item?.biaya_instalasi),
    0
  );
  const totalSubscription = serviceItems.reduce<number>(
    (sum, item) => sum + parseAmount(item?.biaya_langganan_tahunan),
    0
  );
  const computedContractValue = totalInstallation + totalSubscription;
  const totalServiceCount =
    (Number(serviceInfo.connectivity_telkom) || 0) +
    (Number(serviceInfo.non_connectivity_telkom) || 0) +
    (Number(serviceInfo.bundling) || 0);

  const paymentMethodMap: Record<string, string> = {
    termin: 'Termin',
    recurring: 'Recurring',
    one_time_charge: 'One Time Charge',
  };
  const paymentMethodType =
    typeof paymentInfo?.method_type === 'string' ? paymentInfo.method_type : undefined;
  const paymentMethodLabel = paymentMethodType
    ? paymentMethodMap[paymentMethodType] ?? paymentMethodType
    : 'Tidak tersedia';

  const terminPayments: TerminSummary[] = Array.isArray(paymentInfo?.termin_payments)
    ? (paymentInfo.termin_payments as TerminSummary[])
    : [];
  const sortedTerminPayments = [...terminPayments].sort((a, b) => {
    const aNum = typeof a?.termin_number === 'number' ? a.termin_number : Number.MAX_SAFE_INTEGER;
    const bNum = typeof b?.termin_number === 'number' ? b.termin_number : Number.MAX_SAFE_INTEGER;
    return aNum - bNum;
  });
  const terminCount = sortedTerminPayments.length;
  const terminWithDates: TerminWithDate[] = sortedTerminPayments.map((item) => ({
    item,
    date: parseTerminPeriod(item?.period ?? item?.raw_text ?? null),
  }));

  const now = new Date();
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const upcomingWithDate = terminWithDates
    .filter(({ date }) => date !== null)
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()))
    .find(({ date }) => (date as Date).getTime() >= currentMonth.getTime());

  const fallbackWithDate = terminWithDates
    .filter(({ date }) => date !== null)
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()))
    .pop();

  const fallbackByOrder = sortedTerminPayments[0];

  const fallbackByOrderEntry: TerminWithDate | undefined = fallbackByOrder
    ? {
        item: fallbackByOrder,
        date: parseTerminPeriod(fallbackByOrder.period ?? fallbackByOrder.raw_text ?? null),
      }
    : undefined;

  const upcomingTerminEntry = upcomingWithDate ?? fallbackWithDate ?? fallbackByOrderEntry;

  const upcomingTerminLabel = upcomingTerminEntry
    ? upcomingTerminEntry.date
      ? new Intl.DateTimeFormat('id-ID', {
          month: 'long',
          year: 'numeric',
        }).format(upcomingTerminEntry.date)
      : upcomingTerminEntry.item.period ??
        (typeof upcomingTerminEntry.item.termin_number === 'number'
          ? `Termin ${upcomingTerminEntry.item.termin_number}`
          : undefined)
    : undefined;

  const paymentStatValue: QuickStatValue =
    paymentMethodType === 'termin'
      ? terminCount > 0
        ? {
            primary: `${paymentMethodLabel} • ${terminCount} termin`,
            secondary: `Berikutnya: ${upcomingTerminLabel ?? 'Belum dijadwalkan'}`,
          }
        : `${paymentMethodLabel} • Jadwal termin belum tersedia`
      : paymentMethodLabel;

  const heroChips = [
    { label: 'ID Kontrak', value: `#${contract.id}` },
    { label: 'Versi', value: `v${contract.version}` },
    { label: 'Ukuran File', value: formatFileSize(contract.file_size_bytes) },
    { label: 'Total Layanan', value: totalServiceCount.toString() },
  ];

  const quickStats: QuickStat[] = [
    {
      label: 'Nilai Kontrak Total',
      value: computedContractValue > 0 ? formatCurrency(computedContractValue) : 'Rp 0',
      icon: DollarSign,
      accent: 'bg-rose-50 text-rose-600',
    },
    {
      label: 'Metode Pembayaran',
      value: paymentStatValue,
      icon: CreditCard,
      accent: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Tanggal Dikonfirmasi',
      value: formatDateTime(contract.confirmed_at),
      icon: CheckCircle,
      accent: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Terakhir Diperbarui',
      value: formatDateTime(contract.updated_at),
      icon: History,
      accent: 'bg-slate-100 text-slate-700',
    },
  ];

  const timelineEvents: TimelineEvent[] = [];
  if (contract.confirmed_at) {
    timelineEvents.push({
      label: 'Kontrak Dikonfirmasi',
      timestamp: contract.confirmed_at,
      description: contract.confirmed_by ? `oleh ${contract.confirmed_by}` : undefined,
      icon: CheckCircle,
    });
  }
  if (contract.updated_at) {
    timelineEvents.push({
      label: 'Diperbarui',
      timestamp: contract.updated_at,
      description: 'Pembaharuan terakhir pada data kontrak',
      icon: FileText,
    });
  }
  if (contract.created_at) {
    timelineEvents.push({
      label: 'Dibuat',
      timestamp: contract.created_at,
      description: 'Kontrak diunggah ke sistem',
      icon: ArrowUpRight,
    });
  }
  return (
    <motion.div
      className="p-6 space-y-6 min-h-screen"
      style={{ backgroundColor: telkomColors.gray50 }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Hero Header */}
      <motion.section
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-rose-50 shadow-sm"
      >
        <motion.span
          className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-rose-100 opacity-80 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 0.9, 0.7] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        />

        <div className="relative z-10 flex flex-col gap-6 p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/contracts')}
                  className="hover:bg-white/70 transition-colors border border-transparent hover:border-rose-100"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-rose-600 shadow-sm ring-1 ring-rose-100">
                  <Sparkles className="w-4 h-4" />
                  Kontrak Telkom
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  Detail Kontrak
                </h1>
                <p className="mt-2 text-base text-slate-600 lg:max-w-xl">
                  {contract.filename}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {heroChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm"
                  >
                    <span className="text-slate-400">{chip.label}</span>
                    <span className="text-slate-800">{chip.value}</span>
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-2 font-semibold text-rose-600">
                  <CheckCircle className="w-4 h-4" />
                  {formatDateTime(contract.confirmed_at)}
                  {contract.confirmed_by && (
                    <span className="font-normal text-slate-500">oleh {contract.confirmed_by}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Dibuat {formatDateTime(contract.created_at)}
                </div>
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  Pembaharuan {formatDateTime(contract.updated_at)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge
                className="px-3 py-1 text-sm shadow-sm"
                style={{
                  backgroundColor: telkomColors.success,
                  color: telkomColors.white,
                  border: 'none'
                }}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Dikonfirmasi
              </Badge>

              <Button
                variant="outline"
                onClick={() => navigate(`/contracts/${contract.id}/edit`)}
                className="border-white/80 bg-white/90 text-slate-600 hover:bg-white hover:text-slate-900"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>

              <Button
                variant="outline"
                onClick={handleDownloadJson}
                disabled={downloadJsonMutation.isPending}
                className="border-white/80 bg-white/90 text-slate-600 hover:bg-white hover:text-slate-900"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloadJsonMutation.isPending ? 'Mengunduh...' : 'JSON'}
              </Button>

              <Button
                onClick={handleViewPdf}
                style={{
                  backgroundColor: telkomColors.primary,
                  borderColor: telkomColors.primary,
                  color: telkomColors.white
                }}
                className="hover:opacity-90 transition-opacity"
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          let primaryText: string;
          let secondaryText: string | undefined;

          if (isComplexStatValue(stat.value)) {
            primaryText = stat.value.primary;
            secondaryText = stat.value.secondary;
          } else {
            primaryText = stat.value;
            secondaryText = undefined;
          }
          return (
          <motion.div
            key={stat.label}
            variants={cardVariants}
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {stat.label}
                </p>
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-slate-900">{primaryText}</p>
                  {secondaryText && (
                    <p className="text-xs font-semibold text-amber-600">
                      {secondaryText}
                    </p>
                  )}
                </div>
              </div>
              <span className={`inline-flex items-center justify-center rounded-full p-2 ${stat.accent}`}>
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
            </div>
          </motion.div>
        );
        })}
      </motion.section>

      {/* Bento Grid: 3-column layout with 2:1 ratio */}
      <motion.div
        className="grid grid-cols-1 gap-6 lg:grid-cols-3 auto-rows-min grid-flow-row-dense"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Left Column: Customer Information (2/3 width) */}
        <motion.div variants={cardVariants} whileHover={{ y: -4 }} className="lg:col-span-2 lg:row-span-2">
          <Card className="h-auto min-h-0 overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
            <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
                    <Building2 className="h-3.5 w-3.5" />
                    Pelanggan
                  </span>
                  <CardTitle className="mt-3 text-xl font-semibold text-slate-900">Informasi Pelanggan</CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    Data identitas dan kontak perwakilan pelanggan
                  </CardDescription>
                </div>
                <span className="rounded-full bg-white/80 p-2 shadow-inner shadow-rose-100">
                  <Users className="h-5 w-5 text-rose-500" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 bg-white p-5">
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden rounded-3xl border border-rose-100/80 bg-gradient-to-br from-rose-50 via-white to-white p-4 shadow-inner"
              >
                <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-rose-100/60 blur-3xl" />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-400">Profil Pelanggan</p>
                    <h3 className="text-xl font-semibold text-slate-900">{customerNameDisplay}</h3>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Detail identitas resmi dan kontak utama pelanggan pada kontrak ini.
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:max-w-xs sm:self-end">
                    {profileHighlights.map((highlight) => (
                      <div
                        key={highlight.label}
                        className="flex w-full items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm backdrop-blur"
                      >
                        <span className="rounded-full bg-rose-50 p-1.5 text-rose-500">
                          <highlight.icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex w-full flex-col">
                          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-slate-400">
                            {highlight.label}
                          </span>
                          <span
                            title={highlight.value === '-' ? undefined : highlight.value}
                            className={`text-xs font-semibold text-slate-800 leading-snug ${
                              highlight.monospace
                                ? 'font-mono text-sm tracking-wide text-slate-900 break-all'
                                : 'break-words'
                            }`}
                          >
                            {highlight.value}
                          </span>
                          <span className="text-[0.65rem] text-slate-400 break-words" title={highlight.helper}>
                            {highlight.helper}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-3xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50/70 p-4 shadow-sm"
                >
                  <div className="absolute right-6 top-6 h-16 w-16 rounded-full bg-rose-100/40 blur-3xl" />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="rounded-full bg-rose-50 p-1.5 text-rose-500">
                        <Building2 className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-rose-400">Profil</p>
                        <h4 className="text-base font-semibold text-slate-900">Informasi Perusahaan</h4>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {profileDetails.map((detail) => (
                        <div
                          key={detail.label}
                          className="flex items-start gap-2 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-inner shadow-rose-50 transition"
                        >
                          <span
                            aria-hidden="true"
                            className="rounded-full bg-rose-50 p-1.5 text-rose-500 shadow-sm shadow-rose-100"
                          >
                            <detail.icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="space-y-0.5">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-rose-400">
                              {detail.label}
                            </p>
                            <p
                              className={`text-xs font-semibold text-slate-900 ${
                                detail.monospace ? 'font-mono tracking-wide text-slate-900 break-all' : 'break-words'
                              }`}
                            >
                              {detail.value}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden rounded-3xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50/70 p-4 shadow-sm"
                >
                  <div className="absolute left-6 top-6 h-16 w-16 rounded-full bg-rose-100/50 blur-2xl" />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-rose-400">Kontak</p>
                        <h4 className="text-base font-semibold text-slate-900">Perwakilan & Kontak Person</h4>
                      </div>
                      <span className="rounded-full bg-white/90 p-1.5 text-rose-500 shadow-inner shadow-rose-100">
                        <Users className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="rounded-2xl border border-white/70 bg-white/95 p-3 shadow-inner shadow-rose-50 transition">
                        <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-rose-400">
                          <Users className="h-3 w-3 text-rose-500" aria-hidden="true" />
                          Perwakilan Resmi
                        </div>
                        <div className="mt-2 space-y-2">
                          {representativeDetails.map((detail) => (
                            <div key={detail.label} className="flex items-start gap-2">
                              <span aria-hidden="true" className="rounded-full bg-rose-50 p-1.5 text-rose-500 shadow-sm shadow-rose-100">
                                <detail.icon className="h-3.5 w-3.5" />
                              </span>
                              <div className="space-y-0.5">
                                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-400">
                                  {detail.label}
                                </p>
                                <p className="text-xs font-medium text-slate-800">{detail.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/70 bg-white/95 p-3 shadow-inner shadow-rose-50 transition">
                        <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-rose-400">
                          <Phone className="h-3 w-3 text-rose-500" aria-hidden="true" />
                          Kontak Person
                        </div>
                        <div className="mt-2 space-y-2">
                          {contactPersonDetails.map((detail) => (
                            <div
                              key={detail.label}
                              className="flex items-start gap-2"
                            >
                              <span aria-hidden="true" className="rounded-full bg-rose-50 p-1.5 text-rose-500 shadow-sm shadow-rose-100">
                                <detail.icon className="h-3.5 w-3.5" />
                              </span>
                              <div className="space-y-0.5">
                                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-400">
                                  {detail.label}
                                </p>
                                <p
                                  className={`text-xs font-medium text-slate-800 ${
                                    detail.monospace ? 'font-mono tracking-wide text-slate-900 break-all' : 'break-words'
                                  }`}
                                >
                                  {detail.value}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right items are independent grid items so dense packing can close gaps */}
        <motion.div variants={cardVariants} whileHover={{ y: -4 }} className="lg:col-span-1 lg:flex lg:w-full">
          {/* Layanan Utama Card */}
          <Card className="w-full overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40 lg:flex lg:h-full lg:flex-col">
            <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
                    <Settings className="h-3.5 w-3.5" />
                    Layanan
                  </span>
                  <CardTitle className="mt-3 text-xl font-semibold text-slate-900">Layanan Utama</CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    Kuantitas layanan berdasarkan kategori utama
                  </CardDescription>
                </div>
                <span className="rounded-full bg-white/80 p-2 shadow-inner shadow-rose-100">
                  <Layers className="h-5 w-5 text-rose-500" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 bg-white p-5 lg:flex lg:w-full lg:flex-col lg:justify-between">
              <div className="grid grid-cols-1 gap-3 lg:flex-1 lg:w-full">
                {([
                  {
                    label: 'Connectivity Telkom',
                    value: Number(serviceInfo.connectivity_telkom) || 0,
                    gradient: 'from-rose-500/30 via-rose-400/20 to-rose-300/20',
                  },
                  {
                    label: 'Non-Connectivity',
                    value: Number(serviceInfo.non_connectivity_telkom) || 0,
                    gradient: 'from-slate-600/25 via-slate-500/20 to-slate-400/15',
                  },
                  {
                    label: 'Bundling Services',
                    value: Number(serviceInfo.bundling) || 0,
                    gradient: 'from-emerald-500/25 via-emerald-400/18 to-emerald-300/15',
                  },
                ] as Array<{ label: string; value: number; gradient: string }>).map((item) => (
                  <motion.div
                    key={item.label}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className={`relative flex w-full flex-col justify-center overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-r ${item.gradient} p-4 shadow-lg`}
                  >
                    <div className="absolute right-4 top-4 h-12 w-12 rounded-full bg-white/50 blur-2xl" />
                    <div className="relative z-10 flex flex-col items-start gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          {item.label}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[0.65rem] text-slate-600">
                          <Sparkles className="h-3 w-3 text-rose-400" />
                          Total layanan dalam kategori ini
                        </span>
                      </div>
                      <p className="text-3xl font-bold text-slate-900 sm:text-4xl">{item.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants} whileHover={{ y: -4 }} className="lg:col-span-1 lg:col-start-3 lg:row-start-2 lg:flex lg:w-full">
          {/* Kontak Telkom Card */}
          <Card className="w-full overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40 lg:flex lg:h-full lg:flex-col lg:min-h-[320px]">
            <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-rose-500">
                    <User className="h-3 w-3" aria-hidden="true" />
                    Kontak
                  </span>
                  <CardTitle className="mt-2 text-base font-semibold text-slate-900">
                    Kontak Person Telkom
                  </CardTitle>
                </div>
                <span className="rounded-full bg-white/80 p-1.5 shadow-inner shadow-rose-100">
                  <Phone className="h-4 w-4 text-rose-500" aria-hidden="true" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="bg-white p-4 lg:flex lg:w-full lg:flex-col">
              {!hasTelkomContact ? (
                <div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 p-2 text-slate-400">
                    <Phone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  Informasi kontak tidak tersedia
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 text-sm leading-tight sm:grid-cols-2 lg:flex-1 lg:w-full">
                  {telkomContactFields.map((field) => (
                    <div
                      key={field.key}
                      className={`flex items-start gap-3 rounded-2xl border border-rose-100/70 bg-white/95 p-3 shadow-sm ${field.span ?? ''}`}
                    >
                      <span aria-hidden="true" className="rounded-full bg-rose-50 p-1.5 text-rose-500 shadow-sm shadow-rose-100">
                        <field.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-rose-400">
                          {field.label}
                        </p>
                        <p
                          className={`font-medium text-slate-900 ${
                            field.monospace ? 'font-mono text-sm tracking-wide text-slate-900 break-all' : 'text-sm break-words'
                          }`}
                        >
                          {field.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Service Details with VAT Breakdown */}
      <ServiceDetailsSection
        contractId={contract.id}
        serviceItems={serviceItems}
        startDate={timeInfo.mulai}
        endDate={timeInfo.akhir}
        paymentMethod={paymentInfo}
      />

      <motion.section
        className="grid grid-cols-1"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.div variants={cardVariants} whileHover="hover">
          <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
            <CardHeader className="relative border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-rose-500">
                    <History className="h-3.5 w-3.5" />
                    Riwayat Kontrak
                  </span>
                  <CardTitle className="text-xl font-semibold text-slate-900">Riwayat Kronologis Dokumen</CardTitle>
                  <CardDescription className="text-sm text-slate-600">Catatan kronologis peristiwa kunci sepanjang siklus hidup dokumen ini.</CardDescription>
                </div>
                <span className="rounded-full bg-white/80 p-2 shadow-inner shadow-rose-100">
                  <History className="h-5 w-5 text-rose-500" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 bg-white p-6">
              <div className="relative space-y-5 pl-8">
                <span className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-rose-200 via-rose-100 to-transparent" />
                {timelineEvents.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-100 bg-white/70 p-8 text-center text-sm text-slate-500">
                    <History className="h-5 w-5 text-rose-400" />
                    <p>Belum ada peristiwa yang terekam untuk kontrak ini.</p>
                  </div>
                )}
                {timelineEvents.map((event: TimelineEvent, index: number) => {
                  const Icon = event.icon;
                  return (
                    <motion.div
                      key={event.label + index}
                      className="relative flex items-start gap-4 rounded-2xl border border-rose-100/70 bg-white/90 p-5 shadow-sm transition hover:border-rose-200"
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{event.label}</p>
                        <p className="text-[0.6rem] font-medium uppercase tracking-[0.3em] text-rose-400">
                          {formatDateTime(event.timestamp)}
                        </p>
                        {event.description && (
                          <p className="text-sm text-slate-600 leading-snug">{event.description}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>
    </motion.div>
  );
}
