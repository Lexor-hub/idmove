import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Search, ChevronLeft, ChevronRight, Loader2, AlertTriangle, FileText, BarChart3, Image as ImageIcon } from 'lucide-react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { csvFilenameWithDate, downloadCsv, formatCsvDateTime } from '@/lib/csv';

// CORREÇÃO: A interface foi ajustada para corresponder à resposta da API `getDeliveries`.
interface DeliveryReportItem {
  id: string;
  nf_number: string;
  client_name: string;
  created_at: string;
  status: string;
  updated_at?: string; // Mantido como opcional, pois a ordenação o utiliza
  driver_name?: string;
  scheduled_date?: string;
  delivery_address?: string | null;
  source_document_url?: string | null;
  has_receipt?: boolean;
  created_by_name?: string | null;
  delivered_at?: string | null;
}

const DeliveriesReportTab = () => {
  const [allDeliveries, setAllDeliveries] = useState<DeliveryReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  useEffect(() => {
    const fetchDeliveries = async () => {
      setLoading(true);
      try {
        const response = await apiService.getDeliveries({});
        if (response.success && Array.isArray(response.data)) {
          // A ordenação agora usa 'updated_at' se existir, ou 'created_at' como fallback.
          const sortedData = (response.data as DeliveryReportItem[]).sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
          setAllDeliveries(sortedData);
        } else {
          toast({
            title: 'Erro ao carregar entregas',
            description: response.error || 'Não foi possível buscar os dados.',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        toast({
          title: 'Erro de Conexão',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchDeliveries();
  }, [toast]);

  const filteredDeliveries = useMemo(() => {
    if (!searchTerm) return allDeliveries;
    return allDeliveries.filter(delivery =>
      (delivery.nf_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (delivery.client_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [allDeliveries, searchTerm]);

  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const paginatedDeliveries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDeliveries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDeliveries, currentPage]);

  const exportToCSV = () => {
    if (filteredDeliveries.length === 0) {
      toast({ title: "Nenhum dado para exportar." });
      return;
    }
    const headers = ['ID Entrega', 'NF', 'Cliente', 'Motorista', 'Criado por', 'Data Criacao', 'Data Atualizacao', 'Data Agendada', 'Entregue em', 'Status', 'Endereco', 'Possui Canhoto', 'URL NF-e'];
    const rows = filteredDeliveries.map((delivery) => [
      delivery.id,
      delivery.nf_number || '',
      delivery.client_name || '',
      delivery.driver_name || '',
      delivery.created_by_name || '',
      formatCsvDateTime(delivery.created_at),
      formatCsvDateTime(delivery.updated_at || delivery.created_at),
      delivery.scheduled_date ? new Date(`${delivery.scheduled_date}T00:00:00`).toLocaleDateString('pt-BR') : '',
      delivery.delivered_at ? formatCsvDateTime(delivery.delivered_at) : '',
      delivery.status || '',
      delivery.delivery_address || '',
      delivery.has_receipt ? 'Sim' : 'Nao',
      delivery.source_document_url || '',
    ]);
    downloadCsv(csvFilenameWithDate('relatorio_entregas'), headers, rows);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED': return <Badge className="bg-green-500 hover:bg-green-600 text-white">Realizada</Badge>;
      case 'IN_TRANSIT': return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Em Trânsito</Badge>;
      case 'PENDING': return <Badge variant="secondary">Pendente</Badge>;
      case 'REFUSED': case 'CANCELED': return <Badge variant="destructive">Problema</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entregas Realizadas</CardTitle>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4">
          <div className="relative w-full sm:w-auto sm:flex-grow sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por NF, Cliente..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={filteredDeliveries.length === 0 || loading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NF</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Entregue em</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : paginatedDeliveries.length > 0 ? (
                paginatedDeliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nf_number || 'N/A'}</TableCell>
                    <TableCell>{d.client_name || 'N/A'}</TableCell>
                    <TableCell>{d.created_by_name || '—'}</TableCell>
                    <TableCell>{new Date(d.updated_at || d.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{d.delivered_at ? new Date(d.delivered_at).toLocaleString('pt-BR') : '—'}</TableCell>
                    <TableCell>{getStatusBadge(d.status)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhum resultado encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages > 0 ? totalPages : 1}
          </span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface OccurrenceItem {
  id: string;
  type: string;
  description: string;
  photo_url?: string | null;
  driver_name?: string;
  client_name?: string;
  nf_number?: string | null;
  created_at: string;
}

const occurrenceTypeLabel = (type: string) => {
  switch ((type || '').toLowerCase()) {
    case 'reentrega': return 'Reentrega';
    case 'recusa': return 'Recusa';
    case 'avaria': return 'Avaria';
    default: return type || 'Outro';
  }
};

const occurrenceTypeBadge = (type: string) => {
  const lower = (type || '').toLowerCase();
  if (lower === 'avaria') return <Badge variant="destructive">{occurrenceTypeLabel(type)}</Badge>;
  if (lower === 'recusa') return <Badge className="bg-red-500 hover:bg-red-600 text-white">{occurrenceTypeLabel(type)}</Badge>;
  if (lower === 'reentrega') return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">{occurrenceTypeLabel(type)}</Badge>;
  return <Badge variant="secondary">{occurrenceTypeLabel(type)}</Badge>;
};

const OccurrencesReportTab = () => {
  const [items, setItems] = useState<OccurrenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiService.getOccurrences();
        if (response.success && Array.isArray(response.data)) {
          setItems(response.data as OccurrenceItem[]);
        } else {
          toast({
            title: 'Erro ao carregar ocorrências',
            description: response.error || 'Não foi possível buscar os dados.',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        toast({ title: 'Erro de Conexão', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (typeFilter !== 'ALL' && (item.type || '').toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        (item.nf_number || '').toLowerCase().includes(q) ||
        (item.client_name || '').toLowerCase().includes(q) ||
        (item.driver_name || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm, typeFilter]);

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nenhum dado para exportar.' });
      return;
    }
    const headers = ['NF', 'Cliente', 'Motorista', 'Tipo', 'Descrição', 'Data'];
    const rows = [headers.join(',')];
    filtered.forEach(item => {
      rows.push([
        `"${item.nf_number || ''}"`,
        `"${(item.client_name || '').replace(/"/g, '""')}"`,
        `"${(item.driver_name || '').replace(/"/g, '""')}"`,
        `"${occurrenceTypeLabel(item.type)}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`,
        `"${new Date(item.created_at).toLocaleString('pt-BR')}"`,
      ].join(','));
    });
    const blob = new Blob([`﻿${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_ocorrencias_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Ocorrências
        </CardTitle>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mt-4">
          <div className="flex flex-col sm:flex-row gap-2 flex-grow">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por NF, cliente, motorista, descrição..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os tipos</SelectItem>
                <SelectItem value="reentrega">Reentrega</SelectItem>
                <SelectItem value="recusa">Recusa</SelectItem>
                <SelectItem value="avaria">Avaria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={filtered.length === 0 || loading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NF</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Foto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nf_number || 'N/A'}</TableCell>
                    <TableCell>{item.client_name || 'N/A'}</TableCell>
                    <TableCell>{item.driver_name || 'N/A'}</TableCell>
                    <TableCell>{occurrenceTypeBadge(item.type)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={item.description}>{item.description || '-'}</TableCell>
                    <TableCell>{new Date(item.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      {item.photo_url ? (
                        <Button size="sm" variant="outline" onClick={() => setPhotoUrl(item.photo_url || null)}>
                          <ImageIcon className="h-4 w-4 mr-1" /> Ver
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem foto</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhuma ocorrência encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!photoUrl} onOpenChange={(open) => !open && setPhotoUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Foto da ocorrência</DialogTitle>
          </DialogHeader>
          {photoUrl && (
            <img src={photoUrl} alt="Ocorrência" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

interface ReceiptItem {
  id: string;
  delivery_id?: string | null;
  nf_number?: string | null;
  client_name?: string | null;
  driver_name?: string | null;
  filename?: string | null;
  status?: string | null;
  validated?: boolean;
  receipt_image_url?: string | null;
  delivered_at?: string | null;
  scheduled_date?: string | null;
  created_at: string;
}

const ReceiptsReportTab = () => {
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiService.getCanhotos();
        if (response.success && Array.isArray(response.data)) {
          setItems(response.data as ReceiptItem[]);
        } else {
          toast({
            title: 'Erro ao carregar comprovantes',
            description: response.error || 'Não foi possível buscar os canhotos.',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        toast({ title: 'Erro de Conexão', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const filtered = useMemo(() => {
    if (!searchTerm) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(item =>
      (item.nf_number || '').toLowerCase().includes(q) ||
      (item.client_name || '').toLowerCase().includes(q) ||
      (item.driver_name || '').toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  const formatDate = (value?: string | null) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nenhum dado para exportar.' });
      return;
    }
    const headers = ['ID Canhoto', 'ID Entrega', 'NF', 'Cliente', 'Motorista', 'Arquivo', 'Status', 'Validado', 'Data Entrega', 'Captura Canhoto', 'URL Canhoto'];
    const rows = filtered.map((item) => [
      item.id,
      item.delivery_id || '',
      item.nf_number || '',
      item.client_name || '',
      item.driver_name || '',
      item.filename || '',
      item.status || '',
      item.validated ? 'Sim' : 'Nao',
      formatDate(item.delivered_at || item.scheduled_date),
      formatDate(item.created_at),
      item.receipt_image_url || '',
    ]);
    downloadCsv(csvFilenameWithDate('relatorio_canhotos'), headers, rows);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Comprovantes (Canhotos)
        </CardTitle>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por NF, cliente, motorista..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={filtered.length === 0 || loading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NF</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Data Entrega</TableHead>
                <TableHead className="text-right">Canhoto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nf_number || 'N/A'}</TableCell>
                    <TableCell>{item.client_name || 'N/A'}</TableCell>
                    <TableCell>{item.driver_name || 'N/A'}</TableCell>
                    <TableCell>{formatDate(item.delivered_at || item.scheduled_date || item.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {item.receipt_image_url ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setPreviewUrl(item.receipt_image_url || null)}>
                            <ImageIcon className="h-4 w-4 mr-1" /> Ver
                          </Button>
                          <a href={item.receipt_image_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="default">Abrir</Button>
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem canhoto</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">Nenhum canhoto encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Canhoto</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Canhoto" className="w-full h-auto rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

interface NfeItem {
  id: string;
  nf_number?: string | null;
  client_name?: string | null;
  driver_name?: string | null;
  status?: string | null;
  created_at: string;
  scheduled_date?: string | null;
  delivery_address?: string | null;
  source_document_url?: string | null;
  has_receipt?: boolean;
}

const NfeReportTab = () => {
  const [items, setItems] = useState<NfeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiService.getDeliveries({});
        if (response.success && Array.isArray(response.data)) {
          setItems((response.data as NfeItem[]).filter((item) => Boolean(item.source_document_url)));
        } else {
          toast({
            title: 'Erro ao carregar NF-es',
            description: response.error || 'Nao foi possivel buscar os documentos.',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        toast({ title: 'Erro de Conexao', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const filtered = useMemo(() => {
    if (!searchTerm) return items;
    const query = searchTerm.toLowerCase();
    return items.filter((item) =>
      (item.nf_number || '').toLowerCase().includes(query) ||
      (item.client_name || '').toLowerCase().includes(query) ||
      (item.driver_name || '').toLowerCase().includes(query) ||
      (item.delivery_address || '').toLowerCase().includes(query)
    );
  }, [items, searchTerm]);

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nenhum dado para exportar.' });
      return;
    }
    const headers = ['ID Entrega', 'NF', 'Cliente', 'Motorista', 'Status', 'Data Criacao', 'Data Agendada', 'Endereco', 'Possui Canhoto', 'URL NF-e'];
    const rows = filtered.map((item) => [
      item.id,
      item.nf_number || '',
      item.client_name || '',
      item.driver_name || '',
      item.status || '',
      formatCsvDateTime(item.created_at),
      item.scheduled_date ? new Date(`${item.scheduled_date}T00:00:00`).toLocaleDateString('pt-BR') : '',
      item.delivery_address || '',
      item.has_receipt ? 'Sim' : 'Nao',
      item.source_document_url || '',
    ]);
    downloadCsv(csvFilenameWithDate('relatorio_nfes'), headers, rows);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          NF-es
        </CardTitle>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por NF, cliente, motorista ou endereco..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={filtered.length === 0 || loading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NF</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Documento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nf_number || 'N/A'}</TableCell>
                    <TableCell>{item.client_name || 'N/A'}</TableCell>
                    <TableCell>{item.driver_name || 'N/A'}</TableCell>
                    <TableCell>{item.status || 'N/A'}</TableCell>
                    <TableCell>{new Date(item.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      {item.source_document_url ? (
                        <a href={item.source_document_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">Abrir NF-e</Button>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem documento</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Nenhuma NF-e encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

interface PerformanceItem {
  driver_id: string;
  driver_name: string;
  total_deliveries: number;
  completed_deliveries: number;
  pending_deliveries: number;
  in_progress_deliveries: number;
  failed_deliveries: number;
}

const PerformanceReportTab = () => {
  const [items, setItems] = useState<PerformanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiService.getDriverPerformanceReports();
        if (response.success && Array.isArray(response.data)) {
          setItems(response.data as PerformanceItem[]);
        } else {
          toast({
            title: 'Erro ao carregar desempenho',
            description: response.error || 'Não foi possível buscar os dados.',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        toast({ title: 'Erro de Conexão', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  const totals = useMemo(() => items.reduce(
    (acc, item) => ({
      total: acc.total + (item.total_deliveries || 0),
      completed: acc.completed + (item.completed_deliveries || 0),
      pending: acc.pending + (item.pending_deliveries || 0),
      in_progress: acc.in_progress + (item.in_progress_deliveries || 0),
      failed: acc.failed + (item.failed_deliveries || 0),
    }),
    { total: 0, completed: 0, pending: 0, in_progress: 0, failed: 0 }
  ), [items]);

  const successRate = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Desempenho de Entregas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{totals.total}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Realizadas</p>
            <p className="text-2xl font-bold text-green-500">{totals.completed}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Em trânsito</p>
            <p className="text-2xl font-bold text-yellow-500">{totals.in_progress}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold">{totals.pending}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
            <p className="text-2xl font-bold">{successRate}%</p>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Realizadas</TableHead>
                <TableHead className="text-right">Em trânsito</TableHead>
                <TableHead className="text-right">Pendentes</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : items.length > 0 ? (
                items.map((item) => {
                  const rate = item.total_deliveries > 0
                    ? Math.round((item.completed_deliveries / item.total_deliveries) * 100)
                    : 0;
                  return (
                    <TableRow key={item.driver_id}>
                      <TableCell className="font-medium">{item.driver_name}</TableCell>
                      <TableCell className="text-right">{item.total_deliveries}</TableCell>
                      <TableCell className="text-right text-green-600">{item.completed_deliveries}</TableCell>
                      <TableCell className="text-right text-yellow-600">{item.in_progress_deliveries}</TableCell>
                      <TableCell className="text-right">{item.pending_deliveries}</TableCell>
                      <TableCell className="text-right text-red-600">{item.failed_deliveries}</TableCell>
                      <TableCell className="text-right">{rate}%</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhum motorista encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

const DRIVER_ISSUE_LABELS: Record<string, string> = {
  DRIVER_SEM_PROFILE_ID: 'Motorista sem perfil vinculado',
  PROFILE_NAO_ENCONTRADO: 'Perfil não encontrado',
  PROFILE_SEM_AUTH_USER: 'Perfil sem login (auth) vinculado',
  AUTH_USER_NAO_ENCONTRADO: 'Login (auth) não encontrado',
  PROFILE_ROLE_NAO_DRIVER: 'Perfil não está como MOTORISTA',
  PROFILE_SEM_EMPRESA: 'Perfil sem empresa',
  EMPRESA_DIVERGENTE_DRIVER_PROFILE: 'Empresa do motorista difere da do perfil',
  EMPRESA_DIVERGENTE_DRIVER_DELIVERY: 'Empresa do motorista difere da da entrega',
};

interface DriverIntegrityItem {
  driver_id: string;
  driver_name: string;
  issue: string;
}

const DriverHealthTab = () => {
  const [items, setItems] = useState<DriverIntegrityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const response = await apiService.getDriverIntegrity();
      if (response.success && Array.isArray(response.data)) {
        setItems(response.data as DriverIntegrityItem[]);
      } else {
        toast({ title: 'Erro ao verificar motoristas', description: response.error || 'Falha na verificação.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Erro de Conexão', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Saúde dos Motoristas
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Motoristas com vínculo quebrado podem falhar ao iniciar rota ou cadastrar. Verifique antes de mandar para a rua.
        </p>
        <div className="flex justify-end mt-2">
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar de novo'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-24 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">
            ✅ Todos os motoristas estão com vínculo íntegro. Nenhum risco detectado para iniciar rota.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Problema detectado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.driver_id}-${item.issue}`}>
                    <TableCell className="font-medium">{item.driver_name || 'Sem nome'}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{DRIVER_ISSUE_LABELS[item.issue] || item.issue}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Reports = () => {
  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
      <Tabs defaultValue="deliveries" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <TabsTrigger value="deliveries">Entregas</TabsTrigger>
          <TabsTrigger value="nfes">NF-es</TabsTrigger>
          <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
          <TabsTrigger value="receipts">Comprovantes</TabsTrigger>
          <TabsTrigger value="performance">Desempenho</TabsTrigger>
          <TabsTrigger value="driver-health">Motoristas</TabsTrigger>
        </TabsList>
        <TabsContent value="deliveries" className="mt-4"><DeliveriesReportTab /></TabsContent>
        <TabsContent value="nfes" className="mt-4"><NfeReportTab /></TabsContent>
        <TabsContent value="occurrences" className="mt-4"><OccurrencesReportTab /></TabsContent>
        <TabsContent value="receipts" className="mt-4"><ReceiptsReportTab /></TabsContent>
        <TabsContent value="performance" className="mt-4"><PerformanceReportTab /></TabsContent>
        <TabsContent value="driver-health" className="mt-4"><DriverHealthTab /></TabsContent>
      </Tabs>
    </main>
  );
};

export default Reports;
