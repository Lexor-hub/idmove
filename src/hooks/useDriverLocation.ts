import { useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { apiService } from '@/services/api';

interface UseDriverLocationOptions {
  driverId: string;
  active: boolean;
  intervalSeconds?: number;
  onError?: (error: GeolocationPositionError | Error) => void;
}

interface BgLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  simulated?: boolean;
  speed?: number;
  bearing?: number;
  time?: number;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location: BgLocation | null, error?: { code: string; message: string }) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export function useDriverLocation({ driverId, active, intervalSeconds = 15, onError }: UseDriverLocationOptions) {
  const watchRef = useRef<number | null>(null);
  const bgGeoRef = useRef<string | null>(null);
  const lastSentAtRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !driverId) return;

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      let cancelled = false;

      (async () => {
        try {
          const id = await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: 'Rastreamento de rota ativo.',
              backgroundTitle: 'ID Move — Rota em andamento',
              requestPermissions: true,
              stale: false,
              distanceFilter: 10,
            },
            async (location, error) => {
              if (error) {
                console.warn('[useDriverLocation] BG geolocation error:', error);
                onError?.(new Error(error.message ?? error.code));
                return;
              }
              if (!location) return;
              try {
                await apiService.upsertDriverPosition(driverId, location.latitude, location.longitude);
                lastSentAtRef.current = Date.now();
              } catch (rpcError) {
                console.warn('[useDriverLocation] RPC upsert failed (native):', rpcError);
              }
            },
          );

          if (cancelled) {
            try {
              await BackgroundGeolocation.removeWatcher({ id });
            } catch { /* noop */ }
            return;
          }

          bgGeoRef.current = id;
          console.info('[useDriverLocation] Background tracking iniciado para driver', driverId);
        } catch (err) {
          console.warn('[useDriverLocation] Background geolocation indisponivel:', err);
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      })();

      return () => {
        cancelled = true;
        const id = bgGeoRef.current;
        bgGeoRef.current = null;
        if (id) {
          BackgroundGeolocation.removeWatcher({ id })
            .then(() => console.info('[useDriverLocation] Background tracking encerrado'))
            .catch((err) => console.debug('[useDriverLocation] Erro ao parar background geo:', err));
        }
      };
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const err = new Error('Geolocation API indisponivel neste navegador');
      console.warn('[useDriverLocation]', err.message);
      onError?.(err);
      return;
    }

    const minIntervalMs = Math.max(intervalSeconds * 1000, 1000);

    const sendPosition = async (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSentAtRef.current < minIntervalMs) return;
      lastSentAtRef.current = now;
      try {
        await apiService.upsertDriverPosition(driverId, pos.coords.latitude, pos.coords.longitude);
        console.debug('[useDriverLocation] Posicao enviada:', pos.coords.latitude, pos.coords.longitude);
      } catch (err) {
        console.warn('[useDriverLocation] Falha ao enviar posicao:', err);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn('[useDriverLocation] Geolocation error:', err.code, err.message);
      onError?.(err);
    };

    watchRef.current = navigator.geolocation.watchPosition(sendPosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: minIntervalMs,
      timeout: 30000,
    });

    console.info('[useDriverLocation] Web tracking iniciado para driver', driverId);

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
        console.info('[useDriverLocation] Web tracking encerrado');
      }
    };
  }, [active, driverId, intervalSeconds, onError]);
}
