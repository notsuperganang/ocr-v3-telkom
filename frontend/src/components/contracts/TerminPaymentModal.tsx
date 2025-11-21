/**
 * Termin Payment Management Modal
 * Three modes: Mark as Paid, Edit Note, and Cancel
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
import { useUpdateTerminPayment } from '@/hooks/useContracts';
import type { TerminPayment } from '@/types/api';

interface TerminPaymentModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'paid' | 'note' | 'cancel';
  contractId: number;
  terminNumber: number;
  terminData?: TerminPayment | null;
  periodLabel?: string;
  amount?: number;
}

export function TerminPaymentModal({
  open,
  onClose,
  mode,
  contractId,
  terminNumber,
  terminData,
  periodLabel = '',
  amount = 0,
}: TerminPaymentModalProps) {
  const [notes, setNotes] = useState(terminData?.notes || '');
  const [paidAtDate, setPaidAtDate] = useState<string>(
    terminData?.paid_at
      ? format(new Date(terminData.paid_at), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  );

  const updateMutation = useUpdateTerminPayment();

  const handleSubmit = async () => {
    try {
      if (mode === 'paid') {
        // Mark as Paid mode: update status to PAID, set paid_at, and optional notes
        // Convert YYYY-MM-DD to ISO datetime
        const paidAtISO = new Date(paidAtDate).toISOString();

        await updateMutation.mutateAsync({
          contractId,
          terminNumber,
          data: {
            status: 'PAID',
            paid_at: paidAtISO,
            notes: notes.trim() || undefined,
          },
        });
        toast.success('Termin berhasil ditandai sebagai lunas');
      } else if (mode === 'cancel') {
        // Cancel mode: update status to CANCELLED and add cancellation reason in notes
        await updateMutation.mutateAsync({
          contractId,
          terminNumber,
          data: {
            status: 'CANCELLED',
            notes: notes.trim() || undefined,
          },
        });
        toast.success('Termin berhasil dibatalkan');
      } else {
        // Edit Note mode: only update notes
        await updateMutation.mutateAsync({
          contractId,
          terminNumber,
          data: {
            notes: notes.trim() || null,
          },
        });
        toast.success('Catatan berhasil diperbarui');
      }
      onClose();
    } catch (error: any) {
      console.error('Failed to update termin payment:', error);
      toast.error(error.message || 'Gagal memperbarui termin payment');
    }
  };

  const handleClose = () => {
    // Reset form state
    setNotes(terminData?.notes || '');
    setPaidAtDate(
      terminData?.paid_at
        ? format(new Date(terminData.paid_at), 'yyyy-MM-dd')
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
              ? `Tandai Termin ${terminNumber} sebagai Lunas` 
              : mode === 'cancel'
              ? `Batalkan Termin ${terminNumber}`
              : `Ubah Catatan Termin ${terminNumber}`}
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
            {mode === 'cancel' && (
              <p className="text-sm text-red-600 font-medium">
                Termin yang dibatalkan tidak dapat dikembalikan. Pastikan tindakan ini sudah benar.
              </p>
            )}
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
              {mode === 'cancel' ? 'Alasan Pembatalan (Opsional)' : `Catatan ${mode === 'note' ? '' : '(Opsional)'}`}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={mode === 'cancel' ? 'Jelaskan alasan pembatalan termin ini...' : 'Tambahkan catatan untuk termin ini...'}
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
            className={mode === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-rose-600 hover:bg-rose-700'}
          >
            {updateMutation.isPending 
              ? 'Menyimpan...' 
              : mode === 'paid' 
              ? 'Tandai Lunas' 
              : mode === 'cancel'
              ? 'Batalkan Termin'
              : 'Simpan'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
