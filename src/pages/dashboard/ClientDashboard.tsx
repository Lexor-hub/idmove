import { useState, useEffect, useMemo } from 'react';
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
  driver?: string;
  address?: string;
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
  const [filteredDeliveries, setFilteredDeliveries] = useState<ClientDelivery[]>([]);
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasRealizadas: 0,
    emTransito: 0,
    pendentes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState<ClientDelivery | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
    loadClientData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredDeliveries(
        deliveries.filter(
          (d) =>
            d.nfNumber.toLowerCase().includes(query) ||
            d.statusPtBR.toLowerCase().includes(query) ||
            (d.driver && d.driver.toLowerCase().includes(query))
        )
      );
    } else {
      setFilteredDeliveries(deliveries);
    }
  }, [searchQuery, deliveries]);

  const loadClientData = async () => {
    try {
      const response = await apiService.getDeliveryReports({ client: 'current' });
      if (response.success && response.data) {
        const mapped: ClientDelivery[] = (response.data as any[]).map((d: any) => {
          const statusPtBR = statusToPtBR(d.status);
          return {
            id: d.id,
            nfNumber: d.nfNumber || d.nf_number || '',
            nf_number: d.nf_number || d.nfNumber || '',
            date: d.date || d.created_at || '',
            status: d.status,
            statusPtBR,
            volume: d.volume || 0,
            value: d.value || 0,
            driver: d.driver || null,
            address: d.delivery_address || d.client_address || null,
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
    } catch (error: any) {
      toast({
        title: "Erro ao carregar comprovante",
        description: error.message || "Ocorreu um problema.",
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Minhas Entregas</h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe o status das suas mercadorias
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-full overflow-x-auto">
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
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por NF, status ou motorista..."
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
                      <Card key={delivery.id} className="border hover:shadow-sm transition-shadow">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-base">NF {delivery.nfNumber}</p>
                              <p className="text-sm text-muted-foreground">
                                {delivery.date
                                  ? new Date(delivery.date).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })
                                  : '—'}
                              </p>
                            </div>
                            <Badge className={`gap-1 ${getStatusBadgeStyle(delivery.statusPtBR)}`}>
                              {getStatusIcon(delivery.statusPtBR)}
                              {delivery.statusPtBR}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1.5 text-sm">
                            {delivery.driver && (
                              <div className="flex items-center gap-2">
                                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Motorista: {delivery.driver}</span>
                              </div>
                            )}
                            {delivery.address && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground truncate">{delivery.address}</span>
                              </div>
                            )}
                            {delivery.attempt_number && delivery.attempt_number > 1 && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Tentativa {delivery.attempt_number}</span>
                              </div>
                            )}
                          </div>

                          {delivery.statusPtBR === 'Problema' && delivery.latest_occurrence && (
                            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                              <div className="flex items-center gap-2 font-medium text-red-800">
                                <AlertCircle className="h-4 w-4" />
                                OcorrÃªncia registrada
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
