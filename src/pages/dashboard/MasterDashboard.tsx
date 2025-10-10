import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  Users, 
  BarChart3,
  Activity,
  Globe,
  Shield,
  Settings,
  TrendingUp
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Company } from '@/types/auth';

export const MasterDashboard = () => {
  const [stats, setStats] = useState({
    totalEmpresas: 0,
    empresasAtivas: 0,
    totalUsuarios: 0,
    totalEntregas: 0,
  });
  const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      setLoading(true);
      
      // Carregar empresas
      const companiesResponse = await apiService.getCompanies();
      if (companiesResponse.success && companiesResponse.data) {
        const companies = companiesResponse.data as Company[];
        const activeCompanies = companies.filter(c => c.status === 'ACTIVE');
        
        setStats({
          totalEmpresas: companies.length,
          empresasAtivas: activeCompanies.length,
          totalUsuarios: companies.length * 10, // Mock data
          totalEntregas: companies.length * 50, // Mock data
        });
        
        // Empresas mais recentes
        setRecentCompanies(companies.slice(0, 5));
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do dashboard master",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Master</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do sistema multi-tenant - {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
        <Button className="bg-gradient-primary" onClick={() => navigate('/dashboard/empresas')}>
          <Building className="mr-2 h-4 w-4" />
          Gerenciar Empresas
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-full overflow-x-auto">
        <StatsCard
          title="Total de Empresas"
          value={stats.totalEmpresas}
          icon={Building}
          description="Empresas cadastradas"
          variant="default"
        />
        <StatsCard
          title="Empresas Ativas"
          value={stats.empresasAtivas}
          icon={Activity}
          description="Empresas operacionais"
          variant="success"
        />
        <StatsCard
          title="Total de Usuários"
          value={stats.totalUsuarios}
          icon={Users}
          description="Usuários no sistema"
          variant="warning"
        />
        <StatsCard
          title="Total de Entregas"
          value={stats.totalEntregas}
          icon={TrendingUp}
          description="Entregas realizadas"
          variant="danger"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Ações Master
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start h-12" onClick={() => navigate('/dashboard/empresas')}>
              <Building className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Gerenciar Empresas</div>
                <div className="text-xs text-muted-foreground">Criar e editar empresas</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-12" onClick={() => navigate('/dashboard/usuarios')}>
              <Users className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Usuários Master</div>
                <div className="text-xs text-muted-foreground">Gerenciar usuários do sistema</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-12" onClick={() => navigate('/dashboard/relatorios')}>
              <BarChart3 className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Relatórios Globais</div>
                <div className="text-xs text-muted-foreground">Relatórios de todas as empresas</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-12">
              <Settings className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Configurações</div>
                <div className="text-xs text-muted-foreground">Configurações do sistema</div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Companies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Empresas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCompanies.map((company) => (
                <div key={company.id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: company.primary_color || '#3B82F6' }}
                  >
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.domain}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(company.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
              {recentCompanies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building className="h-8 w-8 mx-auto mb-2" />
                  <p>Nenhuma empresa cadastrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Visão Geral do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <div>
                <p className="font-medium">Sistema Multi-Tenant</p>
                <p className="text-sm text-muted-foreground">Operacional</p>
              </div>
              <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <div>
                <p className="font-medium">Isolamento de Dados</p>
                <p className="text-sm text-muted-foreground">Ativo</p>
              </div>
              <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20">
              <div>
                <p className="font-medium">Segurança</p>
                <p className="text-sm text-muted-foreground">Protegido</p>
              </div>
              <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Features */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Recursos Master
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full" />
                <span className="text-sm">Gestão de Empresas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full" />
                <span className="text-sm">Isolamento de Dados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full" />
                <span className="text-sm">Relatórios Globais</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full" />
                <span className="text-sm">Configurações Avançadas</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Status Multi-Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Domínios Ativos</span>
                <span className="text-sm font-medium">{stats.empresasAtivas}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Subdomínios</span>
                <span className="text-sm font-medium">{stats.totalEmpresas}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Isolamento</span>
                <span className="text-sm font-medium text-success">Ativo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auditoria</span>
                <span className="text-sm font-medium text-success">Ativa</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MasterDashboard; 