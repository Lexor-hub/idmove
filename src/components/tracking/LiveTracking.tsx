import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { MapPin, Navigation, Clock, User, Truck, Eye, History } from 'lucide-react';

interface DriverLocation {
  driver_id: string;
  driver_name: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  last_update?: string;
  status: string;
  current_delivery_id?: string;
  current_delivery_client?: string;
}

interface TrackingHistory {
  timestamp: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  delivery_id?: string;
}

export const LiveTracking: React.FC = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const [trackingHistory, setTrackingHistory] = useState<TrackingHistory[]>([]);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadCurrentLocations();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(loadCurrentLocations, 30000); // 30 segundos
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const loadCurrentLocations = async () => {
    try {
      const response = await apiService.getCurrentLocations();
      if (response.success) {
        setDrivers(response.data);
      } else {
        console.error('Erro ao carregar localizações:', response.error);
      }
    } catch (error) {
      console.error('Erro ao carregar localizações:', error);
    }
  };

  const loadTrackingHistory = async (driverId: string) => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await apiService.getTrackingHistory(driverId, {
        start_date: startDate,
        end_date: endDate
      });
      
      if (response.success) {
        setTrackingHistory(response.data);
        setShowHistoryDialog(true);
      } else {
        toast({
          title: "Erro ao carregar histórico",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar histórico",
        description: "Erro ao carregar histórico de rastreamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDriverStatus = async (driverId: string, status: 'active' | 'inactive' | 'busy' | 'available') => {
    try {
      const response = await apiService.updateDriverStatus(driverId, status);
      if (response.success) {
        toast({
          title: "Status atualizado",
          description: "Status do motorista atualizado com sucesso",
        });
        loadCurrentLocations(); // Recarregar dados
      } else {
        toast({
          title: "Erro ao atualizar status",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: "Erro ao atualizar status do motorista",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inativo</Badge>;
      case 'busy':
        return <Badge className="bg-yellow-100 text-yellow-800">Ocupado</Badge>;
      case 'available':
        return <Badge className="bg-blue-100 text-blue-800">Disponível</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSpeedColor = (speed: number) => {
    if (speed > 80) return 'text-red-600';
    if (speed > 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diff < 60) return 'Agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Rastreamento em Tempo Real</h2>
          <Badge variant="outline">
            {drivers.length} motorista{drivers.length !== 1 ? 's' : ''} ativo{drivers.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={loadCurrentLocations}
            variant="outline"
            size="sm"
          >
            <Navigation className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            <Clock className="h-4 w-4 mr-2" />
            Auto-refresh
          </Button>
        </div>
      </div>

      {/* Lista de Motoristas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {drivers.map((driver) => (
          <Card key={driver.driver_id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {driver.driver_name}
                </CardTitle>
                {getStatusBadge(driver.status)}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* Localização */}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="font-medium">
                  {driver.latitude ? driver.latitude.toFixed(6) : 'N/A'}, {driver.longitude ? driver.longitude.toFixed(6) : 'N/A'}
                </span>
              </div>

              {/* Velocidade */}
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-gray-500" />
                <span className={`font-medium ${getSpeedColor(driver.speed || 0)}`}>
                  {driver.speed || 0} km/h
                </span>
              </div>

              {/* Precisão */}
              <div className="flex items-center gap-2 text-sm">
                <Navigation className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">
                  Precisão: ±{driver.accuracy || 0}m
                </span>
              </div>

              {/* Última atualização */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">
                  {formatTimeAgo(driver.last_update || '')}
                </span>
              </div>

              {/* Entrega atual */}
              {driver.current_delivery_client && (
                <div className="p-2 bg-blue-50 rounded-md">
                  <p className="text-sm font-medium text-blue-800">
                    Entrega atual: {driver.current_delivery_client}
                  </p>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setSelectedDriver(driver)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Detalhes
                </Button>
                
                <Button
                  onClick={() => loadTrackingHistory(driver.driver_id)}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  <History className="h-4 w-4" />
                </Button>
              </div>

              {/* Controles de Status */}
              <div className="grid grid-cols-2 gap-1">
                <Button
                  onClick={() => updateDriverStatus(driver.driver_id, 'active')}
                  size="sm"
                  variant={driver.status === 'active' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  Ativo
                </Button>
                <Button
                  onClick={() => updateDriverStatus(driver.driver_id, 'busy')}
                  size="sm"
                  variant={driver.status === 'busy' ? 'default' : 'outline'}
                  className="text-xs"
                >
                  Ocupado
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de Detalhes do Motorista */}
      <Dialog open={!!selectedDriver} onOpenChange={() => setSelectedDriver(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Motorista</DialogTitle>
          </DialogHeader>
          
          {selectedDriver && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold">{selectedDriver.driver_name}</h3>
                {getStatusBadge(selectedDriver.status)}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Velocidade:</span>
                  <span className={`font-medium ${getSpeedColor(selectedDriver.speed || 0)}`}>
                    {selectedDriver.speed || 0} km/h
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Direção:</span>
                  <span className="font-medium">{selectedDriver.heading || 0}°</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Precisão:</span>
                  <span className="font-medium">±{selectedDriver.accuracy || 0}m</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Última atualização:</span>
                  <span className="font-medium">{formatTime(selectedDriver.last_update || '')}</span>
                </div>
              </div>

              {selectedDriver.current_delivery_client && (
                <div className="p-3 bg-blue-50 rounded-md">
                  <p className="text-sm font-medium text-blue-800">Entrega Atual</p>
                  <p className="text-sm text-blue-600">{selectedDriver.current_delivery_client}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => loadTrackingHistory(selectedDriver.driver_id)}
                  variant="outline"
                  className="flex-1"
                >
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </Button>
                
                <Button
                  onClick={() => {
                    // Aqui você pode implementar a navegação para o motorista
                    toast({
                      title: "Navegação",
                      description: "Funcionalidade de navegação em desenvolvimento",
                    });
                  }}
                  className="flex-1"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Navegar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Histórico */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Rastreamento</DialogTitle>
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto">
            {trackingHistory.length > 0 ? (
              <div className="space-y-2">
                {trackingHistory.map((point, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium">
                          {point.latitude ? point.latitude.toFixed(6) : 'N/A'}, {point.longitude ? point.longitude.toFixed(6) : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(point.timestamp)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium">{point.speed || 0} km/h</p>
                      <p className="text-xs text-gray-500">±{point.accuracy || 0}m</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Nenhum histórico encontrado</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 