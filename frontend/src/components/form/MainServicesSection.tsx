import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Network, Globe, Package } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TelkomContractFormData } from '@/lib/validation';

interface MainServicesSectionProps {
  register: UseFormRegister<TelkomContractFormData>;
  errors: FieldErrors<TelkomContractFormData>;
  setValue: UseFormSetValue<TelkomContractFormData>;
  watch: UseFormWatch<TelkomContractFormData>;
}

export function MainServicesSection({
  errors,
  setValue,
  watch,
}: MainServicesSectionProps) {
  const connectivityValue = watch('layanan_utama.connectivity_telkom') || 0;
  const nonConnectivityValue = watch('layanan_utama.non_connectivity_telkom') || 0;
  const bundlingValue = watch('layanan_utama.bundling') || 0;

  // Handle numeric input changes
  const handleNumberChange = (
    field: 'connectivity_telkom' | 'non_connectivity_telkom' | 'bundling',
    value: string
  ) => {
    const numValue = parseInt(value) || 0;
    if (numValue >= 0) {
      setValue(`layanan_utama.${field}`, numValue);
    }
  };

  // Calculate total services
  const totalServices = connectivityValue + nonConnectivityValue + bundlingValue;

  return (
    <FormSection
      title="Layanan Utama"
      description="Jumlah layanan yang akan disediakan dalam kontrak"
      icon={<Network className="w-5 h-5" />}
      isRequired={true}
    >
      <div className="space-y-6">
        {/* Service Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {/* Connectivity Services */}
          <div className="border rounded-lg p-4 bg-blue-50/50 min-h-[140px] flex flex-col">
            <div className="flex items-center gap-3 mb-3 flex-1">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Network className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <Label htmlFor="connectivity" className="text-sm font-medium">
                  Connectivity Telkom
                </Label>
                <p className="text-xs text-muted-foreground">
                  Layanan konektivitas internet
                </p>
              </div>
            </div>

            <div className="mt-auto">
            <Input
              id="connectivity"
              type="number"
              min="0"
              value={connectivityValue}
              onChange={(e) => handleNumberChange('connectivity_telkom', e.target.value)}
              placeholder="0"
              className={`text-center text-lg font-semibold ${
                errors.layanan_utama?.connectivity_telkom ? 'border-red-500' : ''
              }`}
            />
            {errors.layanan_utama?.connectivity_telkom && (
              <p className="text-xs text-red-500 mt-1">
                {errors.layanan_utama.connectivity_telkom.message}
              </p>
            )}
            </div>
          </div>

          {/* Non-Connectivity Services */}
          <div className="border rounded-lg p-4 bg-green-50/50 min-h-[140px] flex flex-col">
            <div className="flex items-center gap-3 mb-3 flex-1">
              <div className="p-2 bg-green-100 rounded-lg">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <Label htmlFor="non_connectivity" className="text-sm font-medium">
                  Non-Connectivity Telkom
                </Label>
                <p className="text-xs text-muted-foreground">
                  Layanan non-konektivitas
                </p>
              </div>
            </div>

            <div className="mt-auto">
            <Input
              id="non_connectivity"
              type="number"
              min="0"
              value={nonConnectivityValue}
              onChange={(e) => handleNumberChange('non_connectivity_telkom', e.target.value)}
              placeholder="0"
              className={`text-center text-lg font-semibold ${
                errors.layanan_utama?.non_connectivity_telkom ? 'border-red-500' : ''
              }`}
            />
            {errors.layanan_utama?.non_connectivity_telkom && (
              <p className="text-xs text-red-500 mt-1">
                {errors.layanan_utama.non_connectivity_telkom.message}
              </p>
            )}
            </div>
          </div>

          {/* Bundling Services */}
          <div className="border rounded-lg p-4 bg-purple-50/50 min-h-[140px] flex flex-col">
            <div className="flex items-center gap-3 mb-3 flex-1">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <Label htmlFor="bundling" className="text-sm font-medium">
                  Bundling
                </Label>
                <p className="text-xs text-muted-foreground">
                  Paket layanan bundling
                </p>
              </div>
            </div>

            <div className="mt-auto">
            <Input
              id="bundling"
              type="number"
              min="0"
              value={bundlingValue}
              onChange={(e) => handleNumberChange('bundling', e.target.value)}
              placeholder="0"
              className={`text-center text-lg font-semibold ${
                errors.layanan_utama?.bundling ? 'border-red-500' : ''
              }`}
            />
            {errors.layanan_utama?.bundling && (
              <p className="text-xs text-red-500 mt-1">
                {errors.layanan_utama.bundling.message}
              </p>
            )}
            </div>
          </div>
        </div>

        {/* Total Summary */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <h4 className="font-medium">Total Layanan</h4>
              <p className="text-sm text-muted-foreground">
                Jumlah keseluruhan layanan dalam kontrak
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {totalServices}
              </div>
              <div className="text-xs text-muted-foreground">
                layanan
              </div>
            </div>
          </div>

          {/* Breakdown if there are services */}
          {totalServices > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-medium text-blue-600">{connectivityValue}</div>
                <div className="text-xs text-muted-foreground">Connectivity</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-green-600">{nonConnectivityValue}</div>
                <div className="text-xs text-muted-foreground">Non-Connectivity</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-purple-600">{bundlingValue}</div>
                <div className="text-xs text-muted-foreground">Bundling</div>
              </div>
            </div>
          )}
        </div>

        {/* Validation Message */}
        {totalServices === 0 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-700">
              ⚠️ Minimal harus ada 1 layanan untuk melanjutkan konfirmasi kontrak.
            </p>
          </div>
        )}

        {/* Service Guidelines */}
        <div className="bg-blue-50/50 p-4 rounded-lg">
          <h5 className="font-medium text-sm mb-2">Panduan Layanan:</h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Connectivity Telkom:</strong> Internet, dedicated line, VPN, dll.</li>
            <li>• <strong>Non-Connectivity Telkom:</strong> Cloud services, maintenance, training, dll.</li>
            <li>• <strong>Bundling:</strong> Paket kombinasi layanan dengan harga khusus.</li>
          </ul>
        </div>
      </div>
    </FormSection>
  );
}