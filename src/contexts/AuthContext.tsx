import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Company, AuthContextType, LoginCredentials } from '@/types/auth';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { normalizeRole } from '@/lib/roles';

const AuthContext = createContext<AuthContextType | null>(null);

const mapUser = (userData: User): User => ({
  ...userData,
  role: normalizeRole(userData.user_type || userData.role),
  name: userData.full_name || userData.name,
});

const clearStoredAuth = () => {
  localStorage.removeItem('id_move_token');
  localStorage.removeItem('id_move_user');
  localStorage.removeItem('id_move_company');
  localStorage.removeItem('temp_token');
  localStorage.removeItem('temp_user');
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [authStep, setAuthStep] = useState<'login' | 'company' | 'complete'>('login');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check for stored auth data on app load
    const token = localStorage.getItem('id_move_token');
    const userData = localStorage.getItem('id_move_user');
    const companyData = localStorage.getItem('id_move_company');
    
    console.log('Verificando dados de autenticação...');
    console.log('Token presente:', !!token);
    console.log('User data presente:', !!userData);
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        const restoredUser = mapUser(parsedUser);
        console.log('Usuário carregado:', restoredUser);
        setUser(restoredUser);
        if (companyData) {
          const parsedCompany = JSON.parse(companyData);
          console.log('Empresa carregada:', parsedCompany);
          setCompany(parsedCompany);
          setAuthStep('complete');
        } else {
          // Se tem token mas não tem empresa, precisa selecionar
          setAuthStep('company');
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        clearStoredAuth();
        setAuthStep('login');
      }
    } else {
      setAuthStep('login');
    }
    
    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      console.log('=== DEBUG LOGIN ===');
      console.log('Fazendo login com credenciais:', credentials);
      
      const response = await apiService.login(credentials);
      console.log('Resposta do login:', response);
      
      if (response.success && response.data) {
        const { user: userData, token, company: selectedCompany } = response.data;
        console.log('Token recebido:', token ? 'Presente' : 'Ausente');
        console.log('User data recebido:', userData);
        
        const mappedUser = mapUser(userData);

        setUser(mappedUser);

        if (selectedCompany && mappedUser.role !== 'MASTER') {
          localStorage.setItem('id_move_token', token);
          localStorage.setItem('id_move_user', JSON.stringify(mappedUser));
          localStorage.setItem('id_move_company', JSON.stringify(selectedCompany));
          localStorage.removeItem('temp_token');
          localStorage.removeItem('temp_user');
          setCompany(selectedCompany);
          setAuthStep('complete');
          toast({
            title: "Login realizado com sucesso!",
            description: `Bem-vindo(a), ${mappedUser.name}!`,
          });
          return;
        }

        localStorage.setItem('temp_token', token);
        localStorage.setItem('temp_user', JSON.stringify(mappedUser));
        setCompany(null);
        setAuthStep('company');

        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo(a), ${mappedUser.name}! Selecione a empresa para continuar.`,
        });
      } else {
        throw new Error(response.error || 'Erro no login');
      }
    } catch (error) {
      toast({
        title: "Erro no login",
        description: error instanceof Error ? error.message : 'Credenciais inválidas',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const selectCompany = async (companyId: string) => {
    try {
      setLoading(true);
      const response = await apiService.selectCompany(companyId);
      
      if (response.success && response.data) {
        const { user: userData, token, company: selectedCompany } = response.data;
        const mappedUser = mapUser(userData);
        
        // Store final token (with company_id)
        localStorage.setItem('id_move_token', token);
        localStorage.setItem('id_move_user', JSON.stringify(mappedUser));
        localStorage.setItem('id_move_company', JSON.stringify(selectedCompany));
        localStorage.removeItem('temp_token');
        localStorage.removeItem('temp_user');
        
        console.log('Token final salvo:', token);
        console.log('Usuário final salvo:', mappedUser);
        
        setUser(mappedUser);
        setCompany(selectedCompany);
        setAuthStep('complete');
        
        toast({
          title: "Empresa selecionada com sucesso!",
          description: `Acesso liberado para ${mappedUser.name}`,
        });
      } else {
        throw new Error(response.error || 'Erro ao selecionar empresa');
      }
    } catch (error) {
      toast({
        title: "Erro ao selecionar empresa",
        description: error instanceof Error ? error.message : 'Erro ao selecionar empresa',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    // Encerra sessão no Supabase + invalida cache do apiService.
    // Sem isso, RLS continua respondendo como o usuário anterior, e o próximo
    // login no mesmo navegador herda o contexto antigo (driver_id/company_id).
    try {
      await apiService.logout();
    } catch (error) {
      console.warn('Falha ao encerrar sessão remota; seguindo com logout local.', error);
    }
    clearStoredAuth();
    setUser(null);
    setCompany(null);
    setAuthStep('login');

    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        isAuthenticated: !!user && authStep === 'complete',
        authStep,
        login,
        selectCompany,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
