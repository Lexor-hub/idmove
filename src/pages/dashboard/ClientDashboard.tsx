import { useState, useEffect, useMemo, useCallback } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Package, 
  CheckCircle, 
  Clock, 
  FileText,
  Search,
  MapPin,
  BarChart3,
  Truck,
  AlertCircle,
  Image as ImageIcon,
  Activity,
  Building2,
  Boxes,
  CalendarDays,
  UserRound,
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type DeliveryStatusPtBR = 'Pendente' | 'Atribuída' | 'Em Trânsito' | 'Entregue' | 'Problema' | 'Cancelada';

interface ClientDelivery {
  id: string;
  nfNumber: string;
  nf_number: string;
  date: string;
  status: string;
  statusPtBR: DeliveryStatusPtBR;
  volume: number;
  value: number;
  clientName?: string | null;
  driver?: string;
  address?: string;
  scheduledDate?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
  receipt_image_url?: string | null;
  receipt_notes?: string | null;
  source_document_url?: string | null;
  attempt_number?: number;
  latest_occurrence?: {
    type?: string;
    description?: string;
    driver_name?: string | null;
    next_scheduled_date?: string | null;
    created_at?: string;
  } | null;
}

interface ActiveDriver {
  id: string;
  name: string;
  currentStatus: 'online' | 'active' | 'idle';
  updatedAt?: string | null;
}

interface DeliveryReportRow {
  id: string | number;
  nfNumber?: string | null;
  nf_number?: string | null;
  date?: string | null;
  created_at?: string | null;
  scheduled_date?: string | null;
  delivered_at?: string | null;
  status?: string | null;
  volume?: number | null;
  value?: number | null;
  client_name?: string | null;
  driver?: string | null;
  delivery_address?: string | null;
  client_address?: string | null;
  notes?: string | null;
  receipt_image_url?: string | null;
  receipt_notes?: string | null;
  source_document_url?: string | null;
  attempt_number?: number | null;
  latest_occurrence?: ClientDelivery['latest_occurrence'];
}

interface ActiveDriverRow {
  id: string | number;
  name?: string | null;
  current_status: ActiveDriver['currentStatus'];
  updated_at?: string | null;
}

