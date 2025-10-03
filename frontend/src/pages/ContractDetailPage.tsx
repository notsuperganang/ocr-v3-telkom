// Contract Detail Page with Telkom branding and smooth animations
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  FileText,
  CreditCard,
  Download,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  Hash,
  DollarSign,
  Users,
  Settings,
  AlertCircle,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useContract, useDownloadContractJson, useDownloadContractPdf } from '@/hooks/useContracts';

// Animation variants
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const cardVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  hover: { y: -2, transition: { duration: 0.2 } }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Telkom color palette
const telkomColors = {
  primary: '#E60012',      // Telkom red
  primaryDark: '#D30019',  // Darker red
  gray50: '#FAFAFA',       // Light gray background
  gray100: '#F5F5F5',      // Card background
  gray200: '#EEEEEE',      // Border
  gray300: '#E0E0E0',      // Divider
  gray600: '#757575',      // Secondary text
  gray700: '#616161',      // Medium gray
  gray800: '#424242',      // Primary text
  success: '#4CAF50',      // Success green
  warning: '#FF9800',      // Warning orange
  white: '#FFFFFF',
};

// Helper function to safely render value
const safeRenderValue = (value: any): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'object') {
    // If it's an object, try to find meaningful fields to display
    if (value.nama) return value.nama;
    if (value.name) return value.name;
    if (value.value) return value.value;
    // Otherwise return empty string to avoid React error
    return '-';
  }
  return String(value);
};

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper function to format file size
const formatFileSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

