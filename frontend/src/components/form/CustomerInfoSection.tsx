import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { User, Building, Phone, Mail, IdCard, AlertCircle } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TelkomContractFormData } from '@/lib/validation';
import { formatNPWP, formatPhone } from '@/lib/validation';

interface CustomerInfoSectionProps {
  register: UseFormRegister<TelkomContractFormData>;
  errors: FieldErrors<TelkomContractFormData>;
  setValue: UseFormSetValue<TelkomContractFormData>;
  watch: UseFormWatch<TelkomContractFormData>;
}

export function CustomerInfoSection({
  register,
  errors,
  setValue,
  watch,
}: CustomerInfoSectionProps) {
  const npwpValue = watch('informasi_pelanggan.npwp');
  const customerPhoneValue = watch('informasi_pelanggan.kontak_person.telepon');
  const customerEmailValue = watch('informasi_pelanggan.kontak_person.email');

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    if (!email || email.trim() === '') return true; // Empty is valid (optional)
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
  };

  // Phone validation helper (accepts various Indonesian formats)
  const isValidPhone = (phone: string): boolean => {
    if (!phone || phone.trim() === '') return true; // Empty is valid (optional)
    const cleaned = phone.replace(/[^\d+]/g, '');
    return /^(0|62|\+62)[0-9]{8,13}$/.test(cleaned);
  };

  // Handle NPWP formatting
  const handleNPWPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 19) {
      setValue('informasi_pelanggan.npwp', value, {
        shouldDirty: true,
        shouldValidate: true  // Re-validate immediately to clear errors when empty
      });
    }
  };

  // Handle phone formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    setValue('informasi_pelanggan.kontak_person.telepon', value, { shouldDirty: true });
  };

  // Format NPWP for display
  const displayNPWP = npwpValue ? formatNPWP(npwpValue) : '';

  // Format phone for display
  const displayPhone = customerPhoneValue ? formatPhone(customerPhoneValue) : '';

  return (
    <FormSection
      title="Informasi Pelanggan"
      description="Data pelanggan dan perwakilan yang menandatangani kontrak"
      icon={<User className="w-5 h-5" />}
      isRequired={true}
    >
      <div className="space-y-6">
        {/* Customer Name - Required */}
        <div className="space-y-2">
          <Label htmlFor="nama_pelanggan" className="text-sm font-medium">
            Nama Pelanggan <span className="text-red-500">*</span>
          </Label>
          <Input
            id="nama_pelanggan"
            {...register('informasi_pelanggan.nama_pelanggan', {
              required: 'Nama pelanggan wajib diisi',
            })}
            placeholder="Contoh: SMK NEGERI 1 BIREUN"
            className={errors.informasi_pelanggan?.nama_pelanggan ? 'border-red-500' : ''}
          />
          {errors.informasi_pelanggan?.nama_pelanggan && (
            <p className="text-xs text-red-500">
              {errors.informasi_pelanggan.nama_pelanggan.message}
            </p>
          )}
        </div>

        {/* Address - Required */}
        <div className="space-y-2">
          <Label htmlFor="alamat" className="text-sm font-medium">
            Alamat <span className="text-red-500">*</span>
          </Label>
          <textarea
            id="alamat"
            {...register('informasi_pelanggan.alamat', {
              required: 'Alamat wajib diisi',
            })}
            placeholder="Alamat lengkap pelanggan"
            rows={3}
            className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              errors.informasi_pelanggan?.alamat ? 'border-red-500' : ''
            }`}
          />
          {errors.informasi_pelanggan?.alamat && (
            <p className="text-xs text-red-500">
              {errors.informasi_pelanggan.alamat.message}
            </p>
          )}
        </div>

        {/* NPWP - Optional field */}
        <div className="space-y-2">
          <Label htmlFor="npwp" className="text-sm font-medium flex items-center gap-2">
            <IdCard className="w-4 h-4" />
            NPWP
            <span className="text-xs text-muted-foreground font-normal">(Opsional)</span>
          </Label>
          <Input
            id="npwp"
            value={npwpValue || ''}
            onChange={handleNPWPChange}
            placeholder="15, 16, atau 19 digit (kosongkan jika tidak ada)"
            maxLength={19}
            className={errors.informasi_pelanggan?.npwp ? 'border-red-500' : ''}
          />
          {displayNPWP && displayNPWP !== npwpValue && !errors.informasi_pelanggan?.npwp && (
            <p className="text-xs text-muted-foreground">
              Format: {displayNPWP}
            </p>
          )}
          {errors.informasi_pelanggan?.npwp && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.informasi_pelanggan.npwp.message}
            </p>
          )}
          {!errors.informasi_pelanggan?.npwp && npwpValue && (
            <p className="text-xs text-muted-foreground">
              💡 NPWP akan divalidasi saat Anda menyimpan
            </p>
          )}
        </div>

        {/* Representative Information */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Building className="w-4 h-4" />
            Perwakilan
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="perwakilan_nama" className="text-sm font-medium">
                Nama Perwakilan
              </Label>
              <Input
                id="perwakilan_nama"
                {...register('informasi_pelanggan.perwakilan.nama')}
                placeholder="Nama lengkap perwakilan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="perwakilan_jabatan" className="text-sm font-medium">
                Jabatan
              </Label>
              <Input
                id="perwakilan_jabatan"
                {...register('informasi_pelanggan.perwakilan.jabatan')}
                placeholder="Contoh: Kepala Sekolah"
              />
            </div>
          </div>
        </div>

        {/* Contact Person */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Kontak Person
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kontak_nama" className="text-sm font-medium">
                Nama Kontak
              </Label>
              <Input
                id="kontak_nama"
                {...register('informasi_pelanggan.kontak_person.nama')}
                placeholder="Nama kontak person"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kontak_jabatan" className="text-sm font-medium">
                Jabatan
              </Label>
              <Input
                id="kontak_jabatan"
                {...register('informasi_pelanggan.kontak_person.jabatan')}
                placeholder="Jabatan kontak person"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kontak_email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                id="kontak_email"
                type="email"
                {...register('informasi_pelanggan.kontak_person.email', {
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Format email tidak valid',
                  },
                })}
                placeholder="email@domain.com"
                className={
                  errors.informasi_pelanggan?.kontak_person?.email
                    ? 'border-red-500'
                    : customerEmailValue && !isValidEmail(customerEmailValue)
                    ? 'border-orange-300'
                    : ''
                }
              />
              {/* Validation indicator - shown when typing invalid email */}
              {customerEmailValue && !isValidEmail(customerEmailValue) && !errors.informasi_pelanggan?.kontak_person?.email && (
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500 mt-0.5" />
                  <p className="text-xs text-orange-600">
                    Format email harus valid (contoh: nama@domain.com)
                  </p>
                </div>
              )}
              {errors.informasi_pelanggan?.kontak_person?.email && (
                <p className="text-xs text-red-500">
                  {errors.informasi_pelanggan.kontak_person.email.message}
                </p>
              )}
              {/* Format guide */}
              {!customerEmailValue && (
                <p className="text-xs text-muted-foreground">
                  Format: nama@domain.com
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kontak_telepon" className="text-sm font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Telepon
              </Label>
              <Input
                id="kontak_telepon"
                value={customerPhoneValue || ''}
                onChange={handlePhoneChange}
                placeholder="08xxxxxxxxxx"
                className={
                  errors.informasi_pelanggan?.kontak_person?.telepon
                    ? 'border-red-500'
                    : customerPhoneValue && !isValidPhone(customerPhoneValue)
                    ? 'border-orange-300'
                    : ''
                }
              />
              {/* Validation indicator - shown when typing invalid phone */}
              {customerPhoneValue && !isValidPhone(customerPhoneValue) && !errors.informasi_pelanggan?.kontak_person?.telepon && (
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500 mt-0.5" />
                  <p className="text-xs text-orange-600">
                    Format: 08xxxxxxxxxx atau 021xxxxxxxx (minimal 10 digit)
                  </p>
                </div>
              )}
              {displayPhone && displayPhone !== customerPhoneValue && (
                <p className="text-xs text-muted-foreground">
                  Preview: {displayPhone}
                </p>
              )}
              {errors.informasi_pelanggan?.kontak_person?.telepon && (
                <p className="text-xs text-red-500">
                  {errors.informasi_pelanggan.kontak_person.telepon.message}
                </p>
              )}
              {/* Format guide */}
              {!customerPhoneValue && (
                <p className="text-xs text-muted-foreground">
                  Format: 08xxxxxxxxxx, 021xxxxxxxx, atau +628xxxxxxxxxx
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </FormSection>
  );
}