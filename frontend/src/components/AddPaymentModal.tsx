import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CalendarIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { id as idLocale } from "date-fns/locale"
import { toast } from "sonner"

import { useAddPayment } from "@/hooks/useInvoices"
import type { Invoice, InvoiceType, PaymentMethod } from "@/types/api"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { cn, formatCurrency } from "@/lib/utils"

// Form schema
const paymentFormSchema = z.object({
  payment_date: z.date({ message: "Tanggal pembayaran wajib diisi" }),
  amount: z
    .string()
    .min(1, "Jumlah wajib diisi")
    .refine((val) => !isNaN(parseFloat(val.replace(/[,.]/g, ""))), {
      message: "Jumlah harus berupa angka",
    }),
  payment_method: z.string().optional(),
  reference_number: z.string().optional(),
  ppn_included: z.boolean(),
  pph23_included: z.boolean(),
  notes: z.string().optional(),
})

type PaymentFormValues = z.output<typeof paymentFormSchema>

interface AddPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceType: InvoiceType
  invoiceId: string
  invoice?: Invoice | null
  onSuccess?: () => void
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: "TRANSFER", label: "Transfer Bank" },
  { value: "CASH", label: "Tunai" },
  { value: "GIRO", label: "Giro" },
  { value: "CHECK", label: "Cek" },
  { value: "VIRTUAL_ACCOUNT", label: "Virtual Account" },
  { value: "OTHER", label: "Lainnya" },
]

export default function AddPaymentModal({
  open,
  onOpenChange,
  invoiceType,
  invoiceId,
  invoice,
  onSuccess,
}: AddPaymentModalProps) {
  const addPaymentMutation = useAddPayment()

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      payment_date: new Date(),
      amount: "",
      payment_method: "",
      reference_number: "",
      ppn_included: false,
      pph23_included: false,
      notes: "",
    },
  })

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        payment_date: new Date(),
        amount: "",
        payment_method: "",
        reference_number: "",
        ppn_included: false,
        pph23_included: false,
        notes: "",
      })
    }
  }, [open, form])

  // Parse currency string to number
  const parseAmount = (value: string): number => {
    // Remove thousand separators and convert comma to dot for decimals
    const cleaned = value.replace(/\./g, "").replace(",", ".")
    return parseFloat(cleaned) || 0
  }

  // Format number as currency input
  const formatAmountInput = (value: string): string => {
    // Remove non-numeric characters except comma
    const cleaned = value.replace(/[^\d,]/g, "")
    // Split by comma for decimal
    const parts = cleaned.split(",")
    // Format integer part with thousand separators
    if (parts[0]) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    }
    return parts.join(",")
  }

  const outstandingAmount = parseFloat(invoice?.outstanding_amount || "0")
  const netPayableAmount = parseFloat(invoice?.net_payable_amount || "0")

  const onSubmit = async (values: PaymentFormValues) => {
    const amount = parseAmount(values.amount)

    // Validate amount against outstanding
    if (amount > outstandingAmount) {
      toast.error(
        `Jumlah pembayaran tidak boleh melebihi outstanding (${formatCurrency(outstandingAmount, { compact: false })})`
      )
      return
    }

    if (amount <= 0) {
      toast.error("Jumlah pembayaran harus lebih dari 0")
      return
    }

    try {
      await addPaymentMutation.mutateAsync({
        invoiceType,
        id: invoiceId,
        data: {
          payment_date: format(values.payment_date, "yyyy-MM-dd"),
          amount,
          payment_method: values.payment_method as PaymentMethod | undefined,
          reference_number: values.reference_number || undefined,
          ppn_included: values.ppn_included,
          pph23_included: values.pph23_included,
          notes: values.notes || undefined,
        },
      })

      toast.success("Pembayaran berhasil ditambahkan")
      onSuccess?.()
    } catch (error) {
      toast.error("Gagal menambahkan pembayaran")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Pembayaran</DialogTitle>
          <DialogDescription>
            Tambahkan pembayaran untuk invoice {invoice?.invoice_number}
          </DialogDescription>
        </DialogHeader>

        {/* Invoice Summary */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Invoice</span>
            <span>{formatCurrency(invoice?.amount || "0", { compact: false })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">PPh 23 Withheld</span>
            <span className="text-red-600">
              - {formatCurrency(invoice?.pph_amount || "0", { compact: false })}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between font-medium">
            <span>Net Payable</span>
            <span>{formatCurrency(netPayableAmount, { compact: false })}</span>
          </div>
          <div className="flex justify-between text-sm text-emerald-600">
            <span>Sudah Dibayar</span>
            <span>{formatCurrency(invoice?.paid_amount || "0", { compact: false })}</span>
          </div>
          <div className="flex justify-between font-bold text-orange-600">
            <span>Outstanding</span>
            <span>{formatCurrency(outstandingAmount, { compact: false })}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Payment Date */}
            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Tanggal Pembayaran *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "d MMMM yyyy", { locale: idLocale })
                          ) : (
                            <span>Pilih tanggal</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah Pembayaran *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        {...field}
                        placeholder="0"
                        className="pl-10"
                        onChange={(e) => {
                          const formatted = formatAmountInput(e.target.value)
                          field.onChange(formatted)
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Maksimal: {formatCurrency(outstandingAmount, { compact: false })}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metode Pembayaran</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih metode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference Number */}
            <FormField
              control={form.control}
              name="reference_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor Referensi</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Contoh: TRF123456789" />
                  </FormControl>
                  <FormDescription>Nomor referensi bank atau bukti transfer</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tax Checkboxes */}
            <div className="space-y-3">
              <FormLabel>Status Pajak</FormLabel>
              <FormField
                control={form.control}
                name="ppn_included"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal">
                        PPN dibayar dalam pembayaran ini
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pph23_included"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal">
                        PPh 23 dibayar dalam pembayaran ini
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

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
                      placeholder="Catatan pembayaran (opsional)"
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
              <Button type="submit" disabled={addPaymentMutation.isPending}>
                {addPaymentMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Simpan Pembayaran
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
