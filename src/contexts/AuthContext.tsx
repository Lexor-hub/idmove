import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Company, AuthContextType, LoginCredentials } from '@/types/auth';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { normalizeRole } from '@/lib/roles';
import { supabase } from '@/integrations/supabase/client';

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
  const [initializing, setInitializing] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const resetAuth = () => {
      apiService.clearContext();
      clearStoredAuth();
      setUser(null);
      setCompany(null);
      setAuthStep('login');
    };

    // Keep this callback synchronous: awaiting Supabase calls here can lock Auth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') resetAuth();
      if (event === 'TOKEN_REFRESHED' && session) {
        localStorage.setItem('id_move_token', session.access_token);
      }
    });

    const restoreAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error || !data.session) {
          resetAuth();
          return;
        }

        // The Supabase session is authoritative; legacy localStorage may be stale
        // or missing even though the refresh token still works.
        const refreshed = await apiService.refreshCurrentSession();
        if (cancelled) return;
        if (!refreshed.success || !refreshed.data) {
          resetAuth();
          return;
        }
        const restoredUser = mapUser(refreshed.data.user);
        let restoredCompany = refreshed.data.company;
        if (restoredUser.role === 'MASTER') {
          const saved = localStorage.getItem('id_move_company');
          if (saved) {
            try {
              const selected = await apiService.selectCompany(JSON.parse(saved).id);
              if (cancelled) return;
              if (selected.success && selected.data) restoredCompany = selected.data.company;
            } catch { /* An invalid saved company falls back to the profile company. */ }
          }
        }
        localStorage.setItem('id_move_token', refreshed.data.token);
        localStorage.setItem('id_move_user', JSON.stringify(restoredUser));
        if (restoredCompany) localStorage.setItem('id_move_company', JSON.stringify(restoredCompany));
        else localStorage.removeItem('id_move_company');
        setUser(restoredUser);
        setCompany(restoredCompany || null);
        setAuthStep(restoredCompany ? 'complete' : 'company');
      } catch {
        if (!cancelled) resetAuth();
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitializing(false);
        }
      }
    };
    void restoreAuth();
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      
      const response = await apiService.login(credentials);
      
      if (response.success && response.data) {
        const { user: userData, token, company: selectedCompany } = response.data;
        
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
        initializing,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
