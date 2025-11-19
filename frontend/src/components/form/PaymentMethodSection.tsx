import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { CreditCard, Clock, Calendar, Receipt } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { TerminTable } from './TerminTable';
import type { PaymentMethodType, TerminPayment } from '@/types/extraction';
import type { TelkomContractFormData } from '@/lib/validation';

interface PaymentMethodSectionProps {
  register: UseFormRegister<TelkomContractFormData>;
  errors: FieldErrors<TelkomContractFormData>;
  setValue: UseFormSetValue<TelkomContractFormData>;
  watch: UseFormWatch<TelkomContractFormData>;
}

export function PaymentMethodSection({
  register,
  errors,
  setValue,
  watch,
}: PaymentMethodSectionProps) {
  const paymentMethod = watch('tata_cara_pembayaran');
  const methodType = paymentMethod?.method_type || 'one_time_charge';
  const terminPayments = paymentMethod?.termin_payments || [];

  // Handle payment method type change
  const handleMethodTypeChange = (newType: PaymentMethodType) => {
    setValue('tata_cara_pembayaran.method_type', newType, { shouldDirty: true });

    // Clear method-specific fields when switching
    if (newType !== 'termin') {
      setValue('tata_cara_pembayaran.termin_payments', [], { shouldDirty: true });
      setValue('tata_cara_pembayaran.total_termin_count', undefined, { shouldDirty: true });
      setValue('tata_cara_pembayaran.total_amount', undefined, { shouldDirty: true });
    }

    if (newType === 'termin') {
      setValue('tata_cara_pembayaran.description', undefined, { shouldDirty: true });
    }
  };

  // Handle termin payments change
  const handleTerminPaymentsChange = (payments: TerminPayment[]) => {
    setValue('tata_cara_pembayaran.termin_payments', payments, { shouldDirty: true });
    setValue('tata_cara_pembayaran.total_termin_count', payments.length, { shouldDirty: true });
    setValue('tata_cara_pembayaran.total_amount',
      payments.reduce((sum: number, payment) => sum + (payment.amount || 0), 0),
      { shouldDirty: true }
    );
  };

  // Payment method options
  const paymentOptions = [
    {
      value: 'one_time_charge' as PaymentMethodType,
      label: 'Sekali Bayar',
      description: 'Pembayaran dilakukan sekaligus',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'bg-green-50 border-green-200 text-green-700',
    },
    {
      value: 'recurring' as PaymentMethodType,
      label: 'Berulang',
      description: 'Pembayaran berkala (bulanan/tahunan)',
      icon: <Clock className="w-5 h-5" />,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
    },
    {
      value: 'termin' as PaymentMethodType,
      label: 'Termin',
      description: 'Pembayaran bertahap sesuai jadwal',
      icon: <Calendar className="w-5 h-5" />,
      color: 'bg-purple-50 border-purple-200 text-purple-700',
    },
  ];

  return (
    <FormSection
      title="Tata Cara Pembayaran"
      description="Metode dan jadwal pembayaran untuk kontrak ini"
      icon={<Receipt className="w-5 h-5" />}
      isRequired={true}
    >
      <div className="space-y-6">
        {/* Payment Method Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Metode Pembayaran</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
            {paymentOptions.map((option) => (
              <Card
                key={option.value}
                className={`cursor-pointer transition-all hover:shadow-md min-h-[100px] flex flex-col ${
                  methodType === option.value
                    ? option.color + ' border-2'
                    : 'border hover:border-primary/50'
                }`}
                onClick={() => handleMethodTypeChange(option.value)}
              >
                <CardContent className="p-4 flex-1 flex items-center">
                  <div className="flex items-center gap-3 w-full">
                    <div className={`p-2 rounded-lg ${
                      methodType === option.value ? 'bg-white/50' : 'bg-gray-100'
                    }`}>
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{option.label}</h4>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                    {methodType === option.value && (
                      <div className="w-4 h-4 rounded-full bg-current opacity-20" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Method-specific content */}
        {methodType === 'one_time_charge' && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-sm text-green-800 mb-2">Pembayaran Sekali Bayar</h4>
              <p className="text-sm text-green-700">
                Seluruh nilai kontrak dibayarkan sekaligus pada saat penandatanganan atau sesuai kesepakatan.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="one_time_description" className="text-sm font-medium">
                Deskripsi Pembayaran
              </Label>
              <Input
                id="one_time_description"
                {...register('tata_cara_pembayaran.description')}
                placeholder="Contoh: Pembayaran dilakukan sekaligus setelah penandatanganan kontrak"
                className={errors.tata_cara_pembayaran?.description ? 'border-red-500' : ''}
              />
              {errors.tata_cara_pembayaran?.description && (
                <p className="text-xs text-red-500">
                  {errors.tata_cara_pembayaran.description.message}
                </p>
              )}
            </div>
          </div>
        )}

        {methodType === 'recurring' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-sm text-blue-800 mb-2">Pembayaran Berulang</h4>
              <p className="text-sm text-blue-700">
                Pembayaran dilakukan secara berkala (bulanan, triwulan, atau tahunan) selama masa kontrak.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring_description" className="text-sm font-medium">
                Deskripsi Pembayaran Berkala
              </Label>
              <Input
                id="recurring_description"
                {...register('tata_cara_pembayaran.description')}
                placeholder="Contoh: Pembayaran dilakukan setiap tahun pada bulan yang sama"
                className={errors.tata_cara_pembayaran?.description ? 'border-red-500' : ''}
              />
              {errors.tata_cara_pembayaran?.description && (
                <p className="text-xs text-red-500">
                  {errors.tata_cara_pembayaran.description.message}
                </p>
              )}
            </div>
          </div>
        )}

        {methodType === 'termin' && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-medium text-sm text-purple-800 mb-2">Pembayaran Termin</h4>
              <p className="text-sm text-purple-700">
                Pembayaran dilakukan secara bertahap sesuai jadwal yang telah disepakati, biasanya terbagi dalam beberapa termin.
              </p>
            </div>

            <TerminTable
              payments={terminPayments}
              onChange={handleTerminPaymentsChange}
              errors={errors.tata_cara_pembayaran as any}
            />
          </div>
        )}

        {/* Raw Text (if available) */}
        {paymentMethod?.raw_text && (
          <div className="border-t pt-4">
            <Label className="text-sm font-medium text-muted-foreground">Teks Asli Ekstraksi:</Label>
            <div className="mt-2 p-3 bg-gray-50 border rounded-lg">
              <p className="text-sm text-muted-foreground font-mono">
                {paymentMethod.raw_text}
              </p>
            </div>
          </div>
        )}

        {/* Guidelines */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h5 className="font-medium text-sm mb-2">Panduan Tata Cara Pembayaran:</h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Pastikan metode pembayaran sesuai dengan ketentuan yang disepakati dalam kontrak.</li>
          </ul>
        </div>
      </div>
    </FormSection>
  );
}