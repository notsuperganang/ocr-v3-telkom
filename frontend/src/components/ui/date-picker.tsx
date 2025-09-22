import React from 'react';
import { format, parse, isValid } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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
  name,
  label,
  value = '',
  onChange,
  onBlur,
  placeholder = 'YYYY-MM-DD',
  disabled = false,
  required = false,
  error,
  className = '',
}: DatePickerProps) {
  const [inputValue, setInputValue] = React.useState(value);

  // Update input value when prop value changes
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Validate and emit change if valid date
    if (newValue.length === 10) {
      const date = parse(newValue, 'yyyy-MM-dd', new Date());
      if (isValid(date)) {
        onChange?.(newValue);
      }
    } else if (newValue === '') {
      onChange?.('');
    }
  };

  // Handle input blur
  const handleBlur = () => {
    onBlur?.();

    // Validate and correct format if needed
    if (inputValue && inputValue.length >= 8) {
      // Try to parse various date formats
      const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy/MM/dd'];
      let parsedDate: Date | null = null;

      for (const fmt of formats) {
        try {
          const date = parse(inputValue, fmt, new Date());
          if (isValid(date)) {
            parsedDate = date;
            break;
          }
        } catch {
          // Continue to next format
        }
      }

      if (parsedDate) {
        const formattedValue = format(parsedDate, 'yyyy-MM-dd');
        setInputValue(formattedValue);
        onChange?.(formattedValue);
      }
    }
  };

  // Clear date
  const clearDate = () => {
    setInputValue('');
    onChange?.('');
  };

  // Format display value
  const displayValue = React.useMemo(() => {
    if (!inputValue) return '';

    try {
      const date = parse(inputValue, 'yyyy-MM-dd', new Date());
      if (isValid(date)) {
        return format(date, 'dd MMMM yyyy', { locale: idLocale });
      }
    } catch {
      // Return raw value if can't parse
    }

    return inputValue;
  }, [inputValue]);

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          id={id}
          name={name}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`pr-20 ${error ? 'border-red-500' : ''}`}
        />

        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearDate}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
            </Button>
          )}

          <div className="flex items-center justify-center h-6 w-6 text-gray-400">
            <Calendar className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* Display formatted date below input for clarity */}
      {inputValue && displayValue !== inputValue && (
        <p className="text-xs text-muted-foreground">
          {displayValue}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
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
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
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
  );
}