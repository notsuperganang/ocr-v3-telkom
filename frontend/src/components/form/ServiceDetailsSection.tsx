import React from 'react';
import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch, Control } from 'react-hook-form';
import { Receipt } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TelkomContractData } from '@/types/extraction';

interface ServiceDetailsSectionProps {
  register: UseFormRegister<TelkomContractData>;
  errors: FieldErrors<TelkomContractData>;
  setValue: UseFormSetValue<TelkomContractData>;
  watch: UseFormWatch<TelkomContractData>;
  control: Control<TelkomContractData>;
}

export function ServiceDetailsSection({
  errors,
  setValue,
  watch,
}: ServiceDetailsSectionProps) {
  // Initialize single service detail if it doesn't exist
  const serviceDetail = watch('rincian_layanan.0') || { biaya_instalasi: 0, biaya_langganan_tahunan: 0 };

  // Ensure we always have at least one service detail
  React.useEffect(() => {
    const currentDetail = watch('rincian_layanan.0');
    if (!currentDetail) {
      setValue('rincian_layanan.0', { biaya_instalasi: 0, biaya_langganan_tahunan: 0 });
    }
  }, [setValue, watch]);

  // Calculate totals for the single service
  const instalationCost = serviceDetail.biaya_instalasi || 0;
  const subscriptionCost = serviceDetail.biaya_langganan_tahunan || 0;
  const totalCost = instalationCost + subscriptionCost;

  return (
    <FormSection
      title="Rincian Layanan"
      description="Detail biaya instalasi dan langganan untuk setiap paket layanan"
      icon={<Receipt className="w-5 h-5" />}
    >
      <div className="space-y-6">
        {/* Single Service Detail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Rincian Biaya Layanan</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Installation Cost */}
              <div className="space-y-2">
                <CurrencyInput
                  label="Biaya Instalasi"
                  value={instalationCost}
                  onChange={(value) => setValue('rincian_layanan.0.biaya_instalasi', value)}
                  placeholder="0"
                  error={errors.rincian_layanan?.[0]?.biaya_instalasi?.message}
                />
              </div>

              {/* Annual Subscription Cost */}
              <div className="space-y-2">
                <CurrencyInput
                  label="Biaya Langganan Tahunan"
                  value={subscriptionCost}
                  onChange={(value) => setValue('rincian_layanan.0.biaya_langganan_tahunan', value)}
                  placeholder="0"
                  error={errors.rincian_layanan?.[0]?.biaya_langganan_tahunan?.message}
                />
              </div>
            </div>

            {/* Service Total */}
            {totalCost > 0 && (
              <div className="border-t pt-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Biaya Layanan:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                    }).format(totalCost)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Totals */}
        {totalCost > 0 && (
          <div className="bg-primary/5 p-4 rounded-lg">
            <h4 className="font-medium mb-3">Ringkasan Biaya</h4>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Biaya Instalasi:</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                  }).format(instalationCost)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Biaya Langganan Tahunan:</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                  }).format(subscriptionCost)}
                </span>
              </div>

              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Keseluruhan:</span>
                  <span className="font-bold text-lg text-primary">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                    }).format(totalCost)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Guidelines */}
        <div className="bg-blue-50/50 p-4 rounded-lg">
          <h5 className="font-medium text-sm mb-2">Panduan Rincian Layanan:</h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Biaya Instalasi:</strong> Biaya sekali bayar untuk pemasangan dan konfigurasi awal.</li>
            <li>• <strong>Biaya Langganan Tahunan:</strong> Biaya berlangganan per tahun untuk penggunaan layanan.</li>
            <li>• Masukkan total biaya untuk semua layanan yang ada dalam kontrak.</li>
            <li>• Pastikan nilai yang dimasukkan sesuai dengan yang tertera dalam kontrak.</li>
          </ul>
        </div>
      </div>
    </FormSection>
  );
}