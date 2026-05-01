import { useState, useEffect } from 'react';
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
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full gap-1"
                                onClick={() => handleViewReceipt(delivery.receipt_image_url!)}
                              >
                                <ImageIcon className="h-4 w-4" />
                                Ver Canhoto Assinado
                              </Button>
                            </div>
                          )}
                          {delivery.statusPtBR === 'Entregue' && !delivery.receipt_image_url && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span>Entrega concluída</span>
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
            {/* Status Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Status das Entregas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span className="text-sm">Entregues</span>
                    </div>
                    <span className="text-sm font-medium">{stats.entregasRealizadas}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span className="text-sm">Em Trânsito</span>
                    </div>
                    <span className="text-sm font-medium">{stats.emTransito}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                      <span className="text-sm">Pendentes</span>
                    </div>
                    <span className="text-sm font-medium">{stats.pendentes}</span>
                  </div>
                </div>

                {stats.totalEntregas > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="flex h-full">
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${(stats.entregasRealizadas / stats.totalEntregas) * 100}%` }}
                        />
                        <div
                          className="bg-blue-500 h-full transition-all"
                          style={{ width: `${(stats.emTransito / stats.totalEntregas) * 100}%` }}
                        />
                        <div
                          className="bg-yellow-500 h-full transition-all"
                          style={{ width: `${(stats.pendentes / stats.totalEntregas) * 100}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {((stats.entregasRealizadas / stats.totalEntregas) * 100).toFixed(0)}% concluído
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Legenda de Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800 text-xs">Pendente</Badge>
                  <span className="text-muted-foreground">Entrega ainda não saiu</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-100 text-indigo-800 text-xs">Atribuída</Badge>
                  <span className="text-muted-foreground">Motorista designado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800 text-xs">Em Trânsito</Badge>
                  <span className="text-muted-foreground">Mercadoria a caminho</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 text-xs">Entregue</Badge>
                  <span className="text-muted-foreground">Entrega concluída</span>
                </div>
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
