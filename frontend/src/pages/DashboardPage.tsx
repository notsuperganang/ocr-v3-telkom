// Dashboard overview page
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, CheckCircle, Clock } from 'lucide-react';
import { apiService } from '@/services/api';

interface DashboardStats {
  totalContracts: number;
  processing: number;
  awaitingReview: number;
  successRate: number;
}

interface RecentUpload {
  id: number;
  filename: string;
  status: string;
  createdAt: string;
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalContracts: 0,
    processing: 0,
    awaitingReview: 0,
    successRate: 0
  });
  const [_recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch contracts for total count
      const contractsData = await apiService.getContracts();
      
      // For now, we'll calculate simple stats. In a real app, you'd have dedicated endpoints
      const totalContracts = contractsData.total || 0;
      
      setStats({
        totalContracts,
        processing: 0, // Would come from processing jobs API
        awaitingReview: 0, // Would come from processing jobs API
        successRate: totalContracts > 0 ? 100 : 0 // Simplified calculation
      });
      
      // Set recent uploads (simplified)
      setRecentUploads([]);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Ringkasan aktivitas pemrosesan kontrak
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kontrak</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '--' : stats.totalContracts}</div>
            <p className="text-xs text-muted-foreground">
              Semua kontrak yang dikonfirmasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sedang Diproses</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '--' : stats.processing}</div>
            <p className="text-xs text-muted-foreground">
              Sedang dalam proses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Menunggu Review</CardTitle>
            <Upload className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '--' : stats.awaitingReview}</div>
            <p className="text-xs text-muted-foreground">
              Siap untuk dikonfirmasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tingkat Keberhasilan</CardTitle>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '--%' : `${stats.successRate}%`}</div>
            <p className="text-xs text-muted-foreground">
              Tingkat keberhasilan pemrosesan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Terbaru</CardTitle>
            <CardDescription>
              File terbaru yang diupload untuk diproses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <FileText className="w-8 h-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Belum ada upload terbaru</p>
                  <p className="text-xs text-muted-foreground">Upload file untuk melihatnya di sini</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Sistem</CardTitle>
            <CardDescription>
              Status kesehatan dan kondisi sistem saat ini
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-muted-foreground">Sehat</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Layanan OCR</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-muted-foreground">Tersedia</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Autentikasi</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-muted-foreground">Terkonfigurasi</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}