import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Company, AuthContextType, LoginCredentials } from '@/types/auth';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext<AuthContextType | null>(null);

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
    const token = localStorage.getItem('id_transporte_token');
    const userData = localStorage.getItem('id_transporte_user');
    const companyData = localStorage.getItem('id_transporte_company');
    
    console.log('Verificando dados de autenticação...');
    console.log('Token presente:', !!token);
    console.log('User data presente:', !!userData);
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log('Usuário carregado:', parsedUser);
        setUser(parsedUser);
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
        localStorage.removeItem('id_transporte_token');
        localStorage.removeItem('id_transporte_user');
        localStorage.removeItem('id_transporte_company');
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
        const { user: userData, token } = response.data;
        console.log('Token recebido:', token ? 'Presente' : 'Ausente');
        console.log('User data recebido:', userData);
        
        // Mapeamento de roles do backend para o frontend (mantendo compatibilidade)
        const roleMap: Record<string, string> = {
          MASTER: 'MASTER',
          ADMIN: 'ADMIN',
          SUPERVISOR: 'SUPERVISOR',
          OPERATOR: 'OPERATOR',
          DRIVER: 'DRIVER',
          CLIENT: 'CLIENT',
          // Compatibilidade com roles antigas
          ADMINISTRADOR: 'ADMIN',
          MOTORISTA: 'DRIVER',
          OPERADOR: 'OPERATOR',
        };
        
        const mappedUser = { 
          ...userData, 
          role: roleMap[userData.user_type] || userData.user_type,
          name: userData.full_name || userData.name
        };
        
        // Store temporary token (without company_id)
        localStorage.setItem('temp_token', token);
        localStorage.setItem('temp_user', JSON.stringify(mappedUser));
        
        console.log('Token temporário salvo no localStorage:', token);
        console.log('Usuário temporário salvo no localStorage:', mappedUser);
        
        // Verificar se foi salvo
        const savedToken = localStorage.getItem('temp_token');
        console.log('Token verificado no localStorage:', savedToken ? 'Presente' : 'Ausente');
        
        setUser(mappedUser);
        setAuthStep('company');
        
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo(a), ${mappedUser.name}! Agora selecione sua empresa.`,
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
        const { user: userData, token } = response.data;
        
        // Mapeamento de roles do backend para o frontend
        const roleMap: Record<string, string> = {
          MASTER: 'MASTER',
          ADMIN: 'ADMIN',
          SUPERVISOR: 'SUPERVISOR',
          OPERATOR: 'OPERATOR',
          DRIVER: 'DRIVER',
          CLIENT: 'CLIENT',
          ADMINISTRADOR: 'ADMIN',
          MOTORISTA: 'DRIVER',
          OPERADOR: 'OPERATOR',
        };
        
        const mappedUser = { 
          ...userData, 
          role: roleMap[userData.user_type] || userData.user_type,
          name: userData.full_name || userData.name
        };
        
        // Store final token (with company_id)
        localStorage.setItem('id_transporte_token', token);
        localStorage.setItem('id_transporte_user', JSON.stringify(mappedUser));
        localStorage.removeItem('temp_token');
        localStorage.removeItem('temp_user');
        
        console.log('Token final salvo:', token);
        console.log('Usuário final salvo:', mappedUser);
        
        setUser(mappedUser);
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

  const logout = () => {
    console.log('Fazendo logout...');
    localStorage.removeItem('id_transporte_token');
    localStorage.removeItem('id_transporte_user');
    localStorage.removeItem('id_transporte_company');
    localStorage.removeItem('temp_token');
    localStorage.removeItem('temp_user');
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