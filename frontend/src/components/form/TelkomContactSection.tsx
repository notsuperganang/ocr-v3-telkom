import React from 'react';
import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Phone, Mail, User, Building2, AlertCircle } from 'lucide-react';
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
  const telkomEmailValue = watch('kontak_person_telkom.email');

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

  // Handle phone formatting
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    setValue('kontak_person_telkom.telepon', value, { shouldDirty: true });
  };

  // Format phone for display
  const displayPhone = telkomPhoneValue ? formatPhone(telkomPhoneValue) : '';

  return (
    <FormSection
      title="Kontak Person Telkom"
      description="Informasi kontak person dari pihak Telkom yang menangani kontrak ini"
      icon={<Building2 className="w-5 h-5" />}
      isRequired={false}
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
              className={
                errors.kontak_person_telkom?.email
                  ? 'border-red-500'
                  : telkomEmailValue && !isValidEmail(telkomEmailValue)
                  ? 'border-orange-300'
                  : ''
              }
            />
            {/* Validation indicator - shown when typing invalid email */}
            {telkomEmailValue && !isValidEmail(telkomEmailValue) && !errors.kontak_person_telkom?.email && (
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-orange-500 mt-0.5" />
                <p className="text-xs text-orange-600">
                  Format email harus valid (contoh: nama@telkom.co.id)
                </p>
              </div>
            )}
            {errors.kontak_person_telkom?.email && (
              <p className="text-xs text-red-500">
                {errors.kontak_person_telkom.email.message}
              </p>
            )}
            {/* Format guide */}
            {!telkomEmailValue && (
              <p className="text-xs text-muted-foreground">
                Format: nama@telkom.co.id
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
              className={
                errors.kontak_person_telkom?.telepon
                  ? 'border-red-500'
                  : telkomPhoneValue && !isValidPhone(telkomPhoneValue)
                  ? 'border-orange-300'
                  : ''
              }
            />
            {/* Validation indicator - shown when typing invalid phone */}
            {telkomPhoneValue && !isValidPhone(telkomPhoneValue) && !errors.kontak_person_telkom?.telepon && (
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-orange-500 mt-0.5" />
                <p className="text-xs text-orange-600">
                  Format: 08xxxxxxxxxx atau 021xxxxxxxx (minimal 10 digit)
                </p>
              </div>
            )}
            {displayPhone && displayPhone !== telkomPhoneValue && (
              <p className="text-xs text-muted-foreground">
                Preview: {displayPhone}
              </p>
            )}
            {errors.kontak_person_telkom?.telepon && (
              <p className="text-xs text-red-500">
                {errors.kontak_person_telkom.telepon.message}
              </p>
            )}
            {/* Format guide */}
            {!telkomPhoneValue && (
              <p className="text-xs text-muted-foreground">
                Format: 08xxxxxxxxxx, 021xxxxxxxx, atau +628xxxxxxxxxx
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

      </div>
    </FormSection>
  );
}