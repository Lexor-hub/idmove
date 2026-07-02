import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Truck,
  Package,
  CheckCircle,
  AlertTriangle,
  Users,
  MapPin,
  BarChart3,
  FileText,
  Search, // Adicionado para o novo botão
  AlertCircle
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DeliveryUpload } from '@/components/delivery/DeliveryUpload';
import { todayBrt } from '@/lib/date';

interface DriverLoadStatus {
  id: string;
  name: string;
  nfsCarregadas: number;
  nfsPendentes: number;
  status: 'CARREGANDO' | 'EM_ROTA' | 'FINALIZADO';
  deliveries: Array<{
    id: string;
    nf_number: string;
    status: string;
    client_name: string;
    receipt_image_url?: string | null;
    receipt_notes?: string | null;
    source_document_url?: string | null;
  }>;
}

interface OccurrenceData {
  id: string;
  driver_name: string;
  type: string;
  created_at: string;
  description: string;
  next_scheduled_date?: string | null;
}

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasRealizadas: 0,
    entregasPendentes: 0,
    motoristasAtivos: 0,
    ocorrencias: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showDeliveryUpload, setShowDeliveryUpload] = useState(false);
  const [driverLoadStatuses, setDriverLoadStatuses] = useState<DriverLoadStatus[]>([]);
  const [dailyOccurrences, setDailyOccurrences] = useState<OccurrenceData[]>([]);
  const [selectedDriverModal, setSelectedDriverModal] = useState<DriverLoadStatus | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadDashboardData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // CORREÇÃO: Usa o endpoint correto para buscar os KPIs.
      const response = await apiService.getDashboardKPIs();
      let deliveriesList: any[] | undefined;

      if (response.success && response.data) {
        const kpis: any = response.data;
        deliveriesList = Array.isArray(kpis.today_deliveries?.list) ? kpis.today_deliveries.list : undefined;
        const newStats = {
          totalEntregas: Number(kpis.today_deliveries?.total ?? kpis.total_deliveries ?? 0),
          entregasRealizadas: Number(kpis.today_deliveries?.completed ?? kpis.completed_deliveries ?? 0),
          // "Em andamento" = entregas ainda nao concluidas e nao falhas:
          // pendentes (PENDING/ASSIGNED) + em rota (IN_TRANSIT). Antes lia so
          // in_progress, escondendo PENDING/ASSIGNED e divergindo do total.
          entregasPendentes:
            Number(kpis.today_deliveries?.pending ?? kpis.pending_deliveries ?? 0) +
            Number(kpis.today_deliveries?.in_progress ?? 0),
          ocorrencias: Number(kpis.pending_occurrences ?? 0),
          motoristasAtivos: Number(kpis.active_drivers ?? 0),
        };
        setStats(newStats);
      } else {
        throw new Error(response.error || 'Nao foi possivel carregar os KPIs.');
      }

      // Carrega dados de carregamento do dia, ocorrências e atividade recente
      await Promise.all([loadDriverLoadStatuses(deliveriesList), loadDailyOccurrences(), loadRecentActivity()]);
    } catch (error) {
      if (!silent) {
        toast({
          title: "Erro ao carregar dados",
          description: error instanceof Error ? error.message : "Nao foi possivel carregar os dados do dashboard",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDriverLoadStatuses = async (deliveriesFromKpis?: any[]) => {
    const today = todayBrt();
    const response = deliveriesFromKpis ? null : await apiService.getDeliveries({ scheduled_date: today });

    if (deliveriesFromKpis || (response?.success && response.data)) {
      const deliveries = (deliveriesFromKpis || response?.data || []) as any[];

      // Agrupa entregas por motorista
      const byDriver = new Map<string, DriverLoadStatus>();

      deliveries.forEach((delivery) => {
        const driverId = delivery.driver_id || 'sem_motorista';
        const driverName = delivery.driver_name || 'Sem motorista';

        if (!byDriver.has(driverId)) {
          byDriver.set(driverId, {
            id: driverId,
            name: driverName,
            nfsCarregadas: 0,
            nfsPendentes: 0,
            status: 'CARREGANDO',
            deliveries: [],
          });
        }

        const driver = byDriver.get(driverId)!;
        driver.deliveries.push(delivery);

        if (['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(delivery.status)) {
          driver.nfsCarregadas++;
          if (delivery.status === 'IN_TRANSIT') {
            driver.status = 'EM_ROTA';
          }
        } else if (delivery.status === 'PENDING') {
          driver.nfsPendentes++;
        } else if (delivery.status === 'DELIVERED') {
          driver.status = 'FINALIZADO';
        }
      });

      setDriverLoadStatuses(Array.from(byDriver.values()).map((driver) => {
        const statuses = driver.deliveries.map((delivery) => delivery.status);
        if (statuses.length > 0 && statuses.every((status) => status === 'DELIVERED')) {
          return { ...driver, status: 'FINALIZADO' as const };
        }
        if (statuses.includes('IN_TRANSIT')) {
          return { ...driver, status: 'EM_ROTA' as const };
        }
        return driver;
      }));
    }
  };

  const loadDailyOccurrences = async () => {
    const today = todayBrt();
    const response = await apiService.getOccurrences({ date: today });

    if (response.success && response.data) {
      const occurrences = (response.data as any[])
        .slice(0, 5)
        .map((occ: any) => ({
          id: occ.id || '',
          driver_name: occ.driver_name || 'Motorista',
          type: occ.type || 'Desconhecido',
          created_at: occ.created_at || new Date().toISOString(),
          description: occ.description || '',
          next_scheduled_date: occ.next_scheduled_date || null,
        }));

      setDailyOccurrences(occurrences);
    }
  };

  const loadRecentActivity = async () => {
    const response = await apiService.getRecentDeliveryEvents(5);
    if (response.success) {
      setRecentActivity(response.data);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const refreshInterval = setInterval(() => loadDashboardData(true), 60_000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    // 1. Layout restaurado: O container principal foi adicionado de volta.
    <div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Administrativo</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do sistema de entregas - {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
        <Button className="bg-gradient-primary" onClick={() => navigate('/dashboard/relatorios')}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Relatórios Completos
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 max-w-full overflow-x-auto">
        <StatsCard
          title="Total de Entregas"
          value={stats.totalEntregas}
          icon={Package}
          description="Entregas programadas hoje"
          variant="default"
        />
        <StatsCard
          title="Entregas Realizadas"
          value={stats.entregasRealizadas}
          icon={CheckCircle}
          description="Concluídas com sucesso"
          variant="success"
        />
        <StatsCard
          title="Entregas Pendentes"
          value={stats.entregasPendentes}
          icon={Truck}
          description="Em andamento"
          variant="warning"
        />
        <StatsCard
          title="Ocorrências"
          value={stats.ocorrencias}
          icon={AlertTriangle}
          description="Problemas reportados"
          variant="danger"
        />
        <StatsCard
          title="Motoristas Ativos"
          value={stats.motoristasAtivos}
          icon={Users}
          description="Online agora"
          variant="default"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card className="glass-card border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start h-12" onClick={() => navigate('/dashboard/usuarios')}>
              <Users className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Gerenciar Usuários</div>
                <div className="text-xs text-muted-foreground">Cadastrar e editar usuários</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-12" onClick={() => navigate('/dashboard/veiculos')}>
              <Truck className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Cadastrar Veículos</div>
                <div className="text-xs text-muted-foreground">Adicionar novos veículos</div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-12" 
              onClick={() => setShowDeliveryUpload(true)}
            >
              <Package className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Nova Entrega</div>
                <div className="text-xs text-muted-foreground">Cadastrar nova entrega</div>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-12" onClick={() => navigate('/dashboard/rastreamento')}>
              <MapPin className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Rastreamento</div>
                <div className="text-xs text-muted-foreground">Ver localização dos motoristas</div>
              </div>
            </Button>
            {/* Botão adicionado para buscar canhotos */}
            <Button 
              variant="outline" 
              className="justify-start h-12" 
              onClick={() => navigate('/dashboard/receipts-report')}
            >
              <Search className="mr-3 h-4 w-4" />
              <div className="text-left">
                <div className="font-medium">Buscar Canhotos</div>
                <div className="text-xs text-muted-foreground">Consultar comprovantes de entrega</div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-card border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => {
                  const typeColors: Record<string, { bg: string; dot: string }> = {
                    DELIVERED: { bg: 'success/5', dot: 'bg-success' },
                    IN_TRANSIT: { bg: 'warning/5', dot: 'bg-warning' },
                    ASSIGNED: { bg: 'primary/5', dot: 'bg-primary' },
                    FAILED: { bg: 'danger/5', dot: 'bg-danger' },
                    PENDING: { bg: 'secondary/5', dot: 'bg-secondary' },
                  };
                  const colors = typeColors[activity.type] || typeColors.PENDING;

                  return (
                    <div key={activity.id} className={`flex items-center gap-3 p-3 rounded-lg bg-${colors.bg} border border-${colors.bg.split('/')[0]}/20`}>
                      <div className={`w-2 h-2 ${colors.dot} rounded-full`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">NF {activity.nf_number} - {activity.driver_name} - {new Date(activity.created_at).toLocaleTimeString('pt-BR')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhuma atividade registrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Carregamento do Dia */}
      <Card className="glass-card border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Carregamento do Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {driverLoadStatuses.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {driverLoadStatuses.map((driver) => {
                const statusColors = {
                  CARREGANDO: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Carregando' },
                  EM_ROTA: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Em Rota' },
                  FINALIZADO: { bg: 'bg-green-100', text: 'text-green-800', label: 'Finalizado' },
                };
                const colors = statusColors[driver.status];

                return (
                  <div
                    key={driver.id}
                    className="p-4 rounded-lg border border-border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{driver.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {driver.nfsCarregadas} carregadas / {driver.nfsPendentes} pendentes
                        </p>
                      </div>
                      <Badge className={`${colors.bg} ${colors.text}`}>
                        {colors.label}
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedDriverModal(driver)}
                    >
                      Ver NFs
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum carregamento registrado para hoje
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Ocorrências do Dia */}
      <Card className="glass-card border-white/5" data-testid="daily-occurrences">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Ocorrências do Dia (Últimas 5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyOccurrences.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Reentrega</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyOccurrences.map((occurrence) => {
                    const isReentrega = occurrence.type?.toLowerCase().includes('reentrega');
                    const isRefusal = occurrence.type?.toLowerCase().includes('recusa') ||
                                     occurrence.type?.toLowerCase().includes('avaria');
                    const iconColor = isReentrega ? 'text-yellow-600' : isRefusal ? 'text-red-600' : 'text-gray-600';

                    return (
                      <TableRow key={occurrence.id} className="hover:bg-muted/30" data-testid="admin-occurrence-row">
                        <TableCell className="font-medium">{occurrence.driver_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <AlertCircle className={`w-4 h-4 ${iconColor}`} />
                            {occurrence.type}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(occurrence.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {occurrence.next_scheduled_date
                            ? new Date(`${occurrence.next_scheduled_date}T00:00:00`).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {occurrence.description}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma ocorrência registrada para hoje
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card className="glass-card border-white/5">
        <CardHeader>
          <CardTitle>Status do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/10 border border-secondary/20">
              <div>
                <p className="font-medium">API de Rastreamento</p>
                <p className="text-sm text-muted-foreground">Não monitorado</p>
              </div>
              <div className="w-3 h-3 bg-secondary rounded-full" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/10 border border-secondary/20">
              <div>
                <p className="font-medium">Processamento OCR</p>
                <p className="text-sm text-muted-foreground">Não monitorado</p>
              </div>
              <div className="w-3 h-3 bg-secondary rounded-full" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/10 border border-secondary/20">
              <div>
                <p className="font-medium">Base de Dados</p>
                <p className="text-sm text-muted-foreground">Não monitorado</p>
              </div>
              <div className="w-3 h-3 bg-secondary rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Funcionalidade corrigida: Modal de Cadastro de Entrega com seleção de motorista habilitada. */}
      <DeliveryUpload
        open={showDeliveryUpload}
        onOpenChange={setShowDeliveryUpload}
        allowDriverSelection={true} // Força a exibição da lista de motoristas.
        onSuccess={() => {
          loadDashboardData(); // Recarrega os KPIs do dashboard
          toast({
            title: "Entrega Cadastrada!",
            description: "A nova entrega foi criada e atribuída com sucesso.",
          });
          // Fecha o modal após o sucesso
          setShowDeliveryUpload(false);
        }}
      />

      {/* Modal de NFs do Motorista */}
      {selectedDriverModal && (
        <Dialog open={!!selectedDriverModal} onOpenChange={() => setSelectedDriverModal(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Entregas - {selectedDriverModal.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {selectedDriverModal.deliveries.map((delivery) => {
                const statusMap: Record<string, { label: string; bg: string; text: string }> = {
                  PENDING: { label: 'Pendente', bg: 'bg-yellow-100', text: 'text-yellow-800' },
                  ASSIGNED: { label: 'Atribuída', bg: 'bg-blue-100', text: 'text-blue-800' },
                  IN_TRANSIT: { label: 'Em Rota', bg: 'bg-orange-100', text: 'text-orange-800' },
                  DELIVERED: { label: 'Entregue', bg: 'bg-green-100', text: 'text-green-800' },
                  FAILED: { label: 'Falha', bg: 'bg-red-100', text: 'text-red-800' },
                  CANCELLED: { label: 'Cancelada', bg: 'bg-gray-100', text: 'text-gray-800' },
                };
                const statusInfo = statusMap[delivery.status] || statusMap.PENDING;

                return (
                  <div key={delivery.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">NF {delivery.nf_number}</p>
                        <p className="text-xs text-muted-foreground">{delivery.client_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {delivery.source_document_url && (
                          <a
                            href={delivery.source_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            title="Ver NF-e original"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                        )}
                        <Badge className={`${statusInfo.bg} ${statusInfo.text}`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>

                    {delivery.receipt_image_url && (
                      <div className="flex items-start gap-3">
                        <a href={delivery.receipt_image_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={delivery.receipt_image_url}
                            alt="Canhoto"
                            className="h-16 w-16 object-cover rounded border hover:opacity-80 transition-opacity"
                          />
                        </a>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Canhoto enviado
                          </p>
                          {delivery.receipt_notes && (
                            <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-1">{delivery.receipt_notes}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
