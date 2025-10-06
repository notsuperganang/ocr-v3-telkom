// Contracts listing and management page
import React from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Wallet, TrendingUp, FileX } from 'lucide-react';
import { ContractsTable } from '@/components/contracts/ContractsTable';
import { FilterBar } from '@/components/contracts/FilterBar';
import { KpiCard } from '@/components/contracts/KpiCard';
import { useContracts, useContractStats } from '@/hooks/useContracts';
import { staggerContainer, slideDown } from '@/lib/motion';

export function ContractsPage() {
  // State for search, filters, and pagination
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [selectedPaymentMethods, setSelectedPaymentMethods] = React.useState<string[]>([]);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Query for contracts data
  const {
    data: rawContractsData,
    isLoading: isLoadingContracts,
    error: contractsError,
  } = useContracts({
    page,
    per_page: 10,
    search: debouncedSearch || undefined,
  });

  // Client-side filtering for payment methods
  const contractsData = React.useMemo(() => {
    if (!rawContractsData) return rawContractsData;

    if (selectedPaymentMethods.length === 0) {
      return rawContractsData;
    }

    const filteredContracts = rawContractsData.contracts.filter((contract) =>
      selectedPaymentMethods.includes(contract.payment_method || '')
    );

    return {
      ...rawContractsData,
      contracts: filteredContracts,
      total: filteredContracts.length,
      total_pages: Math.ceil(filteredContracts.length / rawContractsData.per_page),
    };
  }, [rawContractsData, selectedPaymentMethods]);

  // Query for statistics
  const {
    data: statsData,
    isLoading: isLoadingStats,
  } = useContractStats();

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const handlePaymentMethodToggle = (method: string) => {
    setSelectedPaymentMethods((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method]
    );
    setPage(1); // Reset to first page when filtering
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedPaymentMethods([]);
    setPage(1);
  };

  // Calculate additional KPI data
  const avgContractsPerMonth = React.useMemo(() => {
    if (!statsData?.total) return '0';
    // Calculate based on actual months of operation
    // For now, if we have data this month, assume at least 1 month of operation
    // Better would be to calculate from earliest contract date to now
    const months = statsData.thisMonth > 0 ? 1 : 12; // Simplified: use current month count
    const avg = Math.round(statsData.total / months);
    return avg.toString();
  }, [statsData]);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <motion.div
        variants={slideDown}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kontrak</h1>
          <p className="text-muted-foreground mt-1">
            Lihat dan kelola data kontrak yang telah dikonfirmasi
          </p>
        </div>
        <Button onClick={() => window.location.href = '/upload'} size="lg">
          <FileText className="mr-2 h-4 w-4" />
          Upload File Baru
        </Button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <KpiCard
          label="Total Kontrak"
          value={statsData?.total ?? 0}
          subtitle="Kontrak terkonfirmasi"
          icon={<FileText className="w-5 h-5" />}
          isLoading={isLoadingStats}
        />

        <KpiCard
          label="Bulan Ini"
          value={statsData?.thisMonth ?? 0}
          subtitle="Kontrak diproses bulan ini"
          icon={<TrendingUp className="w-5 h-5" />}
          trend={
            statsData?.thisMonth && statsData?.total
              ? {
                  value: Math.round((statsData.thisMonth / statsData.total) * 100),
                  direction: statsData.thisMonth > 0 ? 'up' : 'neutral',
                  label: 'dari total',
                }
              : undefined
          }
          isLoading={isLoadingStats}
        />

        {/* TODO: Implement contract value tracking
            - Add contract value fields to database schema
            - Update data extraction to capture contract values
            - Calculate total value from all confirmed contracts
            - Replace "N/A" with actual total value (e.g., "Rp 2.5 M")
        */}
        <KpiCard
          label="Nilai Total"
          value="N/A"
          subtitle="Data nilai belum tersedia"
          icon={<Wallet className="w-5 h-5" />}
          isLoading={isLoadingStats}
        />

        <KpiCard
          label="Rata-rata per Bulan"
          value={`${avgContractsPerMonth} kontrak`}
          subtitle="Rata-rata kontrak per bulan"
          icon={<Calendar className="w-5 h-5" />}
          isLoading={isLoadingStats}
        />
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/20">
          <CardContent className="pt-6">
            <FilterBar
              search={search}
              onSearchChange={handleSearchChange}
              selectedPaymentMethods={selectedPaymentMethods}
              onPaymentMethodToggle={handlePaymentMethodToggle}
              onClearFilters={handleClearFilters}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Contracts Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <Card className="transition-all duration-200 hover:shadow-lg hover:border-primary/20">
          <CardHeader>
            <CardTitle>Kontrak Dikonfirmasi</CardTitle>
            <CardDescription>
              Semua kontrak yang telah diproses dan dikonfirmasi
            </CardDescription>
          </CardHeader>
          <CardContent>
          {contractsError ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="flex justify-center mb-6">
                <FileX className="w-20 h-20 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Gagal Memuat Data
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm">
                Terjadi kesalahan saat memuat data kontrak. Silakan coba lagi.
              </p>
              <Button
                variant="default"
                onClick={() => window.location.reload()}
                size="lg"
              >
                Muat Ulang Halaman
              </Button>
            </motion.div>
          ) : (
            <ContractsTable
              data={contractsData || { contracts: [], total: 0, page: 1, per_page: 10, total_pages: 0 }}
              isLoading={isLoadingContracts}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}