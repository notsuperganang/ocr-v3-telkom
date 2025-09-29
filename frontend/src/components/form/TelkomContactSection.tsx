import React from 'react';
import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Phone, Mail, User, Building2 } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TelkomContractFormData } from '@/lib/validation';
import { formatPhone } from '@/lib/validation';

interface TelkomContactSectionProps {
  register: UseFormRegister<TelkomContractFormData>;
  errors: FieldErrors<TelkomContractFormData>;
  setValue: UseFormSetValue<TelkomContractFormData>;
  watch: UseFormWatch<TelkomContractFormData>;
}

export function TelkomContactSection({
  register,
  errors,
  setValue,
  watch,
}: TelkomContactSectionProps) {
  const telkomPhoneValue = watch('kontak_person_telkom.telepon');

  // Handle phone formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    setValue('kontak_person_telkom.telepon', value);
  };

  // Format phone for display
  const displayPhone = telkomPhoneValue ? formatPhone(telkomPhoneValue) : '';

  return (
    <FormSection
      title="Kontak Person Telkom"
      description="Informasi kontak person dari pihak Telkom yang menangani kontrak ini"
      icon={<Building2 className="w-5 h-5" />}
    >
      <div className="space-y-6">
        {/* Contact Name */}
        <div className="space-y-2">
          <Label htmlFor="telkom_contact_name" className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4" />
            Nama Kontak Person
          </Label>
          <Input
            id="telkom_contact_name"
            {...register('kontak_person_telkom.nama')}
            placeholder="Nama lengkap kontak person Telkom"
            className={errors.kontak_person_telkom?.nama ? 'border-red-500' : ''}
          />
          {errors.kontak_person_telkom?.nama && (
            <p className="text-xs text-red-500">
              {errors.kontak_person_telkom.nama.message}
            </p>
          )}
        </div>

        {/* Position/Title */}
        <div className="space-y-2">
          <Label htmlFor="telkom_contact_position" className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Jabatan
          </Label>
          <Input
            id="telkom_contact_position"
            {...register('kontak_person_telkom.jabatan')}
            placeholder="Contoh: Account Manager, Sales Executive"
            className={errors.kontak_person_telkom?.jabatan ? 'border-red-500' : ''}
          />
          {errors.kontak_person_telkom?.jabatan && (
            <p className="text-xs text-red-500">
              {errors.kontak_person_telkom.jabatan.message}
            </p>
          )}
        </div>

        {/* Contact Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="telkom_contact_email" className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <Input
              id="telkom_contact_email"
              type="email"
              {...register('kontak_person_telkom.email', {
                pattern: {
                  value: /^\S+@\S+$/i,
                  message: 'Format email tidak valid',
                },
              })}
              placeholder="email@telkom.co.id"
              className={errors.kontak_person_telkom?.email ? 'border-red-500' : ''}
            />
            {errors.kontak_person_telkom?.email && (
              <p className="text-xs text-red-500">
                {errors.kontak_person_telkom.email.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="telkom_contact_phone" className="text-sm font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Nomor Telepon
            </Label>
            <Input
              id="telkom_contact_phone"
              value={telkomPhoneValue || ''}
              onChange={handlePhoneChange}
              placeholder="08xxxxxxxxxx atau 021xxxxxxxx"
              className={errors.kontak_person_telkom?.telepon ? 'border-red-500' : ''}
            />
            {displayPhone && displayPhone !== telkomPhoneValue && (
              <p className="text-xs text-muted-foreground">
                Format: {displayPhone}
              </p>
            )}
            {errors.kontak_person_telkom?.telepon && (
              <p className="text-xs text-red-500">
                {errors.kontak_person_telkom.telepon.message}
              </p>
            )}
          </div>
        </div>

        {/* Contact Summary */}
        {(watch('kontak_person_telkom.nama') ||
          watch('kontak_person_telkom.jabatan') ||
          watch('kontak_person_telkom.email') ||
          watch('kontak_person_telkom.telepon')) && (
          <div className="border-t pt-4">
            <div className="p-4 bg-blue-50/50 rounded-lg">
              <h4 className="font-medium text-sm mb-3">Ringkasan Kontak:</h4>
              <div className="space-y-2 text-sm">
                {watch('kontak_person_telkom.nama') && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{watch('kontak_person_telkom.nama')}</span>
                    {watch('kontak_person_telkom.jabatan') && (
                      <span className="text-muted-foreground">
                        - {watch('kontak_person_telkom.jabatan')}
                      </span>
                    )}
                  </div>
                )}

                {watch('kontak_person_telkom.email') && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{watch('kontak_person_telkom.email')}</span>
                  </div>
                )}

                {displayPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{displayPhone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Information Note */}
        <div className="bg-blue-50/50 p-4 rounded-lg">
          <h5 className="font-medium text-sm mb-2">Informasi Kontak Person Telkom:</h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Kontak person adalah perwakilan resmi Telkom yang bertanggung jawab atas kontrak ini.</li>
            <li>• Informasi kontak digunakan untuk koordinasi teknis dan administratif.</li>
            <li>• Pastikan informasi kontak valid dan aktif selama masa kontrak.</li>
            <li>• Kontak person biasanya dari divisi Enterprise, Government, atau Regional sesuai segmen pelanggan.</li>
          </ul>
        </div>
      </div>
    </FormSection>
  );
}