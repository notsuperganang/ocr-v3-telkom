// Dashboard overview page
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  TrendingUp,
  Banknote,
  Clock,
  ArrowRight,
  Upload,
  Calendar
} from 'lucide-react';
import { useDashboardOverview, useTerminUpcoming } from '@/hooks/useContracts';

// Helper function to format currency
function formatCurrency(value: string | number, compact: boolean = false): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Rp 0';

  if (compact) {
    if (num >= 1000000000) {
      return `Rp ${(num / 1000000000).toFixed(1)} M`;
    } else if (num >= 1000000) {
      return `Rp ${(num / 1000000).toFixed(1)} Jt`;
    } else if (num >= 1000) {
      return `Rp ${(num / 1000).toFixed(1)} Rb`;
    }
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Helper function to format processing time
function formatProcessingTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '-';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes > 0) {
    return `${minutes} mnt ${remainingSeconds} dtk`;
  }
  return `${remainingSeconds} dtk`;
}

// Helper function to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Dummy data for Recurring section
const DUMMY_RECURRING_DATA = [
  {
    contract_id: 13,
    customer_name: 'SMK Negeri 1 Jakarta',
    period_start: '2024-01-01',
    period_end: '2026-12-31',
    month_number: 12,
    month_label: 'Desember 2025',
    amount: '3017260',
  },
  {
    contract_id: 14,
    customer_name: 'SMK Negeri 2 Bandung',
    period_start: '2025-01-01',
    period_end: '2026-12-31',
    month_number: 6,
    month_label: 'Juni 2025',
    amount: '1017260',
  },
  {
    contract_id: 15,
    customer_name: 'SMK Negeri 3 Surabaya',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    month_number: 9,
    month_label: 'September 2025',
    amount: '6017260',
  },
  {
    contract_id: 16,
    customer_name: 'SMK Negeri 4 Medan',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    month_number: 9,
    month_label: 'September 2025',
    amount: '5017260',
  },
  {
    contract_id: 17,
    customer_name: 'SMK Negeri 5 Semarang',
    period_start: '2024-01-01',
    period_end: '2025-12-31',
    month_number: 6,
    month_label: 'Juni 2025',
    amount: '2017260',
  },
  {
    contract_id: 18,
    customer_name: 'SMK Negeri 6 Makassar',
    period_start: '2024-01-01',
    period_end: '2025-12-31',
    month_number: 6,
    month_label: 'Juni 2025',
    amount: '4017260',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();

  // Fetch dashboard data
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: terminData, isLoading: terminLoading } = useTerminUpcoming(30);

  // Calculate MoM comparison for contracts
  const momDiff = overview
    ? overview.contracts_this_month - overview.contracts_last_month
    : 0;
  const momText = momDiff >= 0 ? `+${momDiff} kontrak` : `${momDiff} kontrak`;

  // Calculate percentage change vs last month
  const percentChange = overview && overview.contracts_last_month > 0
    ? ((overview.contracts_this_month - overview.contracts_last_month) / overview.contracts_last_month * 100).toFixed(1)
    : '0';

  // Calculate recurring dummy totals
  const recurringTotalContracts = DUMMY_RECURRING_DATA.length;
  const recurringTotalAmount = DUMMY_RECURRING_DATA.reduce(
    (sum, item) => sum + parseFloat(item.amount),
    0
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Beranda {'>'} Dashboard
          </div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Ringkasan aktivitas pemrosesan kontrak
          </p>
        </div>
        <Button
          onClick={() => navigate('/upload')}
          className="bg-[#d71920] hover:bg-[#b81419] text-white"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload File Baru
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Kontrak */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Kontrak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#d71920]">
              {overviewLoading ? '--' : overview?.total_contracts || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              vs bln lalu: {percentChange}%
            </p>
          </CardContent>
        </Card>

        {/* Kontrak Bulan Ini */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kontrak Bulan Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#d71920]">
              {overviewLoading ? '--' : overview?.contracts_this_month || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              MoM: {momText}
            </p>
          </CardContent>
        </Card>

        {/* Nilai Total Kontrak */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Nilai Total Kontrak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#d71920]">
              {overviewLoading ? '--' : formatCurrency(overview?.total_contract_value || '0', true)}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Banknote className="w-3 h-3" />
              Rata-rata/kontrak: {overviewLoading ? '-' : formatCurrency(overview?.avg_contract_value || '0', true)}
            </p>
          </CardContent>
        </Card>

        {/* Waktu Proses */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Waktu Proses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#d71920]">
              {overviewLoading ? '--' : formatProcessingTime(overview?.avg_processing_time_sec || null)}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Median: {overviewLoading ? '-' : formatProcessingTime(overview?.median_processing_time_sec || null)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Termin & Recurring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Termin Jatuh Tempo */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">
                  Termin Jatuh Tempo ≤30 Hari
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Termin belum lunas yang segera jatuh tempo
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                className="bg-[#d71920] hover:bg-[#b81419] text-white"
                onClick={() => navigate('/contracts?payment_method=termin')}
              >
                Lihat Semua
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Summary Stats */}
            <div className="mt-4">
              <div className="text-3xl font-bold text-[#d71920]">
                {terminLoading ? '--' : terminData?.total_contracts || 0} Kontrak
              </div>
              <p className="text-sm text-muted-foreground">
                Total nominal: {terminLoading ? '-' : formatCurrency(terminData?.total_amount || '0', true)}
              </p>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">
                      <div className="flex items-center gap-1">
                        Pelanggan
                        <FileText className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">
                      <div className="flex items-center gap-1">
                        Periode
                        <Calendar className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">Termin Ke-</TableHead>
                    <TableHead className="text-xs text-right">Nilai Termin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terminLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <div className="text-muted-foreground">Memuat data...</div>
                      </TableCell>
                    </TableRow>
                  ) : terminData?.items && terminData.items.length > 0 ? (
                    terminData.items.map((item, index) => (
                      <TableRow key={`${item.contract_id}-${item.termin_number}-${index}`}>
                        <TableCell>
                          <div className="font-medium text-sm">{item.customer_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Kontrak ID {item.contract_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDate(item.period_start)}</div>
                          <div className="text-xs text-muted-foreground">
                            s/d {formatDate(item.period_end)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{item.termin_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.termin_period_label}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium text-sm">
                            {formatCurrency(item.amount)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(item.amount, true)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <div className="text-muted-foreground">
                          Belum ada termin yang jatuh tempo dalam 30 hari ke depan.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recurring Bulan Ini */}
        <Card className="bg-white border rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">
                  Recurring Bulan Ini
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Tagihan berkala yang jatuh tempo pada bulan berjalan
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                className="bg-[#d71920] hover:bg-[#b81419] text-white"
                onClick={() => navigate('/contracts?payment_method=recurring')}
              >
                Lihat Semua
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Summary Stats */}
            <div className="mt-4">
              <div className="text-3xl font-bold text-[#d71920]">
                {recurringTotalContracts} Kontrak
              </div>
              <p className="text-sm text-muted-foreground">
                Total nominal: {formatCurrency(recurringTotalAmount, true)}
              </p>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">
                      <div className="flex items-center gap-1">
                        Pelanggan
                        <FileText className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">
                      <div className="flex items-center gap-1">
                        Periode
                        <Calendar className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">Bulan Ke-</TableHead>
                    <TableHead className="text-xs text-right">Nilai Tagihan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DUMMY_RECURRING_DATA.map((item) => (
                    <TableRow key={item.contract_id}>
                      <TableCell>
                        <div className="font-medium text-sm">{item.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Kontrak ID {item.contract_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(item.period_start)}</div>
                        <div className="text-xs text-muted-foreground">
                          s/d {formatDate(item.period_end)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.month_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.month_label}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium text-sm">
                          {formatCurrency(item.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(item.amount, true)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
