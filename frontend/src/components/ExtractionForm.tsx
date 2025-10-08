import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CustomerInfoSection } from '@/components/form/CustomerInfoSection';
import { MainServicesSection } from '@/components/form/MainServicesSection';
import { ServiceDetailsSection } from '@/components/form/ServiceDetailsSection';
import { PaymentMethodSection } from '@/components/form/PaymentMethodSection';
import { TelkomContactSection } from '@/components/form/TelkomContactSection';
import { ContractPeriodSection } from '@/components/form/ContractPeriodSection';
import { FormSummary } from '@/components/ui/form-section';
import {
  telkomContractFormSchema,
  canConfirmContract,
  backendToForm,
  formToBackend,
  type TelkomContractFormData,
  type TelkomContractData
} from '@/lib/validation';
import { useAutoSave, useConfirmExtraction, useDiscardExtraction } from '@/hooks/useExtraction';

interface ExtractionFormProps {
  jobId: number;
  initialData: TelkomContractData; // Backend data format
  onSave?: (data: TelkomContractData) => void; // Save as backend format
  onConfirm?: () => void;
  onDiscard?: () => void;
  disabled?: boolean;
  mode?: 'job' | 'contract'; // 'job' for processing jobs, 'contract' for editing contracts
}

export function ExtractionForm({
  jobId,
  initialData,
  onSave,
  onConfirm,
  onDiscard,
  disabled = false,
  mode = 'job',
}: ExtractionFormProps) {
  const [lastSaveTime, setLastSaveTime] = React.useState<Date | null>(null);

  // Transform backend data to clean form data
  const formData = React.useMemo(() => backendToForm(initialData), [initialData]);

  // Form setup with react-hook-form
  const form = useForm<TelkomContractFormData>({
    resolver: zodResolver(telkomContractFormSchema),
    defaultValues: formData,
    mode: 'onChange',
  });

  const {
    register,
    formState: { errors, isDirty, isValid },
    watch,
    setValue,
    control,
    reset,
  } = form;

  // Auto-save functionality
  const { autoSave, flush, isSaving } = useAutoSave(jobId, 2000); // 2 second delay

  // Mutations
  const confirmMutation = useConfirmExtraction();
  const discardMutation = useDiscardExtraction();

  // Watch all form data for auto-save
  const currentFormData = watch();

  // Stabilize form data to prevent infinite loops
  const stableFormData = React.useMemo(() => {
    return JSON.stringify(currentFormData);
  }, [currentFormData]);

  // Auto-save when form data changes (transform to backend format)
  React.useEffect(() => {
    if (isDirty && isValid) {
      const backendData = formToBackend(currentFormData);
      if (mode === 'job') {
        autoSave(backendData);
      } else if (mode === 'contract' && onSave) {
        // For contract mode, use the onSave callback instead
        onSave(backendData);
      }
    }
  }, [stableFormData, isDirty, isValid, autoSave, mode, onSave]);

  // Update last save time when saving completes
  const prevIsSaving = React.useRef(isSaving);
  React.useEffect(() => {
    if (prevIsSaving.current && !isSaving) {
      setLastSaveTime(new Date());
    }
    prevIsSaving.current = isSaving;
  }, [isSaving]);

  // Reset form when initial data changes (transform to form format)
  React.useEffect(() => {
    const newFormData = backendToForm(initialData);
    reset(newFormData);
  }, [initialData, reset]);

  // Confirm handler
  const handleConfirm = async () => {
    try {
      const isFormValid = await form.trigger();
      if (!isFormValid) {
        return;
      }

      const currentFormData = form.getValues();
      const backendData = formToBackend(currentFormData);
      const { canConfirm, errors: validationErrors } = canConfirmContract(backendData);
      if (!canConfirm) {
        alert(`Tidak dapat mengkonfirmasi:\n${validationErrors.join('\n')}`);
        return;
      }

      // Flush any pending auto-save before confirming (only for job mode)
      if (mode === 'job') {
        await flush();
        confirmMutation.mutate(jobId);
      }

      onConfirm?.();
    } catch (error) {
      console.error('Confirm failed:', error);
    }
  };

  // Discard handler
  const handleDiscard = () => {
    if (confirm('Yakin ingin membatalkan dan menghapus job ini? Tindakan ini tidak dapat dibatalkan.')) {
      // Only call mutation for job mode, contract mode uses callback only
      if (mode === 'job') {
        discardMutation.mutate(jobId);
      }
      onDiscard?.();
    }
  };

  // Calculate form completion statistics
  const formSections = React.useMemo(() => {
    const hasCustomerInfo = currentFormData.informasi_pelanggan?.nama_pelanggan;
    const hasServices = (currentFormData.layanan_utama?.connectivity_telkom || 0) +
                       (currentFormData.layanan_utama?.non_connectivity_telkom || 0) +
                       (currentFormData.layanan_utama?.bundling || 0) > 0;
    const hasPayment = currentFormData.tata_cara_pembayaran?.method_type;
    const hasContact = currentFormData.kontak_person_telkom?.nama;
    const hasPeriod = currentFormData.jangka_waktu?.mulai && currentFormData.jangka_waktu?.akhir;

    return [
      {
        name: 'Informasi Pelanggan',
        completed: hasCustomerInfo ? 1 : 0,
        total: 1,
        errors: errors.informasi_pelanggan ? 1 : 0,
        required: true,
      },
      {
        name: 'Layanan Utama',
        completed: hasServices ? 1 : 0,
        total: 1,
        errors: errors.layanan_utama ? 1 : 0,
        required: true,
      },
      {
        name: 'Rincian Layanan',
        completed: currentFormData.rincian_layanan?.length || 0,
        total: Math.max(1, currentFormData.rincian_layanan?.length || 0),
        errors: errors.rincian_layanan ? 1 : 0,
        required: false,
      },
      {
        name: 'Tata Cara Pembayaran',
        completed: hasPayment ? 1 : 0,
        total: 1,
        errors: errors.tata_cara_pembayaran ? 1 : 0,
        required: false,
      },
      {
        name: 'Kontak Telkom',
        completed: hasContact ? 1 : 0,
        total: 1,
        errors: errors.kontak_person_telkom ? 1 : 0,
        required: false,
      },
      {
        name: 'Jangka Waktu',
        completed: hasPeriod ? 1 : 0,
        total: 1,
        errors: errors.jangka_waktu ? 1 : 0,
        required: false,
      },
    ];
  }, [currentFormData, errors]);

  const canConfirmData = canConfirmContract(formToBackend(currentFormData));

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
        {/* Form Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Form Review Data Ekstraksi</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Review dan edit data hasil ekstraksi sebelum konfirmasi
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Save Status */}
                {isSaving ? (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </div>
                ) : lastSaveTime ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Tersimpan {lastSaveTime.toLocaleTimeString()}
                  </div>
                ) : null}

                {/* Validation Status */}
                <Badge
                  variant={canConfirmData.canConfirm ? "default" : "secondary"}
                  className={canConfirmData.canConfirm ? "bg-green-600" : ""}
                >
                  {canConfirmData.canConfirm ? "Siap Konfirmasi" : "Perlu Review"}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Form Summary */}
        <FormSummary sections={formSections} />

        {/* Form Sections */}
        <div className="space-y-6">
          <CustomerInfoSection
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
          />

          <MainServicesSection
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
          />

          <ServiceDetailsSection
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
            control={control}
          />

          <PaymentMethodSection
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
          />

          <TelkomContactSection
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
          />

          <ContractPeriodSection
            register={register}
            errors={errors}
            setValue={setValue}
            watch={watch}
          />
        </div>

        {/* Action Buttons */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={disabled || discardMutation.isPending}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Batalkan
              </Button>

              <Button
                onClick={handleConfirm}
                disabled={
                  disabled ||
                  !canConfirmData.canConfirm ||
                  confirmMutation.isPending ||
                  isSaving
                }
                className="flex items-center gap-2"
              >
                {confirmMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Mengkonfirmasi...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Konfirmasi Data
                  </>
                )}
              </Button>
            </div>

            {/* Validation Errors */}
            {!canConfirmData.canConfirm && canConfirmData.errors.length > 0 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">
                      Diperlukan perbaikan sebelum konfirmasi:
                    </p>
                    <ul className="mt-1 text-sm text-orange-700 list-disc list-inside">
                      {canConfirmData.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Form Instructions */}
            <div className="mt-4 text-xs text-muted-foreground">
              <p>
                💡 <strong>Tips:</strong> Form akan tersimpan otomatis saat Anda mengetik.
                Pastikan semua field wajib terisi sebelum konfirmasi.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </FormProvider>
  );
}