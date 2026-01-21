import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { FileText, Eye, Edit2, Loader2 } from 'lucide-react';
import { TableCell } from '../ui/table';
import { Button } from '../ui/button';
import { apiService } from '../../services/api';

interface AccountContractRowsProps {
  accountId: number;
}

// Map payment method enum to human-readable label
const mapPaymentMethod = (method: string | null): string => {
  if (!method) return '—';
  const mapping: Record<string, string> = {
    'termin': 'Termin',
    'recurring': 'Recurring',
    'one_time': 'One-Time Charge',
  };
  return mapping[method] || method;
};

export function AccountContractRows({ accountId }: AccountContractRowsProps) {
  const navigate = useNavigate();

  // Lazy load contracts when account is expanded
  const { data, isLoading, error } = useQuery({
    queryKey: ['account-contracts', accountId],
    queryFn: () => apiService.getAccountContracts(accountId),
  });

  if (isLoading) {
    return (
      <motion.tr
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="border-border/50"
      >
        <TableCell colSpan={9} className="bg-muted/30 py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Memuat kontrak...</span>
          </div>
        </TableCell>
      </motion.tr>
    );
  }

  if (error) {
    return (
      <motion.tr
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="border-border/50"
      >
        <TableCell colSpan={9} className="bg-muted/30 py-6">
          <div className="flex flex-col items-center justify-center gap-2 text-destructive">
            <p className="text-sm font-medium">Gagal memuat kontrak</p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : 'Terjadi kesalahan'}
            </p>
          </div>
        </TableCell>
      </motion.tr>
    );
  }

  if (!data?.contracts || data.contracts.length === 0) {
    return (
      <motion.tr
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="border-border/50"
      >
        <TableCell colSpan={9} className="bg-muted/30 py-6">
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="h-8 w-8 opacity-50" />
            <p className="text-sm">Belum ada kontrak untuk account ini</p>
          </div>
        </TableCell>
      </motion.tr>
    );
  }

  // Format currency for display
  const formatCurrency = (value: string) => {
    try {
      const num = parseFloat(value);
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    } catch {
      return value;
    }
  };

  return (
    <>
      {data.contracts.map((contract) => (
        <motion.tr
          key={contract.id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-muted/20 hover:bg-muted/40 border-border/50"
        >
          <TableCell className="py-3"></TableCell>
          <TableCell className="py-3" colSpan={2}>
            <div className="flex items-center gap-2 pl-8">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {contract.contract_year} - {contract.contract_number || `ID ${contract.id}`}
                </span>
                {contract.customer_name && (
                  <span className="text-xs text-muted-foreground">
                    {contract.customer_name}
                  </span>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className="py-3" colSpan={2}>
            <span className="text-sm text-muted-foreground">
              {contract.period_start && contract.period_end ? (
                `${new Date(contract.period_start).toLocaleDateString('id-ID')} - ${new Date(contract.period_end).toLocaleDateString('id-ID')}`
              ) : '—'}
            </span>
          </TableCell>
          <TableCell className="py-3">
            <span className="text-sm text-muted-foreground">
              {mapPaymentMethod(contract.payment_method)}
            </span>
          </TableCell>
          <TableCell className="py-3">
            <span className="text-sm font-medium">
              {formatCurrency(contract.total_contract_value)}
            </span>
          </TableCell>
          <TableCell className="py-3 text-right" colSpan={2}>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/contracts/${contract.id}`);
                }}
                className="h-8 px-3"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Lihat
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/contracts/${contract.id}/edit`);
                }}
                className="h-8 px-3"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </div>
          </TableCell>
        </motion.tr>
      ))}
    </>
  );
}
