// Account History Page - View accounts with expandable contract history
import * as React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';
import { apiService } from '@/services/api';
import { AccountHistoryTable } from '@/components/account/AccountHistoryTable';
import { AccountKpiDashboard } from '@/components/account/AccountKpiDashboard';
import type { SegmentResponse, WitelResponse } from '@/types/api';
import {
  Layers,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const designTokens = {
  radius: {
    xl: 'rounded-[1.25rem]',
  },
  shadow: {
    sm: 'shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]',
    md: 'shadow-[0_20px_45px_-28px_rgba(215,25,32,0.35)]',
  },
  border: 'border border-border/70',
  surface: {
    base: 'bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90',
  },
  focusRing:
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]/80',
} as const;

export function AccountHistoryPage() {
  const { isManager, isStaff } = useAuth();
  const navigate = useNavigate();

  // Redirect if not staff/manager
  React.useEffect(() => {
    if (!isStaff && !isManager) {
      toast.error('Anda tidak memiliki akses ke halaman ini');
      navigate('/');
    }
  }, [isStaff, isManager, navigate]);

  // State
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [segmentFilter, setSegmentFilter] = React.useState<number | undefined>(undefined);
  const [witelFilter, setWitelFilter] = React.useState<number | undefined>(undefined);
  const [accountManagerFilter, setAccountManagerFilter] = React.useState<number | undefined>(undefined);
  const [assignedOfficerFilter, setAssignedOfficerFilter] = React.useState<number | undefined>(undefined);
  const [expandedAccounts, setExpandedAccounts] = React.useState<Set<number>>(new Set());

  // Fetch master data for filters
  const { data: segments } = useQuery({
    queryKey: ['segments'],
    queryFn: async () => {
      const response = await apiService.listSegments(true);
      return response.segments;
    },
  });

  const { data: witels } = useQuery({
    queryKey: ['witels'],
    queryFn: async () => {
      const response = await apiService.listWitels(true);
      return response.witels;
    },
  });

  const { data: accountManagers } = useQuery({
    queryKey: ['account-managers'],
    queryFn: async () => {
      const response = await apiService.listAccountManagers(1, 100, true);
      return response.account_managers;
    },
  });

  const { data: officers } = useQuery({
    queryKey: ['officers'],
    queryFn: async () => {
      const response = await apiService.listUsers(1, 100, undefined, undefined, true);
      return response.users;
    },
  });

  // Fetch accounts with contract counts
  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['account-history', page, searchQuery, segmentFilter, witelFilter, accountManagerFilter, assignedOfficerFilter],
    queryFn: () =>
      apiService.listAccounts(
        page,
        20,
        true, // active only
        searchQuery || undefined,
        segmentFilter,
        witelFilter,
        accountManagerFilter,
        assignedOfficerFilter
      ),
  });

  const accounts = accountsData?.accounts || [];
  const totalPages = accountsData?.total_pages || 1;
  const total = accountsData?.total || 0;

  // Toggle expansion
  const toggleAccount = (accountId: number) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, segmentFilter, witelFilter, accountManagerFilter, assignedOfficerFilter]);

  return (
    <main
      className={twMerge(
        'min-h-screen space-y-8 bg-gradient-to-br from-background via-background to-muted/20 px-6 py-8'
      )}
    >
      {/* Header */}
      <header className="flex flex-col gap-6">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <a
            href="/"
            className={twMerge(
              'transition-colors hover:text-foreground',
              designTokens.focusRing
            )}
          >
            Beranda
          </a>
          <span aria-hidden="true" className="text-muted-foreground/60">
            /
          </span>
          <a
            href="/account-history"
            className={twMerge(
              'transition-colors hover:text-foreground',
              designTokens.focusRing
            )}
            aria-current="page"
          >
            Overview Akun
          </a>
        </nav>

        {/* Title */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={twMerge(
                'flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-[#d71920]/10 to-transparent shadow-inner',
                designTokens.focusRing
              )}
            >
              <Layers className="size-7 text-[#d71920]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-foreground">
                Overview Akun
              </h1>
              <p className="text-sm text-muted-foreground">
                Lihat riwayat kontrak per account dengan detail lengkap
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/accounts')}
            className="bg-[#d71920] hover:bg-[#b81419] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Buat Akun Baru
          </Button>
        </div>
      </header>

      {/* KPI Dashboard */}
      <AccountKpiDashboard />

      {/* Filters Card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={twMerge(
          designTokens.radius.xl,
          designTokens.border,
          designTokens.surface.base,
          designTokens.shadow.sm,
          'p-6'
        )}
        aria-label="Filter accounts"
      >
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Filter & Pencarian</h2>
        </div>
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search" className="text-sm font-medium">
                  Cari Account
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Nama, nomor account, NIPNAS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Segment Filter */}
              <div className="space-y-2">
                <Label htmlFor="segment" className="text-sm font-medium">
                  Segment
                </Label>
                <Select
                  value={segmentFilter?.toString() || 'all'}
                  onValueChange={(value) =>
                    setSegmentFilter(value === 'all' ? undefined : parseInt(value))
                  }
                >
                  <SelectTrigger id="segment">
                    <SelectValue placeholder="Semua Segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Segment</SelectItem>
                    {segments?.map((segment: SegmentResponse) => (
                      <SelectItem key={segment.id} value={segment.id.toString()}>
                        {segment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Witel Filter */}
              <div className="space-y-2">
                <Label htmlFor="witel" className="text-sm font-medium">
                  Witel
                </Label>
                <Select
                  value={witelFilter?.toString() || 'all'}
                  onValueChange={(value) =>
                    setWitelFilter(value === 'all' ? undefined : parseInt(value))
                  }
                >
                  <SelectTrigger id="witel">
                    <SelectValue placeholder="Semua Witel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Witel</SelectItem>
                    {witels?.map((witel: WitelResponse) => (
                      <SelectItem key={witel.id} value={witel.id.toString()}>
                        {witel.code} - {witel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Manager Filter */}
              <div className="space-y-2">
                <Label htmlFor="account-manager" className="text-sm font-medium">
                  Account Manager
                </Label>
                <Select
                  value={accountManagerFilter?.toString() || 'all'}
                  onValueChange={(value) =>
                    setAccountManagerFilter(value === 'all' ? undefined : parseInt(value))
                  }
                >
                  <SelectTrigger id="account-manager">
                    <SelectValue placeholder="Semua AM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua AM</SelectItem>
                    {accountManagers?.map((am) => (
                      <SelectItem key={am.id} value={am.id.toString()}>
                        {am.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Officer Filter */}
              <div className="space-y-2">
                <Label htmlFor="officer" className="text-sm font-medium">
                  Petugas
                </Label>
                <Select
                  value={assignedOfficerFilter?.toString() || 'all'}
                  onValueChange={(value) =>
                    setAssignedOfficerFilter(value === 'all' ? undefined : parseInt(value))
                  }
                >
                  <SelectTrigger id="officer">
                    <SelectValue placeholder="Semua Petugas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Petugas</SelectItem>
                    {officers?.map((officer) => (
                      <SelectItem key={officer.id} value={officer.id.toString()}>
                        {officer.full_name || officer.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Result count */}
            <div className="flex items-center justify-between border-t border-border/50 pt-4">
              <p className="text-sm text-muted-foreground">
                Menampilkan <span className="font-medium text-foreground">{accounts.length}</span> dari{' '}
                <span className="font-medium text-foreground">{total}</span> account
              </p>
              {(searchQuery || segmentFilter || witelFilter || accountManagerFilter || assignedOfficerFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSegmentFilter(undefined);
                    setWitelFilter(undefined);
                    setAccountManagerFilter(undefined);
                    setAssignedOfficerFilter(undefined);
                  }}
                  className="h-8 px-3 text-sm"
                >
                  Reset Filter
                </Button>
              )}
            </div>
          </div>
        </motion.section>

      {/* Accounts Table */}
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className={twMerge(
            designTokens.radius.xl,
            designTokens.border,
            designTokens.surface.base,
            designTokens.shadow.sm,
            'flex h-64 items-center justify-center'
          )}
        >
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Memuat data account...</p>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <AccountHistoryTable
              accounts={accounts}
              expandedAccounts={expandedAccounts}
              onToggleAccount={toggleAccount}
            />
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15 }}
              className={twMerge(
                'flex items-center justify-between px-6 py-4',
                designTokens.radius.xl,
                designTokens.border,
                designTokens.surface.base,
                designTokens.shadow.sm
              )}
            >
              <p className="text-sm text-muted-foreground">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Selanjutnya
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          )}
        </>
        )}
    </main>
  );
}
