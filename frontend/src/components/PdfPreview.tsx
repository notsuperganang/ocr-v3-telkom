import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { apiService } from '@/services/api';
import type { PdfViewerState } from '@/types/extraction';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfPreviewProps {
  jobId: number;
  maxPages?: number; // Limit to first N pages (default: 2)
  className?: string;
}

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_ZOOM = 1;
const MAX_PAGES_DEFAULT = 2;

export function PdfPreview({ jobId, maxPages = MAX_PAGES_DEFAULT, className }: PdfPreviewProps) {
  const [viewerState, setViewerState] = useState<PdfViewerState>({
    currentPage: 1,
    scale: DEFAULT_ZOOM,
    isLoading: true,
    error: undefined,
  });

  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load PDF blob from API
  const loadPdf = useCallback(async () => {
    try {
      setViewerState(prev => ({ ...prev, isLoading: true, error: undefined }));

      const blob = await apiService.getJobPdf(jobId);
      const url = URL.createObjectURL(blob);
      setPdfBlob(url);
    } catch (error) {
      console.error('Failed to load PDF:', error);
      setViewerState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load PDF'
      }));
    }
  }, [jobId]);

  // Load PDF on mount
  React.useEffect(() => {
    loadPdf();

    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlob) {
        URL.revokeObjectURL(pdfBlob);
      }
    };
  }, [loadPdf]);

  // PDF document load success
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setViewerState(prev => ({
      ...prev,
      numPages: Math.min(numPages, maxPages),
      isLoading: false,
      error: undefined,
    }));
  };

  // PDF document load error
  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setViewerState(prev => ({
      ...prev,
      isLoading: false,
      error: 'Failed to load PDF document',
    }));
  };

  // Page navigation
  const goToPage = (page: number) => {
    const maxPage = viewerState.numPages || maxPages;
    const newPage = Math.max(1, Math.min(page, maxPage));
    setViewerState(prev => ({ ...prev, currentPage: newPage }));
  };

  // Zoom controls
  const zoomIn = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(viewerState.scale);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setViewerState(prev => ({ ...prev, scale: ZOOM_LEVELS[currentIndex + 1] }));
    }
  };

  const zoomOut = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(viewerState.scale);
    if (currentIndex > 0) {
      setViewerState(prev => ({ ...prev, scale: ZOOM_LEVELS[currentIndex - 1] }));
    }
  };

  const resetZoom = () => {
    setViewerState(prev => ({ ...prev, scale: DEFAULT_ZOOM }));
  };

  // Get zoom percentage
  const zoomPercentage = Math.round(viewerState.scale * 100);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (viewerState.error) {
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
            <p className="text-muted-foreground text-center">{viewerState.error}</p>
            <Button variant="outline" onClick={loadPdf}>
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
            {viewerState.numPages && (
              <Badge variant="secondary">
                {viewerState.numPages} page{viewerState.numPages !== 1 ? 's' : ''}
              </Badge>
            )}
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

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 text-sm">
          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(viewerState.currentPage - 1)}
              disabled={viewerState.currentPage <= 1}
              className="p-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="px-2 py-1 bg-muted rounded text-xs min-w-[60px] text-center">
              {viewerState.currentPage} / {viewerState.numPages || maxPages}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(viewerState.currentPage + 1)}
              disabled={viewerState.currentPage >= (viewerState.numPages || maxPages)}
              className="p-1"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={viewerState.scale <= ZOOM_LEVELS[0]}
              className="p-1"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              className="px-2 py-1 text-xs min-w-[50px]"
            >
              {zoomPercentage}%
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={viewerState.scale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              className="p-1"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className={`overflow-auto ${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-[calc(100vh-280px)]'}`}>
          {viewerState.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span>Loading PDF...</span>
              </div>
            </div>
          ) : pdfBlob ? (
            <Document
              file={pdfBlob}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-64">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <span>Loading PDF...</span>
                  </div>
                </div>
              }
              error={
                <div className="flex items-center justify-center h-64">
                  <div className="flex items-center gap-3 text-red-500">
                    <AlertCircle className="w-6 h-6" />
                    <span>Failed to load PDF</span>
                  </div>
                </div>
              }
              className="flex flex-col items-center"
            >
              <Page
                pageNumber={viewerState.currentPage}
                scale={viewerState.scale}
                loading={
                  <div className="flex items-center justify-center h-64 border border-dashed border-gray-300 rounded">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span>Loading page...</span>
                    </div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center h-64 border border-dashed border-red-300 rounded">
                    <div className="flex items-center gap-3 text-red-500">
                      <AlertCircle className="w-6 h-6" />
                      <span>Failed to load page</span>
                    </div>
                  </div>
                }
                className="border border-gray-200 rounded shadow-sm mb-4"
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}