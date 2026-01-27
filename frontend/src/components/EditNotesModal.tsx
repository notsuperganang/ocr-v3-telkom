import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { useUpdateInvoiceNotes } from "@/hooks/useInvoices"
import type { InvoiceType } from "@/types/api"

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
import { Textarea } from "@/components/ui/textarea"

// Form schema
const notesFormSchema = z.object({
  notes: z.string().max(1000, "Catatan maksimal 1000 karakter").optional(),
})

type NotesFormValues = z.infer<typeof notesFormSchema>

interface EditNotesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceType: InvoiceType
  invoiceId: string
  currentNotes?: string | null
  onSuccess?: () => void
}

export default function EditNotesModal({
  open,
  onOpenChange,
  invoiceType,
  invoiceId,
  currentNotes,
  onSuccess,
}: EditNotesModalProps) {
  const updateNotesMutation = useUpdateInvoiceNotes()

  const form = useForm<NotesFormValues>({
    resolver: zodResolver(notesFormSchema),
    defaultValues: {
      notes: currentNotes || "",
    },
  })

  // Reset form when modal opens with current notes
  React.useEffect(() => {
    if (open) {
      form.reset({
        notes: currentNotes || "",
      })
    }
  }, [open, currentNotes, form])

  const onSubmit = async (values: NotesFormValues) => {
    try {
      await updateNotesMutation.mutateAsync({
        invoiceType,
        id: invoiceId,
        notes: values.notes || "",
      })

      toast.success("Catatan berhasil diperbarui")
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      toast.error("Gagal memperbarui catatan")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-rose-600" />
            Edit Catatan Invoice
          </DialogTitle>
          <DialogDescription>
            Tambahkan atau ubah catatan untuk invoice ini
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      placeholder="Masukkan catatan invoice (opsional)"
                      rows={6}
                      className="resize-none"
                    />
                  </FormControl>
                  <FormDescription>
                    Maksimal 1000 karakter. Kosongkan untuk menghapus catatan.
                  </FormDescription>
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
                disabled={updateNotesMutation.isPending}
              >
                {updateNotesMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
