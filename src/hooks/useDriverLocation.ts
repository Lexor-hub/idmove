import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { apiService } from '@/services/api';
import { shouldSendTrackingPoint, toKmh, type TrackingSample } from '@/lib/driver-tracking';

export type DriverTrackingPosition = TrackingSample & {
  speed?: number | null;
  heading?: number | null;
};

interface UseDriverLocationOptions {
  driverId: string;
  sessionId?: string | null;
  active: boolean;
  onPosition?: (position: DriverTrackingPosition) => void;
  onError?: (error: GeolocationPositionError | Error) => void;
}

interface BgLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  simulated?: boolean;
  speed?: number | null;
  bearing?: number | null;
  time?: number | null;
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

const isFiniteCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const isFatalTrackingWriteError = (message?: string) => {
  const normalized = String(message || '').toLowerCase();
  return [
    'jwt',
    'unauthorized',
    'not authenticated',
    'permission denied',
    'row-level',
    'rls',
    'sessao',
    'session',
    'inativa',
    'inactive',
  ].some((needle) => normalized.includes(needle));
};

export function useDriverLocation({ driverId, sessionId, active, onPosition, onError }: UseDriverLocationOptions) {
  const webWatchRef = useRef<number | null>(null);
  const bgGeoRef = useRef<string | null>(null);
  const lastSentRef = useRef<DriverTrackingPosition | null>(null);
  const [lastPosition, setLastPosition] = useState<DriverTrackingPosition | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (!active || !driverId || !sessionId) {
      lastSentRef.current = null;
      setIsWatching(false);
      setIsRequesting(false);
      return;
    }

    let cancelled = false;
    const trackingStartedAt = Date.now();

    const handleError = (error: GeolocationPositionError | Error) => {
      if (cancelled) return;
      setIsRequesting(false);
      setIsWatching(false);
      onError?.(error);
    };

    const sendPosition = async (position: DriverTrackingPosition) => {
      if (cancelled) return;
      if (!isFiniteCoordinate(position.latitude, position.longitude)) return;
      const recordedAt = Math.max(Number(position.recordedAt) || trackingStartedAt, trackingStartedAt);
      const normalizedPosition = { ...position, recordedAt };
      if (!shouldSendTrackingPoint({ previous: lastSentRef.current, next: normalizedPosition })) return;

      lastSentRef.current = normalizedPosition;
      setLastPosition(normalizedPosition);
      setIsRequesting(false);
      onPosition?.(normalizedPosition);

      const response = await apiService.recordDriverLocation({
        session_id: sessionId,
        driver_id: driverId,
        latitude: normalizedPosition.latitude,
        longitude: normalizedPosition.longitude,
        accuracy: normalizedPosition.accuracy ?? undefined,
        speed: normalizedPosition.speed ?? undefined,
        heading: normalizedPosition.heading ?? undefined,
        recorded_at: new Date(normalizedPosition.recordedAt).toISOString(),
      });

      if (!response.success) {
        console.warn('[useDriverLocation] Falha ao enviar posicao:', response.error);
        if (isFatalTrackingWriteError(response.error)) {
          handleError(new Error(response.error));
        }
      }
    };

    const isNative = Capacitor.isNativePlatform();
    setIsRequesting(true);

    if (isNative) {
      (async () => {
        try {
          const id = await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: 'Rastreamento de rota ativo.',
              backgroundTitle: 'ID Move - Rota em andamento',
              requestPermissions: true,
              stale: false,
              distanceFilter: 1,
            },
            (location, error) => {
              if (error) {
                console.warn('[useDriverLocation] BG geolocation error:', error);
                handleError(new Error(error.message || error.code));
                return;
              }
              if (!location) return;

              void sendPosition({
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy ?? null,
                speed: toKmh(location.speed),
                heading: location.bearing ?? null,
                recordedAt: location.time || Date.now(),
              });
            },
          );

          if (cancelled) {
            await BackgroundGeolocation.removeWatcher({ id }).catch(() => undefined);
            return;
          }

          bgGeoRef.current = id;
          setIsWatching(true);
          console.info('[useDriverLocation] Background tracking iniciado para driver', driverId);
        } catch (err) {
          console.warn('[useDriverLocation] Background geolocation indisponivel:', err);
          handleError(err instanceof Error ? err : new Error(String(err)));
        }
      })();

      return () => {
        cancelled = true;
        setIsWatching(false);
        setIsRequesting(false);
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
      handleError(new Error('Geolocation API indisponivel neste navegador'));
      return;
    }

    webWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void sendPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
          speed: toKmh(pos.coords.speed),
          heading: typeof pos.coords.heading === 'number' ? pos.coords.heading : null,
          recordedAt: pos.timestamp || Date.now(),
        });
      },
      (err) => {
        console.warn('[useDriverLocation] Geolocation error:', err.code, err.message);
        handleError(err);
      },
      {
        // 1ª leitura no navegador costuma demorar (diálogo de permissão + 1º fix).
        // timeout curto fazia o "iniciar rota" falhar na primeira tentativa.
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 30_000,
      },
    );

    setIsWatching(true);
    console.info('[useDriverLocation] Web tracking iniciado para driver', driverId);

    return () => {
      cancelled = true;
      setIsWatching(false);
      setIsRequesting(false);
      if (webWatchRef.current !== null) {
        navigator.geolocation.clearWatch(webWatchRef.current);
        webWatchRef.current = null;
        console.info('[useDriverLocation] Web tracking encerrado');
      }
    };
  }, [active, driverId, sessionId, onError, onPosition]);

  return { isWatching, isRequesting, lastPosition };
}
