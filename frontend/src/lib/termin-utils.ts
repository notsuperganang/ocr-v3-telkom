// Shared utilities for termin payment status display
import type { TerminPaymentStatus } from '@/types/api';

export interface StatusBadgeConfig {
  variant: 'outline';
  label: string;
  className: string;
}

export interface StatusInfo {
  key: TerminPaymentStatus;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

// Status configuration for badges
export const getStatusBadgeConfig = (status: TerminPaymentStatus): StatusBadgeConfig => {
  switch (status) {
    case 'PENDING':
      return { variant: 'outline', label: 'Pending', className: 'bg-slate-50 text-slate-600 border-slate-200' };
    case 'DUE':
      return { variant: 'outline', label: 'Jatuh Tempo', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'OVERDUE':
      return { variant: 'outline', label: 'Terlambat', className: 'bg-red-50 text-red-700 border-red-200' };
    case 'PAID':
      return { variant: 'outline', label: 'Lunas', className: 'bg-green-50 text-green-700 border-green-200' };
    case 'CANCELLED':
      return { variant: 'outline', label: 'Dibatalkan', className: 'bg-gray-50 text-gray-500 border-gray-200' };
    default:
      return { variant: 'outline', label: status, className: 'bg-slate-50 text-slate-600 border-slate-200' };
  }
};

// Extended status info for summary cards and headers
export const STATUS_INFO: Record<'OVERDUE' | 'DUE' | 'PENDING', StatusInfo> = {
  OVERDUE: {
    key: 'OVERDUE',
    label: 'Terlambat',
    shortLabel: 'Terlambat',
    icon: '🔴',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  DUE: {
    key: 'DUE',
    label: 'Jatuh Tempo',
    shortLabel: 'Jatuh Tempo',
    icon: '🟠',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  PENDING: {
    key: 'PENDING',
    label: 'Akan Datang',
    shortLabel: 'Akan Datang',
    icon: '🔵',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
};

// Order of status display (most urgent first)
export const STATUS_ORDER: Array<'OVERDUE' | 'DUE' | 'PENDING'> = ['OVERDUE', 'DUE', 'PENDING'];
