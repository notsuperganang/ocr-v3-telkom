import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  MoreHorizontal,
  FileJson,
  FileText,
  Trash2,
  Eye,
  Calendar,
  Building2,
  FileX,
  Loader2,
} from 'lucide-react';
import type { ContractListResponse } from '@/types/api';
import {
  useDownloadContractJson,
  useDownloadContractPdf,
  useDeleteContract,
} from '@/hooks/useContracts';
import { PaymentMethodBadge } from './PaymentMethodBadge';
import { tableRowStagger, tableRowItem } from '@/lib/motion';

interface ContractsTableProps {
  data: ContractListResponse;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export function ContractsTable({ data, isLoading, onPageChange }: ContractsTableProps) {
  const navigate = useNavigate();
  const downloadJsonMutation = useDownloadContractJson();
  const downloadPdfMutation = useDownloadContractPdf();
  const deleteContractMutation = useDeleteContract();

  const handleDownloadJson = (contractId: number) => {
    downloadJsonMutation.mutate(contractId);
  };

  const handleDownloadPdf = (contractId: number) => {
    downloadPdfMutation.mutate(contractId);
  };

  const handleDeleteContract = (contractId: number) => {
    deleteContractMutation.mutate(contractId);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Memuat data kontrak...</p>
        </div>
      </div>
    );
  }

  if (!data.contracts.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center py-16"
      >
        <div className="flex justify-center mb-6">
          <FileX className="w-20 h-20 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-3">
          Belum Ada Kontrak Terkonfirmasi
        </h3>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm">
          Upload file kontrak pertama Anda untuk memulai. Setelah diproses dan dikonfirmasi,
          kontrak akan muncul di sini.
        </p>
        <Button onClick={() => window.location.href = '/upload'} size="lg">
          <FileText className="mr-2 h-4 w-4" />
          Upload File Kontrak
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">File</TableHead>
                <TableHead className="font-semibold">Pelanggan</TableHead>
                <TableHead className="font-semibold">Periode Kontrak</TableHead>
                <TableHead className="font-semibold">Metode Pembayaran</TableHead>
                <TableHead className="font-semibold">Dikonfirmasi</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-[100px] font-semibold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <motion.tbody
              variants={tableRowStagger}
              initial="hidden"
              animate="visible"
            >
              {data.contracts.map((contract) => (
                <motion.tr
                  key={contract.id}
                  variants={tableRowItem}
                  className="group border-b transition-all duration-150 hover:bg-muted/50 even:bg-muted/20"
                >
                {/* File */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-sm truncate max-w-[200px]">
                      {contract.filename}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {contract.id}
                    </div>
                  </div>
                </TableCell>

                {/* Customer */}
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {contract.customer_name || 'Tidak diketahui'}
                    </span>
                  </div>
                </TableCell>

                {/* Contract Period */}
                <TableCell>
                  {contract.contract_start_date && contract.contract_end_date ? (
                    <div className="text-sm">
                      <div className="font-medium">
                        {format(new Date(contract.contract_start_date), 'dd MMM yyyy', {
                          locale: id,
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        s/d {format(new Date(contract.contract_end_date), 'dd MMM yyyy', {
                          locale: id,
                        })}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>

                {/* Payment Method */}
                <TableCell>
                  <PaymentMethodBadge method={contract.payment_method || ''} />
                </TableCell>

                {/* Confirmed Date */}
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div className="text-sm">
                      <div>
                        {format(new Date(contract.confirmed_at), 'dd MMM yyyy', {
                          locale: id,
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(contract.confirmed_at), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge variant="default" className="bg-success text-success-foreground hover:bg-success/90">
                    Dikonfirmasi
                  </Badge>
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Buka menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/contracts/${contract.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Lihat Detail
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDownloadPdf(contract.id)}
                        disabled={downloadPdfMutation.isPending}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDownloadJson(contract.id)}
                        disabled={downloadJsonMutation.isPending}
                      >
                        <FileJson className="mr-2 h-4 w-4" />
                        Download JSON
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                            Hapus Kontrak
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Kontrak?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Aksi ini tidak dapat dibatalkan. Kontrak dan file terkait akan
                              dihapus secara permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteContract(contract.id)}
                              className="bg-red-600 hover:bg-red-700"
                              disabled={deleteContractMutation.isPending}
                            >
                              {deleteContractMutation.isPending ? 'Menghapus...' : 'Hapus'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))}
          </motion.tbody>
        </Table>
        </div>
      </div>

      {/* Pagination */}
      {data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Menampilkan {((data.page - 1) * data.per_page) + 1} - {Math.min(data.page * data.per_page, data.total)} dari {data.total} kontrak
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(data.page - 1)}
              disabled={data.page === 1}
            >
              Sebelumnya
            </Button>
            <div className="text-sm">
              Halaman {data.page} dari {data.total_pages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(data.page + 1)}
              disabled={data.page === data.total_pages}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}