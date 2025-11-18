import React from 'react';
import { format, parse, isValid } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Calendar as CalendarIcon, X, AlertCircle, ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  id?: string;
  name?: string;
  label?: string;
  value?: string; // YYYY-MM-DD format
  onChange?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
}

export function DatePicker({
  id,
  label,
  value = '',
  onChange,
  disabled = false,
  required = false,
  error,
  className = '',
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse string value to Date object for Calendar component
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const date = parse(value, 'yyyy-MM-dd', new Date());
      return isValid(date) ? date : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  // Format date for display in button (Indonesian format)
  const displayValue = React.useMemo(() => {
    if (!value) return '';
    try {
      const date = parse(value, 'yyyy-MM-dd', new Date());
      if (isValid(date)) {
        return format(date, 'dd MMMM yyyy', { locale: idLocale });
      }
    } catch {
      // Return empty if can't parse
    }
    return '';
  }, [value]);

  // Handle date selection from calendar
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const formattedValue = format(date, 'yyyy-MM-dd');
      onChange?.(formattedValue);
      setOpen(false);
    }
  };

  // Clear date
  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening popover when clearing
    onChange?.('');
  };

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              disabled={disabled}
              className={cn(
                'w-full justify-between font-normal',
                !value && 'text-muted-foreground',
                error && 'border-red-500'
              )}
            >
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span>{value ? displayValue : 'Pilih tanggal'}</span>
              </div>
              <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              captionLayout="dropdown"
              locale={idLocale}
              defaultMonth={selectedDate}
            />
          </PopoverContent>
        </Popover>

        {/* Clear button overlay */}
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearDate}
            className="absolute right-10 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Format guide when empty */}
      {!value && !error && (
        <p className="text-xs text-muted-foreground">
          Klik untuk memilih tanggal dari kalender
        </p>
      )}
    </div>
  );
}

// Utility component for date range picker
interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  required?: boolean;
  errors?: { start?: string; end?: string };
  className?: string;
}

export function DateRangePicker({
  startDate = '',
  endDate = '',
  onStartDateChange,
  onEndDateChange,
  startLabel = 'Tanggal Mulai',
  endLabel = 'Tanggal Akhir',
  disabled = false,
  required = false,
  errors = {},
  className = '',
}: DateRangePickerProps) {
  // Validate that end date is after start date
  const isEndDateAfterStart = React.useMemo(() => {
    if (!startDate || !endDate) return true; // If either is empty, skip validation

    try {
      const start = parse(startDate, 'yyyy-MM-dd', new Date());
      const end = parse(endDate, 'yyyy-MM-dd', new Date());

      if (!isValid(start) || !isValid(end)) return true; // Skip if invalid format

      return end > start;
    } catch {
      return true; // Skip validation on error
    }
  }, [startDate, endDate]);

  return (
    <div className="space-y-4">
      <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
        <DatePicker
          label={startLabel}
          value={startDate}
          onChange={onStartDateChange}
          disabled={disabled}
          required={required}
          error={errors.start}
        />

        <DatePicker
          label={endLabel}
          value={endDate}
          onChange={onEndDateChange}
          disabled={disabled}
          required={required}
          error={errors.end}
        />
      </div>

      {/* Range validation error */}
      {startDate && endDate && !isEndDateAfterStart && (
        <div className="flex items-start gap-1.5 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-orange-700">
            Tanggal akhir kontrak harus setelah tanggal mulai
          </p>
        </div>
      )}
    </div>
  );
}
