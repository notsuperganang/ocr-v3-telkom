// Documents Card Component
import * as React from "react"
import { motion } from "motion/react"
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  Clock,
  Minus,
  FolderOpen,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Invoice, InvoiceDocument, DocumentType } from "@/types/api"
import { formatDateTime, documentTypeLabels } from "./invoice-utils"
import {
  Skeleton,
  SectionHeader,
  EmptyState,
  cardVariants,
} from "./InvoiceUIComponents"

interface DocumentsCardProps {
  invoice: Invoice | undefined
  documents: InvoiceDocument[]
  isLoading: boolean
  onUploadDocument: () => void
}

// Document Card sub-component
interface DocumentCardProps {
  document: InvoiceDocument
}

const DocumentCard: React.FC<DocumentCardProps> = ({ document }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -2, scale: 1.01 }}
    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 p-3 transition-shadow hover:shadow-md"
  >
    <div className="rounded-xl bg-rose-50 p-2.5">
      <FileText className="size-5 text-rose-500" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate text-slate-900">{document.file_name}</p>
      <p className="text-xs text-slate-500">
        {documentTypeLabels[document.document_type]} • {formatDateTime(document.uploaded_at)}
      </p>
    </div>
    <Button variant="ghost" size="icon" asChild className="hover:bg-rose-50">
      <a href={document.file_path} target="_blank" rel="noopener noreferrer">
        <Download className="size-4 text-slate-600" />
        <span className="sr-only">Download</span>
      </a>
    </Button>
  </motion.div>
)

// Document Checklist sub-component
interface DocumentChecklistProps {
  label: string
  uploaded: boolean
  warning?: boolean
}

const DocumentChecklist: React.FC<DocumentChecklistProps> = ({
  label,
  uploaded,
  warning,
}) => (
  <div className="flex items-center justify-between py-2 px-1">
    <span className="text-sm text-slate-700">{label}</span>
    {uploaded ? (
      <div className="flex items-center gap-1.5 text-emerald-600">
        <CheckCircle2 className="size-4" />
        <span className="text-xs font-medium">Lengkap</span>
      </div>
    ) : warning ? (
      <div className="flex items-center gap-1.5 text-amber-600">
        <Clock className="size-3.5" />
        <span className="text-xs font-medium">Menunggu</span>
      </div>
    ) : (
      <div className="flex items-center gap-1.5 text-slate-400">
        <Minus className="size-4" />
        <span className="text-xs">Belum ada</span>
      </div>
    )}
  </div>
)

export const DocumentsCard: React.FC<DocumentsCardProps> = ({
  invoice,
  documents,
  isLoading,
  onUploadDocument,
}) => {
  // Check which documents are uploaded
  const hasDocument = (type: DocumentType) =>
    documents.some((d) => d.document_type === type)

  // Required documents checklist
  const requiredDocs = [
    { type: "BUKTI_BAYAR" as DocumentType, label: "Bukti Bayar", warning: false },
    { type: "BUPOT_PPH23" as DocumentType, label: "BUPOT PPh 23", warning: !invoice?.pph23_paid },
    { type: "INVOICE_PDF" as DocumentType, label: "Invoice PDF", warning: false },
    { type: "FAKTUR_PAJAK" as DocumentType, label: "Faktur Pajak", warning: false },
  ]

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover={{ y: -4 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
        <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
          <div className="flex flex-row items-start justify-between">
            <SectionHeader
              icon={FolderOpen}
              tag="Dokumen"
              title="Dokumen Invoice"
              description={`${documents.length} dokumen tersedia`}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={onUploadDocument}
              className="border-rose-200 hover:bg-rose-50"
            >
              <Upload className="mr-2 size-4" />
              Upload Dokumen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="bg-white p-5 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              {/* Document Checklist */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-500" />
                  Dokumen Diperlukan
                </div>
                <div className="divide-y divide-slate-100">
                  {requiredDocs.map((doc) => (
                    <DocumentChecklist
                      key={doc.type}
                      label={doc.label}
                      uploaded={hasDocument(doc.type)}
                      warning={doc.warning}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Uploaded Documents List */}
              {documents.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Belum ada dokumen"
                  description="Upload bukti bayar, BUPOT, atau dokumen lainnya"
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 px-1">
                    Dokumen Terupload
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {documents.map((doc) => (
                      <DocumentCard key={doc.id} document={doc} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default DocumentsCard
