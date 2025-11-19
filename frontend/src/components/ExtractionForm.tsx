import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, AlertCircle, RefreshCw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
import { useUpdateExtraction, useConfirmExtraction, useDiscardExtraction } from '@/hooks/useExtraction';

// Field path to user-friendly label mapping for error messages
const fieldLabels: Record<string, string> = {
  // Customer Information
  'informasi_pelanggan.nama_pelanggan': 'Nama Pelanggan',
  'informasi_pelanggan.alamat': 'Alamat Pelanggan',
  'informasi_pelanggan.npwp': 'NPWP',
  'informasi_pelanggan.perwakilan.nama': 'Nama Perwakilan',
  'informasi_pelanggan.perwakilan.jabatan': 'Jabatan Perwakilan',
  'informasi_pelanggan.kontak_person.nama': 'Nama Kontak Person Pelanggan',
  'informasi_pelanggan.kontak_person.jabatan': 'Jabatan Kontak Person Pelanggan',
  'informasi_pelanggan.kontak_person.email': 'Email Kontak Person Pelanggan',
  'informasi_pelanggan.kontak_person.telepon': 'Telepon Kontak Person Pelanggan',

  // Main Services
  'layanan_utama': 'Layanan Utama',
  'layanan_utama.connectivity_telkom': 'Jumlah Layanan Connectivity',
  'layanan_utama.non_connectivity_telkom': 'Jumlah Layanan Non-Connectivity',
  'layanan_utama.bundling': 'Jumlah Layanan Bundling',

  // Service Details
  'rincian_layanan': 'Rincian Layanan',
  'rincian_layanan.biaya_instalasi': 'Biaya Instalasi',
  'rincian_layanan.biaya_langganan_tahunan': 'Biaya Langganan Tahunan',

  // Payment Method
  'tata_cara_pembayaran': 'Tata Cara Pembayaran',
  'tata_cara_pembayaran.method_type': 'Metode Pembayaran',
  'tata_cara_pembayaran.termin_payments': 'Pembayaran Termin',

  // Telkom Contact
  'kontak_person_telkom.nama': 'Nama Kontak Person Telkom',
  'kontak_person_telkom.jabatan': 'Jabatan Kontak Person Telkom',
  'kontak_person_telkom.email': 'Email Kontak Person Telkom',
  'kontak_person_telkom.telepon': 'Telepon Kontak Person Telkom',

  // Contract Period
  'jangka_waktu': 'Jangka Waktu Kontrak',
  'jangka_waktu.mulai': 'Tanggal Mulai Kontrak',
  'jangka_waktu.akhir': 'Tanggal Akhir Kontrak',
  'jangka_waktu.mulai.format': 'Format Tanggal Mulai',
  'jangka_waktu.akhir.format': 'Format Tanggal Akhir',
};

interface ExtractionFormProps {
  jobId: number;
  initialData: TelkomContractData; // Backend data format
  onSave?: (data: TelkomContractData) => void; // Save as backend format
  onConfirm?: (data?: TelkomContractData) => void; // Optional data parameter for contract mode
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

  // Mutations
  const confirmMutation = useConfirmExtraction();
  const discardMutation = useDiscardExtraction();
  const updateMutation = useUpdateExtraction(jobId);

  // Watch all form data
  const currentFormData = watch();

  // Reset form when initial data changes (transform to form format)
  React.useEffect(() => {
    const newFormData = backendToForm(initialData);
    reset(newFormData);
    // Trigger validation to sync isValid state
    form.trigger();
  }, [initialData, reset, form.trigger]);

  // Debug: Track form initialization
  React.useEffect(() => {
    const formData = backendToForm(initialData);
    console.log('🔍 Form Initialized with OCR Data:', {
      npwp: formData.informasi_pelanggan?.npwp,
      npwpLength: (formData.informasi_pelanggan?.npwp || '').length,
      npwpIsNumeric: /^\d+$/.test(formData.informasi_pelanggan?.npwp || ''),
    });
  }, [initialData]);

  // Debug: Track form validation state
  React.useEffect(() => {
    console.log('🔍 Form Validation State:', {
      isValid: isValid,
      isDirty: isDirty,
      errorKeys: Object.keys(errors),
      npwpValue: currentFormData.informasi_pelanggan?.npwp,
      npwpError: errors.informasi_pelanggan?.npwp?.message,
    });
  }, [currentFormData, isValid, isDirty, errors]);

  // Trigger initial validation on mount
  React.useEffect(() => {
    form.trigger();
  }, []);

  // Manual save handler for job mode
  const handleManualSave = async () => {
    try {
      const isFormValid = await form.trigger();
      if (!isFormValid) {
        toast.error('Silakan perbaiki kesalahan validasi sebelum menyimpan');
        return;
      }

      const currentFormData = form.getValues();
      const backendData = formToBackend(currentFormData);

      if (mode === 'job') {
        await updateMutation.mutateAsync(backendData);
        toast.success('Draft berhasil disimpan');
      } else if (mode === 'contract' && onSave) {
        onSave(backendData);
      }
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Gagal menyimpan draft');
    }
  };

