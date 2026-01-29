import React from 'react';
import { Users, Phone, Mail, UserRound, ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiService } from '@/services/api';

interface CustomerContact {
  id: number;
  name: string;
  phone_number: string | null;
  job_title: string | null;
  email: string | null;
}

interface CustomerContactsDisplayProps {
  contractId: number;
}

const cardVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  hover: { y: -2, transition: { duration: 0.2 } }
};

export function CustomerContactsDisplay({ contractId }: CustomerContactsDisplayProps) {
  const [contacts, setContacts] = React.useState<CustomerContact[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    fetchContacts();
  }, [contractId]);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getContractContacts(contractId);
      setContacts(response);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <motion.div
        variants={cardVariants}
        initial="initial"
        animate="animate"
        whileHover="hover"
      >
        <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
          <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
                  <Users className="h-3.5 w-3.5" />
                  Kontak
                </span>
                <CardTitle className="mt-3 text-xl font-semibold text-slate-900">Kontak Pelanggan Tambahan</CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Kontak tambahan selain yang tercantum di dokumen
                </CardDescription>
              </div>
              <span className="rounded-full bg-white/80 p-2 shadow-inner shadow-rose-100">
                <Users className="h-5 w-5 text-rose-500" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="bg-white p-6">
            <div className="flex items-center justify-center py-8 text-sm text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500 mr-3" />
              Memuat kontak...
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (contacts.length === 0) {
    return null; // Don't show the section if there are no contacts
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
    >
      <Card className="overflow-hidden rounded-3xl border border-rose-100/80 shadow-lg shadow-rose-100/40">
        <CardHeader className="border-b border-rose-100 bg-gradient-to-br from-white via-white to-rose-50">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
                <Users className="h-3.5 w-3.5" />
                Kontak
              </span>
              <CardTitle className="mt-3 text-xl font-semibold text-slate-900">Kontak Pelanggan Tambahan</CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Kontak tambahan selain yang tercantum di dokumen
              </CardDescription>
            </div>
            <span className="rounded-full bg-white/80 p-2 shadow-inner shadow-rose-100">
              <Users className="h-5 w-5 text-rose-500" />
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 bg-white p-6">
          {contacts.map((contact) => (
            <motion.div
              key={contact.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="relative overflow-hidden rounded-3xl border border-rose-100/80 bg-gradient-to-br from-white via-white to-rose-50/70 p-5 shadow-sm"
            >
              <div className="absolute right-6 top-6 h-16 w-16 rounded-full bg-rose-100/40 blur-3xl" />
              <div className="relative z-10 space-y-3">
                {/* Name and Job Title Row */}
                <div className="flex items-center gap-3 pb-3 border-b border-rose-100/50">
                  <span aria-hidden="true" className="rounded-full bg-rose-50 p-2 text-rose-500 shadow-sm shadow-rose-100">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-slate-900 truncate" title={contact.name}>
                      {contact.name}
                    </h4>
                    {contact.job_title && (
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                        <ClipboardList className="h-3 w-3 text-rose-400" />
                        {contact.job_title}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contact Details Grid */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {contact.phone_number && (
                    <div className="flex items-start gap-2 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-inner shadow-rose-50">
                      <span aria-hidden="true" className="rounded-full bg-rose-50 p-1.5 text-rose-500 shadow-sm shadow-rose-100">
                        <Phone className="h-3.5 w-3.5" />
                      </span>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-400">
                          Telepon
                        </p>
                        <p className="text-xs font-medium text-slate-900 font-mono tracking-wide break-all">
                          {contact.phone_number}
                        </p>
                      </div>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-start gap-2 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-inner shadow-rose-50">
                      <span aria-hidden="true" className="rounded-full bg-rose-50 p-1.5 text-rose-500 shadow-sm shadow-rose-100">
                        <Mail className="h-3.5 w-3.5" />
                      </span>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-rose-400">
                          Email
                        </p>
                        <p className="text-xs font-medium text-slate-900 break-all">
                          {contact.email}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
