import React from 'react';
import { useForm, FormProvider, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, AlertCircle, RefreshCw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorSummaryOverlay, type ErrorItem } from '@/components/ui/error-summary-overlay';
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
import { AccountLinkageSection } from '@/components/form/AccountLinkageSection';
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
import type { AccountManagerResponse } from '@/types/api';

// Field path prefix to section ID mapping for scroll-to-error
const fieldToSectionId: Record<string, string> = {
  'informasi_pelanggan': 'section-informasi-pelanggan',
  'layanan_utama': 'section-layanan-utama',
  'rincian_layanan': 'section-rincian-layanan',
  'tata_cara_pembayaran': 'section-tata-cara-pembayaran',
  'kontak_person_telkom': 'section-kontak-person-telkom',
  'jangka_waktu': 'section-jangka-waktu',
  'account_linkage': 'section-account-linkage',
};

// Helper function to flatten nested React Hook Form errors into ErrorItem array
function flattenFormErrors(
  errors: FieldErrors<TelkomContractFormData>,
  parentPath: string = ''
): ErrorItem[] {
  const result: ErrorItem[] = [];

  for (const key in errors) {
    const error = errors[key as keyof typeof errors];
    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    if (error) {
      // Check if this is a leaf error (has message property)
      if ('message' in error && typeof error.message === 'string' && error.message) {
        // For termin payments, add context to the message
        let message = error.message;
        if (currentPath.includes('termin_payments')) {
          const match = currentPath.match(/\.(\d+)\./);
          const index = match ? parseInt(match[1]) + 1 : 1;
          if (currentPath.includes('period')) {
            message = `Periode termin ${index} ${message.toLowerCase()}`;
          } else if (currentPath.includes('amount')) {
            message = `Jumlah termin ${index} ${message.toLowerCase()}`;
          }
        }

        result.push({
          fieldPath: currentPath,
          message,
        });
      }
      // Check if this is an array of errors (like rincian_layanan or termin_payments)
      // React Hook Form stores array errors as objects with numeric keys, not actual arrays
      else if (Array.isArray(error)) {
        error.forEach((item, index) => {
          if (item && typeof item === 'object') {
            const nestedErrors = flattenFormErrors(
              item as FieldErrors<TelkomContractFormData>,
              `${currentPath}.${index}`
            );
            result.push(...nestedErrors);
          }
        });
      }
      // Recursively handle nested objects (including array-like objects with numeric keys)
      else if (typeof error === 'object') {
        // Check if this is an array-like object with numeric keys (React Hook Form's array error format)
        const keys = Object.keys(error);
        const isArrayLike = keys.length > 0 && keys.every(k => /^\d+$/.test(k));

        if (isArrayLike) {
          // Handle as array-like object
          keys.forEach(indexKey => {
            const item = (error as Record<string, unknown>)[indexKey];
            if (item && typeof item === 'object') {
              const nestedErrors = flattenFormErrors(
                item as FieldErrors<TelkomContractFormData>,
                `${currentPath}.${indexKey}`
              );
              result.push(...nestedErrors);
            }
          });
        } else {
          // Regular nested object
          const nestedErrors = flattenFormErrors(
            error as FieldErrors<TelkomContractFormData>,
            currentPath
          );
          result.push(...nestedErrors);
        }
      }
    }
  }

  return result;
}

// Helper function to deduplicate errors by message
function deduplicateErrors(errors: ErrorItem[]): ErrorItem[] {
  const seen = new Set<string>();
  return errors.filter(error => {
    if (seen.has(error.message)) {
      return false;
    }
    seen.add(error.message);
    return true;
  });
}

interface ExtractionFormProps {
  jobId: number;
  initialData: TelkomContractData; // Backend data format
  onSave?: (data: TelkomContractData) => void; // Save as backend format
  onConfirm?: (data?: TelkomContractData) => void; // Optional data parameter for contract mode
  onDiscard?: () => void;
  disabled?: boolean;
  mode?: 'job' | 'contract'; // 'job' for processing jobs, 'contract' for editing contracts
  // Account linkage initial values (for contract edit mode)
  initialAccountId?: number | null;
  initialContractYear?: number | null;
  initialTelkomContactId?: number | null;
  // Callback for account linkage changes (for contract edit mode)
  onAccountLinkageChange?: (data: { accountId: number | null; contractYear: number; telkomContactId: number | null }) => void;
  // Callback for form dirty state changes (for contract edit mode)
  onDirtyChange?: (isDirty: boolean) => void;
}

