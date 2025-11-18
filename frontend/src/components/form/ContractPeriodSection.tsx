import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Calendar, Clock } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { DateRangePicker } from '@/components/ui/date-picker';
import type { TelkomContractFormData } from '@/lib/validation';
import { format, parse, differenceInDays, differenceInMonths, differenceInYears, isValid } from 'date-fns';
import { id } from 'date-fns/locale';

interface ContractPeriodSectionProps {
  register: UseFormRegister<TelkomContractFormData>;
  errors: FieldErrors<TelkomContractFormData>;
  setValue: UseFormSetValue<TelkomContractFormData>;
  watch: UseFormWatch<TelkomContractFormData>;
}

export function ContractPeriodSection({
  errors,
  setValue,
  watch,
}: ContractPeriodSectionProps) {
  const startDate = watch('jangka_waktu.mulai') || '';
  const endDate = watch('jangka_waktu.akhir') || '';

  // Handle date changes
  const handleStartDateChange = (value: string) => {
    setValue('jangka_waktu.mulai', value, { shouldDirty: true });
  };

  const handleEndDateChange = (value: string) => {
    setValue('jangka_waktu.akhir', value, { shouldDirty: true });
  };

  // Calculate contract duration with smart rounding
  const calculateDuration = () => {
    if (!startDate || !endDate) return null;

    try {
      const start = parse(startDate, 'yyyy-MM-dd', new Date());
      const end = parse(endDate, 'yyyy-MM-dd', new Date());

      if (!isValid(start) || !isValid(end)) return null;

      const days = differenceInDays(end, start);
      const rawMonths = differenceInMonths(end, start);
      const years = differenceInYears(end, start);

      if (days < 0) return { error: 'Tanggal akhir harus setelah tanggal mulai' };

      // Smart rounding logic: if the difference is less than 7 days from a full month, round up
      const exactMonthEnd = new Date(start);
      exactMonthEnd.setMonth(exactMonthEnd.getMonth() + rawMonths + 1);
      const daysDifferenceFromFullMonth = differenceInDays(exactMonthEnd, end);

      // If we're within 7 days of the next full month, round up
      const months = (daysDifferenceFromFullMonth <= 7 && daysDifferenceFromFullMonth >= 0)
        ? rawMonths + 1
        : rawMonths;

      return { days, months, years };
    } catch {
      return null;
    }
  };

  const duration = calculateDuration();

  // Format duration text
  const formatDuration = (duration: { days: number; months: number; years: number }) => {
    if (duration.years > 0) {
      return `${duration.years} tahun ${duration.months % 12} bulan`;
    } else if (duration.months > 0) {
      return `${duration.months} bulan`;
    } else {
      return `${duration.days} hari`;
    }
  };

  // Get formatted date displays
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (isValid(date)) {
        return format(date, 'dd MMMM yyyy', { locale: id });
      }
    } catch {
      // Return original if parsing fails
    }
    return dateStr;
  };

  return (
    <FormSection
      title="Jangka Waktu Kontrak"
      description="Periode berlakunya kontrak dari tanggal mulai hingga tanggal berakhir"
      icon={<Calendar className="w-5 h-5" />}
    >
      <div className="space-y-6">
        {/* Date Range Picker */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          startLabel="Tanggal Mulai Kontrak"
          endLabel="Tanggal Berakhir Kontrak"
          required={true}
          errors={{
            start: errors.jangka_waktu?.mulai?.message,
            end: errors.jangka_waktu?.akhir?.message,
          }}
        />

        {/* Duration Summary */}
        {duration && (
          <div className="border-t pt-4">
            {duration.error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">{duration.error}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-primary/5 rounded-lg">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Durasi Kontrak
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Periode:</div>
                    <div className="text-sm">
                      <div>{formatDisplayDate(startDate)}</div>
                      <div className="text-muted-foreground">s/d</div>
                      <div>{formatDisplayDate(endDate)}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Durasi:</div>
                    <div className="text-lg font-semibold text-primary">
                      {!duration.error && 'days' in duration && duration.days !== undefined && formatDuration(duration as { days: number; months: number; years: number })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ({!duration.error && 'days' in duration && duration.days} hari total)
                    </div>
                  </div>
                </div>

                {/* Contract Type Based on Duration */}
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-1">Kategori Kontrak:</div>
                  <div className="text-sm">
                    {!duration.error && 'years' in duration && duration.years !== undefined && duration.months !== undefined && (
                      duration.years >= 3 ? (
                        <span className="text-green-600 font-medium">Kontrak Jangka Panjang (≥3 tahun)</span>
                      ) : duration.years >= 1 ? (
                        <span className="text-blue-600 font-medium">Kontrak Tahunan (1-2 tahun)</span>
                      ) : duration.months >= 6 ? (
                        <span className="text-orange-600 font-medium">Kontrak Jangka Menengah (6-12 bulan)</span>
                      ) : (
                        <span className="text-purple-600 font-medium">Kontrak Jangka Pendek (&lt;6 bulan)</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contract Timeline Visualization */}
        {startDate && endDate && duration && !duration.error && (
          <div className="border-t pt-4">
            <div className="space-y-3">
              <h5 className="font-medium text-sm">Timeline Kontrak:</h5>

              <div className="relative pb-16">
                {/* Timeline container with proper spacing */}
                <div className="mx-8">
                  {/* Timeline bar */}
                  <div className="h-2 bg-gradient-to-r from-green-200 via-blue-200 to-red-200 rounded-full"></div>

                  {/* Start marker */}
                  <div className="absolute left-0 top-0">
                    <div className="w-3 h-3 bg-green-500 rounded-full ml-6"></div>
                  </div>

                  {/* End marker */}
                  <div className="absolute right-0 top-0">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-6"></div>
                  </div>

                  {/* Current time marker (if within contract period) */}
                  {(() => {
                    const now = new Date();
                    const start = parse(startDate, 'yyyy-MM-dd', new Date());
                    const end = parse(endDate, 'yyyy-MM-dd', new Date());

                    if (now >= start && now <= end) {
                      const totalDays = differenceInDays(end, start);
                      const daysPassed = differenceInDays(now, start);
                      const percentage = Math.max(15, Math.min(85, (daysPassed / totalDays) * 100));

                      return (
                        <div className="absolute top-0" style={{ left: `calc(${percentage}% + 32px)` }}>
                          <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow transform -translate-x-1/2"></div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Labels row - positioned below timeline */}
                <div className="flex justify-between mt-6 text-xs">
                  <div className="text-left">
                    <div className="font-medium">Mulai</div>
                    <div className="text-muted-foreground">{format(parse(startDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yy')}</div>
                  </div>

                  {(() => {
                    const now = new Date();
                    const start = parse(startDate, 'yyyy-MM-dd', new Date());
                    const end = parse(endDate, 'yyyy-MM-dd', new Date());

                    if (now >= start && now <= end) {
                      return (
                        <div className="text-center">
                          <div className="font-medium text-blue-600">Sekarang</div>
                          <div className="text-muted-foreground">{format(now, 'dd/MM/yy')}</div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="text-right">
                    <div className="font-medium">Berakhir</div>
                    <div className="text-muted-foreground">{format(parse(endDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yy')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Guidelines */}
        <div className="bg-blue-50/50 p-4 rounded-lg">
          <h5 className="font-medium text-sm mb-2">Panduan Jangka Waktu Kontrak:</h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Tanggal mulai:</strong> Tanggal efektif berlakunya kontrak (biasanya setelah penandatanganan).</li>
            <li>• <strong>Tanggal berakhir:</strong> Tanggal berakhirnya masa kontrak sebelum perpanjangan.</li>
            <li>• Kontrak jangka panjang (≥3 tahun) biasanya mendapat harga yang lebih kompetitif.</li>
            <li>• Perhatikan klausul perpanjangan otomatis jika ada dalam kontrak.</li>
            <li>• Pastikan periode kontrak sesuai dengan kebutuhan bisnis dan budget planning.</li>
          </ul>
        </div>
      </div>
    </FormSection>
  );
}