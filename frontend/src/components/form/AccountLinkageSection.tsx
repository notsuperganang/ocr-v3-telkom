import React from 'react';
import { Building2, Calendar, User, Link2, Info } from 'lucide-react';
import { FormSection } from '@/components/ui/form-section';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CreateAccountModal } from '@/components/form/CreateAccountModal';
import { apiService } from '@/services/api';
import type { AccountResponse, AccountManagerResponse } from '@/types/api';

interface AccountLinkageSectionProps {
  accountId: number | null;
  contractYear: number | null;
  onAccountChange: (accountId: number | null) => void;
  onContractYearChange: (year: number) => void;
  onAccountManagerData: (amData: AccountManagerResponse | null) => void;
  defaultContractYear?: number;
  errors?: {
    accountId?: string;
    contractYear?: string;
  };
}

export function AccountLinkageSection({
  accountId,
  contractYear,
  onAccountChange,
  onContractYearChange,
  onAccountManagerData,
  defaultContractYear,
  errors,
}: AccountLinkageSectionProps) {
  const [accounts, setAccounts] = React.useState<AccountResponse[]>([]);
  const [accountManagers, setAccountManagers] = React.useState<AccountManagerResponse[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(true);
  const [isLoadingManagers, setIsLoadingManagers] = React.useState(true);
  const [linkedAM, setLinkedAM] = React.useState<AccountManagerResponse | null>(null);

  // Modal states
  const [createAccountModalOpen, setCreateAccountModalOpen] = React.useState(false);

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

  // Load account managers on mount (for looking up full AM data by ID)
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

  // When accountId changes, derive AM from selected account
  React.useEffect(() => {
    const deriveAccountManager = async () => {
      if (!accountId) {
        setLinkedAM(null);
        onAccountManagerData(null);
        return;
      }

      const selectedAccount = accounts.find((acc) => acc.id === accountId);
      if (!selectedAccount?.account_manager?.id) {
        setLinkedAM(null);
        onAccountManagerData(null);
        return;
      }

      const amId = selectedAccount.account_manager.id;

      // Try to find full AM data from already loaded list
      const fullAM = accountManagers.find((am) => am.id === amId);
      if (fullAM) {
        setLinkedAM(fullAM);
        onAccountManagerData(fullAM);
      } else if (!isLoadingManagers) {
        // If not found in list and loading is done, fetch directly
        try {
          const amData = await apiService.getAccountManager(amId);
          setLinkedAM(amData);
          onAccountManagerData(amData);
        } catch (error) {
          console.error('Failed to fetch Account Manager details:', error);
          setLinkedAM(null);
          onAccountManagerData(null);
        }
      }
    };

    deriveAccountManager();
  }, [accountId, accounts, accountManagers, isLoadingManagers, onAccountManagerData]);

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

          {/* Account Manager - Read-only display (derived from account) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Account Manager
            </Label>
            {isLoadingManagers && accountId ? (
              <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
            ) : linkedAM ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
                <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-blue-900 truncate">
                    {linkedAM.name}
                  </p>
                  {linkedAM.title && (
                    <p className="text-xs text-blue-700 truncate">{linkedAM.title}</p>
                  )}
                </div>
              </div>
            ) : accountId ? (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <Info className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-orange-700">
                  Akun ini belum memiliki Account Manager. Silakan assign AM di halaman detail akun.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-lg">
                <User className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Pilih akun untuk melihat Account Manager</p>
              </div>
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
    </>
  );
}
