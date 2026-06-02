import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface DriverFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface DriverFormData {
  name: string;
  username: string;
  email: string;
  password: string;
  cpf: string;
  cnh: string;
  phone: string;
}

const initialState: DriverFormData = {
  name: '',
  username: '',
  email: '',
  password: '',
  cpf: '',
  cnh: '',
  phone: '',
};

export const DriverForm = ({ open, onOpenChange, onSuccess }: DriverFormProps) => {
  const [formData, setFormData] = useState<DriverFormData>(initialState);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, company } = useAuth();

  const handleInputChange = (field: keyof DriverFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Erro de validação', description: 'Nome é obrigatório.', variant: 'destructive' });
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast({ title: 'Erro de validação', description: 'Email válido é obrigatório.', variant: 'destructive' });
      return false;
    }
    if (
      !formData.password ||
      formData.password.length < 8 ||
      !/[A-Z]/.test(formData.password) ||
      !/[a-z]/.test(formData.password) ||
      !/[0-9]/.test(formData.password)
    ) {
      toast({
        title: 'Erro de validação',
        description: 'A senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.',
        variant: 'destructive',
      });
      return false;
    }
    if (!formData.cpf.trim()) {
      toast({ title: 'Erro de validação', description: 'CPF é obrigatório.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      // 1) Cria profile + driver via RPC create_managed_user
      // (company_id é resolvido no backend a partir do contexto do admin logado)
      const userResponse = await apiService.createUser({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        full_name: formData.name.trim(),
        username: formData.username.trim() || formData.email.trim().toLowerCase(),
        role: 'DRIVER',
        cpf: formData.cpf.trim(),
        status: 'ATIVO',
      });

      if (!userResponse.success || !userResponse.data) {
        toast({
          title: 'Erro ao cadastrar motorista',
          description: userResponse.error || 'Não foi possível concluir o cadastro.',
          variant: 'destructive',
        });
        return;
      }

      // 2) Atualiza dados auxiliares (phone/license) que o RPC não popula.
      // Sem isso, esses campos ficavam vazios. A chamada anterior tentava INSERT
      // duplicado e silenciosamente falhava — agora é UPDATE no driver já criado.
      const driverId = userResponse.data.driver_id;
      if (driverId && (formData.phone.trim() || formData.cnh.trim())) {
        const updateResponse = await apiService.updateDriver(driverId, {
          phone: formData.phone.trim() || undefined,
          license: formData.cnh.trim() || undefined,
        });
        if (!updateResponse.success) {
          console.warn('[DriverForm] Falha ao atualizar telefone/CNH:', updateResponse.error);
          toast({
            title: 'Motorista cadastrado',
            description: 'Cadastro principal concluído, mas telefone/CNH não foram salvos. Edite o motorista para completar.',
          });
          setFormData(initialState);
          onOpenChange(false);
          onSuccess?.();
          return;
        }
      }

      toast({
        title: 'Motorista cadastrado',
        description: `${formData.name.trim()} foi adicionado à operação.`,
      });
      setFormData(initialState);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erro ao cadastrar motorista',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const empresaAlvo = company?.name || user?.company_name || 'sua empresa atual';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Motorista</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
            <span className="font-medium text-amber-900">Empresa de destino: </span>
            <span className="text-amber-900">{empresaAlvo}</span>
            <p className="mt-1 text-xs text-amber-800">
              O motorista é vinculado a essa empresa. Pra cadastrar em outra, troque o contexto antes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Nome de Usuário</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="(opcional, usa email se vazio)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="motorista@exemplo.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Mín. 8 caracteres, com maiúscula, minúscula e número"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => handleInputChange('cpf', e.target.value)}
                placeholder="000.000.000-00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnh">CNH</Label>
              <Input
                id="cnh"
                value={formData.cnh}
                onChange={(e) => handleInputChange('cnh', e.target.value)}
                placeholder="(opcional)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="(11) 99999-9999 (opcional)"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar Motorista'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
