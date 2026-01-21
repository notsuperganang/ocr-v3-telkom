import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import type { AccountResponse } from '../../types/api';
import { AccountContractRows } from './AccountContractRows';
import { AnimatePresence } from 'framer-motion';

interface AccountHistoryTableProps {
  accounts: AccountResponse[];
  expandedAccounts: Set<number>;
  onToggleAccount: (id: number) => void;
}

export function AccountHistoryTable({
  accounts,
  expandedAccounts,
  onToggleAccount
}: AccountHistoryTableProps) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="w-12"></TableHead>
            <TableHead className="font-semibold text-primary">Account Number</TableHead>
            <TableHead className="font-semibold text-primary">Nama Customer</TableHead>
            <TableHead className="font-semibold text-primary">NIPNAS</TableHead>
            <TableHead className="font-semibold text-primary">Segment</TableHead>
            <TableHead className="font-semibold text-primary">Witel</TableHead>
            <TableHead className="font-semibold text-primary">Account Manager</TableHead>
            <TableHead className="font-semibold text-primary">Petugas</TableHead>
            <TableHead className="text-right font-semibold text-primary">Jumlah Kontrak</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-48 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <svg
                    className="h-12 w-12 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p className="text-sm font-medium">Tidak ada account ditemukan</p>
                  <p className="text-xs">Coba ubah filter atau kata kunci pencarian</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            accounts.map((account) => (
              <React.Fragment key={account.id}>
                {/* Parent Row */}
                <TableRow
                  className="cursor-pointer transition-colors hover:bg-muted/50 border-border/50"
                  onClick={() => onToggleAccount(account.id)}
                >
                  <TableCell className="py-4">
                    {expandedAccounts.has(account.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                    )}
                  </TableCell>
                  <TableCell className="py-4 font-medium">
                    {account.account_number || '—'}
                  </TableCell>
                  <TableCell className="py-4">
                    {account.name}
                  </TableCell>
                  <TableCell className="py-4">
                    {account.nipnas || '—'}
                  </TableCell>
                  <TableCell className="py-4">
                    {account.segment ? (
                      <Badge variant="outline" className="font-normal">
                        {account.segment.name}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    {account.witel ? (
                      <Badge variant="outline" className="font-normal">
                        {account.witel.code} - {account.witel.name}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    {account.account_manager ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{account.account_manager.name}</span>
                        {/* {account.account_manager.title && (
                          <span className="text-xs text-muted-foreground">
                            {account.account_manager.title}
                          </span>
                        )} */}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    {account.assigned_officer ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{account.assigned_officer.full_name}</span>
                        {/* {account.assigned_officer.full_name && (
                          <span className="text-xs text-muted-foreground">
                            {account.assigned_officer.full_name}
                          </span>
                        )} */}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                      {account.contract_count || 0}
                    </Badge>
                  </TableCell>
                </TableRow>

                {/* Child Rows - Contracts */}
                <AnimatePresence>
                  {expandedAccounts.has(account.id) && (
                    <AccountContractRows accountId={account.id} />
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
