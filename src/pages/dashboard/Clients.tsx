import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader } from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Client {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  company_id?: string;
  created_at?: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
}

type FormMode = 'create' | 'edit' | null;

export const Clients: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, company } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    totalCount: 0,
  });

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    address: '',
  });

  // Carregar clientes quando componente montar ou página mudar
  useEffect(() => {
    loadClients();
  }, [pagination.page]);

  // Redirect se não houver empresa selecionada
  useEffect(() => {
    if (!company) {
      navigate('/');
    }
  }, [company, navigate]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await apiService.getClients({
        company_id: company?.id || undefined,
      });

      if (response.success && Array.isArray(response.data)) {
        // Simulando paginação (backend deveria retornar dados já paginados)
        const startIdx = (pagination.page - 1) * pagination.pageSize;
        const endIdx = startIdx + pagination.pageSize;
        const paginatedData = response.data.slice(startIdx, endIdx);

        setClients(paginatedData);
        setPagination(prev => ({
          ...prev,
          totalCount: response.data.length,
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os clientes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedClient(null);
    setFormData({
      name: '',
      document: '',
      email: '',
      phone: '',
      address: '',
    });
  };

  const handleOpenEdit = (client: Client) => {
    setFormMode('edit');
    setSelectedClient(client);
    setFormData({
      name: client.name || '',
      document: client.document || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
    });
  };

  const handleCloseForm = () => {
    setFormMode(null);
    setSelectedClient(null);
    setFormData({
      name: '',
      document: '',
      email: '',
      phone: '',
      address: '',
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      if (!formData.name.trim()) {
        toast({
          title: 'Validação',
          description: 'Nome do cliente é obrigatório',
          variant: 'destructive',
        });
        return;
      }

      if (formMode === 'create') {
        const response = await apiService.createClient({
          name: formData.name,
          document: formData.document || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
        });

        if (response.success) {
          toast({
            title: 'Sucesso',
            description: 'Cliente criado com sucesso',
          });
          handleCloseForm();
          loadClients();
        }
      } else if (formMode === 'edit' && selectedClient) {
        const response = await apiService.updateClient(selectedClient.id, {
          name: formData.name,
          document: formData.document || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
        });

        if (response.success) {
          toast({
            title: 'Sucesso',
            description: 'Cliente atualizado com sucesso',
          });
          handleCloseForm();
          loadClients();
        }
      }
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast({
        title: 'Erro ao salvar',
        description: (error as Error).message || 'Não foi possível salvar o cliente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!window.confirm('Deseja realmente deletar este cliente?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.deleteClient(clientId);

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Cliente deletado com sucesso',
        });
        loadClients();
      }
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      toast({
        title: 'Erro ao deletar',
        description: (error as Error).message || 'Não foi possível deletar o cliente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(pagination.totalCount / pagination.pageSize);
  const canPrevious = pagination.page > 1;
  const canNext = pagination.page < totalPages;

  if (!company) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Gerenciar clientes da empresa {company.name}
          </p>
        </div>
        <Button onClick={handleOpenCreate} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Card com Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && clients.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhum cliente cadastrado ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.document || '-'}</TableCell>
                      <TableCell>{client.email || '-'}</TableCell>
                      <TableCell>{client.phone || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{client.address || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(client)}
                            disabled={loading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(client.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Paginação */}
          {clients.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Página {pagination.page} de {totalPages} ({pagination.totalCount} clientes)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                  }
                  disabled={!canPrevious || loading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))
                  }
                  disabled={!canNext || loading}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Criar/Editar Cliente */}
      <Dialog open={formMode !== null} onOpenChange={(open) => !open && handleCloseForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? 'Novo Cliente' : 'Editar Cliente'}
            </DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? 'Preencha os dados do novo cliente'
                : 'Atualize os dados do cliente'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nome da empresa ou pessoa"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document">CPF/CNPJ</Label>
              <Input
                id="document"
                value={formData.document}
                onChange={(e) =>
                  setFormData({ ...formData, document: e.target.value })
                }
                placeholder="123.456.789-00"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="cliente@example.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="(11) 99999-9999"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Rua, número, complemento, cidade, estado"
                disabled={loading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseForm}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando...' : formMode === 'create' ? 'Criar' : 'Atualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
