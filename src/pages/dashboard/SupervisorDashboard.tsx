import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DriverForm } from '@/components/forms/DriverForm';
import { 
  Truck, 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  MapPin,
  Search,
  FileText,
  Users,
  Activity,
  ClipboardList,
  RefreshCw
} from 'lucide-react';
import { apiService } from '@/services/api';
import { computeMovementStatus, getMovementStatusTw, MOVEMENT_STATUS_LABEL, MovementStatus } from '@/lib/driver-status';
import { useToast } from '@/hooks/use-toast';

type DriverStatusItem = {
  id: string;
  name: string;
  speed: number;
  lastUpdate?: string | null;
  status: MovementStatus;
};

type TodayDelivery = {
  id: string;
  nfNumber: string;
  clientName: string;
  driverName: string;
  address: string;
  statusLabel: string;
  createdAt: string;
  // optional receipt-related fields
  receipt_id?: string | null;
  receipt_image_url?: string | null;
  filename?: string | null;
};

const formatDeliveryStatus = (status?: string, hasReceipt?: boolean) => {
  const normalized = (status || '').toUpperCase();
  if (hasReceipt || normalized === 'DELIVERED' || normalized === 'ENTREGUE') {
    return 'Realizada';
  }
  switch (normalized) {
    case 'IN_TRANSIT':
    case 'EM_ANDAMENTO':
      return 'Em andamento';
    case 'PENDING':
    case 'PENDENTE':
      return 'Pendente';
    case 'REATTEMPTED':
      return 'Reentrega';
    case 'PROBLEM':
      return 'Problema';
    case 'REFUSED':
      return 'Recusada';
    case 'CANCELLED':
    case 'CANCELED':
      return 'Cancelada';
    default:
      return status || 'Indefinido';
  }
};

