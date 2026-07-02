import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L, { LatLngTuple } from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { computeMovementStatus, getMovementStatusHex, MOVEMENT_STATUS_LABEL, MovementStatus } from '@/lib/driver-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Truck, AlertTriangle } from 'lucide-react';

const DEFAULT_CENTER: LatLngTuple = [-23.55052, -46.633308];

interface DriverLocation {
  driver_id: string;
  session_id?: string | null;
  driver_name: string;
  latitude: number;
  longitude: number;
  last_update: string;
  status: 'active' | 'inactive';
  movementStatus: MovementStatus;
  speed: number;
  accuracy: number;
  heading: number;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '??';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const createDriverIcon = (driver: Pick<DriverLocation, 'driver_name' | 'movementStatus'>) => {
  const initials = escapeHtml(getInitials(driver.driver_name));
  const color = getMovementStatusHex(driver.movementStatus);
  const safeName = escapeHtml(driver.driver_name);

  return L.divIcon({
    className: '',
    iconAnchor: [24, 52],
    iconSize: [120, 60],
    popupAnchor: [0, -40],
    html: `
      <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:6px;
        transform:translateY(-8px);
      ">
        <div style="
          display:flex;
          align-items:center;
          justify-content:center;
          width:36px;
          height:36px;
          border-radius:18px;
          background:linear-gradient(135deg,#2563eb,#1d4ed8);
          color:#ffffff;
          font-weight:600;
          box-shadow:0 8px 20px rgba(37,99,235,0.3);
          border:2px solid rgba(255,255,255,0.85);
          font-size:14px;
        ">
          ${initials}
        </div>
        <span style="
          font-size:12px;
          font-weight:600;
          color:${color};
          background:rgba(255,255,255,0.92);
          border-radius:9999px;
          padding:2px 8px;
          border:1px solid ${color};
          box-shadow:0 2px 6px rgba(0,0,0,0.16);
          white-space:nowrap;
        ">
          ${safeName}
        </span>
      </div>
    `,
  });
};

const MapBoundsUpdater: React.FC<{ points: LatLngTuple[] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (!points.length) {
      map.setView(DEFAULT_CENTER, 11);
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [points, map]);

  return null;
};

const Tracking = () => {
  const { toast } = useToast();
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Saúde do tracking: comparar nº de sessões ativas (driver_tracking_sessions) vs
  // motoristas realmente visíveis no mapa. Diferença sinaliza motorista que iniciou
  // rota mas parou de enviar GPS (Chrome em background, vínculo quebrado etc).
  const [activeSessionDrivers, setActiveSessionDrivers] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

    const fetchAll = async (showLoading = false) => {
      try {
        if (showLoading) setIsLoading(true);
        const { data, error } = await supabase
          .from('v_motoristas_posicao')
          .select('motorista_id, driver_name, session_id, is_active, latitude, longitude, accuracy_m, speed_kmh, heading_deg, recorded_at, updated_at')
          .eq('is_active', true);

        if (!isMounted) return;

        if (error) {
          console.warn('[Tracking] Erro ao carregar posições:', error);
          setLocations([]);
          setError('Erro ao carregar posições. A tela vai tentar atualizar automaticamente.');
          return;
        }

        const now = Date.now();
        setLocations(
          (data || [])
            .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
            .map((r) => ({
              driver_id: r.motorista_id,
              session_id: r.session_id,
              driver_name: r.driver_name,
              latitude: r.latitude,
              longitude: r.longitude,
              last_update: r.updated_at,
              status: 'active' as const,
              movementStatus: computeMovementStatus({ speed: r.speed_kmh, last_update: r.updated_at }, now),
              speed: Number(r.speed_kmh || 0),
              accuracy: Number(r.accuracy_m || 0),
              heading: Number(r.heading_deg || 0),
            }))
        );
        setError(null);
      } catch (err) {
        console.error('[TrackingMap] Erro ao buscar posições:', err);
        if (isMounted) {
          setLocations([]);
          setError('Não foi possível carregar as localizações.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const fetchActiveSessions = async () => {
      const { data, error: sessionError } = await supabase
        .from('driver_tracking_sessions')
        .select('driver_id')
        .eq('status', 'active');
      if (!isMounted) return;
      if (sessionError) {
        console.warn('[Tracking] Erro ao buscar sessões ativas:', sessionError);
        return;
      }
      setActiveSessionDrivers(new Set((data || []).map((row) => String(row.driver_id))));
    };

    fetchAll(true);
    fetchActiveSessions();
    const locationsPoll = setInterval(() => fetchAll(false), 30_000);
    const sessionsPoll = setInterval(fetchActiveSessions, 60_000);

    // Re-calcular status "offline" a cada 30s (sem chamada de rede)
    const offlineTimer = setInterval(() => {
      setLocations((prev) => {
        const now = Date.now();
        return prev.map((l) => ({
          ...l,
          movementStatus: computeMovementStatus({ speed: l.speed, last_update: l.last_update }, now),
        }));
      });
    }, 30_000);

    return () => {
      isMounted = false;
      clearInterval(offlineTimer);
      clearInterval(locationsPoll);
      clearInterval(sessionsPoll);
    };
  }, []);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Aviso sobre o mapa',
        description: error,
        variant: 'default',
        duration: 4000,
      });
    }
  }, [error, toast]);

  const markerPoints = useMemo<LatLngTuple[]>(
    () => locations.map((loc) => [loc.latitude, loc.longitude] as LatLngTuple),
    [locations]
  );

  // Motoristas com sessão de tracking aberta mas sem ponto recente no mapa.
  // Sinaliza visualmente o que antes ficava silencioso (caso João/Ana 02/06).
  const visibleDriverIds = useMemo(
    () => new Set(locations.map((l) => String(l.driver_id))),
    [locations]
  );
  const missingDriverCount = useMemo(
    () => Array.from(activeSessionDrivers).filter((id) => !visibleDriverIds.has(id)).length,
    [activeSessionDrivers, visibleDriverIds]
  );

  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rastreamento em Tempo Real</h1>
          <p className="text-muted-foreground mt-1">
            Localizações dos motoristas com GPS ativo. Atualiza automaticamente a cada minuto.
          </p>
        </div>
      </div>

      {missingDriverCount > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">
                  {missingDriverCount} motorista(s) em rota sem posição no mapa
                </p>
                <p className="text-xs mt-1">
                  Têm sessão de rota ativa, mas pararam de enviar GPS. Pode ser tela
                  bloqueada, app em segundo plano ou conexão instável. Vale checar com o
                  motorista antes de cobrar.
                </p>
                <p className="text-xs mt-1 text-amber-800">
                  {activeSessionDrivers.size} sessão(ões) ativa(s) · {locations.length} visível(is) no mapa
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Motoristas no Mapa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          <div className="relative">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={11}
              scrollWheelZoom
              className="h-[600px] w-full rounded-lg"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapBoundsUpdater points={markerPoints} />

              {locations.map((driver) => (
                <Marker
                  key={driver.driver_id}
                  position={[driver.latitude, driver.longitude]}
                  icon={createDriverIcon(driver)}
                >
                  <Popup>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        <p className="font-semibold text-foreground">{driver.driver_name}</p>
                      </div>
                      <p
                        className="text-xs font-semibold"
                        style={{ color: getMovementStatusHex(driver.movementStatus) }}
                      >
                        {MOVEMENT_STATUS_LABEL[driver.movementStatus]}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Última atualização: {new Date(driver.last_update).toLocaleTimeString('pt-BR')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Precisão: ±{Math.round(driver.accuracy)}m
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Velocidade: {Math.round(driver.speed)} km/h | Direção: {Math.round(driver.heading)}°
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {(isLoading || !locations.length) && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
                <p className="text-sm text-muted-foreground">
                  {isLoading ? 'Carregando motoristas...' : 'Nenhum motorista com GPS ativo neste momento.'}
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Tracking;
