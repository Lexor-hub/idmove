import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { getApiConfig } from '@/config/api';

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
  company_id: string;
}

export const DriverForm = ({ open, onOpenChange, onSuccess }: DriverFormProps) => {
  const [formData, setFormData] = useState<DriverFormData>({
    name: '',
    username: '',
    email: '',
    password: '',
    cpf: '',
    cnh: '',
    phone: '',
    company_id: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: keyof DriverFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Erro de Validação",
        description: "Nome é obrigatório.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.username.trim()) {
      toast({
        title: "Erro de Validação",
        description: "Nome de usuário é obrigatório.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast({
        title: "Erro de Validação",
        description: "Email válido é obrigatório.",
        variant: "destructive",
      });
      return false;
    }

    // Backend expects at least 8 chars, with upper, lower and number
    if (!formData.password || formData.password.length < 8 || !/[A-Z]/.test(formData.password) || !/[a-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      toast({
        title: "Erro de Validação",
        description: "A senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.cpf.trim()) {
      toast({
        title: "Erro de Validação",
        description: "CPF é obrigatório.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.cnh.trim()) {
      toast({
        title: "Erro de Validação",
        description: "CNH é obrigatória.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.phone.trim()) {
      toast({
        title: "Erro de Validação",
        description: "Telefone é obrigatório.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Primeiro, criar o usuário com tipo DRIVER
      const userData = {
        username: formData.username.trim(),
        password: formData.password,
        email: formData.email,
        full_name: formData.name,
        user_type: 'DRIVER', // Fixo como motorista
        company_id: formData.company_id || '1', // Usar company_id do usuário logado ou padrão
        cpf: formData.cpf ? formData.cpf.trim() : undefined,
        status: 'ATIVO',
        is_active: true
      };

      let userResponse = await apiService.createUser(userData);

      if (!userResponse || typeof userResponse !== 'object') {
        userResponse = { success: false, error: 'Resposta invalida do servidor.' } as any;
      }

      // Fallback: se a resposta for HTML, 404 ou contiver 'Cannot POST' (indica que foi roteado para serviço errado), tentar POST direto ao auth-users service
      if (!userResponse.success && typeof userResponse.error === 'string') {
        const txt = userResponse.error.toLowerCase();
        if (txt.includes('cannot post') || txt.includes('<!doctype html') || txt.includes('<html') || txt.includes('http 404') || txt.includes('not found')) {
          try {
            const cfg = getApiConfig();
            const authBase = (cfg.AUTH_USERS || cfg.AUTH_SERVICE).replace(/\/$/, '');
            const token = localStorage.getItem('id_transporte_token') || localStorage.getItem('temp_token') || '';
            const resp = await fetch(`${authBase}/api/users`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify(userData),
            });
            if (resp.ok) {
              const body = await resp.json().catch(() => ({}));
              userResponse = { success: true, data: body } as any;
            } else {
              const bodyText = await resp.text().catch(() => '');
              userResponse = { success: false, error: bodyText || `HTTP ${resp.status}` } as any;
            }
          } catch (fbErr) {
            console.error('Fallback createUser error', fbErr);
          }
        }
      }
      if (userResponse.success && userResponse.data) {
        // Se o usuário foi criado com sucesso, criar o registro de motorista
        const driverData = {
          user_id: userResponse.data.id, // Adiciona o ID do usuário recém-criado
          name: formData.name,
          cpf: formData.cpf,
          cnh: formData.cnh,
          phone: formData.phone,
          email: formData.email,
        };

        // Tentar criar o registro de motorista (se o endpoint existir)
        try {
          await apiService.createDriver(driverData);
        } catch (driverError) {
          console.log('Endpoint de motorista não disponível, usuário criado apenas como DRIVER');
        }

        toast({
          title: "Sucesso",
          description: "Motorista cadastrado com sucesso!",
        });
        
        // Limpar formulário
        setFormData({
          name: '',
          username: '',
          email: '',
          password: '',
          cpf: '',
          cnh: '',
          phone: '',
          company_id: ''
        });
        
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Erro",
          description: userResponse.error || "Erro ao cadastrar motorista",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar motorista",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Motorista</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="username">Nome de Usuário *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="Digite o nome de usuário"
                required
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
              placeholder="Digite o email"
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
              placeholder="Digite a senha (mín. 6 caracteres)"
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
              <Label htmlFor="cnh">CNH *</Label>
              <Input
                id="cnh"
                value={formData.cnh}
                onChange={(e) => handleInputChange('cnh', e.target.value)}
                placeholder="Digite o número da CNH"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="(11) 99999-9999"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
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