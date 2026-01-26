import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FileUp, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { useUploadInvoiceDocument } from "@/hooks/useInvoices"
import type { InvoiceType, PaymentTransaction, DocumentType } from "@/types/api"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Document type options
const documentTypes: { value: DocumentType; label: string; description: string }[] = [
  { value: "BUKTI_BAYAR", label: "Bukti Bayar", description: "Bukti transfer atau pembayaran" },
  { value: "BUPOT_PPH23", label: "BUPOT PPh 23", description: "Bukti potong PPh 23" },
  { value: "BUKTI_BAYAR_PPH", label: "Bukti Bayar PPh", description: "Bukti pembayaran PPh" },
  { value: "BUKTI_BAYAR_PPN", label: "Bukti Bayar PPN", description: "Bukti pembayaran PPN" },
  { value: "INVOICE_PDF", label: "Invoice PDF", description: "Dokumen invoice" },
  { value: "FAKTUR_PAJAK", label: "Faktur Pajak", description: "Faktur pajak elektronik" },
  { value: "OTHER", label: "Lainnya", description: "Dokumen pendukung lainnya" },
]

// Allowed file types
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Form schema
const uploadFormSchema = z.object({
  document_type: z.enum([
    "BUKTI_BAYAR",
    "BUPOT_PPH23",
    "BUKTI_BAYAR_PPH",
    "BUKTI_BAYAR_PPN",
    "INVOICE_PDF",
    "FAKTUR_PAJAK",
    "OTHER",
  ], { message: "Tipe dokumen wajib dipilih" }),
  payment_transaction_id: z.string().optional(),
  notes: z.string().optional(),
})

type UploadFormValues = z.infer<typeof uploadFormSchema>

interface UploadDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceType: InvoiceType
  invoiceId: string
  payments?: PaymentTransaction[]
  onSuccess?: () => void
}

export default function UploadDocumentModal({
  open,
  onOpenChange,
  invoiceType,
  invoiceId,
  payments = [],
  onSuccess,
}: UploadDocumentModalProps) {
  const uploadMutation = useUploadInvoiceDocument()
  const [file, setFile] = React.useState<File | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      document_type: undefined,
      payment_transaction_id: "",
      notes: "",
    },
  })

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        document_type: undefined,
        payment_transaction_id: "",
        notes: "",
      })
      setFile(null)
    }
  }, [open, form])

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      toast.error("Tipe file tidak didukung. Gunakan PDF, JPG, atau PNG.")
      return
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("Ukuran file maksimal 10MB")
      return
    }

    setFile(selectedFile)
  }

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const removeFile = () => {
    setFile(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const onSubmit = async (values: UploadFormValues) => {
    if (!file) {
      toast.error("Pilih file terlebih dahulu")
      return
    }

    try {
      await uploadMutation.mutateAsync({
        invoiceType,
        id: invoiceId,
        file,
        documentType: values.document_type,
        paymentTransactionId: values.payment_transaction_id || undefined,
        notes: values.notes || undefined,
      })

      toast.success("Dokumen berhasil diupload")
      onSuccess?.()
    } catch (error) {
      toast.error("Gagal mengupload dokumen")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Dokumen</DialogTitle>
          <DialogDescription>
            Upload dokumen pendukung untuk invoice ini
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Document Type */}
            <FormField
              control={form.control}
              name="document_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Dokumen *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih tipe dokumen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span>{type.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Link to Payment (optional) */}
            {payments.length > 0 && (
              <FormField
                control={form.control}
                name="payment_transaction_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tautkan ke Pembayaran</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tidak ditautkan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Tidak ditautkan</SelectItem>
                        {payments.map((payment, index) => (
                          <SelectItem key={payment.id} value={payment.id}>
                            Pembayaran #{index + 1} - Rp{" "}
                            {parseFloat(payment.amount).toLocaleString("id-ID")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Opsional: Tautkan dokumen ke pembayaran tertentu
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* File Upload */}
            <FormItem>
              <FormLabel>File *</FormLabel>
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                  file && "border-solid border-emerald-500 bg-emerald-50"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="flex w-full items-center gap-3">
                    <div className="rounded-lg bg-emerald-100 p-2">
                      <FileUp className="size-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeFile}
                      className="shrink-0"
                    >
                      <X className="size-4" />
                      <span className="sr-only">Hapus file</span>
                    </Button>
                  </div>
                ) : (
                  <>
                    <FileUp className="size-10 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      Drag & drop file di sini, atau{" "}
                      <button
                        type="button"
                        className="text-primary underline hover:no-underline"
                        onClick={() => inputRef.current?.click()}
                      >
                        pilih file
                      </button>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, JPG, PNG (max 10MB)
                    </p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleInputChange}
                  className="hidden"
                />
              </div>
            </FormItem>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Catatan dokumen (opsional)"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={uploadMutation.isPending || !file}
              >
                {uploadMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Upload
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
