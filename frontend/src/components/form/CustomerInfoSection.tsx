import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { User, Building, Phone, Mail, IdCard } from 'lucide-react';
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

  // Handle NPWP formatting
  const handleNPWPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.length <= 19) {
      setValue('informasi_pelanggan.npwp', value);
    }
  };

  // Handle phone formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    setValue('informasi_pelanggan.kontak_person.telepon', value);
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

        {/* NPWP */}
        <div className="space-y-2">
          <Label htmlFor="npwp" className="text-sm font-medium flex items-center gap-2">
            <IdCard className="w-4 h-4" />
            NPWP
          </Label>
          <Input
            id="npwp"
            value={npwpValue || ''}
            onChange={handleNPWPChange}
            placeholder="15-19 digit NPWP"
            maxLength={19}
            className={errors.informasi_pelanggan?.npwp ? 'border-red-500' : ''}
          />
          {displayNPWP && displayNPWP !== npwpValue && (
            <p className="text-xs text-muted-foreground">
              Format: {displayNPWP}
            </p>
          )}
          {errors.informasi_pelanggan?.npwp && (
            <p className="text-xs text-red-500">
              {errors.informasi_pelanggan.npwp.message}
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
                className={errors.informasi_pelanggan?.kontak_person?.email ? 'border-red-500' : ''}
              />
              {errors.informasi_pelanggan?.kontak_person?.email && (
                <p className="text-xs text-red-500">
                  {errors.informasi_pelanggan.kontak_person.email.message}
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
                className={errors.informasi_pelanggan?.kontak_person?.telepon ? 'border-red-500' : ''}
              />
              {displayPhone && displayPhone !== customerPhoneValue && (
                <p className="text-xs text-muted-foreground">
                  Format: {displayPhone}
                </p>
              )}
              {errors.informasi_pelanggan?.kontak_person?.telepon && (
                <p className="text-xs text-red-500">
                  {errors.informasi_pelanggan.kontak_person.telepon.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </FormSection>
  );
}