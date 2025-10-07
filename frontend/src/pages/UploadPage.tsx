import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { FileUpload, type FileUploadRef } from '@/components/ui/file-upload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  RefreshCw,
  Eye,
  Info
} from 'lucide-react';
import { apiService } from '@/services/api';

// Types untuk file upload
interface UploadFile {
  id: string;
  file: File;
  status: 'selected' | 'uploading' | 'processing' | 'awaiting_review' | 'completed' | 'failed';
  progress: number;
  jobId?: number;
  error?: string;
  uploadedAt?: Date;
  processingTime?: number;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['application/pdf'];
const POLL_INTERVAL = 2000; // 2 detik

export function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const pollingIntervals = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const pollingInProgress = useRef<Set<number>>(new Set()); // Track in-progress polls
  const fileUploadRef = useRef<FileUploadRef>(null);

  // Format ukuran file
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Validasi file
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Hanya file PDF yang diperbolehkan';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Ukuran file maksimal 50MB';
    }
    return null;
  };

  // Handle file selection from FileUpload component
  const handleFileSelection = (selectedFiles: File[]) => {
    const newFiles: UploadFile[] = [];

    selectedFiles.forEach((file) => {
      // Check total file limit
      if (files.length + newFiles.length >= MAX_FILES) {
        return;
      }

      // Check if file already exists
      const existingFile = files.find(f => f.file.name === file.name && f.file.size === file.size);
      if (existingFile) {
        return;
      }

      const error = validateFile(file);
      const uploadFile: UploadFile = {
        id: Date.now().toString() + Math.random().toString(36),
        file,
        status: error ? 'failed' : 'selected',
        progress: 0,
        error: error || undefined
      };

      newFiles.push(uploadFile);
    });

    setFiles(prev => [...prev, ...newFiles]);
  };

  // Remove file
  const removeFile = (fileId: string) => {
    // Find the file and stop its polling if it has a jobId
    const fileToRemove = files.find(f => f.id === fileId);
    if (fileToRemove?.jobId) {
      const interval = pollingIntervals.current.get(fileToRemove.jobId);
      if (interval) {
        clearInterval(interval);
        pollingIntervals.current.delete(fileToRemove.jobId);
      }
    }

    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Get status badge
  const getStatusBadge = (status: UploadFile['status']) => {
    switch (status) {
      case 'selected':
        return <Badge variant="secondary" className="bg-muted">Siap Upload</Badge>;
      case 'uploading':
        return <Badge className="bg-primary">Mengupload</Badge>;
      case 'processing':
        return <Badge className="bg-primary animate-pulse">Memproses</Badge>;
      case 'awaiting_review':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Siap Review</Badge>;
      case 'completed':
        return <Badge className="bg-green-600 hover:bg-green-600">Selesai</Badge>;
      case 'failed':
        return <Badge variant="destructive">Gagal</Badge>;
      default:
        return null;
    }
  };

  // Get status icon
  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'selected':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'uploading':
        return <RefreshCw className="w-4 h-4 animate-spin text-primary" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 animate-spin text-primary" />;
      case 'awaiting_review':
        return <Eye className="w-4 h-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Get progress message
  const getProgressMessage = (file: UploadFile) => {
    switch (file.status) {
      case 'selected':
        return 'Siap untuk diupload';
      case 'uploading':
        return `Mengupload... ${file.progress}%`;
      case 'processing':
        return 'Sedang memproses dengan OCR...';
      case 'awaiting_review':
        return 'Siap untuk direview dan dikonfirmasi';
      case 'completed':
        return `Selesai ${file.processingTime ? `dalam ${file.processingTime}s` : ''}`;
      case 'failed':
        return file.error || 'Upload gagal';
      default:
        return '';
    }
  };

  // Poll job status
  const pollJobStatus = useCallback(async (jobId: number, fileId: string) => {
    // Prevent multiple simultaneous polls for the same job
    if (pollingInProgress.current.has(jobId)) {
      return;
    }

    // Check if interval still exists (might have been cleared by previous response)
    if (!pollingIntervals.current.has(jobId)) {
      return;
    }

    pollingInProgress.current.add(jobId);

    try {
      const status = await apiService.getJobStatus(jobId);

      setFiles(prev => prev.map(file => {
        if (file.id === fileId) {
          let newStatus: UploadFile['status'] = 'processing';
          let progress = file.progress;

          switch (status.status) {
            case 'processing':
              newStatus = 'processing';
              progress = 50;
              break;
            case 'awaiting_review':
              newStatus = 'awaiting_review';
              progress = 100;
              break;
            case 'completed':
              newStatus = 'completed';
              progress = 100;
              break;
            case 'failed':
              newStatus = 'failed';
              progress = 0;
              break;
          }

          return {
            ...file,
            status: newStatus,
            progress,
            error: status.error_message || file.error,
            processingTime: status.processing_time_seconds
          };
        }
        return file;
      }));

      // Stop polling if job is finished
      if (['awaiting_review', 'completed', 'failed'].includes(status.status)) {
        const interval = pollingIntervals.current.get(jobId);
        if (interval) {
          clearInterval(interval);
          pollingIntervals.current.delete(jobId);
          pollingInProgress.current.delete(jobId);
        }
      }
    } catch (error) {
      console.error('Error polling job status:', error);
      const interval = pollingIntervals.current.get(jobId);
      if (interval) {
        clearInterval(interval);
        pollingIntervals.current.delete(jobId);
        pollingInProgress.current.delete(jobId);
      }
    } finally {
      // Always remove from in-progress set
      pollingInProgress.current.delete(jobId);
    }
  }, []);

  // Start polling for a job
  const startPolling = useCallback((jobId: number, fileId: string) => {
    // Clear any existing interval for this job to prevent duplicates
    const existingInterval = pollingIntervals.current.get(jobId);
    if (existingInterval) {
      clearInterval(existingInterval);
      pollingIntervals.current.delete(jobId);
    }

    const interval = setInterval(() => {
      pollJobStatus(jobId, fileId);
    }, POLL_INTERVAL);

    pollingIntervals.current.set(jobId, interval);

    // Initial poll
    pollJobStatus(jobId, fileId);
  }, [pollJobStatus]);

  // Upload single file
  const uploadSingleFile = async (file: UploadFile): Promise<void> => {
    try {
      setFiles(prev => prev.map(f =>
        f.id === file.id
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      // Simulate upload progress
      for (let progress = 0; progress <= 90; progress += 10) {
        setFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, progress } : f
        ));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const response = await apiService.uploadFile(file.file);

      setFiles(prev => prev.map(f =>
        f.id === file.id
          ? {
              ...f,
              status: 'processing',
              progress: 100,
              jobId: response.job_id,
              uploadedAt: new Date()
            }
          : f
      ));

      startPolling(response.job_id, file.id);

    } catch (error: any) {
      setFiles(prev => prev.map(f =>
        f.id === file.id
          ? {
              ...f,
              status: 'failed',
              progress: 0,
              error: error.message || 'Upload gagal'
            }
          : f
      ));
    }
  };

  // Upload all selected files
  const handleBulkUpload = async () => {
    const selectedFiles = files.filter(f => f.status === 'selected');
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of selectedFiles) {
        await uploadSingleFile(file);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      pollingIntervals.current.forEach(interval => clearInterval(interval));
      pollingIntervals.current.clear();
    };
  }, []);

  return (
    <div className="min-h-screen w-full relative">
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-red-50 via-white to-orange-50 -z-10">
        {/* Subtle animated orbs */}
        <motion.div
          className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.2, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-orange-200/20 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-r from-red-100/10 via-orange-100/10 to-red-100/10 rounded-full blur-3xl"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 py-8 max-w-6xl">
        {/* Header Section */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <Upload className="w-8 h-8 text-primary" />
          </motion.div>
          <motion.h1
            className="text-4xl font-bold text-foreground mb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Upload Kontrak Telkom
          </motion.h1>
          <motion.p
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Ekstraksi data otomatis dari dokumen kontrak PDF menggunakan teknologi OCR
          </motion.p>
        </motion.div>

        {/* Main Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Card className="mb-6 border-2 shadow-lg bg-clip-padding backdrop-filter backdrop-blur-md bg-white/80 border-white/20">
            <CardHeader>
              <CardTitle className="text-2xl">Upload File Kontrak</CardTitle>
              <CardDescription className="text-base">
                Maksimal 5 file per batch • Ukuran maksimal 50MB per file • Format PDF
              </CardDescription>
            </CardHeader>
          <CardContent>
            {files.length < MAX_FILES ? (
              <FileUpload ref={fileUploadRef} onChange={handleFileSelection} />
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/30">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium text-foreground mb-1">
                  Batas Maksimal Tercapai
                </p>
                <p className="text-muted-foreground">
                  Anda telah mencapai batas 5 file. Hapus beberapa file untuk menambahkan yang baru.
                </p>
              </div>
            )}

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg text-foreground">
                    File Terpilih ({files.length}/{MAX_FILES})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Stop all polling intervals
                      pollingIntervals.current.forEach(interval => clearInterval(interval));
                      pollingIntervals.current.clear();

                      setFiles([]);
                      fileUploadRef.current?.clearFiles();
                    }}
                    disabled={isUploading}
                    className="text-muted-foreground hover:text-white hover:bg-destructive"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Hapus Semua
                  </Button>
                </div>

                <div className="space-y-3">
                  {files.map((file, index) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      <Card className="border shadow-sm hover:shadow-md transition-shadow bg-clip-padding backdrop-filter backdrop-blur-md bg-white/75 border-white/20">
                        <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            {getStatusIcon(file.status)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground truncate">
                                {file.file.name}
                              </p>
                              {getStatusBadge(file.status)}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{formatFileSize(file.file.size)}</span>
                              <span>•</span>
                              <span>{getProgressMessage(file)}</span>
                            </div>

                            {/* Progress Bar */}
                            {(file.status === 'uploading' || file.status === 'processing') && (
                              <div className="mt-2">
                                <Progress value={file.progress} className="h-2" />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Review Button */}
                            {file.status === 'awaiting_review' && (
                              <Button
                                onClick={() => navigate(`/review/${file.jobId}`)}
                                size="sm"
                                className="bg-primary hover:bg-primary/90"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Review
                              </Button>
                            )}

                            {/* Remove Button */}
                            {(file.status === 'selected' || file.status === 'failed') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(file.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Upload Actions */}
                {files.some(f => f.status === 'selected') && (
                  <div className="mt-6 flex gap-3">
                    <Button
                      onClick={handleBulkUpload}
                      disabled={isUploading}
                      size="lg"
                      className="flex-1 bg-primary hover:bg-primary/90 text-lg h-12"
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                          Mengupload...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 mr-2" />
                          Upload {files.filter(f => f.status === 'selected').length} File
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>

        {/* Guidelines Grid */}
        <motion.div
          className="grid md:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <Card className="border hover:border-primary/50 transition-colors bg-clip-padding backdrop-filter backdrop-blur-md bg-white/70 border-white/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Format Dokumen</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>• Kontrak Telkom (K.TEL)</p>
                <p>• PDF dengan teks jelas</p>
                <p>• Maksimal 50MB/file</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            <Card className="border hover:border-primary/50 transition-colors bg-clip-padding backdrop-filter backdrop-blur-md bg-white/70 border-white/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Proses Otomatis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>• Upload & antrian</p>
                <p>• Ekstraksi OCR otomatis</p>
                <p>• Review & konfirmasi</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9, duration: 0.4 }}
          >
            <Card className="border hover:border-primary/50 transition-colors bg-clip-padding backdrop-filter backdrop-blur-md bg-white/70 border-white/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">Waktu Proses</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>• 15-45 detik/dokumen</p>
                <p>• Tergantung ukuran file</p>
                <p>• Notifikasi real-time</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
        >
          <Card className="mt-4 bg-clip-padding backdrop-filter backdrop-blur-md bg-red-50/60 border border-white/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  <p className="font-medium mb-1">Tips untuk hasil terbaik:</p>
                  <p className="text-muted-foreground">
                    Pastikan dokumen PDF memiliki kualitas scan yang baik dan teks dapat terbaca dengan jelas.
                    Dokumen dengan tabel dan struktur yang rapi akan menghasilkan ekstraksi data yang lebih akurat.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