const activeDriverStatus: Record<ActiveDriver['currentStatus'], string> = {
  online: 'Online',
  active: 'Em operação',
  idle: 'Aguardando',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const formatDate = (value?: string | null, includeTime = false) => {
  if (!value) return '—';
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('pt-BR', includeTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const statusToPtBR = (status: string): DeliveryStatusPtBR => {
  switch (status) {
    case 'DELIVERED':
    case 'REALIZADA':
      return 'Entregue';
    case 'IN_TRANSIT':
    case 'EM_ANDAMENTO':
      return 'Em Trânsito';
    case 'ASSIGNED':
      return 'Atribuída';
    case 'FAILED':
    case 'PROBLEMA':
      return 'Problema';
    case 'CANCELLED':
    case 'CANCELED':
      return 'Cancelada';
    case 'PENDING':
    case 'PENDENTE':
    default:
      return 'Pendente';
  }
};

const getStatusBadgeStyle = (status: DeliveryStatusPtBR) => {
  switch (status) {
    case 'Entregue':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Em Trânsito':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Atribuída':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'Problema':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Cancelada':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'Pendente':
    default:
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
};

const getStatusIcon = (status: DeliveryStatusPtBR) => {
  switch (status) {
    case 'Entregue':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'Em Trânsito':
      return <Truck className="h-4 w-4 text-blue-600" />;
    case 'Atribuída':
      return <Package className="h-4 w-4 text-indigo-600" />;
    case 'Problema':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'Pendente':
    default:
      return <Clock className="h-4 w-4 text-yellow-600" />;
  }
};

export const ClientDashboard = () => {
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [activeDrivers, setActiveDrivers] = useState<ActiveDriver[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<ClientDelivery[]>([]);
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasRealizadas: 0,
    emTransito: 0,
    pendentes: 0,
    motoristasAtivos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const { toast } = useToast();
  const { company } = useAuth();

  const statusChartData = useMemo(() => {
    const data = [
      { name: 'Entregue', value: stats.entregasRealizadas, color: '#22c55e' },
      { name: 'Em Trânsito', value: stats.emTransito, color: '#3b82f6' },
      { name: 'Pendente', value: stats.pendentes, color: '#eab308' },
      { name: 'Problema', value: deliveries.filter((d) => d.statusPtBR === 'Problema').length, color: '#ef4444' },
    ];
    return data.filter((item) => item.value > 0);
  }, [stats, deliveries]);

  const receiptsList = useMemo(
    () => deliveries.filter((d) => d.receipt_image_url),
    [deliveries]
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredDeliveries(
        deliveries.filter(
          (d) =>
            d.nfNumber.toLowerCase().includes(query) ||
            d.statusPtBR.toLowerCase().includes(query) ||
            (d.driver && d.driver.toLowerCase().includes(query)) ||
            (d.clientName && d.clientName.toLowerCase().includes(query)) ||
            (d.address && d.address.toLowerCase().includes(query))
        )
      );
    } else {
      setFilteredDeliveries(deliveries);
    }
  }, [searchQuery, deliveries]);

  const loadClientData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [deliveriesResponse, driversResponse] = await Promise.all([
        apiService.getDeliveryReports(),
        apiService.getActiveCompanyDrivers(),
      ]);

      if (deliveriesResponse.success && deliveriesResponse.data) {
        const mapped: ClientDelivery[] = (deliveriesResponse.data as DeliveryReportRow[]).map((d) => {
          const statusPtBR = statusToPtBR(d.status || 'PENDING');
          return {
            id: String(d.id),
            nfNumber: d.nfNumber || d.nf_number || '',
            nf_number: d.nf_number || d.nfNumber || '',
            date: d.date || d.created_at || '',
            status: d.status || 'PENDING',
            statusPtBR,
            volume: d.volume || 0,
            value: d.value || 0,
            clientName: d.client_name || null,
            driver: d.driver || null,
            address: d.delivery_address || d.client_address || null,
            scheduledDate: d.scheduled_date || null,
            deliveredAt: d.delivered_at || null,
            notes: d.notes || null,
            receipt_image_url: d.receipt_image_url || null,
            receipt_notes: d.receipt_notes || null,
            source_document_url: d.source_document_url || null,
            attempt_number: d.attempt_number || 1,
            latest_occurrence: d.latest_occurrence || null,
          };
        });

        setDeliveries(mapped);
        setFilteredDeliveries(mapped);

        const totalEntregas = mapped.length;
        const entregasRealizadas = mapped.filter((d) => d.statusPtBR === 'Entregue').length;
        const emTransito = mapped.filter((d) => d.statusPtBR === 'Em Trânsito').length;
        const pendentes = mapped.filter((d) => d.statusPtBR === 'Pendente' || d.statusPtBR === 'Atribuída').length;

        setStats({
          totalEntregas,
          entregasRealizadas,
          emTransito,
          pendentes,
          motoristasAtivos: driversResponse.success && Array.isArray(driversResponse.data)
            ? driversResponse.data.length
            : 0,
        });
      }

      if (driversResponse.success && Array.isArray(driversResponse.data)) {
        const mappedDrivers = (driversResponse.data as ActiveDriverRow[]).map((driver): ActiveDriver => ({
          id: String(driver.id),
          name: String(driver.name || 'Motorista'),
          currentStatus: driver.current_status as ActiveDriver['currentStatus'],
          updatedAt: driver.updated_at || null,
        }));
        setActiveDrivers(mappedDrivers);
        setStats((current) => ({ ...current, motoristasAtivos: mappedDrivers.length }));
      }

      if (!deliveriesResponse.success && !driversResponse.success && !silent) {
        throw new Error(deliveriesResponse.error || driversResponse.error || 'Falha ao carregar os dados');
      }
    } catch (error) {
      if (!silent) {
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados da empresa",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadClientData();
    const refreshInterval = window.setInterval(() => void loadClientData(true), 60_000);
    return () => window.clearInterval(refreshInterval);
  }, [loadClientData]);

  const handleViewReceipt = async (url: string) => {
    setReceiptLoading(true);
    setShowReceiptModal(true);
    setReceiptImage(null);
    try {
      const imageUrl = await apiService.getSecureFile(url);
      if (imageUrl) {
        setReceiptImage(imageUrl);
      } else {
        throw new Error("Não foi possível carregar a imagem.");
      }
    } catch (error: unknown) {
      toast({
        title: "Erro ao carregar comprovante",
        description: error instanceof Error ? error.message : "Ocorreu um problema.",
        variant: "destructive",
      });
      setShowReceiptModal(false);
    } finally {
      setReceiptLoading(false);
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Building2 className="h-4 w-4" />
              {company?.name || 'Empresa vinculada'}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Painel de Entregas</h1>
            <p className="text-muted-foreground mt-1">
              Visão completa da operação da empresa definida pelo administrador
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 max-w-full">
          <StatsCard
            title="Total de Entregas"
            value={stats.totalEntregas}
            icon={Package}
            description="Todas as entregas"
            variant="default"
          />
          <StatsCard
            title="Entregues"
            value={stats.entregasRealizadas}
            icon={CheckCircle}
            description="Concluídas com sucesso"
            variant="success"
          />
          <StatsCard
            title="Em Trânsito"
            value={stats.emTransito}
            icon={Truck}
            description="A caminho"
            variant="warning"
          />
          <StatsCard
            title="Pendentes"
            value={stats.pendentes}
            icon={Clock}
            description="Aguardando envio"
            variant="default"
          />
          <StatsCard
            title="Motoristas Ativos"
            value={stats.motoristasAtivos}
            icon={Activity}
            description="Online na empresa"
            variant="success"
          />
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por NF, cliente, status, endereço ou motorista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Deliveries List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Entregas ({filteredDeliveries.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredDeliveries.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery ? 'Nenhuma entrega encontrada com esse filtro' : 'Nenhuma entrega encontrada'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDeliveries.map((delivery) => (
                      <Card key={delivery.id} data-testid="entrega-item" className="border hover:shadow-sm transition-shadow">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-base">NF {delivery.nfNumber}</p>
                              <p className="text-sm text-muted-foreground">Criada em {formatDate(delivery.date)}</p>
                            </div>
                            <Badge className={`gap-1 ${getStatusBadgeStyle(delivery.statusPtBR)}`}>
                              {getStatusIcon(delivery.statusPtBR)}
                              {delivery.statusPtBR}
                            </Badge>
                          </div>
                          
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Cliente: {delivery.clientName || 'Não informado'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Motorista: {delivery.driver || 'Não atribuído'}</span>
                            </div>
                            {delivery.address && (
                              <div className="flex items-start gap-2 sm:col-span-2">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{delivery.address}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Programada: {formatDate(delivery.scheduledDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {delivery.volume} {delivery.volume === 1 ? 'volume' : 'volumes'} · {formatCurrency(delivery.value)}
                              </span>
                            </div>
                            {delivery.deliveredAt && (
                              <div className="flex items-center gap-2 sm:col-span-2">
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                <span className="text-muted-foreground">Concluída em {formatDate(delivery.deliveredAt, true)}</span>
                              </div>
                            )}
                            {delivery.attempt_number && delivery.attempt_number > 1 && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Tentativa {delivery.attempt_number}</span>
                              </div>
                            )}
                            {delivery.notes && (
                              <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground sm:col-span-2">
                                Observação: {delivery.notes}
                              </p>
                            )}
                          </div>

                          {delivery.statusPtBR === 'Problema' && delivery.latest_occurrence && (
                            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                              <div className="flex items-center gap-2 font-medium text-red-800">
                                <AlertCircle className="h-4 w-4" />
                                Ocorrência registrada
                              </div>
                              <p className="mt-1 text-red-700">{delivery.latest_occurrence.description}</p>
                              <div className="mt-2 space-y-1 text-xs text-red-700">
                                {delivery.latest_occurrence.driver_name && (
                                  <p>Motorista: {delivery.latest_occurrence.driver_name}</p>
                                )}
                                {delivery.latest_occurrence.next_scheduled_date && (
                                  <p>
                                    Reentrega prevista:{' '}
                                    {new Date(`${delivery.latest_occurrence.next_scheduled_date}T00:00:00`).toLocaleDateString('pt-BR')}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Actions for delivered items */}
                          {delivery.statusPtBR === 'Entregue' && delivery.receipt_image_url && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-start gap-3">
                                <button onClick={() => handleViewReceipt(delivery.receipt_image_url!)} className="shrink-0">
                                  <img
                                    src={delivery.receipt_image_url}
                                    alt="Canhoto"
                                    className="h-16 w-16 object-cover rounded border hover:opacity-80 transition-opacity"
                                  />
                                </button>
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Canhoto disponível
                                  </p>
                                  {delivery.receipt_notes && (
                                    <p className="text-xs text-gray-600 mt-1">{delivery.receipt_notes}</p>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-1 gap-1 h-7 text-xs"
                                    onClick={() => handleViewReceipt(delivery.receipt_image_url!)}
                                  >
                                    <ImageIcon className="h-3 w-3" />
                                    Ampliar
                                  </Button>
                                </div>
                              </div>
                              {delivery.source_document_url && (
                                <a
                                  href={delivery.source_document_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                >
                                  <FileText className="h-3 w-3" />
                                  Ver NF-e original
                                </a>
                              )}
                            </div>
                          )}
                          {delivery.statusPtBR === 'Entregue' && !delivery.receipt_image_url && (
                            <div className="mt-3 space-y-1">
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span>Entrega concluída</span>
                              </div>
                              {delivery.source_document_url && (
                                <a
                                  href={delivery.source_document_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                >
                                  <FileText className="h-3 w-3" />
                                  Ver NF-e original
                                </a>
                              )}
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

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Motoristas Ativos
                  </span>
                  <Badge variant="secondary" className="text-xs">{activeDrivers.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeDrivers.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum motorista ativo no momento
                  </p>
                ) : (
                  <div className="space-y-2" data-testid="motoristas-ativos">
                    {activeDrivers.map((driver) => (
                      <div
                        key={driver.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-emerald-900">{driver.name}</p>
                          <p className="text-xs text-emerald-700">
                            Atualizado em {formatDate(driver.updatedAt, true)}
                          </p>
                        </div>
                        <Badge className="shrink-0 border-emerald-200 bg-white text-emerald-700">
                          <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                          {activeDriverStatus[driver.currentStatus] || 'Ativo'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Donut Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Status das Entregas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusChartData.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Sem entregas para exibir
                  </p>
                ) : (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {statusChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [`${value} entregas`, name]}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          wrapperStyle={{ fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <p className="text-2xl font-bold">{stats.totalEntregas}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                )}
                {stats.totalEntregas > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {((stats.entregasRealizadas / stats.totalEntregas) * 100).toFixed(0)}% concluído
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Lista de Canhotos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Lista de Canhotos
                  </span>
                  <Badge variant="secondary" className="text-xs">{receiptsList.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {receiptsList.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    Nenhum canhoto disponível ainda
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {receiptsList.map((delivery) => (
                      <button
                        key={delivery.id}
                        onClick={() => handleViewReceipt(delivery.receipt_image_url!)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/40 transition-colors text-left"
                      >
                        <img
                          src={delivery.receipt_image_url!}
                          alt={`Canhoto NF ${delivery.nfNumber}`}
                          className="h-12 w-12 rounded object-cover border shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">NF {delivery.nfNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {delivery.driver || 'Motorista'} •{' '}
                            {delivery.date
                              ? new Date(delivery.date).toLocaleDateString('pt-BR')
                              : '—'}
                          </p>
                        </div>
                        <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Receipt Image Modal */}
        <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Canhoto Assinado</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center items-center min-h-[200px]">
              {receiptLoading && <p className="text-muted-foreground">Carregando imagem...</p>}
              {receiptImage && (
                <a href={receiptImage} target="_blank" rel="noopener noreferrer">
                  <img
                    src={receiptImage}
                    alt="Canhoto assinado"
                    className="max-w-full max-h-[70vh] object-contain rounded-md"
                  />
                </a>
              )}
              {!receiptLoading && !receiptImage && (
                <p className="text-red-500">Não foi possível carregar a imagem.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowReceiptModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
};
