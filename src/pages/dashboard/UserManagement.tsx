import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { isStrongPassword } from '@/lib/user-creation';

type UserRole = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | 'DRIVER' | 'CLIENT';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole | string;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

interface FormErrors {
  [key: string]: string;
}

const ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT'];
const ITEMS_PER_PAGE = 10;

export const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state - Create
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'CLIENT' as UserRole,
  });
  const [createErrors, setCreateErrors] = useState<FormErrors>({});

  // Form state - Edit
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: 'CLIENT' as UserRole,
    status: 'ATIVO' as 'ATIVO' | 'INATIVO',
  });
  const [editErrors, setEditErrors] = useState<FormErrors>({});

  // Check if user is MASTER
  useEffect(() => {
    if (user && user.role !== 'MASTER') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUsers();
      if (response.success) {
        setUsers(response.data || []);
      } else {
        toast({
          title: 'Erro',
          description: response.error || 'Erro ao carregar usuários',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao carregar usuários',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Validation
  const validateCreateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!createForm.email.trim()) {
      errors.email = 'Email é obrigatório';
    } else if (!createForm.email.includes('@')) {
      errors.email = 'Email inválido';
    }

    if (!isStrongPassword(createForm.password)) {
      errors.password = 'Senha deve ter no mínimo 8 caracteres, com maiúscula, minúscula e número';
    }

    if (!createForm.full_name.trim()) {
      errors.full_name = 'Nome completo é obrigatório';
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEditForm = (): boolean => {
    const errors: FormErrors = {};

    if (!editForm.full_name.trim()) {
      errors.full_name = 'Nome completo é obrigatório';
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handlers - Create
  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (createErrors[name]) {
      setCreateErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleCreateRoleChange = (value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      role: value as UserRole,
    }));
  };

  const handleCreateUser = async () => {
    if (!validateCreateForm()) return;

    try {
      setLoading(true);
      const response = await apiService.createUser({
        email: createForm.email.trim(),
        password: createForm.password,
        full_name: createForm.full_name.trim(),
        role: createForm.role,
      });

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Usuário criado com sucesso!',
        });
        setIsCreateDialogOpen(false);
        setCreateForm({
          email: '',
          password: '',
          full_name: '',
          role: 'CLIENT',
        });
        setCreateErrors({});
        await loadUsers();
      } else {
        toast({
          title: 'Erro',
          description: response.error || 'Erro ao criar usuário',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar usuário',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handlers - Edit
  const handleOpenEditDialog = (user: User) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name,
      role: user.role as UserRole,
      status: user.status,
    });
    setEditErrors({});
    setIsEditDialogOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (editErrors[name]) {
      setEditErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleEditRoleChange = (value: string) => {
    setEditForm((prev) => ({
      ...prev,
      role: value as UserRole,
    }));
  };

  const handleEditStatusChange = (value: string) => {
    setEditForm((prev) => ({
      ...prev,
      status: value as 'ATIVO' | 'INATIVO',
    }));
  };

  const handleUpdateUser = async () => {
    if (!validateEditForm() || !editingUser) return;

    try {
      setLoading(true);
      const response = await apiService.updateUser(editingUser.id, {
        full_name: editForm.full_name.trim(),
        role: editForm.role,
        status: editForm.status,
      });

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Usuário atualizado com sucesso!',
        });
        setIsEditDialogOpen(false);
        setEditingUser(null);
        setEditForm({
          full_name: '',
          role: 'CLIENT',
          status: 'ATIVO',
        });
        setEditErrors({});
        await loadUsers();
      } else {
        toast({
          title: 'Erro',
          description: response.error || 'Erro ao atualizar usuário',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar usuário',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete handler
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Tem certeza que quer deletar este usuário? (${userEmail})`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.deleteUser(userId);

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Usuário deletado com sucesso!',
        });
        await loadUsers();
      } else {
        toast({
          title: 'Erro',
          description: response.error || 'Erro ao deletar usuário',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao deletar usuário',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtering and pagination
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  if (user?.role !== 'MASTER') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <h2 className="text-xl font-semibold">Acesso Negado</h2>
              <p className="text-sm text-muted-foreground text-center">
                Apenas usuários com role MASTER podem acessar esta página.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Gerencie todos os usuários do sistema</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>Preencha os dados do novo usuário abaixo</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@example.com"
                  value={createForm.email}
                  onChange={handleCreateChange}
                  className={createErrors.email ? 'border-destructive' : ''}
                />
                {createErrors.email && (
                  <p className="text-xs text-destructive mt-1">{createErrors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={createForm.password}
                  onChange={handleCreateChange}
                  className={createErrors.password ? 'border-destructive' : ''}
                />
                {createErrors.password && (
                  <p className="text-xs text-destructive mt-1">{createErrors.password}</p>
                )}
              </div>

              <div>
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="João Silva"
                  value={createForm.full_name}
                  onChange={handleCreateChange}
                  className={createErrors.full_name ? 'border-destructive' : ''}
                />
                {createErrors.full_name && (
                  <p className="text-xs text-destructive mt-1">{createErrors.full_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={createForm.role} onValueChange={handleCreateRoleChange}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCreateUser}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Buscar por Email ou Nome</Label>
              <Input
                id="search"
                placeholder="Digite para buscar..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
              />
            </div>
            <div>
              <Label htmlFor="role-filter">Filtrar por Role</Label>
              <Select value={filterRole} onValueChange={(value) => {
                setFilterRole(value);
                setCurrentPage(0);
              }}>
                <SelectTrigger id="role-filter">
                  <SelectValue placeholder="Todas as roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as roles</SelectItem>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Usuários ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            Página {currentPage + 1} de {Math.max(1, totalPages)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome Completo</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && paginatedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
                {!loading && paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">{user.email}</TableCell>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 text-xs rounded-md bg-primary/10 text-primary font-medium">
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs rounded-md font-medium ${
                          user.status === 'ATIVO'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditDialog(user)}
                          disabled={loading}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          disabled={loading}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Mostrando {paginatedUsers.length > 0 ? currentPage * ITEMS_PER_PAGE + 1 : 0} a{' '}
                {Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredUsers.length)} de{' '}
                {filteredUsers.length} usuários
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage === totalPages - 1}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Edite os dados do usuário (email não pode ser alterado)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editingUser?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">Email não pode ser alterado</p>
            </div>

            <div>
              <Label htmlFor="edit_full_name">Nome Completo *</Label>
              <Input
                id="edit_full_name"
                name="full_name"
                placeholder="João Silva"
                value={editForm.full_name}
                onChange={handleEditChange}
                className={editErrors.full_name ? 'border-destructive' : ''}
              />
              {editErrors.full_name && (
                <p className="text-xs text-destructive mt-1">{editErrors.full_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="edit_role">Role</Label>
              <Select value={editForm.role} onValueChange={handleEditRoleChange}>
                <SelectTrigger id="edit_role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_status">Status</Label>
              <Select value={editForm.status} onValueChange={handleEditStatusChange}>
                <SelectTrigger id="edit_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleUpdateUser}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Atualizando...' : 'Atualizar Usuário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
