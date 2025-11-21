/**
 * Recurring Payment Management Modal
 * Two modes: Mark as Paid and Edit Note
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { formatIDR } from '@/lib/currency';
import { toast } from 'sonner';
import { useUpdateRecurringPayment } from '@/hooks/useContracts';
import type { RecurringPayment } from '@/types/api';

interface RecurringPaymentModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'paid' | 'note';
  contractId: number;
  cycleNumber: number;
  paymentData?: RecurringPayment | null;
  periodLabel?: string;
  amount?: number;
}

export function RecurringPaymentModal({
  open,
  onClose,
  mode,
  contractId,
  cycleNumber,
  paymentData,
  periodLabel = '',
  amount = 0,
}: RecurringPaymentModalProps) {
  const [notes, setNotes] = useState(paymentData?.notes || '');
  const [paidAtDate, setPaidAtDate] = useState<string>(
    paymentData?.paid_at
      ? format(new Date(paymentData.paid_at), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  );

  const updateMutation = useUpdateRecurringPayment();

  const handleSubmit = async () => {
    try {
      if (mode === 'paid') {
        // Mark as Paid mode: update status to PAID, set paid_at, and optional notes
        // Convert YYYY-MM-DD to ISO datetime
        const paidAtISO = new Date(paidAtDate).toISOString();

        await updateMutation.mutateAsync({
          contractId,
          cycleNumber,
          data: {
            status: 'PAID',
            paid_at: paidAtISO,
            notes: notes.trim() || undefined,
          },
        });
        toast.success('Pembayaran bulanan berhasil ditandai sebagai lunas');
      } else {
        // Edit Note mode: only update notes
        await updateMutation.mutateAsync({
          contractId,
          cycleNumber,
          data: {
            notes: notes.trim() || null,
          },
        });
        toast.success('Catatan berhasil diperbarui');
      }
      onClose();
    } catch (error: any) {
      console.error('Failed to update recurring payment:', error);
      toast.error(error.message || 'Gagal memperbarui pembayaran bulanan');
    }
  };

  const handleClose = () => {
    // Reset form state
    setNotes(paymentData?.notes || '');
    setPaidAtDate(
      paymentData?.paid_at
        ? format(new Date(paymentData.paid_at), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd')
    );
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'paid'
              ? `Tandai Bulan ke-${cycleNumber} sebagai Lunas`
              : `Ubah Catatan Bulan ke-${cycleNumber}`}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <div className="text-sm text-slate-600">
              <span className="font-medium">{periodLabel}</span>
              {amount > 0 && (
                <>
                  {' • '}
                  <span className="font-semibold text-rose-700">{formatIDR(amount)}</span>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {mode === 'paid' && (
            <div className="space-y-2">
              <Label htmlFor="paid-at">Tanggal Pembayaran</Label>
              <DatePicker
                id="paid-at"
                value={paidAtDate}
                onChange={(value: string) => setPaidAtDate(value)}
                placeholder="YYYY-MM-DD"
              />
              <p className="text-xs text-slate-500">
                Default: hari ini ({format(new Date(), 'dd MMMM yyyy', { locale: id })})
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">
              Catatan {mode === 'note' ? '' : '(Opsional)'}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan untuk pembayaran bulanan ini..."
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose} disabled={updateMutation.isPending}>
            Batalkan
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {updateMutation.isPending
              ? 'Menyimpan...'
              : mode === 'paid'
              ? 'Tandai Lunas'
              : 'Simpan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
