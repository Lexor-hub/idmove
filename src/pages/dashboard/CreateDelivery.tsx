import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, AlertTriangle } from 'lucide-react';
import { apiService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { SimpleDeliveryForm } from '@/components/delivery/SimpleDeliveryForm';

type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

interface Delivery {
  id: string;
  nf_number: string;
  client_name: string;
  driver_name: string;
  client_address: string;
  status: DeliveryStatus;
  created_at: string;
  scheduled_date: string;
  driver_id: string | null;
}

interface Driver {
  id: string;
  name: string;
}

interface OccurrenceDetail {
  id?: string;
  type: string;
  description: string;
  created_at: string;
}

const statusColorMap: Record<DeliveryStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' },
  ASSIGNED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Atribuída' },
  IN_TRANSIT: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Em Rota' },
  DELIVERED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Entregue' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Falha' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelada' },
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
};

export const CreateDelivery = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeliveryUpload, setShowDeliveryUpload] = useState(false);
  const [selectedDeliveryForDetails, setSelectedDeliveryForDetails] = useState<Delivery | null>(null);
  const [selectedDeliveryForOccurrences, setSelectedDeliveryForOccurrences] = useState<Delivery | null>(null);
  const [occurrences, setOccurrences] = useState<OccurrenceDetail[]>([]);
  const { toast } = useToast();

  // Filter states
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | 'ALL'>('ALL');
  const [filterDriver, setFilterDriver] = useState('ALL');

  const PAGE_SIZE = 10;

  useEffect(() => {
    loadInitialData();
  }, [filterDate, filterStatus, filterDriver]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadDeliveries(), loadDrivers()]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveries = async () => {
    const filters: Record<string, string> = {
      scheduled_date: filterDate,
    };

    if (filterStatus !== 'ALL') {
      filters.status = filterStatus;
    }
    if (filterDriver !== 'ALL') {
      filters.driver_id = filterDriver;
    }

    const response = await apiService.getDeliveries(filters);
    if (response.success && response.data) {
      setDeliveries(response.data as any[]);
    } else {
      toast({
        title: 'Erro',
        description: response.error || 'Erro ao carregar entregas',
        variant: 'destructive',
      });
    }
  };

  const loadDrivers = async () => {
    const response = await apiService.getDrivers();
    if (response.success && response.data) {
      setDrivers(response.data as any[]);
    }
  };

  const loadOccurrences = async (deliveryId: string) => {
    const response = await apiService.getOccurrences({ delivery_id: deliveryId });
    if (response.success && response.data) {
      setOccurrences(response.data as any[]);
    } else {
      setOccurrences([]);
    }
  };

  const handleViewOccurrences = async (delivery: Delivery) => {
    setSelectedDeliveryForOccurrences(delivery);
    await loadOccurrences(delivery.id);
  };

  const handleViewDetails = (delivery: Delivery) => {
    setSelectedDeliveryForDetails(delivery);
  };

  const handleNewDelivery = () => {
    setShowDeliveryUpload(true);
  };

  const handleUploadSuccess = async () => {
    setShowDeliveryUpload(false);
    toast({
      title: 'Sucesso',
      description: 'Entrega criada com sucesso',
    });
    await loadDeliveries();
  };

  // Filtered and paginated deliveries
  const filteredDeliveries = deliveries;
  const paginatedDeliveries = filteredDeliveries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const totalPages = Math.ceil(filteredDeliveries.length / PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">📋 Entregas do Dia</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciar entregas programadas para {formatDate(filterDate)}
          </p>
        </div>
        <Button onClick={handleNewDelivery} className="bg-gradient-primary">
          + Nova Entrega
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {/* Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filterStatus} onValueChange={(val) => {
                setFilterStatus(val as DeliveryStatus | 'ALL');
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="ASSIGNED">Atribuída</SelectItem>
                  <SelectItem value="IN_TRANSIT">Em Rota</SelectItem>
                  <SelectItem value="DELIVERED">Entregue</SelectItem>
                  <SelectItem value="FAILED">Falha</SelectItem>
                  <SelectItem value="CANCELLED">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Driver Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Motorista</label>
              <Select value={filterDriver} onValueChange={(val) => {
                setFilterDriver(val);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Entregas ({filteredDeliveries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NF</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Ocorrências</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDeliveries.length > 0 ? (
                  paginatedDeliveries.map((delivery) => {
                    const statusInfo = statusColorMap[delivery.status];
                    const hasOccurrences = occurrences.some(o => o.id === delivery.id);

                    return (
                      <TableRow key={delivery.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{delivery.nf_number}</TableCell>
                        <TableCell className="max-w-xs truncate">{delivery.client_name}</TableCell>
                        <TableCell>{delivery.driver_name || 'Não atribuído'}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {delivery.client_address}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusInfo.bg} ${statusInfo.text}`}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatTime(delivery.created_at)}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleViewOccurrences(delivery)}
                            className="inline-flex items-center"
                          >
                            {hasOccurrences ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Sim
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="flex items-center gap-1 text-green-700 border-green-300">
                                <AlertCircle className="w-3 h-3" />
                                Não
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(delivery)}
                            className="gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma entrega encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({filteredDeliveries.length} entregas)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SimpleDeliveryForm Modal */}
      <SimpleDeliveryForm
        open={showDeliveryUpload}
        onOpenChange={setShowDeliveryUpload}
        allowDriverSelection={true}
        mode="admin"
        onSuccess={handleUploadSuccess}
      />

      {/* Details Modal */}
      {selectedDeliveryForDetails && (
        <Dialog open={!!selectedDeliveryForDetails} onOpenChange={() => setSelectedDeliveryForDetails(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da Entrega - NF {selectedDeliveryForDetails.nf_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                  <p className="mt-1 font-medium">{selectedDeliveryForDetails.client_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Motorista</label>
                  <p className="mt-1 font-medium">{selectedDeliveryForDetails.driver_name || 'Não atribuído'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <p className="mt-1">
                    <Badge className={`${statusColorMap[selectedDeliveryForDetails.status].bg} ${statusColorMap[selectedDeliveryForDetails.status].text}`}>
                      {statusColorMap[selectedDeliveryForDetails.status].label}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data Programada</label>
                  <p className="mt-1 font-medium">{formatDate(selectedDeliveryForDetails.scheduled_date)}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Endereço</label>
                <p className="mt-1 font-medium">{selectedDeliveryForDetails.client_address}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Occurrences Modal */}
      {selectedDeliveryForOccurrences && (
        <Dialog open={!!selectedDeliveryForOccurrences} onOpenChange={() => setSelectedDeliveryForOccurrences(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ocorrências - NF {selectedDeliveryForOccurrences.nf_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {occurrences.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {occurrences.map((occurrence, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{occurrence.type}</TableCell>
                        <TableCell>{occurrence.description}</TableCell>
                        <TableCell>{formatTime(occurrence.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhuma ocorrência registrada para esta entrega
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CreateDelivery;