  // Confirm handler
  const handleConfirm = async () => {
    try {
      const isFormValid = await form.trigger();
      if (!isFormValid) {
        alert('Silakan perbaiki kesalahan validasi sebelum konfirmasi');
        return;
      }

      const currentFormData = form.getValues();
      const backendData = formToBackend(currentFormData);
      const { canConfirm, errors: validationErrors } = canConfirmContract(backendData);
      if (!canConfirm) {
        alert(`Tidak dapat mengkonfirmasi:\n${validationErrors.join('\n')}`);
        return;
      }

      if (mode === 'job') {
        // IMPORTANT: Save the edited data first before confirming
        // The confirm endpoint reads edited_data from the database
        await updateMutation.mutateAsync(backendData);
        // Then confirm (backend will create contract from saved edited_data)
        confirmMutation.mutate(jobId);
        onConfirm?.();
      } else if (mode === 'contract') {
        // IMPORTANT: For contract mode, pass data directly to onConfirm
        // to avoid async state update issues
        onConfirm?.(backendData);
      }
    } catch (error) {
      console.error('Confirm failed:', error);
      alert('Gagal mengkonfirmasi data');
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
        completed: hasCustomerInfo && !errors.informasi_pelanggan ? 1 : 0,
        total: 1,
        errors: errors.informasi_pelanggan ? 1 : 0,
        required: true,
      },
      {
        name: 'Layanan Utama',
        completed: hasServices && !errors.layanan_utama ? 1 : 0,
        total: 1,
        errors: errors.layanan_utama ? 1 : 0,
        required: true,
      },
      {
        name: 'Rincian Layanan',
        completed: currentFormData.rincian_layanan?.length || 0,
        total: Math.max(1, currentFormData.rincian_layanan?.length || 0),
        errors: errors.rincian_layanan ? 1 : 0,
        required: true,
      },
      {
        name: 'Tata Cara Pembayaran',
        completed: hasPayment && !errors.tata_cara_pembayaran ? 1 : 0,
        total: 1,
        errors: errors.tata_cara_pembayaran ? 1 : 0,
        required: true,
      },
      {
        name: 'Kontak Telkom',
        completed: hasContact && !errors.kontak_person_telkom ? 1 : 0,
        total: 1,
        errors: errors.kontak_person_telkom ? 1 : 0,
        required: false,
      },
      {
        name: 'Jangka Waktu',
        completed: hasPeriod && !errors.jangka_waktu ? 1 : 0,
        total: 1,
        errors: errors.jangka_waktu ? 1 : 0,
        required: true,
      },
    ];
  }, [currentFormData, errors]);

  // Debug: Track formSections calculation
  React.useEffect(() => {
    console.log('🔍 Form Sections Summary:', {
      sections: formSections,
      totalCompleted: formSections.reduce((sum, s) => sum + s.completed, 0),
      totalErrors: formSections.reduce((sum, s) => sum + s.errors, 0),
      npwpError: errors.informasi_pelanggan?.npwp,
    });
  }, [formSections, errors]);

  // Calculate if form can be confirmed, with error handling to prevent crashes
  // when user is editing incomplete data (e.g., partial email or phone)
  const canConfirmData = React.useMemo(() => {
    try {
      return canConfirmContract(formToBackend(currentFormData));
    } catch (error) {
      // Extract detailed validation errors from ZodError
      if (error instanceof z.ZodError) {
        const detailedErrors = error.issues.map((issue) => {
          const fieldPath = issue.path.join('.');
          const fieldLabel = fieldLabels[fieldPath] || fieldPath;
          return `${fieldLabel}: ${issue.message}`;
        });
        return {
          canConfirm: false,
          errors: detailedErrors.length > 0 ? detailedErrors : ['Data masih perlu dilengkapi']
        };
      }
      // Fallback for non-Zod errors
      return { canConfirm: false, errors: ['Data masih perlu dilengkapi'] };
    }
  }, [currentFormData]);

  // Debug: Track canConfirmData calculation
  React.useEffect(() => {
    console.log('🔍 Can Confirm Data:', {
      canConfirm: canConfirmData.canConfirm,
      validationErrors: canConfirmData.errors,
      confirmButtonDisabled: !isValid || !canConfirmData.canConfirm,
    });
  }, [canConfirmData, isValid]);

  return (
    <FormProvider {...form}>
      <div className="space-y-6">
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

          <ContractPeriodSection
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
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="group"
        >
          <Card className={cn(
            'rounded-[1.25rem] border border-border/70 shadow-sm',
            'transition-all duration-200',
            'group-hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)]',
            'group-hover:border-[#d71920]/40'
          )}>
            <CardContent className="p-5">
              {/* Validation Errors */}
              {!canConfirmData.canConfirm && canConfirmData.errors.length > 0 && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
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

              {/* Button Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Cancel Button */}
                <Button
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={disabled || discardMutation.isPending}
                  className="h-12 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                >
                  <X className="w-4 h-4 mr-2" />
                  Batalkan
                </Button>

                {/* Save Draft Button - only show for job mode */}
                {mode === 'job' ? (
                  <Button
                    variant="outline"
                    onClick={handleManualSave}
                    disabled={disabled || !isValid || !isDirty || updateMutation.isPending}
                    className="h-12 flex items-center justify-center gap-2 border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Simpan Draft
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="hidden sm:block" /> // Empty space for grid alignment in contract mode
                )}

                {/* Confirm Button */}
                <Button
                  onClick={handleConfirm}
                  disabled={
                    disabled ||
                    !isValid ||
                    !canConfirmData.canConfirm ||
                    confirmMutation.isPending
                  }
                  className="h-12 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90"
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
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </FormProvider>
  );
}