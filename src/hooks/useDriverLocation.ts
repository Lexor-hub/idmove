import { useEffect, useRef } from 'react';
import { apiService } from '@/services/api';

interface UseDriverLocationOptions {
  driverId: string;
  active: boolean;
  intervalSeconds?: number;
}

export function useDriverLocation({ driverId, active, intervalSeconds = 15 }: UseDriverLocationOptions) {
  const watchRef = useRef<number | null>(null);
  const bgGeoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !driverId) return;

    // Detectar se é plataforma nativa (Capacitor)
    const isNative = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();

    if (isNative) {
      // Caminho nativo: background geolocation (só importa em nativo)
      (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { BackgroundGeolocation } = require('@capacitor-community/background-geolocation');
          const id = await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: 'Rastreamento de rota ativo.',
              backgroundTitle: 'ID Move — Rota em andamento',
              requestPermissions: true,
              stale: false,
              distanceFilter: 10,
            },
            async (location: any, error: any) => {
              if (error || !location) return;
              await apiService.upsertDriverPosition(driverId, location.latitude, location.longitude);
            }
          );
          bgGeoRef.current = id;
        } catch (err) {
          console.debug('[useDriverLocation] Background geolocation não disponível:', err);
        }
      })();

      return () => {
        if (bgGeoRef.current) {
          (async () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { BackgroundGeolocation } = require('@capacitor-community/background-geolocation');
              await BackgroundGeolocation.removeWatcher({ id: bgGeoRef.current as string });
            } catch (err) {
              console.debug('[useDriverLocation] Erro ao parar background geo:', err);
            }
          })();
        }
      };
    }

    // Caminho web: navigator.geolocation a cada intervalSeconds
    const sendPosition = (pos: GeolocationPosition) => {
      apiService.upsertDriverPosition(driverId, pos.coords.latitude, pos.coords.longitude);
    };

    watchRef.current = navigator.geolocation.watchPosition(sendPosition, undefined, {
      enableHighAccuracy: true,
      maximumAge: intervalSeconds * 1000,
    });

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [active, driverId, intervalSeconds]);
}
