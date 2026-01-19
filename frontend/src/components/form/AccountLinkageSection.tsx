import React from 'react';
import { Building2, Calendar, User, Loader2 } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiService } from '@/services/api';
import type { AccountResponse, AccountManagerResponse } from '@/types/api';

interface AccountLinkageSectionProps {
  accountId: number | null;
  contractYear: number | null;
  telkomContactId: number | null;
  onAccountChange: (accountId: number | null) => void;
  onContractYearChange: (year: number) => void;
  onTelkomContactChange: (contactId: number | null) => void;
  defaultContractYear?: number;
  errors?: {
    accountId?: string;
    contractYear?: string;
    telkomContactId?: string;
  };
}

export function AccountLinkageSection({
  accountId,
  contractYear,
  telkomContactId,
  onAccountChange,
  onContractYearChange,
  onTelkomContactChange,
  defaultContractYear,
  errors,
}: AccountLinkageSectionProps) {
  const [accounts, setAccounts] = React.useState<AccountResponse[]>([]);
  const [accountManagers, setAccountManagers] = React.useState<AccountManagerResponse[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(true);
  const [isLoadingManagers, setIsLoadingManagers] = React.useState(true);

  // Load accounts on mount
  React.useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await apiService.listAccounts(1, 100, true);
        setAccounts(response.accounts);
      } catch (error) {
        console.error('Failed to load accounts:', error);
      } finally {
        setIsLoadingAccounts(false);
      }
    };
    loadAccounts();
  }, []);

  // Load account managers on mount
  React.useEffect(() => {
    const loadManagers = async () => {
      try {
        const response = await apiService.listAccountManagers(1, 100, true);
        setAccountManagers(response.account_managers);
      } catch (error) {
        console.error('Failed to load account managers:', error);
      } finally {
        setIsLoadingManagers(false);
      }
    };
    loadManagers();
  }, []);

  // Set default contract year from period_start if not set
  React.useEffect(() => {
    if (!contractYear && defaultContractYear) {
      onContractYearChange(defaultContractYear);
    }
  }, [contractYear, defaultContractYear, onContractYearChange]);

  // Handle contract year change
  const handleContractYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      // Allow empty for typing
      return;
    }
    const year = parseInt(value, 10);
    if (!isNaN(year)) {
      onContractYearChange(year);
    }
  };

  return (
    <FormSection
      title="Akun"
      description="Hubungkan kontrak dengan akun pelanggan"
      icon={<Building2 className="w-5 h-5" />}
      isRequired={true}
    >
      <div className="space-y-6">
        {/* Contract Year - Required */}
        <div className="space-y-2">
          <Label htmlFor="contract_year" className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Tahun Kontrak <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contract_year"
            type="number"
            min={2020}
            max={2100}
            value={contractYear ?? defaultContractYear ?? ''}
            onChange={handleContractYearChange}
            placeholder="Contoh: 2025"
            className={errors?.contractYear ? 'border-red-500' : ''}
          />
          {errors?.contractYear && (
            <p className="text-xs text-red-500">{errors.contractYear}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Tahun working contract (diambil dari tanggal mulai kontrak)
          </p>
        </div>

        {/* Account Selection - Optional */}
        <div className="space-y-2">
          <Label htmlFor="account_id" className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Akun Pelanggan
          </Label>
          {isLoadingAccounts ? (
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Memuat akun...</span>
            </div>
          ) : (
            <Select
              value={accountId?.toString() ?? '__none__'}
              onValueChange={(value) => onAccountChange(value === '__none__' ? null : parseInt(value, 10))}
            >
              <SelectTrigger className={errors?.accountId ? 'border-red-500' : ''}>
                <SelectValue placeholder="Pilih akun pelanggan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- Tidak dipilih --</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.name}
                    {account.account_number && ` (${account.account_number})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {errors?.accountId && (
            <p className="text-xs text-red-500">{errors.accountId}</p>
          )}
        </div>

        {/* Telkom Contact Selection - Optional */}
        <div className="space-y-2">
          <Label htmlFor="telkom_contact_id" className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4" />
            Account Manager
          </Label>
          {isLoadingManagers ? (
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Memuat Account Manager...</span>
            </div>
          ) : (
            <Select
              value={telkomContactId?.toString() ?? '__none__'}
              onValueChange={(value) => onTelkomContactChange(value === '__none__' ? null : parseInt(value, 10))}
            >
              <SelectTrigger className={errors?.telkomContactId ? 'border-red-500' : ''}>
                <SelectValue placeholder="Pilih Account Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- Tidak dipilih --</SelectItem>
                {accountManagers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id.toString()}>
                    {manager.name}
                    {manager.title && ` - ${manager.title}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {errors?.telkomContactId && (
            <p className="text-xs text-red-500">{errors.telkomContactId}</p>
          )}
        </div>
      </div>
    </FormSection>
  );
}
