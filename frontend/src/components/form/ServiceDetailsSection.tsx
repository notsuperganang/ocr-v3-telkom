import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch, Control } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
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
  control,
}: ServiceDetailsSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rincian_layanan',
  });

  // Add new service detail
  const addServiceDetail = () => {
    append({
      biaya_instalasi: 0,
      biaya_langganan_tahunan: 0,
    });
  };

  // Remove service detail
  const removeServiceDetail = (index: number) => {
    remove(index);
  };

  // Calculate totals
  const calculateTotals = () => {
    const services = watch('rincian_layanan') || [];
    return services.reduce(
      (acc, service) => ({
        instalasi: acc.instalasi + (service.biaya_instalasi || 0),
        langganan: acc.langganan + (service.biaya_langganan_tahunan || 0),
      }),
      { instalasi: 0, langganan: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <FormSection
      title="Rincian Layanan"
      description="Detail biaya instalasi dan langganan untuk setiap paket layanan"
      icon={<Receipt className="w-5 h-5" />}
    >
      <div className="space-y-6">
        {/* Service Details List */}
        {fields.length > 0 ? (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <Card key={field.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      Paket Layanan #{index + 1}
                    </CardTitle>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeServiceDetail(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Installation Cost */}
                    <div className="space-y-2">
                      <CurrencyInput
                        label="Biaya Instalasi"
                        value={watch(`rincian_layanan.${index}.biaya_instalasi`) || 0}
                        onChange={(value) => setValue(`rincian_layanan.${index}.biaya_instalasi`, value)}
                        placeholder="0"
                        error={errors.rincian_layanan?.[index]?.biaya_instalasi?.message}
                      />
                    </div>

                    {/* Annual Subscription Cost */}
                    <div className="space-y-2">
                      <CurrencyInput
                        label="Biaya Langganan Tahunan"
                        value={watch(`rincian_layanan.${index}.biaya_langganan_tahunan`) || 0}
                        onChange={(value) => setValue(`rincian_layanan.${index}.biaya_langganan_tahunan`, value)}
                        placeholder="0"
                        error={errors.rincian_layanan?.[index]?.biaya_langganan_tahunan?.message}
                      />
                    </div>
                  </div>

                  {/* Package Total */}
                  {(watch(`rincian_layanan.${index}.biaya_instalasi`) || 0) > 0 ||
                   (watch(`rincian_layanan.${index}.biaya_langganan_tahunan`) || 0) > 0 ? (
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Paket:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            minimumFractionDigits: 0,
                          }).format(
                            (watch(`rincian_layanan.${index}.biaya_instalasi`) || 0) +
                            (watch(`rincian_layanan.${index}.biaya_langganan_tahunan`) || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <Receipt className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 mb-4">Belum ada rincian layanan</p>
            <Button type="button" onClick={addServiceDetail} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Rincian Layanan
            </Button>
          </div>
        )}

        {/* Add Service Button */}
        {fields.length > 0 && (
          <div className="flex justify-center">
            <Button
              type="button"
              onClick={addServiceDetail}
              variant="outline"
              className="w-full max-w-xs"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Paket Layanan
            </Button>
          </div>
        )}

        {/* Summary Totals */}
        {fields.length > 0 && (totals.instalasi > 0 || totals.langganan > 0) && (
          <div className="border-t pt-6">
            <div className="bg-primary/5 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Ringkasan Total</h4>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Biaya Instalasi:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                    }).format(totals.instalasi)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Biaya Langganan Tahunan:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('id-ID', {
                      style: 'currency',
                      currency: 'IDR',
                      minimumFractionDigits: 0,
                    }).format(totals.langganan)}
                  </span>
                </div>

                <div className="border-t pt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Grand Total:</span>
                    <span className="font-bold text-lg text-primary">
                      {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR',
                        minimumFractionDigits: 0,
                      }).format(totals.instalasi + totals.langganan)}
                    </span>
                  </div>
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
            <li>• Setiap paket layanan dapat memiliki struktur biaya yang berbeda.</li>
            <li>• Tambahkan paket baru jika terdapat layanan dengan struktur biaya terpisah.</li>
          </ul>
        </div>
      </div>
    </FormSection>
  );
}