import { Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TerminPayment } from '@/types/extraction';

interface TerminTableProps {
  payments: TerminPayment[];
  onChange: (payments: TerminPayment[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

export function TerminTable({
  payments,
  onChange,
  disabled = false,
  errors = {},
}: TerminTableProps) {
  // Add new termin payment
  const addTermin = () => {
    const newTermin: TerminPayment = {
      termin_number: payments.length + 1,
      period: '',
      amount: 0,
    };
    onChange([...payments, newTermin]);
  };

  // Remove termin payment
  const removeTermin = (index: number) => {
    const updatedPayments = payments.filter((_, i) => i !== index);

    // Renumber termin numbers to maintain sequence
    const renumberedPayments = updatedPayments.map((payment, idx) => ({
      ...payment,
      termin_number: idx + 1,
    }));

    onChange(renumberedPayments);
  };

  // Update termin payment
  const updateTermin = (index: number, field: keyof TerminPayment, value: any) => {
    const updatedPayments = payments.map((payment, i) =>
      i === index ? { ...payment, [field]: value } : payment
    );
    onChange(updatedPayments);
  };

  // Calculate total amount
  const totalAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

  // Validate termin sequence
  const hasSequenceError = payments.some((payment, index) => payment.termin_number !== index + 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Pembayaran Termin</Label>
          <p className="text-xs text-muted-foreground">
            Atur jadwal pembayaran bertahap
          </p>
        </div>
        <Button
          type="button"
          onClick={addTermin}
          disabled={disabled}
          size="sm"
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Termin
        </Button>
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 mb-4">Belum ada pembayaran termin</p>
          <Button type="button" onClick={addTermin} disabled={disabled} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Termin Pertama
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment, index) => (
            <Card key={index} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {payment.termin_number}
                    </span>
                    Termin #{payment.termin_number}
                  </CardTitle>
                  {payments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTermin(index)}
                      disabled={disabled}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Period */}
                  <div className="space-y-2">
                    <Label htmlFor={`period_${index}`} className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Periode Pembayaran
                    </Label>
                    <Input
                      id={`period_${index}`}
                      value={payment.period}
                      onChange={(e) => updateTermin(index, 'period', e.target.value)}
                      placeholder="Contoh: Maret 2025"
                      disabled={disabled}
                      className={errors[`termin_${index}_period`] ? 'border-red-500' : ''}
                    />
                    {errors[`termin_${index}_period`] && (
                      <p className="text-xs text-red-500">{errors[`termin_${index}_period`]}</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <CurrencyInput
                      label="Jumlah Pembayaran"
                      value={payment.amount}
                      onChange={(value) => updateTermin(index, 'amount', value)}
                      placeholder="0"
                      disabled={disabled}
                      error={errors[`termin_${index}_amount`]}
                    />
                  </div>
                </div>

                {/* Raw Text (if available) */}
                {payment.raw_text && (
                  <div className="border-t pt-3">
                    <Label className="text-xs text-muted-foreground">Teks asli ekstraksi:</Label>
                    <p className="text-xs text-muted-foreground mt-1 p-2 bg-gray-50 rounded">
                      {payment.raw_text}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {payments.length > 0 && (
        <div className="border-t pt-4">
          <Card className="bg-primary/5">
            <CardContent className="p-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Ringkasan Pembayaran Termin</h4>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Jumlah Termin:</span>
                    <span className="ml-2 font-medium">{payments.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Pembayaran:</span>
                    <span className="ml-2 font-medium">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                      }).format(totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Payment Schedule */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Jadwal Pembayaran:</Label>
                  <div className="space-y-1">
                    {payments.map((payment, index) => (
                      <div key={index} className="flex justify-between items-center text-xs p-2 bg-white rounded">
                        <span>Termin {payment.termin_number} - {payment.period || 'Periode belum diisi'}</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            minimumFractionDigits: 0,
                          }).format(payment.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation Warnings */}
                {hasSequenceError && (
                  <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                    ⚠️ Nomor termin tidak berurutan. Akan diperbaiki otomatis saat menyimpan.
                  </div>
                )}

                {payments.some(p => !p.period.trim()) && (
                  <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                    ⚠️ Beberapa periode pembayaran belum diisi.
                  </div>
                )}

                {payments.some(p => p.amount <= 0) && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    ❌ Semua jumlah pembayaran harus lebih dari 0.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Guidelines */}
      <div className="bg-blue-50/50 p-3 rounded-lg">
        <h5 className="font-medium text-xs mb-2">Panduan Pembayaran Termin:</h5>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Pembayaran termin memungkinkan pelanggan membayar dalam beberapa tahap.</li>
          <li>• Setiap termin harus memiliki periode yang jelas (bulan/tahun).</li>
          <li>• Jumlah pembayaran setiap termin harus lebih dari 0.</li>
          <li>• Nomor termin akan diurutkan otomatis dari 1, 2, 3, dst.</li>
        </ul>
      </div>
    </div>
  );
}