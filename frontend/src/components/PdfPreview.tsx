import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { apiService } from '@/services/api';

interface PdfPreviewProps {
  jobId: number;
  className?: string;
}

export function PdfPreview({ jobId, className }: PdfPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);

  // Retry function for failed loads
  const retryLoad = () => {
    console.log('Retrying PDF load...');
    setError(null);
    setIsLoading(true);
    setPdfBlob(null);
    setRetryCount(prev => prev + 1);
  };

  // Load PDF on mount
  React.useEffect(() => {
    async function loadPdf() {
      try {
        console.log(`Loading PDF for job ${jobId}... (attempt ${retryCount + 1})`);
        setIsLoading(true);
        setError(null);

        // Clear any existing timeout
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          setLoadTimeout(null);
        }

        const blob = await apiService.getJobPdf(jobId);
        console.log(`PDF blob received: ${blob.size} bytes, type: ${blob.type}`);

        if (blob.size === 0) {
          throw new Error('Received empty PDF file');
        }

        const url = URL.createObjectURL(blob);
        setPdfBlob(url);
        console.log('PDF blob URL created successfully');

        // Set timeout fallback in case iframe doesn't trigger load events
        const timeout = setTimeout(() => {
          console.warn('PDF iframe load timeout - assuming loaded');
          setIsLoading(false);
        }, 5000);
        setLoadTimeout(timeout);

      } catch (error) {
        console.error('Failed to load PDF:', error);
        setError(error instanceof Error ? error.message : 'Failed to load PDF');
        setIsLoading(false);
      }
    }

    loadPdf();

    // Cleanup blob URL and timeout on unmount
    return () => {
      if (pdfBlob) {
        URL.revokeObjectURL(pdfBlob);
      }
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [jobId, retryCount]); // Re-run when jobId changes or when retrying

  // Handle iframe load success
  const handleIframeLoad = () => {
    console.log('✅ PDF iframe loaded successfully');

    // Clear timeout since iframe loaded successfully
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      setLoadTimeout(null);
    }

    setIsLoading(false);
    setError(null);
  };

  // Handle iframe load error
  const handleIframeError = () => {
    console.error('❌ PDF iframe failed to load');

    // Clear timeout since we got an error
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      setLoadTimeout(null);
    }

    setError('Failed to load PDF in browser viewer');
    setIsLoading(false);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            PDF Preview Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-muted-foreground text-center">{error}</p>
            <Button variant="outline" onClick={retryLoad}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            PDF Preview
          </CardTitle>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="p-1"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className={`${isFullscreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-240px)]'}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span>Loading PDF...</span>
              </div>
            </div>
          ) : pdfBlob ? (
            <iframe
              src={pdfBlob}
              className="w-full h-full border-0"
              title="PDF Preview"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}