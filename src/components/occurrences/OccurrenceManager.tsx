import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { AlertTriangle, Camera, MapPin, Calendar, User, FileText, Plus, Eye } from 'lucide-react';

interface Occurrence {
  id: string;
  delivery_id: string;
  type: string;
  description: string;
  photo_url?: string;
  driver_name: string;
  client_name: string;
  created_at: string;
}

interface OccurrenceFormData {
  type: 'reentrega' | 'recusa' | 'avaria';
  description: string;
  photo?: File;
  latitude?: number;
  longitude?: number;
}

export const OccurrenceManager: React.FC = () => {
  const { toast } = useToast();
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null);
  const [formData, setFormData] = useState<OccurrenceFormData>({
    type: 'reentrega',
    description: ''
  });
  const [filters, setFilters] = useState({
    type: '',
    start_date: '',
    end_date: '',
    driver_id: ''
  });

  useEffect(() => {
    loadOccurrences();
  }, [filters]);

  const loadOccurrences = async () => {
    setLoading(true);
    try {
      const response = await apiService.getOccurrences(filters);
      if (response.success) {
        setOccurrences(response.data);
      } else {
        toast({
          title: "Erro ao carregar ocorrências",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar ocorrências",
        description: "Erro ao carregar lista de ocorrências",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOccurrence = async (deliveryId: string) => {
    if (!formData.description.trim()) {
      toast({
        title: "Descrição obrigatória",
        description: "Por favor, informe uma descrição para a ocorrência",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiService.createOccurrence(deliveryId, formData);
      if (response.success) {
        toast({
          title: "Ocorrência criada",
          description: "Ocorrência registrada com sucesso",
        });
        setShowCreateDialog(false);
        setFormData({ type: 'reentrega', description: '' });
        loadOccurrences();
      } else {
        toast({
          title: "Erro ao criar ocorrência",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao criar ocorrência",
        description: "Erro ao registrar ocorrência",
        variant: "destructive",
      });
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'reentrega':
        return <Badge className="bg-yellow-100 text-yellow-800">Reentrega</Badge>;
      case 'recusa':
        return <Badge className="bg-red-100 text-red-800">Recusa</Badge>;
      case 'avaria':
        return <Badge className="bg-orange-100 text-orange-800">Avaria</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reentrega':
        return <Calendar className="h-4 w-4" />;
      case 'recusa':
        return <AlertTriangle className="h-4 w-4" />;
      case 'avaria':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo não suportado",
          description: "Apenas JPG e PNG são aceitos",
          variant: "destructive",
        });
        return;
      }

      // Validar tamanho (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }

      setFormData(prev => ({ ...prev, photo: file }));
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
          toast({
            title: "Localização obtida",
            description: "Coordenadas capturadas com sucesso",
          });
        },
        (error) => {
          toast({
            title: "Erro ao obter localização",
            description: "Não foi possível obter sua localização",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Geolocalização não suportada",
        description: "Seu navegador não suporta geolocalização",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Gestão de Ocorrências</h2>
          <Badge variant="outline">
            {occurrences.length} ocorrência{occurrences.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Ocorrência
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os tipos</SelectItem>
                  <SelectItem value="reentrega">Reentrega</SelectItem>
                  <SelectItem value="recusa">Recusa</SelectItem>
                  <SelectItem value="avaria">Avaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Data Início</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Motorista</Label>
              <Input
                placeholder="ID do motorista"
                value={filters.driver_id}
                onChange={(e) => setFilters(prev => ({ ...prev, driver_id: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Ocorrências */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando ocorrências...</p>
          </div>
        ) : occurrences.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {occurrences.map((occurrence) => (
              <Card key={occurrence.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(occurrence.type)}
                      {getTypeBadge(occurrence.type)}
                    </div>
                    <Button
                      onClick={() => setSelectedOccurrence(occurrence)}
                      variant="ghost"
                      size="sm"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Descrição</p>
                    <p className="text-sm font-medium line-clamp-2">
                      {occurrence.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">{occurrence.driver_name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">{occurrence.client_name}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">{formatDate(occurrence.created_at)}</span>
                  </div>
                  
                  {occurrence.photo_url && (
                    <div className="flex items-center gap-2 text-sm">
                      <Camera className="h-4 w-4 text-gray-500" />
                      <span className="text-blue-600">Foto disponível</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Nenhuma ocorrência encontrada</p>
          </div>
        )}
      </div>

      {/* Dialog de Criar Ocorrência */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Ocorrência</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Tipo de Ocorrência</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'reentrega' | 'recusa' | 'avaria') => 
                  setFormData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reentrega">Reentrega</SelectItem>
                  <SelectItem value="recusa">Recusa</SelectItem>
                  <SelectItem value="avaria">Avaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva a ocorrência..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div>
              <Label>Foto (opcional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={getCurrentLocation}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Capturar Localização
              </Button>
            </div>
            
            {formData.latitude && formData.longitude && (
              <div className="p-2 bg-green-50 rounded-md">
                <p className="text-sm text-green-800">
                  Localização capturada: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                </p>
              </div>
            )}
            
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => setShowCreateDialog(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleCreateOccurrence('delivery-id-placeholder')}
                disabled={!formData.description.trim()}
              >
                Criar Ocorrência
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalhes da Ocorrência */}
      <Dialog open={!!selectedOccurrence} onOpenChange={() => setSelectedOccurrence(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Ocorrência</DialogTitle>
          </DialogHeader>
          
          {selectedOccurrence && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getTypeIcon(selectedOccurrence.type)}
                <div>
                  <h3 className="font-semibold">{selectedOccurrence.type}</h3>
                  {getTypeBadge(selectedOccurrence.type)}
                </div>
              </div>
              
              <div>
                <Label>Descrição</Label>
                <p className="text-sm bg-gray-50 p-3 rounded-md">
                  {selectedOccurrence.description}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Motorista</Label>
                  <p className="text-sm font-medium">{selectedOccurrence.driver_name}</p>
                </div>
                <div>
                  <Label>Cliente</Label>
                  <p className="text-sm font-medium">{selectedOccurrence.client_name}</p>
                </div>
                <div>
                  <Label>Data de Criação</Label>
                  <p className="text-sm">{formatDate(selectedOccurrence.created_at)}</p>
                </div>
                <div>
                  <Label>ID da Entrega</Label>
                  <p className="text-sm font-mono">{selectedOccurrence.delivery_id}</p>
                </div>
              </div>
              
              {selectedOccurrence.photo_url && (
                <div>
                  <Label>Foto da Ocorrência</Label>
                  <div className="mt-2">
                    <img
                      src={selectedOccurrence.photo_url}
                      alt="Foto da ocorrência"
                      className="max-w-full h-auto rounded-md"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}; 