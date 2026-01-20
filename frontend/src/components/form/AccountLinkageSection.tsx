import React from 'react';
import { Building2, Calendar, User } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CreateAccountModal } from '@/components/form/CreateAccountModal';
import { CreateAccountManagerModal } from '@/components/form/CreateAccountManagerModal';
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

  // Modal states
  const [createAccountModalOpen, setCreateAccountModalOpen] = React.useState(false);
  const [createAMModalOpen, setCreateAMModalOpen] = React.useState(false);

  // Load accounts on mount
  React.useEffect(() => {
    const loadAccounts = async () => {
      try {
        // Fetch accounts (max 100 per page due to backend limit)
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
        // Fetch AMs (max 100 per page due to backend limit)
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

  // Handle new account created
  const handleAccountCreated = (newAccount: AccountResponse) => {
    setAccounts((prev) => [...prev, newAccount]);
    onAccountChange(newAccount.id);
  };

  // Handle new AM created
  const handleAMCreated = (newManager: AccountManagerResponse) => {
    setAccountManagers((prev) => [...prev, newManager]);
    onTelkomContactChange(newManager.id);
  };

  // Transform accounts to searchable select items
  const accountItems = React.useMemo(() => {
    return accounts.map((account) => ({
      value: account.id.toString(),
      label: account.account_number
        ? `${account.name} (${account.account_number})`
        : account.name,
      searchText: account.account_number ?? '', // Allow searching by account number
    }));
  }, [accounts]);

  // Transform account managers to searchable select items
  const amItems = React.useMemo(() => {
    return accountManagers.map((manager) => ({
      value: manager.id.toString(),
      label: manager.title
        ? `${manager.name} - ${manager.title}`
        : manager.name,
      searchText: manager.email ?? '', // Allow searching by email
    }));
  }, [accountManagers]);

  return (
    <>
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
          </div>

          {/* Account Selection - with search */}
          <div className="space-y-2">
            <Label htmlFor="account_id" className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Akun Pelanggan
            </Label>
            <SearchableSelect
              value={accountId?.toString() ?? null}
              onValueChange={(value) => onAccountChange(value ? parseInt(value, 10) : null)}
              items={accountItems}
              placeholder="Pilih akun pelanggan"
              searchPlaceholder="Cari nama atau nomor akun..."
              emptyText="Tidak ada akun ditemukan"
              isLoading={isLoadingAccounts}
              error={!!errors?.accountId}
              onAddNew={() => setCreateAccountModalOpen(true)}
              addNewLabel="Tambah Akun Baru"
            />
            {errors?.accountId && (
              <p className="text-xs text-red-500">{errors.accountId}</p>
            )}
          </div>

          {/* Account Manager Selection - with search */}
          <div className="space-y-2">
            <Label htmlFor="telkom_contact_id" className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Account Manager
            </Label>
            <SearchableSelect
              value={telkomContactId?.toString() ?? null}
              onValueChange={(value) => onTelkomContactChange(value ? parseInt(value, 10) : null)}
              items={amItems}
              placeholder="Pilih Account Manager"
              searchPlaceholder="Cari nama atau email..."
              emptyText="Tidak ada Account Manager ditemukan"
              isLoading={isLoadingManagers}
              error={!!errors?.telkomContactId}
              onAddNew={() => setCreateAMModalOpen(true)}
              addNewLabel="Tambah AM Baru"
            />
            {errors?.telkomContactId && (
              <p className="text-xs text-red-500">{errors.telkomContactId}</p>
            )}
          </div>
        </div>
      </FormSection>

      {/* Create Account Modal */}
      <CreateAccountModal
        open={createAccountModalOpen}
        onOpenChange={setCreateAccountModalOpen}
        onSuccess={handleAccountCreated}
      />

      {/* Create Account Manager Modal */}
      <CreateAccountManagerModal
        open={createAMModalOpen}
        onOpenChange={setCreateAMModalOpen}
        onSuccess={handleAMCreated}
      />
    </>
  );
}
