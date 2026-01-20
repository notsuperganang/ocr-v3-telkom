import * as React from 'react';
import { Check, ChevronsUpDown, Search, Plus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SearchableSelectItem {
  value: string;
  label: string;
  searchText?: string; // Additional text to search against (e.g., account_number)
}

interface SearchableSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  items: SearchableSelectItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  error?: boolean;
  // Add new item functionality
  onAddNew?: () => void;
  addNewLabel?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  items,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyText = 'Tidak ada data ditemukan',
  clearLabel = '-- Tidak dipilih --',
  isLoading = false,
  disabled = false,
  error = false,
  onAddNew,
  addNewLabel = 'Tambah baru',
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Find selected item label
  const selectedItem = items.find((item) => item.value === value);

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(query);
      const searchTextMatch = item.searchText?.toLowerCase().includes(query);
      return labelMatch || searchTextMatch;
    });
  }, [items, searchQuery]);

  // Focus input when popover opens
  React.useEffect(() => {
    if (open && inputRef.current) {
      // Small delay to ensure popover is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [open]);

  const handleSelect = (itemValue: string | null) => {
    onValueChange(itemValue);
    setOpen(false);
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Memuat data...</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selectedItem && 'text-muted-foreground',
            error && 'border-red-500'
          )}
        >
          <span className="truncate">
            {selectedItem ? selectedItem.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {/* Search Input */}
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Options List */}
        <ScrollArea className="max-h-[200px]">
          <div className="p-1">
            {/* Clear Selection Option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors',
                value === null
                  ? 'bg-primary text-primary-foreground font-medium hover:bg-primary/90'
                  : 'hover:bg-muted'
              )}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  value === null ? 'opacity-100 text-primary-foreground' : 'opacity-0'
                )}
              />
              <span className={value === null ? 'text-primary-foreground' : 'text-muted-foreground'}>{clearLabel}</span>
            </button>

            {/* Filtered Items */}
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => handleSelect(item.value)}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors',
                    value === item.value
                      ? 'bg-primary text-primary-foreground font-medium hover:bg-primary/90'
                      : 'hover:bg-muted'
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === item.value ? 'opacity-100 text-primary-foreground' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Add New Button */}
        {onAddNew && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddNew();
              }}
              className={cn(
                'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors',
                'hover:bg-primary/10',
                'text-primary font-medium'
              )}
            >
              <Plus className="mr-2 h-4 w-4" />
              {addNewLabel}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
