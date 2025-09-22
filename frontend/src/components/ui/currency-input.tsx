import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CurrencyInputProps {
  id?: string;
  name?: string;
  label?: string;
  value?: number;
  onChange?: (value: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  currency?: string;
  locale?: string;
  min?: number;
  max?: number;
}

export function CurrencyInput({
  id,
  name,
  label,
  value = 0,
  onChange,
  onBlur,
  placeholder = '0',
  disabled = false,
  required = false,
  error,
  className = '',
  currency = 'IDR',
  locale = 'id-ID',
  min = 0,
  max,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);

  // Format number to currency string
  const formatCurrency = React.useCallback(
    (amount: number): string => {
      if (isNaN(amount) || amount === 0) return '';

      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    },
    [locale, currency]
  );

  // Parse currency string to number
  const parseCurrency = React.useCallback((str: string): number => {
    if (!str) return 0;

    // Remove all non-digit characters except decimal separator
    const cleaned = str.replace(/[^\d,.-]/g, '');

    // Handle Indonesian number format (1.000.000,00)
    let normalized = cleaned;
    if (locale.startsWith('id')) {
      // Replace dots with nothing (thousands separator) and comma with dot (decimal)
      normalized = cleaned.replace(/\./g, '').replace(/,/g, '.');
    }

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }, [locale]);

  // Update display value when prop value changes
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrency(value));
    }
  }, [value, isFocused, formatCurrency]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    // Parse and emit numeric value
    const numericValue = parseCurrency(inputValue);

    // Apply min/max constraints
    let constrainedValue = numericValue;
    if (min !== undefined && constrainedValue < min) {
      constrainedValue = min;
    }
    if (max !== undefined && constrainedValue > max) {
      constrainedValue = max;
    }

    onChange?.(constrainedValue);
  };

  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number for editing
    setDisplayValue(value.toString());
  };

  // Handle blur
  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();

    // Parse and reformat
    const numericValue = parseCurrency(displayValue);
    let constrainedValue = numericValue;

    // Apply constraints
    if (min !== undefined && constrainedValue < min) {
      constrainedValue = min;
    }
    if (max !== undefined && constrainedValue > max) {
      constrainedValue = max;
    }

    // Update display and emit change
    setDisplayValue(formatCurrency(constrainedValue));
    onChange?.(constrainedValue);
  };

  // Handle key down for numeric input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation keys
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Tab' ||
      e.key === 'Escape' ||
      e.key === 'Enter' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      (e.key === 'a' && e.ctrlKey) ||
      (e.key === 'c' && e.ctrlKey) ||
      (e.key === 'v' && e.ctrlKey) ||
      (e.key === 'x' && e.ctrlKey)
    ) {
      return;
    }

    // Allow digits
    if (e.key >= '0' && e.key <= '9') {
      return;
    }

    // Allow decimal separator for locale
    if (e.key === '.' || e.key === ',') {
      return;
    }

    // Block all other keys
    e.preventDefault();
  };

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
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`text-right ${error ? 'border-red-500' : ''}`}
        />

        {/* Currency symbol indicator */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
          {currency === 'IDR' ? 'Rp' : currency}
        </div>
      </div>

      {/* Show numeric value when focused for clarity */}
      {!isFocused && value > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Nilai: {value.toLocaleString(locale)}
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Utility component for amount with calculation
interface AmountWithCalculationProps extends CurrencyInputProps {
  calculation?: {
    label: string;
    value: number;
    operation: 'add' | 'subtract' | 'multiply' | 'divide';
  };
}

export function AmountWithCalculation({
  calculation,
  ...props
}: AmountWithCalculationProps) {
  const calculatedValue = React.useMemo(() => {
    if (!calculation || !props.value) return props.value || 0;

    switch (calculation.operation) {
      case 'add':
        return (props.value || 0) + calculation.value;
      case 'subtract':
        return (props.value || 0) - calculation.value;
      case 'multiply':
        return (props.value || 0) * calculation.value;
      case 'divide':
        return calculation.value !== 0 ? (props.value || 0) / calculation.value : 0;
      default:
        return props.value || 0;
    }
  }, [props.value, calculation]);

  return (
    <div>
      <CurrencyInput {...props} />

      {calculation && props.value && props.value > 0 && (
        <div className="mt-2 p-2 bg-muted rounded text-sm">
          <div className="flex justify-between items-center">
            <span>{calculation.label}:</span>
            <span className="font-mono">
              {new Intl.NumberFormat(props.locale || 'id-ID', {
                style: 'currency',
                currency: props.currency || 'IDR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(calculation.value)}
            </span>
          </div>
          <div className="flex justify-between items-center font-medium border-t pt-1 mt-1">
            <span>Total:</span>
            <span className="font-mono">
              {new Intl.NumberFormat(props.locale || 'id-ID', {
                style: 'currency',
                currency: props.currency || 'IDR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(calculatedValue)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}