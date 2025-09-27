// Contracts listing and management page
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, FileText, Clock, TrendingUp } from 'lucide-react';
import { ContractsTable } from '@/components/contracts/ContractsTable';
import { useContracts, useContractStats } from '@/hooks/useContracts';

export function ContractsPage() {
  // State for search and pagination
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

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
    data: contractsData,
    isLoading: isLoadingContracts,
    error: contractsError,
  } = useContracts({
    page,
    per_page: 10,
    search: debouncedSearch || undefined,
  });

  // Query for statistics
  const {
    data: statsData,
    isLoading: isLoadingStats,
  } = useContractStats();

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kontrak</h1>
          <p className="text-muted-foreground">
            Lihat dan kelola data kontrak yang telah dikonfirmasi
          </p>
        </div>
        <Button onClick={() => window.location.href = '/upload'}>
          Upload File Baru
        </Button>
      </div>

      {/* Contract Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kontrak</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? (
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
              ) : (
                statsData?.total ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Kontrak dikonfirmasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bulan Ini</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? (
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
              ) : (
                statsData?.thisMonth ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Kontrak diproses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata Proses</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? (
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
              ) : (
                statsData?.avgProcessingTime ?? '--'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Waktu per kontrak
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari berdasarkan nama file, nomor kontrak, atau nama pelanggan..."
                  className="pl-10"
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kontrak Dikonfirmasi</CardTitle>
          <CardDescription>
            Semua kontrak yang telah diproses dan dikonfirmasi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contractsError ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                Gagal memuat data kontrak
              </div>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Muat Ulang
              </Button>
            </div>
          ) : (
            <ContractsTable
              data={contractsData || { contracts: [], total: 0, page: 1, per_page: 10, total_pages: 0 }}
              isLoading={isLoadingContracts}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}