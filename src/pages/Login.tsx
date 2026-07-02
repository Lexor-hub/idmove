import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, User, Lock } from 'lucide-react';
import { apiService } from '@/services/api';

interface Company {
  // CORREÇÃO: A interface foi ajustada para corresponder aos dados retornados por `getAuthCompanies`.
  // As propriedades `email` e `subscription_plan` não são fornecidas neste endpoint.
  id: string;
  name: string;
  domain: string;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const Login: React.FC = () => {
  const { login, selectCompany, authStep, loading } = useAuth();
  const { toast } = useToast();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authStep === 'company') {
      loadCompanies();
    }
  }, [authStep]);

  const loadCompanies = async () => {
    try {
      setCompaniesLoading(true);
      const response = await apiService.getAuthCompanies(); // CORREÇÃO: Usar a função específica para o fluxo de autenticação
      if (response.success && response.data) {
        setCompanies(response.data);
      } else {
        setError(response.error || 'Erro ao carregar empresas');
      }
    } catch (error) {
      setError(errorMessage(error, 'Erro ao carregar empresas'));
    } finally {
      setCompaniesLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(credentials);
    } catch (error) {
      setError(errorMessage(error, 'Erro no login'));
    }
  };

  const handleCompanySelect = async (companyId: string) => {
    try {
      await selectCompany(companyId);
    } catch (error) {
      setError(errorMessage(error, 'Erro ao selecionar empresa'));
    }
  };

  if (authStep === 'company') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
        {/* Animated Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse-primary pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="max-w-md w-full space-y-8 z-10 relative animate-fade-in">
          <div className="text-center">
            <div className="mx-auto h-32 w-32 relative flex items-center justify-center mb-6 group">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse-primary" />
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-transparent rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
              <img src="/logo_final.png" alt="ID MOVE Premium Logo" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(242,139,4,0.7)] transform group-hover:scale-105 transition-transform duration-500" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">
              Selecione sua empresa
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha a empresa para a qual você trabalha
            </p>
          </div>

          <Card className="glass-card border-white/10 shadow-elevated">
            <CardContent className="pt-6">
              {companiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground font-medium">Carregando empresas...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-destructive font-medium mb-4">{error}</p>
                  <Button 
                    onClick={loadCompanies} 
                    variant="outline" 
                    className="glass-input hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      onClick={() => handleCompanySelect(company.id)}
                      className="p-4 border border-white/10 rounded-xl cursor-pointer bg-background/30 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300 group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{company.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{company.domain}</p>
                        </div>
                        <Button size="sm" variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground">
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Animated Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse-primary pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="max-w-md w-full space-y-8 z-10 relative animate-fade-in">
        <div className="text-center">
          <div className="mx-auto h-32 w-32 relative flex items-center justify-center mb-6 group">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse-primary" />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-transparent rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
            <img src="/logo_final.png" alt="ID MOVE Premium Logo" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(242,139,4,0.7)] transform group-hover:scale-105 transition-transform duration-500" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground">
            Entrar no ID MOVE
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesse a sua conta premium
          </p>
        </div>

        <Card className="glass-card border-white/10 shadow-elevated">
          <CardContent className="pt-8 pb-6 px-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">E-mail</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="username"
                    type="email"
                    autoComplete="email"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    className="pl-10 glass-input h-12"
                    placeholder="Digite seu e-mail"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Senha</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="pl-10 glass-input h-12"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="text-destructive text-sm text-center font-medium bg-destructive/10 py-2 rounded-md border border-destructive/20">{error}</div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-primary hover:shadow-glow text-primary-foreground font-semibold text-base tracking-wide transition-all duration-300 mt-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  'Acessar Sistema'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