export function ContractDetailPage() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  
  const { data: contract, isLoading, error } = useContract(Number(contractId));
  const downloadJsonMutation = useDownloadContractJson();
  const downloadPdfMutation = useDownloadContractPdf();

  const handleDownloadJson = () => {
    if (contract) {
      downloadJsonMutation.mutate(contract.id);
    }
  };

  const handleDownloadPdf = () => {
    if (contract) {
      downloadPdfMutation.mutate(contract.id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-10 h-10 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error ? 'Gagal memuat detail kontrak' : 'Kontrak tidak ditemukan'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const contractData = contract.final_data;
  const customerInfo = contractData?.informasi_pelanggan || {};
  const serviceInfo = contractData?.layanan_utama || {};
  const paymentInfo = contractData?.tata_cara_pembayaran || {};
  const contactInfo = contractData?.kontak_person_telkom || {};
  const timeInfo = contractData?.jangka_waktu || {};

  return (
    <motion.div
      className="p-6 space-y-6 min-h-screen"
      style={{ backgroundColor: telkomColors.gray50 }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Header */}
      <motion.div
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/contracts')}
            className="hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: telkomColors.gray800 }}>
              Detail Kontrak
            </h1>
            <p className="text-lg" style={{ color: telkomColors.gray600 }}>
              {contract.filename}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge
            className="px-3 py-1"
            style={{
              backgroundColor: telkomColors.success,
              color: telkomColors.white,
              border: 'none'
            }}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Dikonfirmasi
          </Badge>
          
          <Button
            variant="outline"
            onClick={handleDownloadJson}
            disabled={downloadJsonMutation.isPending}
            className="border-gray-300 hover:bg-gray-100"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloadJsonMutation.isPending ? 'Mengunduh...' : 'JSON'}
          </Button>
          
          <Button
            onClick={handleDownloadPdf}
            disabled={downloadPdfMutation.isPending}
            style={{
              backgroundColor: telkomColors.primary,
              borderColor: telkomColors.primary,
              color: telkomColors.white
            }}
            className="hover:opacity-90 transition-opacity"
          >
            <FileText className="w-4 h-4 mr-2" />
            {downloadPdfMutation.isPending ? 'Mengunduh...' : 'PDF'}
          </Button>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Contract Overview */}
        <motion.div variants={cardVariants} whileHover="hover">
          <Card className="h-full border-gray-200 shadow-sm">
            <CardHeader style={{ backgroundColor: telkomColors.white }}>
              <CardTitle className="flex items-center text-lg" style={{ color: telkomColors.gray800 }}>
                <FileText className="w-5 h-5 mr-2" style={{ color: telkomColors.primary }} />
                Informasi Kontrak
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" style={{ backgroundColor: telkomColors.white }}>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: telkomColors.gray600 }}>ID Kontrak</span>
                  <span className="font-medium" style={{ color: telkomColors.gray800 }}>#{contract.id}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: telkomColors.gray600 }}>Versi</span>
                  <Badge variant="outline" className="border-gray-300">v{contract.version}</Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: telkomColors.gray600 }}>Ukuran File</span>
                  <span className="font-medium" style={{ color: telkomColors.gray800 }}>
                    {formatFileSize(contract.file_size_bytes)}
                  </span>
                </div>
                
                {contract.processing_time_seconds && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: telkomColors.gray600 }}>Waktu Proses</span>
                    <span className="font-medium" style={{ color: telkomColors.gray800 }}>
                      {contract.processing_time_seconds.toFixed(1)}s
                    </span>
                  </div>
                )}
                
                <hr style={{ backgroundColor: telkomColors.gray200, border: 'none', height: '1px' }} />
                
                <div className="space-y-2">
                  <div className="flex items-center text-sm" style={{ color: telkomColors.gray600 }}>
                    <User className="w-4 h-4 mr-2" />
                    Dikonfirmasi oleh: {contract.confirmed_by}
                  </div>
                  <div className="flex items-center text-sm" style={{ color: telkomColors.gray600 }}>
                    <Calendar className="w-4 h-4 mr-2" />
                    {format(new Date(contract.confirmed_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Customer Information */}
        <motion.div variants={cardVariants} whileHover="hover">
          <Card className="h-full border-gray-200 shadow-sm">
            <CardHeader style={{ backgroundColor: telkomColors.white }}>
              <CardTitle className="flex items-center text-lg" style={{ color: telkomColors.gray800 }}>
                <Building2 className="w-5 h-5 mr-2" style={{ color: telkomColors.primary }} />
                Informasi Pelanggan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" style={{ backgroundColor: telkomColors.white }}>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium" style={{ color: telkomColors.gray600 }}>
                    Nama Pelanggan
                  </label>
                  <p className="mt-1 font-medium" style={{ color: telkomColors.gray800 }}>
                    {safeRenderValue(customerInfo.nama_pelanggan)}
                  </p>
                </div>
                
                {safeRenderValue(customerInfo.alamat) !== '-' && (
                  <div>
                    <label className="text-sm font-medium flex items-center" style={{ color: telkomColors.gray600 }}>
                      <MapPin className="w-4 h-4 mr-1" />
                      Alamat
                    </label>
                    <p className="mt-1" style={{ color: telkomColors.gray800 }}>
                      {safeRenderValue(customerInfo.alamat)}
                    </p>
                  </div>
                )}
                
                {safeRenderValue(customerInfo.npwp) !== '-' && (
                  <div>
                    <label className="text-sm font-medium flex items-center" style={{ color: telkomColors.gray600 }}>
                      <Hash className="w-4 h-4 mr-1" />
                      NPWP
                    </label>
                    <p className="mt-1 font-mono" style={{ color: telkomColors.gray800 }}>
                      {safeRenderValue(customerInfo.npwp)}
                    </p>
                  </div>
                )}
                
                {safeRenderValue(customerInfo.perwakilan) !== '-' && (
                  <div>
                    <label className="text-sm font-medium flex items-center" style={{ color: telkomColors.gray600 }}>
                      <Users className="w-4 h-4 mr-1" />
                      Perwakilan
                    </label>
                    <p className="mt-1" style={{ color: telkomColors.gray800 }}>
                      {safeRenderValue(customerInfo.perwakilan)}
                    </p>
                  </div>
                )}
                
                {safeRenderValue(customerInfo.kontak_person) !== '-' && (
                  <div>
                    <label className="text-sm font-medium flex items-center" style={{ color: telkomColors.gray600 }}>
                      <Phone className="w-4 h-4 mr-1" />
                      Kontak Person
                    </label>
                    <p className="mt-1" style={{ color: telkomColors.gray800 }}>
                      {safeRenderValue(customerInfo.kontak_person)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Service Information */}
        <motion.div variants={cardVariants} whileHover="hover">
          <Card className="h-full border-gray-200 shadow-sm">
            <CardHeader style={{ backgroundColor: telkomColors.white }}>
              <CardTitle className="flex items-center text-lg" style={{ color: telkomColors.gray800 }}>
                <Settings className="w-5 h-5 mr-2" style={{ color: telkomColors.primary }} />
                Layanan Utama
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" style={{ backgroundColor: telkomColors.white }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: telkomColors.gray50 }}>
                  <div className="text-2xl font-bold" style={{ color: telkomColors.primary }}>
                    {serviceInfo.connectivity_telkom || 0}
                  </div>
                  <div className="text-sm" style={{ color: telkomColors.gray600 }}>
                    Connectivity Telkom
                  </div>
                </div>
                
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: telkomColors.gray50 }}>
                  <div className="text-2xl font-bold" style={{ color: telkomColors.primary }}>
                    {serviceInfo.non_connectivity_telkom || 0}
                  </div>
                  <div className="text-sm" style={{ color: telkomColors.gray600 }}>
                    Non-Connectivity
                  </div>
                </div>
                
                <div className="text-center p-4 rounded-lg col-span-2" style={{ backgroundColor: telkomColors.gray50 }}>
                  <div className="text-2xl font-bold" style={{ color: telkomColors.primary }}>
                    {serviceInfo.bundling || 0}
                  </div>
                  <div className="text-sm" style={{ color: telkomColors.gray600 }}>
                    Bundling Services
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Information */}
        <motion.div variants={cardVariants} whileHover="hover" className="lg:col-span-2">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader style={{ backgroundColor: telkomColors.white }}>
              <CardTitle className="flex items-center text-lg" style={{ color: telkomColors.gray800 }}>
                <CreditCard className="w-5 h-5 mr-2" style={{ color: telkomColors.primary }} />
                Tata Cara Pembayaran
              </CardTitle>
              <CardDescription>
                {paymentInfo.description || 'Informasi pembayaran tidak tersedia'}
              </CardDescription>
            </CardHeader>
            <CardContent style={{ backgroundColor: telkomColors.white }}>
              {paymentInfo.method_type === 'termin' && paymentInfo.termin_payments ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: telkomColors.gray50 }}>
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 mr-2" style={{ color: telkomColors.primary }} />
                      <span className="font-medium" style={{ color: telkomColors.gray800 }}>
                        Total Kontrak
                      </span>
                    </div>
                    <span className="text-xl font-bold" style={{ color: telkomColors.primary }}>
                      {formatCurrency(paymentInfo.total_amount || 0)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paymentInfo.termin_payments.map((termin: any, index: number) => (
                      <motion.div
                        key={index}
                        className="p-4 border rounded-lg"
                        style={{ borderColor: telkomColors.gray200 }}
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium" style={{ color: telkomColors.gray800 }}>
                            {termin.period}
                          </span>
                          <Badge
                            style={{
                              backgroundColor: telkomColors.gray100,
                              color: telkomColors.gray700,
                              border: 'none'
                            }}
                          >
                            #{termin.termin_number}
                          </Badge>
                        </div>
                        <div className="text-lg font-semibold" style={{ color: telkomColors.primary }}>
                          {formatCurrency(termin.amount)}
                        </div>
                        {termin.raw_text && (
                          <div className="text-xs mt-2" style={{ color: telkomColors.gray600 }}>
                            {termin.raw_text}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: telkomColors.gray600 }}>
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Informasi pembayaran tidak tersedia</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Telkom Contact & Contract Period */}
        <motion.div variants={cardVariants} whileHover="hover">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader style={{ backgroundColor: telkomColors.white }}>
              <CardTitle className="flex items-center text-lg" style={{ color: telkomColors.gray800 }}>
                <User className="w-5 h-5 mr-2" style={{ color: telkomColors.primary }} />
                Kontak Telkom & Jangka Waktu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" style={{ backgroundColor: telkomColors.white }}>
              {/* Telkom Contact */}
              <div>
                <h4 className="font-medium mb-3" style={{ color: telkomColors.gray800 }}>
                  Kontak Person Telkom
                </h4>
                <div className="space-y-2">
                  {safeRenderValue(contactInfo.nama) !== '-' ? (
                    <>
                      <div className="flex items-center text-sm">
                        <User className="w-4 h-4 mr-2" style={{ color: telkomColors.gray600 }} />
                        <span style={{ color: telkomColors.gray800 }}>{safeRenderValue(contactInfo.nama)}</span>
                      </div>
                      {safeRenderValue(contactInfo.jabatan) !== '-' && (
                        <div className="flex items-center text-sm">
                          <Building2 className="w-4 h-4 mr-2" style={{ color: telkomColors.gray600 }} />
                          <span style={{ color: telkomColors.gray800 }}>{safeRenderValue(contactInfo.jabatan)}</span>
                        </div>
                      )}
                      {safeRenderValue(contactInfo.email) !== '-' && (
                        <div className="flex items-center text-sm">
                          <Mail className="w-4 h-4 mr-2" style={{ color: telkomColors.gray600 }} />
                          <span style={{ color: telkomColors.gray800 }}>{safeRenderValue(contactInfo.email)}</span>
                        </div>
                      )}
                      {safeRenderValue(contactInfo.telepon) !== '-' && (
                        <div className="flex items-center text-sm">
                          <Phone className="w-4 h-4 mr-2" style={{ color: telkomColors.gray600 }} />
                          <span style={{ color: telkomColors.gray800 }}>{safeRenderValue(contactInfo.telepon)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm" style={{ color: telkomColors.gray600 }}>
                      Tidak tersedia
                    </p>
                  )}
                </div>
              </div>

              <hr style={{ backgroundColor: telkomColors.gray200, border: 'none', height: '1px' }} />

              {/* Contract Period */}
              <div>
                <h4 className="font-medium mb-3 flex items-center" style={{ color: telkomColors.gray800 }}>
                  <Calendar className="w-4 h-4 mr-2" style={{ color: telkomColors.primary }} />
                  Jangka Waktu Kontrak
                </h4>
                <div className="space-y-2">
                  {safeRenderValue(timeInfo.mulai) !== '-' || safeRenderValue(timeInfo.akhir) !== '-' ? (
                    <>
                      {safeRenderValue(timeInfo.mulai) !== '-' && (
                        <div className="flex justify-between">
                          <span className="text-sm" style={{ color: telkomColors.gray600 }}>Mulai:</span>
                          <span className="text-sm font-medium" style={{ color: telkomColors.gray800 }}>
                            {format(new Date(timeInfo.mulai), 'dd MMMM yyyy', { locale: id })}
                          </span>
                        </div>
                      )}
                      {safeRenderValue(timeInfo.akhir) !== '-' && (
                        <div className="flex justify-between">
                          <span className="text-sm" style={{ color: telkomColors.gray600 }}>Berakhir:</span>
                          <span className="text-sm font-medium" style={{ color: telkomColors.gray800 }}>
                            {format(new Date(timeInfo.akhir), 'dd MMMM yyyy', { locale: id })}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm" style={{ color: telkomColors.gray600 }}>
                      Tidak tersedia
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}