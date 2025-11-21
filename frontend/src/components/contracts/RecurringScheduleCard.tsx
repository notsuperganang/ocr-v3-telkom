/**
 * Recurring Schedule Management Card
 * Displays monthly recurring payment schedule with management actions
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Repeat, MoreVertical, CheckCircle2, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatIDR } from '@/lib/currency';
import { getStatusBadgeConfig } from '@/lib/termin-utils';
import { useRecurringPayments } from '@/hooks/useContracts';
import { RecurringPaymentModal } from './RecurringPaymentModal';
import { cn } from '@/lib/utils';
import type { RecurringPayment } from '@/types/api';

interface RecurringScheduleCardProps {
  contractId: number;
}

export function RecurringScheduleCard({ contractId }: RecurringScheduleCardProps) {
  const { data: payments, isLoading, error } = useRecurringPayments(contractId);

  // Modal state
  const [modalState, setModalState] = useState<{
    open: boolean;
    mode: 'paid' | 'note';
    payment: RecurringPayment | null;
  }>({
    open: false,
    mode: 'paid',
    payment: null,
  });

  // Current month detection
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

  // Summary stats
  const totalPayments = payments?.length || 0;
  const paidCount = payments?.filter((p) => p.status === 'PAID').length || 0;
  const unpaidCount = totalPayments - paidCount;
  const totalAmount =
    payments?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;

  const handleOpenModal = (payment: RecurringPayment, mode: 'paid' | 'note') => {
    setModalState({
      open: true,
      mode,
      payment,
    });
  };

  const handleCloseModal = () => {
    setModalState({
      open: false,
      mode: 'paid',
      payment: null,
    });
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-rose-400">
          <Repeat className="h-3.5 w-3.5 text-rose-500" />
          Manajemen Pembayaran Bulanan
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-rose-50/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-rose-400">
          <Repeat className="h-3.5 w-3.5 text-rose-500" />
          Manajemen Pembayaran Bulanan
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50/30 p-4 text-center">
          <p className="text-sm text-red-600">
            Gagal memuat jadwal pembayaran. Silakan refresh halaman.
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!payments || payments.length === 0) {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-rose-400">
          <Repeat className="h-3.5 w-3.5 text-rose-500" />
          Manajemen Pembayaran Bulanan
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Tidak ada jadwal pembayaran bulanan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-rose-400">
        <Repeat className="h-3.5 w-3.5 text-rose-500" />
        Manajemen Pembayaran Bulanan
      </div>

      {/* Summary Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{totalPayments} Tagihan</span>
        <span>•</span>
        <span className="text-green-600">{paidCount} Lunas</span>
        <span>•</span>
        <span>{unpaidCount} Belum Lunas</span>
        <span>•</span>
        <span className="font-medium text-foreground">
          Total: {formatIDR(totalAmount)}
        </span>
      </div>

      {/* Payment Table */}
      <div className="rounded-xl border border-rose-100/80 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-rose-50/30 hover:bg-rose-50/30">
              <TableHead className="w-[25%]">Bulan</TableHead>
              <TableHead className="w-[15%]">Status</TableHead>
              <TableHead className="w-[20%]">Jumlah</TableHead>
              <TableHead className="w-[20%]">Tanggal Bayar</TableHead>
              <TableHead className="w-[15%]">Catatan</TableHead>
              <TableHead className="text-center w-[5%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const isCurrentMonth =
                payment.period_year === currentYear &&
                payment.period_month === currentMonth;
              const isPaid = payment.status === 'PAID';
              const statusConfig = getStatusBadgeConfig(payment.status);
              const amount = parseFloat(payment.amount || '0');

              // Status-based hover colors
              const getHoverColor = () => {
                switch (payment.status) {
                  case 'PAID':
                    return 'hover:bg-green-50/50';
                  case 'OVERDUE':
                    return 'hover:bg-red-50/50';
                  case 'DUE':
                    return 'hover:bg-amber-50/50';
                  case 'PENDING':
                    return 'hover:bg-slate-50/50';
                  case 'CANCELLED':
                    return 'hover:bg-gray-50/50';
                  default:
                    return 'hover:bg-slate-50/50';
                }
              };

              // Status-based current month border and background colors
              const getCurrentMonthStyles = () => {
                if (!isCurrentMonth) return '';
                switch (payment.status) {
                  case 'PAID':
                    return 'bg-green-50/20 border-l-2 border-l-green-500';
                  case 'OVERDUE':
                    return 'bg-red-50/20 border-l-2 border-l-red-500';
                  case 'DUE':
                    return 'bg-amber-50/20 border-l-2 border-l-amber-500';
                  case 'PENDING':
                    return 'bg-slate-50/20 border-l-2 border-l-slate-500';
                  case 'CANCELLED':
                    return 'bg-gray-50/20 border-l-2 border-l-gray-500';
                  default:
                    return 'bg-slate-50/20 border-l-2 border-l-slate-500';
                }
              };

              // Status-based cycle number colors
              const getCycleNumberStyles = () => {
                switch (payment.status) {
                  case 'PAID':
                    return 'bg-green-100 text-green-700';
                  case 'OVERDUE':
                    return 'bg-red-100 text-red-700';
                  case 'DUE':
                    return 'bg-amber-100 text-amber-700';
                  case 'PENDING':
                    return 'bg-slate-100 text-slate-600';
                  case 'CANCELLED':
                    return 'bg-gray-100 text-gray-500';
                  default:
                    return 'bg-slate-100 text-slate-600';
                }
              };

              return (
                <TableRow
                  key={payment.id}
                  className={cn(
                    'transition-colors',
                    getHoverColor(),
                    getCurrentMonthStyles()
                  )}
                >
                  {/* Bulan Column */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                        getCycleNumberStyles()
                      )}>
                        {payment.cycle_number}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          Bulan {payment.cycle_number}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {payment.period_label}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Status Column */}
                  <TableCell>
                    <Badge variant="outline" className={cn(statusConfig.className, "min-w-[90px] justify-center")}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>

                  {/* Amount Column */}
                  <TableCell className="font-medium">
                    {formatIDR(amount)}
                  </TableCell>

                  {/* Paid Date Column */}
                  <TableCell>
                    {payment.paid_at ? (
                      <div className="flex items-center gap-1.5 text-sm text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {format(
                          new Date(payment.paid_at),
                          'dd MMM yyyy',
                          { locale: id }
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Notes Column */}
                  <TableCell>
                    {payment.notes ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">
                          {payment.notes}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Action Column */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!isPaid && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleOpenModal(payment, 'paid')}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Tandai sebagai lunas
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleOpenModal(payment, 'note')}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {payment.notes ? 'Ubah catatan' : 'Tambah catatan'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal */}
      {modalState.open && modalState.payment && (
        <RecurringPaymentModal
          open={modalState.open}
          onClose={handleCloseModal}
          mode={modalState.mode}
          contractId={contractId}
          cycleNumber={modalState.payment.cycle_number}
          paymentData={modalState.payment}
          periodLabel={modalState.payment.period_label}
          amount={parseFloat(modalState.payment.amount || '0')}
        />
      )}
    </div>
  );
}
