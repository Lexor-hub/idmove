import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L, { LatLngTuple } from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { computeMovementStatus, getMovementStatusHex, MOVEMENT_STATUS_LABEL, MovementStatus } from '@/lib/driver-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Truck } from 'lucide-react';

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

  useEffect(() => {
    let isMounted = true;

    const fetchAll = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('v_motoristas_posicao')
          .select('motorista_id, driver_name, session_id, is_active, latitude, longitude, accuracy_m, speed_kmh, heading_deg, recorded_at, updated_at')
          .eq('is_active', true);

        if (!isMounted || error || !data) {
          if (error) setError('Erro ao carregar posições');
          return;
        }

        const now = Date.now();
        setLocations(
          data
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
        setIsLoading(false);
      } catch (err) {
        console.error('[TrackingMap] Erro ao buscar posições:', err);
        if (isMounted) setError('Não foi possível carregar as localizações.');
      }
    };

    fetchAll();

    // Realtime subscription — escuta INSERT e UPDATE
    const channel = supabase
      .channel('rt_motoristas_posicao')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'motoristas_posicao' },
        async (payload) => {
          if (!isMounted) return;
          const motoristaId = (payload.new as Record<string, unknown>)?.motorista_id as string
                            || (payload.old as Record<string, unknown>)?.motorista_id as string;
          if (!motoristaId) return;

          console.debug('[Tracking] Realtime event recebido:', payload.eventType, motoristaId);

          const isActive = (payload.new as Record<string, unknown>)?.is_active;
          if (payload.eventType === 'DELETE' || isActive === false) {
            setLocations((prev) => prev.filter((l) => l.driver_id !== motoristaId));
            return;
          }

          // Re-fetch desta linha na view (converte geography → lat/lon)
          const { data: row, error: rowError } = await supabase
            .from('v_motoristas_posicao')
            .select('motorista_id, driver_name, session_id, is_active, latitude, longitude, accuracy_m, speed_kmh, heading_deg, recorded_at, updated_at')
            .eq('motorista_id', motoristaId)
            .eq('is_active', true)
            .single();

          if (rowError) {
            setLocations((prev) => prev.filter((l) => l.driver_id !== motoristaId));
            return;
          }
          if (!row || !isMounted) return;
          if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return;

          const now = Date.now();
          setLocations((prev) => {
            const existing = prev.findIndex((l) => l.driver_id === motoristaId);
            const updated = {
              driver_id: row.motorista_id,
              session_id: row.session_id,
              driver_name: row.driver_name,
              latitude: row.latitude,
              longitude: row.longitude,
              last_update: row.updated_at,
              status: 'active' as const,
              movementStatus: computeMovementStatus({ speed: row.speed_kmh, last_update: row.updated_at }, now),
              speed: Number(row.speed_kmh || 0),
              accuracy: Number(row.accuracy_m || 0),
              heading: Number(row.heading_deg || 0),
            };
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = updated;
              return next;
            }
            return [...prev, updated];
          });
        }
      )
      .subscribe((status) => {
        console.info('[Tracking] Realtime channel status:', status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Conexão em tempo real perdida. Recarregue para tentar novamente.');
        }
      });

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
      supabase.removeChannel(channel);
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