const formatDateTime = (isoDate?: string) => {
  if (!isoDate) {
    return 'N/A';
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeTime = (timestamp?: string | null) => {
  if (!timestamp) {
    return "Sem atualizacao";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Sem atualizacao";
  }

  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60000) {
    return "Agora mesmo";
  }

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `Ha ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Ha ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Ha ${diffDays} d`;
};

export const SupervisorDashboard = () => {
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasRealizadas: 0,
    entregasPendentes: 0,
    motoristasAtivos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [driverStatuses, setDriverStatuses] = useState<DriverStatusItem[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false);
  const [todayDeliveries, setTodayDeliveries] = useState<TodayDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [showReceiptsModal, setShowReceiptsModal] = useState(false);
  const [finishedDeliveries, setFinishedDeliveries] = useState<TodayDelivery[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  // filters and pagination for receipts modal
  const [companies, setCompanies] = useState<Array<any>>([]);
  const [drivers, setDrivers] = useState<Array<any>>([]);
  const [filterCompany, setFilterCompany] = useState<string | undefined>(undefined);
  const [filterDriver, setFilterDriver] = useState<string | undefined>(undefined);
  const [companyQuery, setCompanyQuery] = useState<string>('');
  const [driverQuery, setDriverQuery] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 10;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadDriverStatuses = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setDriversLoading(true);
      }

      try {
        const response = await apiService.getCurrentLocations();

        if (response.success && Array.isArray(response.data)) {
          const now = Date.now();
          const normalized: DriverStatusItem[] = (response.data as Array<Record<string, unknown>>)
            .map((raw) => {
              const driver = (raw ?? {}) as Record<string, unknown>;
              const id = (driver['driver_id'] ?? driver['id']) as string | number | undefined;

              if (id === undefined || id === null) {
                return null;
              }

              const speedValueRaw = driver['speed'];
              const speedValue = Number(speedValueRaw ?? 0);
              const safeSpeed = Number.isFinite(speedValue) ? speedValue : 0;
              const lastUpdateValue = driver['last_update'];

              return {
                id: String(id),
                name: String(driver['driver_name'] ?? 'Motorista'),
                speed: safeSpeed,
                lastUpdate: typeof lastUpdateValue === 'string' ? lastUpdateValue : null,
                status: computeMovementStatus(
                  {
                    speed: typeof speedValueRaw === 'number' ? speedValueRaw : safeSpeed,
                    last_update: typeof lastUpdateValue === 'string' ? lastUpdateValue : null,
                  },
                  now
                ),
              } as DriverStatusItem | null;
            })
            .filter((item): item is DriverStatusItem => Boolean(item))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

          setDriverStatuses(normalized);
        }
      } catch (error) {
        if (!silent) {
          toast({
            title: 'Falha ao carregar motoristas',
            description: 'Nao foi possivel atualizar o status dos motoristas.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!silent) {
          setDriversLoading(false);
        }
      }
    },
    [toast]
  );

  const loadTodayDeliveries = useCallback(async () => {
    try {
      setDeliveriesLoading(true);
      const response = await apiService.getDeliveries();

      if (response.success && Array.isArray(response.data)) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const normalizeString = (value: unknown, fallback: string) => {
          if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length ? trimmed : fallback;
          }
          return fallback;
        };
        const toTimestamp = (value: string) => {
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        };

        const deliveriesData = (response.data as Array<Record<string, unknown>>).map((item) => {
          const createdAt = typeof item['created_at'] === 'string' ? item['created_at'] : '';
          const hasReceipt = Boolean(item['has_receipt']);
          const status = typeof item['status'] === 'string' ? item['status'] : '';
          const nfNumber = normalizeString(item['nf_number'], 'N/A');
          const clientNamePrimary = normalizeString(item['client_name'], '');
          const clientName = clientNamePrimary || normalizeString(item['client_name_extracted'], 'Cliente não identificado');
          const addressPrimary = normalizeString(item['delivery_address'], '');
          const address = addressPrimary || normalizeString(item['client_address'], 'Endereço não informado');
          const driverName = normalizeString(item['driver_name'], 'Sem motorista');

          return {
            id: String(item['id'] ?? ''),
            nfNumber,
            clientName,
            driverName,
            address,
            statusLabel: formatDeliveryStatus(status, hasReceipt),
            createdAt,
          } as TodayDelivery;
        });

        const filtered = deliveriesData.filter(
          (delivery) => typeof delivery.createdAt === 'string' && delivery.createdAt.slice(0, 10) === todayIso
        );
        const sorted = filtered.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

        setTodayDeliveries(sorted);
      } else {
        setTodayDeliveries([]);
  if (!response.success && (response as any).error) {
          toast({
            title: 'Erro ao carregar entregas',
            description: (response as any).error,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      setTodayDeliveries([]);
      toast({
        title: 'Erro ao carregar entregas',
        description: 'Não foi possível carregar as entregas do dia.',
        variant: 'destructive',
      });
    } finally {
      setDeliveriesLoading(false);
    }
  }, [toast]);

  const handleDeliveriesModalChange = useCallback((open: boolean) => {
    setShowDeliveriesModal(open);
    // Only fetch the deliveries list if we don't already have it from KPIs
    if (open && todayDeliveries.length === 0) {
      void loadTodayDeliveries();
    }
  }, [loadTodayDeliveries, todayDeliveries]);

  const loadFinishedDeliveries = useCallback(async (overrideFilters?: Record<string, string>) => {
    // default wrapper to call with current filters and page
    try {
      setReceiptsLoading(true);
      // Busca entregas finalizadas / canhotos via reports service
      const filters: Record<string, string> = {};
      if (overrideFilters) {
        Object.assign(filters, overrideFilters);
      } else {
        if (filterCompany) filters.company_id = filterCompany;
        if (filterDriver) filters.driver_id = filterDriver;
        if (filterStartDate) filters.start_date = filterStartDate;
        if (filterEndDate) filters.end_date = filterEndDate;
      }

      const response = await apiService.getCanhotos(Object.keys(filters).length ? filters : undefined);

      if (response.success && Array.isArray(response.data)) {
        const normalizeString = (value: unknown, fallback: string) => {
          if (typeof value === 'string') return value.trim() || fallback;
          return fallback;
        };

        const deliveriesData = (response.data as Array<Record<string, unknown>>).map((item) => {
          // Accept multiple possible API shapes: some endpoints return `id`, others `delivery_id`.
          const rawId = item['id'] ?? item['delivery_id'] ?? item['deliveryId'];
          const hasReceipt = Boolean(item['receipt_id'] ?? item['receiptId'] ?? item['dr_id'] ?? item['dr']);

          // NF can be provided under different keys depending on backend version
          const nfRaw = item['nf_number'] ?? item['nfNumber'] ?? item['nf'] ?? null;

          // driver name may come from different properties (driver_name, driverName, driver)
          const driverRaw = item['driver_name'] ?? item['driverName'] ?? item['driver'] ?? item['driver_full_name'] ?? null;

          // image URL may be under different keys and we prefer image_url > gcs_path > file_path
          const imageUrl = item['image_url'] ?? item['imageUrl'] ?? item['gcs_path'] ?? item['gcsPath'] ?? item['file_path'] ?? item['filePath'] ?? null;
          const filenameRaw = item['filename'] ?? item['file_name'] ?? item['fileName'] ?? null;

          return {
            id: String(rawId ?? ''),
            nfNumber: normalizeString(nfRaw, 'N/A'),
            clientName: normalizeString(item['client_name'] ?? item['client_name_extracted'], 'Cliente não identificado'),
            driverName: normalizeString(driverRaw, 'Sem motorista'),
            address: normalizeString(item['delivery_address'] ?? item['client_address'], 'Endereço não informado'),
            statusLabel: formatDeliveryStatus(item['status'] as string, hasReceipt),
            createdAt: typeof item['date'] === 'string' ? item['date'] : (typeof item['created_at'] === 'string' ? item['created_at'] : ''),
            receipt_id: (item['receipt_id'] ?? item['receiptId']) ? String(item['receipt_id'] ?? item['receiptId']) : null,
            receipt_image_url: imageUrl ? String(imageUrl) : null,
            filename: filenameRaw ? String(filenameRaw) : null,
            // include optional ids so we can prioritize filtered items on the client
            driver_id: (item['driver_id'] ?? item['driverId'] ?? item['driver']) ? String(item['driver_id'] ?? item['driverId'] ?? item['driver']) : null,
            company_id: (item['company_id'] ?? item['companyId'] ?? item['company']) ? String(item['company_id'] ?? item['companyId'] ?? item['company']) : null,
          } as TodayDelivery & { receipt_id: string | null; receipt_image_url: string | null; filename: string | null; driver_id?: string | null; company_id?: string | null };
        });

        // If filters were provided, move matching items to the top of the list
        let resultList = deliveriesData;
        const filterDriverId = filters.driver_id;
        const filterCompanyId = filters.company_id;
        if (filterDriverId || filterCompanyId) {
          const matched: typeof deliveriesData = [];
          const others: typeof deliveriesData = [];
          for (const d of deliveriesData) {
            const driverMatch = filterDriverId ? (d as any).driver_id === filterDriverId : true;
            const companyMatch = filterCompanyId ? (d as any).company_id === filterCompanyId : true;
            if (driverMatch && companyMatch) matched.push(d);
            else others.push(d);
          }
          resultList = [...matched, ...others];
        }

        setFinishedDeliveries(resultList);
        setCurrentPage(1);
      } else {
        setFinishedDeliveries([]);
        toast({
          title: 'Erro ao carregar canhotos',
          description: (response as any).error || 'Não foi possível buscar as entregas finalizadas.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setFinishedDeliveries([]);
      toast({
        title: 'Erro de Rede',
        description: 'Não foi possível conectar ao servidor para buscar os canhotos.',
        variant: 'destructive',
      });
    } finally {
      setReceiptsLoading(false);
    }
  }, [filterCompany, filterDriver, filterStartDate, filterEndDate, toast]);

  // load companies and drivers for filters
  const loadCompaniesAndDrivers = useCallback(async () => {
    try {
      const companiesResp = await apiService.getCompanies();
      if (companiesResp.success && Array.isArray(companiesResp.data)) {
        setCompanies(companiesResp.data as Array<any>);
      }
      const driversResp = await apiService.getDrivers({ status: 'active' });
      if (driversResp.success && Array.isArray(driversResp.data)) {
        setDrivers((driversResp.data as Array<any>).map(d => ({
          id: String(d.id ?? d.driver_id ?? d.user_id ?? ''),
          name: String(d.name ?? d.full_name ?? d.driver_name ?? 'Motorista'),
          username: String(d.username ?? d.user_name ?? d.login ?? d.email ?? ''),
        })));
      }
    } catch (err) {}
  }, []);

  const handleReceiptsModalChange = useCallback((open: boolean) => {
    setShowReceiptsModal(open);
    if (open) {
      void loadCompaniesAndDrivers();
      void loadFinishedDeliveries();
    }
  }, [loadFinishedDeliveries]);

  const applyFilters = () => {
    // Map companyQuery/driverQuery (name search) to IDs if possible, then apply
    if (companyQuery && companies.length) {
      const found = companies.find(c => String(c.name ?? '').toLowerCase().includes(companyQuery.toLowerCase()));
      if (found) setFilterCompany(String(found.id));
      else setFilterCompany(undefined);
    } else {
      setFilterCompany(undefined);
    }

    if (driverQuery && drivers.length) {
      const q = driverQuery.toLowerCase();
      // Prefer username match
      let foundD = drivers.find(d => String(d.username ?? '').toLowerCase().includes(q));
      if (!foundD) {
        // Fallback to display name
        foundD = drivers.find(d => String(d.name ?? '').toLowerCase().includes(q));
      }
      if (foundD) setFilterDriver(String(foundD.id));
      else setFilterDriver(undefined);
    } else {
      setFilterDriver(undefined);
    }

    setCurrentPage(1);
    const computedFilters: Record<string, string> = {};
    if (companyQuery && companies.length) {
      const found = companies.find(c => String(c.name ?? '').toLowerCase().includes(companyQuery.toLowerCase()));
      if (found) computedFilters.company_id = String(found.id);
    }
    if (driverQuery && drivers.length) {
      const q = driverQuery.toLowerCase();
      let foundD = drivers.find(d => String(d.username ?? '').toLowerCase().includes(q));
      if (!foundD) foundD = drivers.find(d => String(d.name ?? '').toLowerCase().includes(q));
      if (foundD) computedFilters.driver_id = String(foundD.id);
    }

    // include date range if present
    if (filterStartDate) computedFilters.start_date = filterStartDate;
    if (filterEndDate) computedFilters.end_date = filterEndDate;

    void loadFinishedDeliveries(Object.keys(computedFilters).length ? computedFilters : undefined);
  };

  const clearFilters = () => {
    setFilterCompany(undefined);
    setFilterDriver(undefined);
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setCompanyQuery('');
    setDriverQuery('');
    setCurrentPage(1);
    void loadFinishedDeliveries({});
  };

  const downloadCsv = () => {
    const rows = finishedDeliveries.map(d => ({
      delivery_id: d.id,
      nf_number: d.nfNumber,
      client_name: d.clientName,
      driver_name: d.driverName,
      date: d.createdAt,
      image_url: (d as any).receipt_image_url ?? '',
    }));
    const header = Object.keys(rows[0] ?? {}).join(',') + '\n';
    const body = rows.map(r => Object.values(r).map(v => '"' + String(v ?? '') .replace(/"/g, '""') + '"').join(',')).join('\n');
    const csv = header + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canhotos_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    loadDriverStatuses();

    const intervalId = setInterval(() => {
      loadDriverStatuses({ silent: true });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [loadDriverStatuses]);

  const loadDashboardData = async () => {
    try {
      // CORREÇÃO: Usa o endpoint correto para buscar os KPIs.
      const response = await apiService.getDashboardKPIs(); 
      if (response.success && response.data) {
        const kpis: any = response.data;
        // The backend returns a nested `today_deliveries` object with { total, completed, pending, in_progress }
        // Keep fallbacks for older flat keys (total_deliveries, cng_deliveries)
        const totalEntregas = Number(
          kpis?.today_deliveries?.total ?? kpis?.total_deliveries ?? kpis?.totalEntregas ?? 0
        );
        const entregasRealizadas = Number(
          kpis?.today_deliveries?.completed ?? kpis?.completed_deliveries ?? kpis?.entregasRealizadas ?? 0
        );
        const entregasPendentes = Number(
          kpis?.today_deliveries?.in_progress ??
          kpis?.today_deliveries?.pending ??
          kpis?.pending_deliveries ??
          kpis?.entregasPendentes ?? 0
        );
        const motoristasAtivos = Number(kpis?.active_drivers ?? kpis?.motoristasAtivos ?? 0);

        const newStats = {
          totalEntregas,
          entregasRealizadas,
          entregasPendentes,
          motoristasAtivos,
        };
        setStats(newStats);

        // If backend returned a list of today's deliveries, normalize and store it
        const deliveriesList = kpis?.today_deliveries?.list;
        if (Array.isArray(deliveriesList)) {
          const mapped: TodayDelivery[] = deliveriesList.map((item: any) => {
            const createdAt = typeof item.created_at === 'string' ? item.created_at : (item.delivery_date_expected || '');
            const hasReceipt = Boolean(item.receipt_id || item.dr_id || item.receiptId || item.dr);
            return {
              id: String(item.id ?? ''),
              nfNumber: String(item.nf_number ?? item.nfNumber ?? 'N/A'),
              clientName: String(item.client_name ?? item.client_name_extracted ?? 'Cliente não identificado'),
              driverName: String(item.driver_name ?? 'Sem motorista'),
              address: String(item.delivery_address ?? item.client_address ?? 'Endereço não informado'),
              statusLabel: formatDeliveryStatus(item.status, hasReceipt),
              createdAt,
            } as TodayDelivery;
          }).sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });

          setTodayDeliveries(mapped);
        }
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do dashboard",
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Operacional</h1>
            <p className="text-muted-foreground mt-1">
              Monitoramento e controle das operações - {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
          <Button className="bg-gradient-primary" onClick={() => handleDeliveriesModalChange(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Entregas do dia
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-full overflow-x-auto">
          <StatsCard
            title="Total de Entregas"
            value={stats.totalEntregas}
            icon={Package}
            description="Entregas do dia"
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
            icon={Truck}
            description="Rotas ativas"
            variant="warning"
          />
          <StatsCard
            title="Motoristas Ativos"
            value={stats.motoristasAtivos}
            icon={Users}
            description="Em operação"
            variant="default"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Ações de Supervisão
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button 
                variant="outline" 
                className="justify-start h-12"
                onClick={() => navigate('/dashboard/rastreamento')}
              >
                <MapPin className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Rastreamento de Motoristas</div>
                  <div className="text-xs text-muted-foreground">Monitorar localização em tempo real</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-12"
                onClick={() => handleReceiptsModalChange(true)}
              >
                <Search className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Buscar Canhotos</div>
                  <div className="text-xs text-muted-foreground">Consultar comprovantes de entrega</div>
                </div>
              </Button>
              <Button variant="outline" className="justify-start h-12">
                <FileText className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Relatórios Básicos</div>
                  <div className="text-xs text-muted-foreground">Gerar relatórios operacionais</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="justify-start h-12"
                onClick={() => setShowDriverForm(true)}
              >
                <Users className="mr-3 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Cadastrar Motorista</div>
                  <div className="text-xs text-muted-foreground">Adicionar novo motorista</div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Driver Status */}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Status dos Motoristas
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDriverStatuses()}
                disabled={driversLoading}
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${driversLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {driversLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                </div>
              ) : driverStatuses.length ? (
                <div className="space-y-3">
                  {driverStatuses.map((driver) => {
                    const statusStyles = getMovementStatusTw(driver.status);
                    const safeSpeed = driver.speed < 0 ? 0 : driver.speed;
                    const formattedSpeed = safeSpeed.toFixed(1);
                    return (
                      <div
                        key={driver.id}
                        className={`flex items-center justify-between rounded-lg p-3 ${statusStyles.container}`}
                      >
                        <div>
                          <p className={`text-sm font-semibold ${statusStyles.text}`}>{driver.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(driver.lastUpdate)} - {formattedSpeed} km/h
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${statusStyles.badge}`}
                        >
                          {MOVEMENT_STATUS_LABEL[driver.status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum motorista com rastreamento ativo no momento.
                </p>
              )}
            </CardContent>
          </Card>
        {/* Alerts and Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas e Notificações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-medium">Atraso na Rota 004</p>
                  <p className="text-sm text-muted-foreground">Pedro Costa está 30 min atrasado na programação</p>
                </div>
                <span className="text-xs text-muted-foreground">há 15 min</span>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-danger/5 border border-danger/20">
                <AlertTriangle className="h-5 w-5 text-danger" />
                <div className="flex-1">
                  <p className="font-medium">Entrega com problema</p>
                  <p className="text-sm text-muted-foreground">NF 98765 - Destinatário ausente</p>
                </div>
                <span className="text-xs text-muted-foreground">há 32 min</span>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Meta diária atingida</p>
                  <p className="text-sm text-muted-foreground">85% das entregas já foram concluídas</p>
                </div>
                <span className="text-xs text-muted-foreground">há 1h</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={showDeliveriesModal} onOpenChange={handleDeliveriesModalChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Entregas do dia</DialogTitle>
            <DialogDescription>Resumo das entregas cadastradas por todos os motoristas hoje.</DialogDescription>
          </DialogHeader>
          {deliveriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : todayDeliveries.length ? (
            <ScrollArea className="max-h-[60vh]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b">
                  <tr className="text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">NF</th>
                    <th className="py-2 pr-4 font-medium">Cliente</th>
                    <th className="py-2 pr-4 font-medium">Motorista</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Horário</th>
                    <th className="py-2 font-medium">Endereço</th>
                  </tr>
                </thead>
                <tbody>
                  {todayDeliveries.map((delivery) => (
                    <tr key={delivery.id} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-medium">{delivery.nfNumber}</td>
                      <td className="py-2 pr-4">{delivery.clientName}</td>
                      <td className="py-2 pr-4">{delivery.driverName}</td>
                      <td className="py-2 pr-4">{delivery.statusLabel}</td>
                      <td className="py-2 pr-4">{formatDateTime(delivery.createdAt)}</td>
                      <td className="py-2">{delivery.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma entrega cadastrada hoje até o momento.</p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => handleDeliveriesModalChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiptsModal} onOpenChange={handleReceiptsModalChange}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Entregas Finalizadas e Canhotos</DialogTitle>
            <DialogDescription>Lista de todas as entregas concluídas.</DialogDescription>
          </DialogHeader>
          {receiptsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            </div>
          ) : finishedDeliveries.length ? (
            <div>
              {/* Filters row */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <input
                    list="companies-list"
                    placeholder="Pesquisar empresa..."
                    value={companyQuery}
                    onChange={e => setCompanyQuery(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                  <datalist id="companies-list">
                    {companies.map(c => (
                      <option key={c.id} value={String(c.name)} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    list="drivers-list"
                    placeholder="Pesquisar motorista (usuário)..."
                    value={driverQuery}
                    onChange={e => setDriverQuery(e.target.value)}
                    className="border rounded px-2 py-1"
                  />
                  <datalist id="drivers-list">
                    {drivers.map(d => (
                      // show username if available, otherwise show display name
                      <option key={d.id} value={String(d.username || d.name)} />
                    ))}
                  </datalist>
                </div>
                <input type="date" value={filterStartDate ?? ''} onChange={e => setFilterStartDate(e.target.value || undefined)} className="border rounded px-2 py-1" />
                <input type="date" value={filterEndDate ?? ''} onChange={e => setFilterEndDate(e.target.value || undefined)} className="border rounded px-2 py-1" />
                <Button variant="outline" size="sm" onClick={applyFilters}>Filtrar</Button>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar</Button>
                <div className="ml-auto">
                  <Button variant="default" size="sm" onClick={downloadCsv}>Baixar CSV</Button>
                </div>
              </div>
              <ScrollArea className="max-h-[60vh]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b">
                  <tr className="text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">NF</th>
                    <th className="py-2 pr-4 font-medium">Cliente</th>
                    <th className="py-2 pr-4 font-medium">Motorista</th>
                    <th className="py-2 pr-4 font-medium">Data</th>
                    <th className="py-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const start = (currentPage - 1) * PER_PAGE;
                    const paginated = finishedDeliveries.slice(start, start + PER_PAGE);
                    return paginated.map((delivery) => (
                    <tr key={delivery.id} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-medium">{delivery.nfNumber}</td>
                      <td className="py-2 pr-4">{delivery.clientName}</td>
                      <td className="py-2 pr-4">{delivery.driverName}</td>
                      <td className="py-2 pr-4">{formatDateTime(delivery.createdAt)}</td>
                      <td className="py-2">
                        {delivery.receipt_image_url ? (
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={async () => {
                              try {
                                // Try to get a secure blob URL for preview if needed
                                const blobUrl = await apiService.getSecureFile(delivery.receipt_image_url!);
                                setPreviewUrl(blobUrl || delivery.receipt_image_url!);
                              } catch (err) {
                                // Fallback: open the original URL
                                window.open(delivery.receipt_image_url, '_blank', 'noopener');
                              }
                            }}>
                              Ver Canhoto
                            </Button>
                            {/* link "Abrir" removed per request; preview remains available via 'Ver Canhoto' button */}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem Canhoto</span>
                        )}
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </ScrollArea>
            {/* Pagination controls */}
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-muted-foreground">Mostrando {(currentPage-1)*PER_PAGE + 1} - {Math.min(currentPage*PER_PAGE, finishedDeliveries.length)} de {finishedDeliveries.length}</div>
              <div className="space-x-2">
                <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Anterior</Button>
                <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => (p * PER_PAGE < finishedDeliveries.length ? p + 1 : p))} disabled={currentPage * PER_PAGE >= finishedDeliveries.length}>Próxima</Button>
              </div>
            </div>
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma entrega finalizada encontrada.</p>
          )}
          {/* Image preview modal */}
          {previewUrl && (
            <Dialog open={true} onOpenChange={() => setPreviewUrl(null)}>
              <DialogContent className="w-full max-w-[92vw] sm:max-w-3xl p-4 sm:p-6">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-lg sm:text-xl">Visualizar Canhoto</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Ajuste com gesto de pinça ou rolagem para inspecionar os detalhes.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center">
                  <ScrollArea className="max-h-[70vh] w-full">
                    <img
                      src={previewUrl}
                      alt="Canhoto"
                      className="max-h-[68vh] w-full max-w-full object-contain rounded-md shadow-sm"
                    />
                  </ScrollArea>
                </div>
                <DialogFooter className="sm:flex sm:justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    variant="secondary"
                    onClick={() => setPreviewUrl(null)}
                  >
                    Fechar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </DialogContent>
      </Dialog>

      <DriverForm 
        open={showDriverForm}
        onOpenChange={setShowDriverForm}
        onSuccess={() => {
          toast({
            title: "Sucesso",
            description: "Motorista cadastrado com sucesso!",
          });
          // Recarregar dados se necessário
          loadDashboardData();
          if (showDeliveriesModal) {
            void loadTodayDeliveries();
          }
        }}
      />
    </div>
  );
};
