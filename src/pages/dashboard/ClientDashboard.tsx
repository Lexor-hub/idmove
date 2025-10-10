import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  CheckCircle, 
  Clock, 
  FileText,
  Search,
  MapPin,
  BarChart3
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface ClientDelivery {
  id: string;
  nfNumber: string;
  date: string;
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'REALIZADA';
  volume: number;
  value: number;
  driver?: string;
}

export const ClientDashboard = () => {
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasRealizadas: 0,
    entregasPendentes: 0,
    volumeTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadClientData();
  }, []);

  const loadClientData = async () => {
    try {
      // Load client-specific deliveries
      const response = await apiService.getDeliveryReports({ client: 'current' });
      if (response.success && response.data) {
        setDeliveries(response.data);
        
        // Calculate stats
        const totalEntregas = response.data.length;
        const entregasRealizadas = response.data.filter((d: any) => d.status === 'REALIZADA').length;
        const entregasPendentes = totalEntregas - entregasRealizadas;
        const volumeTotal = response.data.reduce((sum: number, d: any) => sum + d.volume, 0);
        
        setStats({
          totalEntregas,
          entregasRealizadas,
          entregasPendentes,
          volumeTotal,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar suas entregas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'REALIZADA': return 'bg-success text-success-foreground';
      case 'EM_ANDAMENTO': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'REALIZADA': return 'Entregue';
      case 'EM_ANDAMENTO': return 'Em Trânsito';
      default: return 'Pendente';
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
            <h1 className="text-3xl font-bold tracking-tight">Minhas Entregas</h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe o status das suas mercadorias
            </p>
          </div>
          <Button className="bg-gradient-primary">
            <Search className="mr-2 h-4 w-4" />
            Buscar por NF
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-full overflow-x-auto">
          <StatsCard
            title="Total de Entregas"
            value={stats.totalEntregas}
            icon={Package}
            description="Últimos 30 dias"
            variant="default"
          />
          <StatsCard
            title="Entregas Realizadas"
            value={stats.entregasRealizadas}
            icon={CheckCircle}
            description="Concluídas"
            variant="success"
          />
          <StatsCard
            title="Em Andamento"
            value={stats.entregasPendentes}
            icon={Clock}
            description="Aguardando entrega"
            variant="warning"
          />
          <StatsCard
            title="Volume Total"
            value={`${stats.volumeTotal} itens`}
            icon={Package}
            description="Produtos transportados"
            variant="default"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Deliveries */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Entregas Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deliveries.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma entrega encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deliveries.slice(0, 10).map((delivery) => (
                      <Card key={delivery.id} className="border">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium">NF {delivery.nfNumber}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(delivery.date).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <Badge className={getStatusColor(delivery.status)}>
                              {getStatusText(delivery.status)}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Volume: {delivery.volume} itens</span>
                              <span>Valor: R$ {delivery.value ? delivery.value.toFixed(2) : '0.00'}</span>
                            </div>
                            {delivery.driver && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Motorista: {delivery.driver}</span>
                              </div>
                            )}
                          </div>
                          
                          {delivery.status === 'REALIZADA' && (
                            <div className="mt-3">
                              <Button size="sm" variant="outline" className="w-full">
                                <FileText className="mr-2 h-4 w-4" />
                                Ver Comprovante
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Ações Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start h-12">
                  <Search className="mr-3 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Rastrear Entrega</div>
                    <div className="text-xs text-muted-foreground">Por número da NF</div>
                  </div>
                </Button>
                
                <Button variant="outline" className="w-full justify-start h-12">
                  <FileText className="mr-3 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Meus Comprovantes</div>
                    <div className="text-xs text-muted-foreground">Ver todos os canhotos</div>
                  </div>
                </Button>
                
                <Button variant="outline" className="w-full justify-start h-12">
                  <BarChart3 className="mr-3 h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Relatórios</div>
                    <div className="text-xs text-muted-foreground">Histórico mensal</div>
                  </div>
                </Button>
              </CardContent>
            </Card>

            {/* Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Status das Entregas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-success rounded-full" />
                      <span className="text-sm">Entregues</span>
                    </div>
                    <span className="text-sm font-medium">{stats.entregasRealizadas}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-warning rounded-full" />
                      <span className="text-sm">Em Trânsito</span>
                    </div>
                    <span className="text-sm font-medium">{stats.entregasPendentes}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-muted rounded-full" />
                      <span className="text-sm">Aguardando</span>
                    </div>
                    <span className="text-sm font-medium">0</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
};