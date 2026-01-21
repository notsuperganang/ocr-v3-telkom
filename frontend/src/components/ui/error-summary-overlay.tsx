import { useState } from 'react';
import { AlertCircle, X, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export interface ErrorItem {
  fieldPath: string;
  message: string;
}

interface ErrorSummaryOverlayProps {
  errors: ErrorItem[];
  onErrorClick: (fieldPath: string) => void;
  className?: string;
}

export function ErrorSummaryOverlay({
  errors,
  onErrorClick,
  className,
}: ErrorSummaryOverlayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no errors
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      <AnimatePresence mode="wait">
        {isExpanded ? (
          // Expanded view - error list
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-lg border border-gray-200 w-72 max-h-80 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-orange-50 rounded-t-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">
                  {errors.length} {errors.length === 1 ? 'Masalah' : 'Masalah'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 hover:bg-orange-100 rounded transition-colors"
                  aria-label="Minimize"
                >
                  <ChevronDown className="w-4 h-4 text-orange-600" />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 hover:bg-orange-100 rounded transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-orange-600" />
                </button>
              </div>
            </div>

            {/* Error list */}
            <div className="overflow-y-auto flex-1 p-2">
              <ul className="space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>
                    <button
                      onClick={() => {
                        onErrorClick(error.fieldPath);
                        setIsExpanded(false);
                      }}
                      className="w-full text-left p-2 text-sm text-gray-700 hover:bg-orange-50 rounded transition-colors flex items-start gap-2"
                    >
                      <span className="text-orange-500 mt-0.5">•</span>
                      <span className="flex-1">{error.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer hint */}
            <div className="p-2 border-t bg-gray-50 rounded-b-lg">
              <p className="text-xs text-muted-foreground text-center">
                Klik item untuk menuju ke field
              </p>
            </div>
          </motion.div>
        ) : (
          // Collapsed view - badge button
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsExpanded(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg',
              'bg-orange-500 hover:bg-orange-600 text-white',
              'transition-all duration-200 hover:shadow-xl',
              'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2'
            )}
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {errors.length} {errors.length === 1 ? 'Masalah' : 'Masalah'}
            </span>
            <ChevronUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