export function ExtractionForm({
  jobId,
  initialData,
  onSave,
  onConfirm,
  onDiscard,
  disabled = false,
  mode = 'job',
  initialAccountId,
  initialContractYear,
  initialTelkomContactId,
  onAccountLinkageChange,
  onDirtyChange,
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

  // Account linkage state (used in both job and contract modes)
  const [accountId, setAccountId] = React.useState<number | null>(initialAccountId ?? null);
  const [contractYear, setContractYear] = React.useState<number | null>(initialContractYear ?? null);
  const [telkomContactId, setTelkomContactId] = React.useState<number | null>(initialTelkomContactId ?? null);
  
  // Linked Account Manager state (derived from selected account)
  const [linkedAccountManager, setLinkedAccountManager] = React.useState<AccountManagerResponse | null>(null);
  
  const [linkageErrors, setLinkageErrors] = React.useState<{
    accountId?: string;
    contractYear?: string;
  }>({});

  // Handle Account Manager data from AccountLinkageSection
  const handleAccountManagerData = React.useCallback((amData: AccountManagerResponse | null) => {
    setLinkedAccountManager(amData);
    
    // Auto-set telkomContactId to AM's id
    setTelkomContactId(amData?.id ?? null);
    
    // Auto-populate Telkom Contact fields
    if (amData) {
      setValue('kontak_person_telkom.nama', amData.name || '', { shouldDirty: true });
      setValue('kontak_person_telkom.jabatan', amData.title || '', { shouldDirty: true });
      setValue('kontak_person_telkom.email', amData.email || '', { shouldDirty: true });
      setValue('kontak_person_telkom.telepon', amData.phone || '', { shouldDirty: true });
    } else {
      // Clear fields when no AM
      setValue('kontak_person_telkom.nama', '', { shouldDirty: true });
      setValue('kontak_person_telkom.jabatan', '', { shouldDirty: true });
      setValue('kontak_person_telkom.email', '', { shouldDirty: true });
      setValue('kontak_person_telkom.telepon', '', { shouldDirty: true });
    }
  }, [setValue]);

  // Watch all form data
  const currentFormData = watch();

  // Notify parent of form dirty state changes
  React.useEffect(() => {
    if (mode === 'contract' && onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, mode, onDirtyChange]);

  // Derive default contract year from period_start
  const defaultContractYear = React.useMemo(() => {
    const periodStart = currentFormData.jangka_waktu?.mulai;
    if (periodStart) {
      const year = parseInt(periodStart.split('-')[0], 10);
      if (!isNaN(year) && year >= 2020 && year <= 2100) {
        return year;
      }
    }
    return new Date().getFullYear();
  }, [currentFormData.jangka_waktu?.mulai]);

  // Notify parent of account linkage changes (for contract edit mode)
  React.useEffect(() => {
    if (mode === 'contract' && onAccountLinkageChange) {
      const yearToUse = contractYear ?? defaultContractYear;
      if (yearToUse) {
        onAccountLinkageChange({
          accountId,
          contractYear: yearToUse,
          telkomContactId,
        });
      }
    }
  }, [accountId, contractYear, telkomContactId, mode, onAccountLinkageChange, defaultContractYear]);

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
        // Validate account linkage (contract_year is required)
        const yearToUse = contractYear ?? defaultContractYear;
        const newLinkageErrors: typeof linkageErrors = {};

        if (!yearToUse || yearToUse < 2020 || yearToUse > 2100) {
          newLinkageErrors.contractYear = 'Tahun kontrak wajib diisi (2020-2100)';
        }

        if (Object.keys(newLinkageErrors).length > 0) {
          setLinkageErrors(newLinkageErrors);
          alert('Silakan lengkapi data penghubungan akun (tahun kontrak wajib diisi)');
          // Scroll to account linkage section
          const element = document.getElementById('section-account-linkage');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return;
        }

        setLinkageErrors({});

        // IMPORTANT: Save the edited data first before confirming
        // The confirm endpoint reads edited_data from the database
        await updateMutation.mutateAsync(backendData);
        // Then confirm with account linkage data
        confirmMutation.mutate({
          jobId: jobId,
          accountId: accountId,
          contractYear: yearToUse,
          telkomContactId: telkomContactId,
        });
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

    // Check if rincian_layanan has valid data (biaya_langganan_tahunan > 0)
    const hasValidServiceDetails = currentFormData.rincian_layanan?.length > 0 &&
                                   (currentFormData.rincian_layanan[0]?.biaya_langganan_tahunan || 0) > 0;

    return [
      // Account section at the top
      {
        name: 'Akun',
        completed: (contractYear ?? defaultContractYear) ? 1 : 0,
        total: 1,
        errors: linkageErrors.contractYear ? 1 : 0,
        required: true,
      },
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
        completed: hasValidServiceDetails && !errors.rincian_layanan ? 1 : 0,
        total: 1,
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
  }, [currentFormData, errors, contractYear, defaultContractYear, linkageErrors]);

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
      const result = canConfirmContract(formToBackend(currentFormData));
      if (!result.canConfirm) {
        // Clean up error messages from canConfirmContract
        const cleanedErrors = result.errors.map((error) => {
          // Parse "path → subpath: message" format and extract just the message
          const pathMatch = error.match(/^(.+?):\s*(.+)$/);
          if (pathMatch) {
            return pathMatch[2].trim();
          }
          return error;
        });
        return { canConfirm: false, errors: cleanedErrors };
      }
      return result;
    } catch (error) {
      // Extract detailed validation errors from ZodError
      if (error instanceof z.ZodError) {
        const detailedErrors = error.issues.map((issue) => {
          const fieldPath = issue.path.join('.');

          // For termin payments, add context to the message
          let message = issue.message;
          if (fieldPath.includes('termin_payments')) {
            const match = fieldPath.match(/\.(\d+)\./);
            const index = match ? parseInt(match[1]) + 1 : 1;
            if (fieldPath.includes('period')) {
              message = `Periode termin ${index} ${message.toLowerCase()}`;
            } else if (fieldPath.includes('amount')) {
              message = `Jumlah termin ${index} ${message.toLowerCase()}`;
            }
          }

          return message;
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

  // Create error items with field paths for the overlay
  // Merges both React Hook Form errors and canConfirmContract business logic errors
  const errorItems: ErrorItem[] = React.useMemo(() => {
    const allErrors: ErrorItem[] = [];

    // 1. Get React Hook Form errors (format validation: NPWP, email, phone, termin format)
    const formErrors = flattenFormErrors(errors);
    allErrors.push(...formErrors);

    // 2. Get canConfirmContract business logic errors
    try {
      const result = canConfirmContract(formToBackend(currentFormData));
      if (!result.canConfirm) {
        // Parse canConfirmContract errors and extract field paths
        result.errors.forEach((error) => {
          // canConfirmContract errors have format "path → subpath: message"
          let fieldPath = 'informasi_pelanggan'; // Default section
          let message = error;

          // Check if error has path format "path → subpath: message"
          const pathMatch = error.match(/^(.+?):\s*(.+)$/);
          if (pathMatch) {
            const rawPath = pathMatch[1].trim();
            message = pathMatch[2].trim(); // Just use the message part

            // Convert "informasi_pelanggan → nama_pelanggan" to "informasi_pelanggan.nama_pelanggan"
            const normalizedPath = rawPath.replace(/\s*→\s*/g, '.');

            // Determine section for scroll-to
            if (normalizedPath.includes('informasi_pelanggan')) {
              fieldPath = 'informasi_pelanggan';
            } else if (normalizedPath.includes('layanan_utama')) {
              fieldPath = 'layanan_utama';
            } else if (normalizedPath.includes('rincian_layanan')) {
              fieldPath = 'rincian_layanan';
            } else if (normalizedPath.includes('tata_cara_pembayaran')) {
              fieldPath = 'tata_cara_pembayaran';
            } else if (normalizedPath.includes('jangka_waktu')) {
              fieldPath = 'jangka_waktu';
            } else if (normalizedPath.includes('kontak_person_telkom')) {
              fieldPath = 'kontak_person_telkom';
            }
          }

          allErrors.push({
            fieldPath,
            message,
          });
        });
      }
    } catch (zodError) {
      // If formToBackend fails with ZodError, add those errors too
      if (zodError instanceof z.ZodError) {
        zodError.issues.forEach((issue) => {
          const fieldPath = issue.path.join('.');

          // For termin payments, add context to the message
          let message = issue.message;
          if (fieldPath.includes('termin_payments')) {
            const match = fieldPath.match(/\.(\d+)\./);
            const index = match ? parseInt(match[1]) + 1 : 1;
            if (fieldPath.includes('period')) {
              message = `Periode termin ${index} ${message.toLowerCase()}`;
            } else if (fieldPath.includes('amount')) {
              message = `Jumlah termin ${index} ${message.toLowerCase()}`;
            }
          }

          allErrors.push({
            fieldPath,
            message,
          });
        });
      }
    }

    // 3. Deduplicate errors by message
    return deduplicateErrors(allErrors);
  }, [currentFormData, errors]);

  // Scroll to section when clicking an error
  const scrollToSection = (fieldPath: string) => {
    const sectionKey = fieldPath.split('.')[0];
    const sectionId = fieldToSectionId[sectionKey];
    const element = document.getElementById(sectionId);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

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
          {/* Account Linkage Section - shown at the top */}
          <div id="section-account-linkage">
            <AccountLinkageSection
              accountId={accountId}
              contractYear={contractYear}
              onAccountChange={setAccountId}
              onContractYearChange={setContractYear}
              onAccountManagerData={handleAccountManagerData}
              defaultContractYear={defaultContractYear}
              errors={linkageErrors}
            />
          </div>

          <div id="section-informasi-pelanggan">
            <CustomerInfoSection
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
            />
          </div>

          <div id="section-layanan-utama">
            <MainServicesSection
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
            />
          </div>

          <div id="section-rincian-layanan">
            <ServiceDetailsSection
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
              control={control}
            />
          </div>

          <div id="section-tata-cara-pembayaran">
            <PaymentMethodSection
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
            />
          </div>

          <div id="section-jangka-waktu">
            <ContractPeriodSection
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
            />
          </div>

          <div id="section-kontak-person-telkom">
            <TelkomContactSection
              register={register}
              errors={errors}
              setValue={setValue}
              watch={watch}
              linkedAccountManager={linkedAccountManager}
            />
          </div>
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

        {/* Error Summary Overlay */}
        <ErrorSummaryOverlay
          errors={errorItems}
          onErrorClick={scrollToSection}
        />
      </div>
    </FormProvider>
  );
}