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
  Building2,
  FileX,
  Loader2,
} from 'lucide-react';
import type { UnifiedContractListResponse } from '@/types/api';
import {
  useDownloadContractJson,
  useDownloadContractPdf,
  useDeleteContract,
  useDiscardJob,
} from '@/hooks/useContracts';
import { PaymentMethodBadge } from './PaymentMethodBadge';
import { tableRowStagger, tableRowItem } from '@/lib/motion';

interface ContractsTableProps {
  data: UnifiedContractListResponse;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export function ContractsTable({ data, isLoading, onPageChange }: ContractsTableProps) {
  const navigate = useNavigate();
  const downloadJsonMutation = useDownloadContractJson();
  const downloadPdfMutation = useDownloadContractPdf();
  const deleteContractMutation = useDeleteContract();
  const discardJobMutation = useDiscardJob();

  const handleDownloadJson = (contractId: number) => {
    downloadJsonMutation.mutate(contractId);
  };

  const handleDownloadPdf = (contractId: number) => {
    downloadPdfMutation.mutate(contractId);
  };

  const handleDeleteContract = (contractId: number) => {
    deleteContractMutation.mutate(contractId);
  };

  const handleDiscardJob = (jobId: number) => {
    discardJobMutation.mutate(jobId);
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

  if (!data.items.length) {
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
          Belum Ada Data
        </h3>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm">
          Upload file kontrak untuk memulai. Kontrak yang diproses dan perlu direview akan muncul di sini.
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
                <TableHead className="font-semibold">Dikonfirmasi Oleh</TableHead>
                <TableHead className="font-semibold">Tahun</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-[100px] font-semibold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <motion.tbody
              variants={tableRowStagger}
              initial="hidden"
              animate="visible"
            >
              {data.items.map((item) => (
                <motion.tr
                  key={`${item.item_type}-${item.id}`}
                  variants={tableRowItem}
                  className="group border-b transition-all duration-150 hover:bg-muted/50 even:bg-muted/20"
                >
                {/* File */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-sm truncate max-w-[200px]">
                      {item.filename}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.item_type === 'contract' ? 'ID Kontrak' : 'ID Job'}: {item.id}
                    </div>
                  </div>
                </TableCell>

                {/* Customer */}
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {item.customer_name || <span className="italic text-muted-foreground">Tidak diketahui</span>}
                    </span>
                  </div>
                </TableCell>

                {/* Contract Period */}
                <TableCell>
                  {item.contract_start_date && item.contract_end_date ? (
                    <div className="text-sm">
                      <div className="font-medium">
                        {format(new Date(item.contract_start_date), 'dd MMM yyyy', {
                          locale: id,
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        s/d {format(new Date(item.contract_end_date), 'dd MMM yyyy', {
                          locale: id,
                        })}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">-</span>
                  )}
                </TableCell>

                {/* Payment Method */}
                <TableCell>
                  {item.payment_method ? (
                    <PaymentMethodBadge method={item.payment_method} />
                  ) : (
                    <span className="text-muted-foreground text-sm italic">-</span>
                  )}
                </TableCell>

                {/* Confirmed By */}
                <TableCell className="text-center">
                  {item.status === 'confirmed' && item.confirmed_by ? (
                    <span className="text-sm">
                      {item.confirmed_by}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">-</span>
                  )}
                </TableCell>

                {/* Contract Year */}
                <TableCell className="text-center">
                  {item.contract_year ? (
                    <span className="text-sm">
                      {item.contract_year}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm italic">-</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  {item.status === 'confirmed' ? (
                    <Badge variant="default" className="bg-success text-success-foreground hover:bg-success/90">
                      Dikonfirmasi
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200">
                      Menunggu Review
                    </Badge>
                  )}
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
                      {item.status === 'confirmed' ? (
                        <>
                          <DropdownMenuItem onClick={() => navigate(`/contracts/${item.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Lihat Detail
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDownloadPdf(item.id)}
                            disabled={downloadPdfMutation.isPending}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDownloadJson(item.id)}
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
                                  onClick={() => handleDeleteContract(item.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={deleteContractMutation.isPending}
                                >
                                  {deleteContractMutation.isPending ? 'Menghapus...' : 'Hapus'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => navigate(`/review/${item.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Review
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                                Hapus
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Job?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Aksi ini tidak dapat dibatalkan. Job dan file terkait akan
                                  dihapus secara permanen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDiscardJob(item.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={discardJobMutation.isPending}
                                >
                                  {discardJobMutation.isPending ? 'Menghapus...' : 'Hapus'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
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