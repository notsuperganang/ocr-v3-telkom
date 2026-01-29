import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, Trash2, Edit2, Save, X, Phone, Mail, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/api';
import { toast } from 'sonner';

interface CustomerContact {
  id: number;
  name: string;
  phone_number: string | null;
  job_title: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomerContactsSectionProps {
  contractId: number | null;
  mode: 'job' | 'contract';
}

export function CustomerContactsSection({ contractId, mode }: CustomerContactsSectionProps) {
  const [contacts, setContacts] = React.useState<CustomerContact[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  // Form state for new contact
  const [newContact, setNewContact] = React.useState({
    name: '',
    phone_number: '',
    job_title: '',
    email: '',
  });

  // Form state for editing contact
  const [editForm, setEditForm] = React.useState<Partial<CustomerContact>>({});

  // Fetch contacts when contractId changes
  React.useEffect(() => {
    if (contractId && mode === 'contract') {
      fetchContacts();
    }
  }, [contractId, mode]);

  const fetchContacts = async () => {
    if (!contractId) return;

    setIsLoading(true);
    try {
      const response = await apiService.getContractContacts(contractId);
      setContacts(response);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      toast.error('Gagal memuat kontak pelanggan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!contractId || !newContact.name.trim()) {
      toast.error('Nama kontak wajib diisi');
      return;
    }

    try {
      const response = await apiService.createContractContact(contractId, {
        name: newContact.name,
        phone_number: newContact.phone_number || null,
        job_title: newContact.job_title || null,
        email: newContact.email || null,
      });

      setContacts([...contacts, response]);
      setNewContact({ name: '', phone_number: '', job_title: '', email: '' });
      setIsAdding(false);
      toast.success('Kontak berhasil ditambahkan');
    } catch (error) {
      console.error('Failed to add contact:', error);
      toast.error('Gagal menambahkan kontak');
    }
  };

  const handleEditContact = async (contactId: number) => {
    if (!contractId || !editForm.name?.trim()) {
      toast.error('Nama kontak wajib diisi');
      return;
    }

    try {
      const response = await apiService.updateContractContact(contractId, contactId, {
        name: editForm.name,
        phone_number: editForm.phone_number || null,
        job_title: editForm.job_title || null,
        email: editForm.email || null,
      });

      setContacts(contacts.map(c => c.id === contactId ? response : c));
      setEditingId(null);
      setEditForm({});
      toast.success('Kontak berhasil diperbarui');
    } catch (error) {
      console.error('Failed to update contact:', error);
      toast.error('Gagal memperbarui kontak');
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!contractId) return;

    if (!confirm('Yakin ingin menghapus kontak ini?')) {
      return;
    }

    try {
      await apiService.deleteContractContact(contractId, contactId);
      setContacts(contacts.filter(c => c.id !== contactId));
      toast.success('Kontak berhasil dihapus');
    } catch (error) {
      console.error('Failed to delete contact:', error);
      toast.error('Gagal menghapus kontak');
    }
  };

  const startEditing = (contact: CustomerContact) => {
    setEditingId(contact.id);
    setEditForm({
      name: contact.name,
      phone_number: contact.phone_number || '',
      job_title: contact.job_title || '',
      email: contact.email || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setNewContact({ name: '', phone_number: '', job_title: '', email: '' });
  };

  // Show message for job mode
  if (mode === 'job') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="rounded-[1.25rem] border border-border/70 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Kontak Pelanggan Tambahan</CardTitle>
                <CardDescription>Kontak tambahan selain yang tercantum di dokumen</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Kontak tambahan dapat ditambahkan setelah kontrak dikonfirmasi.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Contract mode - full CRUD interface
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="rounded-[1.25rem] border border-border/70 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Kontak Pelanggan Tambahan</CardTitle>
                <CardDescription>Kontak tambahan selain yang tercantum di dokumen</CardDescription>
              </div>
            </div>
            {!isAdding && (
              <Button
                onClick={() => setIsAdding(true)}
                size="sm"
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Kontak
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Contact Form */}
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50"
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="new-name" className="text-sm font-medium">
                        Nama <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="new-name"
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        placeholder="Nama lengkap"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-job-title" className="text-sm font-medium">
                        Jabatan
                      </Label>
                      <Input
                        id="new-job-title"
                        value={newContact.job_title}
                        onChange={(e) => setNewContact({ ...newContact, job_title: e.target.value })}
                        placeholder="Jabatan"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="new-phone" className="text-sm font-medium">
                        Nomor Telepon
                      </Label>
                      <Input
                        id="new-phone"
                        value={newContact.phone_number}
                        onChange={(e) => setNewContact({ ...newContact, phone_number: e.target.value })}
                        placeholder="08xxxxxxxxxx"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-email" className="text-sm font-medium">
                        Email
                      </Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                        placeholder="email@example.com"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelAdding}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddContact}
                      disabled={!newContact.name.trim()}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Simpan
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Contacts List */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Memuat kontak...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Belum ada kontak tambahan</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {contacts.map((contact) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 border border-gray-200 rounded-lg bg-white hover:shadow-sm transition-shadow"
                  >
                    {editingId === contact.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`edit-name-${contact.id}`} className="text-sm font-medium">
                              Nama <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`edit-name-${contact.id}`}
                              value={editForm.name || ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              placeholder="Nama lengkap"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-job-title-${contact.id}`} className="text-sm font-medium">
                              Jabatan
                            </Label>
                            <Input
                              id={`edit-job-title-${contact.id}`}
                              value={editForm.job_title || ''}
                              onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                              placeholder="Jabatan"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`edit-phone-${contact.id}`} className="text-sm font-medium">
                              Nomor Telepon
                            </Label>
                            <Input
                              id={`edit-phone-${contact.id}`}
                              value={editForm.phone_number || ''}
                              onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                              placeholder="08xxxxxxxxxx"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-email-${contact.id}`} className="text-sm font-medium">
                              Email
                            </Label>
                            <Input
                              id={`edit-email-${contact.id}`}
                              type="email"
                              value={editForm.email || ''}
                              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                              placeholder="email@example.com"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditing}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Batal
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleEditContact(contact.id)}
                            disabled={!editForm.name?.trim()}
                            className="bg-primary hover:bg-primary/90"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Simpan
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-900">{contact.name}</span>
                            {contact.job_title && (
                              <Badge variant="outline" className="text-xs">
                                {contact.job_title}
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            {contact.phone_number && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                <span>{contact.phone_number}</span>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                <span>{contact.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(contact)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteContact(contact.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
