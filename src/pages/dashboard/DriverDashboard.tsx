import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Play,
    Square,
    MapPin,
    Package,
    Camera,
    CheckCircle,
    AlertTriangle,
    Plus,
    Route,
    Upload,
    Eye,
    Trash2,
    FileText,
    Loader2,
    ChevronRight,
} from 'lucide-react';
import { apiService } from '@/services/api';
import { processImageOCR, type NFeExtractedData } from '@/services/ocrService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDriverLocation, type DriverTrackingPosition } from '@/hooks/useDriverLocation';
import { SimpleDeliveryForm } from '@/components/delivery/SimpleDeliveryForm';
import { todayBrt } from '@/lib/date';
import { Capacitor } from '@capacitor/core';

// CORRIGIDO: A interface agora inclui 'createdAt' e 'driverId'
interface Delivery {
    id: string;
    nfNumber: string;
    client: string;
    address: string;
    volume: number;
    value: number;
    status: 'PENDENTE' | 'EM_ANDAMENTO' | 'REALIZADA' | 'PROBLEMA';
    hasReceipt?: boolean;
    createdAt?: string;
    driverId?: string;
    receiptImageUrl?: string; // Adicionado para guardar a URL da imagem
    originalApiStatus?: string;
}

interface ApiDelivery {
    id: number;
    nf_number: string;
    client_name_extracted: string;
    delivery_address: string;
    delivery_volume?: number;
    merchandise_value: string;
    status: string;
    driver_name?: string;
    created_at: string;
    client_name?: string;
    client_address?: string;
    has_receipt?: boolean;
    receipt_id?: string;
    receipt_image_url?: string; // Adicionado para corresponder à API
    image_url?: string; // Adicionado para compatibilidade
    driver_id?: number;
}

type WakeLockSentinelLike = EventTarget & {
    released: boolean;
    release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
};

const OCCURRENCE_PHOTO_MAX_SIZE = 5 * 1024 * 1024;
const OCCURRENCE_PHOTO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const DriverDashboard = () => {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [routeStarted, setRouteStarted] = useState(false);
    const [dayStarted, setDayStarted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState<'LOADING' | 'ON_ROUTE'>('LOADING');

    const { user } = useAuth();
    const { toast } = useToast();

    // Auto-recuperação do driver_id: se a sessão (user) não trouxe driver_id
    // — caso de sessão antiga criada antes do vínculo operacional — busca no
    // backend uma vez. Sem isso, iniciar rota/rastreamento e registrar
    // ocorrência falhavam com "Motorista não identificado" mesmo o motorista
    // estando corretamente vinculado no banco.
    const [resolvedDriverId, setResolvedDriverId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!user?.driver_id) {
            apiService.getCurrentDriverId()
                .then((id) => {
                    if (!cancelled && id) setResolvedDriverId(id);
                })
                .catch((err) => { console.debug('[DriverDashboard] auto-recuperar driver_id falhou:', err); });
        }
        return () => { cancelled = true; };
    }, [user?.driver_id]);

    const resolveDriverId = useCallback(() => {
        const idValue = user?.driver_id ?? resolvedDriverId;
        if (idValue === undefined || idValue === null) {
            return null;
        }
        return idValue.toString();
    }, [user, resolvedDriverId]);

    const [showDeliveryUpload, setShowDeliveryUpload] = useState(false);
    const [showAddDelivery, setShowAddDelivery] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
    const [occurrenceDelivery, setOccurrenceDelivery] = useState<Delivery | null>(null);
    const [occurrenceType, setOccurrenceType] = useState<'reentrega' | 'recusa' | 'avaria'>('reentrega');
    const [occurrenceDescription, setOccurrenceDescription] = useState('');
    const [reportingOccurrence, setReportingOccurrence] = useState(false);
    const [occurrencePhoto, setOccurrencePhoto] = useState<{ file: File; dataUrl: string } | null>(null);
    const occurrencePhotoInputRef = useRef<HTMLInputElement | null>(null);

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [deliveryDetails, setDeliveryDetails] = useState<any>(null); // Para guardar os dados completos
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Estados para o fluxo de captura de foto
    const [showPhotoConfirmModal, setShowPhotoConfirmModal] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<{ file: File, dataUrl: string } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estados para o modal de visualização do canhoto
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptImage, setReceiptImage] = useState<string | null>(null);
    const [receiptLoading, setReceiptLoading] = useState(false);

    // OCR states for canhoto photo
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrStatus, setOcrStatus] = useState('');
    const [ocrResult, setOcrResult] = useState<NFeExtractedData | null>(null);
    const [editOcrCnpj, setEditOcrCnpj] = useState('');
    const [editOcrClient, setEditOcrClient] = useState('');
    const [editOcrNf, setEditOcrNf] = useState('');

    // 2-step finalize: step 1=photo+OCR, step 2=notes
    const [finalizeStep, setFinalizeStep] = useState<1 | 2>(1);
    const [finalizeNotes, setFinalizeNotes] = useState('');

    // Delete delivery state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deliveryToDelete, setDeliveryToDelete] = useState<Delivery | null>(null);
    const [deletingDelivery, setDeletingDelivery] = useState(false);

    const [hasLocationConsent, setHasLocationConsent] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('driver_location_consent') === 'true';
    });
    const [showConsentDialog, setShowConsentDialog] = useState(false);
    const [locationActive, setLocationActive] = useState(false);
    const [requestingLocation, setRequestingLocation] = useState(false);
    const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null);
    const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
    const [screenAwake, setScreenAwake] = useState(false);
    const [wakeLockUnavailable, setWakeLockUnavailable] = useState(false);
    const [lastKnownPosition, setLastKnownPosition] = useState<DriverTrackingPosition | null>(null);

    const driverIdForTracking = user?.driver_id || resolvedDriverId || '';

    const releaseWakeLock = useCallback(async () => {
        const sentinel = wakeLockRef.current;
        wakeLockRef.current = null;
        setScreenAwake(false);

        if (sentinel && !sentinel.released) {
            try {
                await sentinel.release();
            } catch (error) {
                console.debug('[DriverDashboard] Nao foi possivel liberar Wake Lock:', error);
            }
        }
    }, []);

    const requestWakeLock = useCallback(async () => {
        if (typeof navigator === 'undefined') return;

        const nav = navigator as NavigatorWithWakeLock;
        if (!nav.wakeLock) {
            setWakeLockUnavailable(true);
            setScreenAwake(false);
            return;
        }

        try {
            const sentinel = await nav.wakeLock.request('screen');
            wakeLockRef.current = sentinel;
            setWakeLockUnavailable(false);
            setScreenAwake(true);

            sentinel.addEventListener('release', () => {
                if (wakeLockRef.current === sentinel) {
                    wakeLockRef.current = null;
                    setScreenAwake(false);
                }
            });
        } catch (error) {
            setWakeLockUnavailable(true);
            setScreenAwake(false);
            console.debug('[DriverDashboard] Wake Lock indisponivel:', error);
        }
    }, []);

    const stopLocationTracking = useCallback(() => {
        setLocationActive(false);
        setRequestingLocation(false);
        setLastKnownPosition(null);
        setTrackingSessionId(null);
    }, []);

    const sendLocationUpdate = useCallback(async (position?: DriverTrackingPosition) => {
        const targetPosition = position ?? lastKnownPosition;
        const driverId = resolveDriverId();

        if (!targetPosition || !driverId || !routeStarted || !trackingSessionId) {
            return;
        }

        await apiService.recordDriverLocation({
            session_id: trackingSessionId,
            driver_id: driverId,
            latitude: targetPosition.latitude,
            longitude: targetPosition.longitude,
            accuracy: targetPosition.accuracy ?? undefined,
            speed: targetPosition.speed ?? undefined,
            heading: targetPosition.heading ?? undefined,
            recorded_at: new Date(targetPosition.recordedAt).toISOString(),
        });

        /*
        const { latitude, longitude, accuracy, speed, heading } = targetPosition.coords;
        const numericAccuracy = typeof accuracy === 'number' ? accuracy : null;
        const skipAccuracyFilter = Boolean(position);
        const startedTrackingAt = trackingStartTimestampRef.current;
        const isWithinAccuracyGracePeriod =
            typeof startedTrackingAt === 'number'
                ? (Date.now() - startedTrackingAt) < GPS_ACCURACY_GRACE_PERIOD_MS
                : false;

        const shouldSkipForAccuracy =
            !skipAccuracyFilter &&
            numericAccuracy !== null &&
            numericAccuracy > GPS_ACCURACY_THRESHOLD_METERS &&
            isWithinAccuracyGracePeriod;

        if (shouldSkipForAccuracy) {
            if (!awaitingAccurateFixRef.current) {
                awaitingAccurateFixRef.current = true;
            }

            if (!accuracyToastShownRef.current) {
                accuracyToastShownRef.current = true;
                const accuracyText = numericAccuracy !== null
                    ? `${Math.round(numericAccuracy)}m`
                    : 'desconhecida';
                toast({
                    title: 'Ajustando precisão do GPS',
                    description: `Aguardando um sinal de GPS mais preciso (atual: ±${accuracyText})`,
                });
            }

            return;
        }

        if (awaitingAccurateFixRef.current) {
            awaitingAccurateFixRef.current = false;
            if (accuracyToastShownRef.current) {
                toast({
                    title: 'GPS calibrado',
                    description: 'Agora temos um sinal mais preciso. Seguiremos monitorando sua rota.',
                });
                accuracyToastShownRef.current = false;
            }
        }

        try {
            await apiService.sendDriverLocation({
                driver_id: driverId,
                latitude,
                longitude,
                accuracy: typeof accuracy === 'number' ? accuracy : undefined,
                speed: typeof speed === 'number' ? speed : undefined,
                heading: typeof heading === 'number' ? heading : undefined,
            });
        } catch (error) {}
        */
    }, [lastKnownPosition, routeStarted, resolveDriverId, trackingSessionId]);

    const updateDriverStatus = useCallback(async (status: 'online' | 'offline' | 'idle') => {
        const driverId = resolveDriverId();
        if (!driverId) return;
        try {
            await apiService.updateDriverStatus(driverId, status);
        } catch (error) {
            console.debug('[DriverDashboard] Nao foi possivel atualizar status do motorista:', error);
        } 
    }, [resolveDriverId]);

    const startLocationTracking = useCallback(async () => {
        // Resolve o driver_id na hora: se a sessão não trouxe e o auto-recuperar
        // de fundo ainda não terminou, busca inline no backend ANTES de falhar.
        // Sem isso havia race: o 1º clique falhava e só o 2º funcionava.
        let driverId = resolveDriverId();
        if (!driverId) {
            driverId = await apiService.getCurrentDriverId();
            if (driverId) setResolvedDriverId(driverId);
        }
        if (!driverId) {
            toast({
                title: 'Motorista não identificado',
                description: 'Não foi possível iniciar o rastreamento. Faça logout e login novamente.',
                variant: 'destructive'
            });
            return false;
        }

        setRequestingLocation(true);
        setLocationActive(false);
        setLastKnownPosition(null);

        const response = await apiService.startDriverTracking(driverId, Capacitor.getPlatform());
        if (!response.success) {
            setRequestingLocation(false);
            toast({
                title: 'Erro ao iniciar rastreamento',
                description: response.error,
                variant: 'destructive'
            });
            return false;
        }

        setTrackingSessionId(response.data.session_id);
        setLocationActive(true);
        updateDriverStatus('online');
        return true;

        /*
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            toast({
                title: 'Geolocalizaçãoo indisponível',
                description: 'O dispositivo não oferece suporte á localização ou a permissão está bloqueada.',
                variant: 'destructive'
            });
            return false;
        }

        if (locationWatchId.current !== null) {
            navigator.geolocation.clearWatch(locationWatchId.current);
        }

        setRequestingLocation(true);
        setLocationActive(false);

        trackingStartTimestampRef.current = Date.now();
        awaitingAccurateFixRef.current = false;
        accuracyToastShownRef.current = false;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                setLastKnownPosition(position);
                if (!locationActive) { // Apenas na primeira vez que a localização é obtida
                    setLocationActive(true);
                    setRequestingLocation(false);
                    toast({
                        title: 'localização ativada',
                        description: 'Estamos acompanhando seu trajeto apenas enquanto a rota estiver ativa.'
                    });
                }
            },
            (error) => {
                // Se houver um erro, paramos tudo para evitar comportamento inesperado.
                stopLocationTracking();

                setRequestingLocation(false);
                let description = 'Não foi possível ativar a localização.';
                if (error.code === error.PERMISSION_DENIED) {
                    description = 'Permita o acesso á localização para acompanhar o trajeto da rota.';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    description = 'Não foi possível obter sua localização atual. Tente novamente em instantes.';
                } else if (error.code === error.TIMEOUT) {
                    description = 'Tempo excedido ao tentar obter sua localização. Tente novamente.';
                }
                toast({
                    title: 'Erro de localização',
                    description,
                    variant: 'destructive'
                });
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
        );

        locationWatchId.current = watchId;
        return true;
        */
    }, [resolveDriverId, toast, updateDriverStatus]);

    // Novo useEffect para enviar a localização sempre que `lastKnownPosition` mudar.
    const handleTrackingPosition = useCallback((position: DriverTrackingPosition) => {
        setLastKnownPosition(position);
        setRequestingLocation(false);
    }, []);

    const handleTrackingError = useCallback(async (error: GeolocationPositionError | Error) => {
        const driverId = resolveDriverId();
        const sessionId = trackingSessionId;

        setRequestingLocation(false);
        setLocationActive(false);
        setTrackingSessionId(null);

        if (driverId && sessionId) {
            await apiService.finishDriverTracking(driverId, sessionId);
            await updateDriverStatus('offline');
        }

        let description = 'Não foi possível ativar a localização.';
        if ('code' in error) {
            if (error.code === error.PERMISSION_DENIED) {
                description = 'Permita o acesso à localização para acompanhar o trajeto da rota.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                description = 'Não foi possível obter sua localização atual. Tente novamente em instantes.';
            } else if (error.code === error.TIMEOUT) {
                description = 'Tempo excedido ao tentar obter sua localização. Tente novamente.';
            }
        } else if (error.message) {
            description = error.message;
        }

        toast({
            title: 'Erro de localização',
            description,
            variant: 'destructive'
        });
    }, [resolveDriverId, toast, trackingSessionId, updateDriverStatus]);

    const driverTracking = useDriverLocation({
        driverId: String(driverIdForTracking || ''),
        sessionId: trackingSessionId,
        active: routeStarted && locationActive && Boolean(trackingSessionId),
        onPosition: handleTrackingPosition,
        onError: handleTrackingError,
    });

    useEffect(() => {
        if (locationActive) {
            setRequestingLocation(driverTracking.isRequesting);
        }
    }, [driverTracking.isRequesting, locationActive]);

    useEffect(() => {
        if (driverTracking.lastPosition) {
            setLastKnownPosition(driverTracking.lastPosition);
        }
    }, [driverTracking.lastPosition]);

    // DriverDashboard.tsx (Adicione este handler)
    const handleViewDetails = useCallback(async (delivery: Delivery) => {
        setDetailsLoading(true);
        setDeliveryDetails(null);
        setShowDetailsModal(true);

        try {
            const response = await apiService.getDelivery(delivery.id);

            if (response.success && response.data) {
                setDeliveryDetails(response.data);
            } else {
                toast({
                    title: 'Erro ao carregar detalhes',
                    description: 'Não foi possível carregar as informações detalhadas da entrega.',
                    variant: 'destructive'
                });
                setShowDetailsModal(false);
            }
        } catch (error) {
            toast({
                title: 'Erro de conexão',
                description: 'Não foi possível se comunicar com o servidor.',
                variant: 'destructive'
            });
            setShowDetailsModal(false);
        } finally {
            setDetailsLoading(false);
        }
    }, [toast]);

    const loadTodayDeliveries = useCallback(async () => {
        setLoading(true);

        const driverIdToFetch = resolveDriverId();
        if (!driverIdToFetch) {
            setLoading(false);
            return;
        }

        try {
            const response = await apiService.getDeliveries({
                 driver_id: driverIdToFetch,
                 scheduled_date: todayBrt(),
            });

            if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                const deliveriesData = (response.data as unknown as ApiDelivery[])
                    .map((item) => ({
                        id: item.id.toString(),
                        nfNumber: item.nf_number,
                        client: (item.client_name || item.client_name_extracted || 'Cliente Desconhecido').trim(),
                        address: item.delivery_address || 'Endereço Indefinido',
                        volume: item.delivery_volume ?? 1,
                        value: Number(item.merchandise_value || 0),
                        status: item.has_receipt || item.status === 'DELIVERED'
                            ? 'REALIZADA'
                            : item.status === 'IN_TRANSIT' || item.status === 'ASSIGNED'
                            ? 'EM_ANDAMENTO'
                            : item.status === 'PENDING'
                            ? 'PENDENTE'
                            : 'PROBLEMA',
                        originalApiStatus: item.status,
                        hasReceipt: Boolean(item.has_receipt),
                        createdAt: item.created_at,
                        receiptImageUrl: item.receipt_image_url || item.image_url || null,
                        driverId: item.driver_id !== undefined && item.driver_id !== null ? item.driver_id.toString() : undefined
                    }))
                    .sort((a, b) => {
                        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return dateA - dateB;
                    });

                setDeliveries(deliveriesData as Delivery[]);

            } else {
                setDeliveries([]); 
                if (!response.success) {
                    toast({
                        title: 'Erro ao carregar entregas',
                        description: (response as any).error || 'Nenhuma entrega encontrada para o dia.',
                        variant: 'destructive'
                    });
                }
            }

        } catch (error) {
            setDeliveries([]);
            toast({
                title: 'Erro de Conexão',
                description: 'Não foi possível buscar as entregas. Verifique se o serviço está rodando.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    }, [resolveDriverId, toast]);

    // Detecta fase automaticamente baseado no status das entregas
    useEffect(() => {
        const hasInTransitDeliveries = deliveries.some(d => d.status === 'EM_ANDAMENTO');
        if (hasInTransitDeliveries) {
            setPhase('ON_ROUTE');
        } else {
            setPhase('LOADING');
        }
    }, [deliveries]);

    useEffect(() => {
        const driverId = resolveDriverId();
        if (driverId) {
            loadTodayDeliveries();
        }
    }, [resolveDriverId, loadTodayDeliveries]);

    useEffect(() => {
        if (!routeStarted) {
            stopLocationTracking();
        }
    }, [routeStarted, stopLocationTracking]);

    useEffect(() => {
        return () => {
            stopLocationTracking();
        };
    }, [stopLocationTracking]);

    useEffect(() => {
        if (routeStarted) {
            requestWakeLock();
            return;
        }

        releaseWakeLock();
    }, [routeStarted, requestWakeLock, releaseWakeLock]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && routeStarted) {
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            releaseWakeLock();
        };
    }, [routeStarted, requestWakeLock, releaseWakeLock]);

    const handleStartDay = () => {
        setDayStarted(true);
        toast({
            title: "Dia iniciado!",
            description: "Você pode agora fotografar os canhotos e iniciar sua rota",
        });
        // Auto-inicia tracking GPS junto com "Iniciar Dia" — sem isso o motorista
        // operava o dia todo sem aparecer no painel de rastreamento (visto em prod
        // 03/06/2026: Rafael, João, Diego fizeram entregas mas nunca abriram sessão
        // de tracking porque pulavam a etapa "Iniciar Rota" ou caíam no return
        // silencioso de startRoute quando entregas ainda não estavam ASSIGNED).
        if (!hasLocationConsent) {
            setShowConsentDialog(true);
            return;
        }
        if (!routeStarted) {
            setRouteStarted(true);
            void startLocationTracking().then((ok) => {
                if (!ok) setRouteStarted(false);
            });
        }
    };

    const handleStartRoute = () => {
        if (!hasLocationConsent) {
            setShowConsentDialog(true);
            return;
        }
        void startRoute();
    };

    const handleFinishRoute = async () => {
        if (!routeStarted) {
            return;
        }

        const driverId = resolveDriverId();
        const sessionId = trackingSessionId;
        setLocationActive(false);

        if (lastKnownPosition) {
            await sendLocationUpdate(lastKnownPosition);
        }

        if (driverId && sessionId) {
            const response = await apiService.finishDriverTracking(driverId, sessionId);
            if (!response.success) {
                toast({
                    title: 'Erro ao finalizar rastreamento',
                    description: response.error,
                    variant: 'destructive'
                });
            }
        }
        setRouteStarted(false);
        stopLocationTracking();
        await updateDriverStatus('offline');
        toast({
            title: 'Rota finalizada!',
            description: 'Parabéns! Sua rota foi concluída com sucesso.'
        });
    };

    const handleEnableLocation = async () => {
        if (!routeStarted) {
            toast({
                title: 'Rota não iniciada',
                description: 'Inicie a sua rota para compartilhar a localização.',
                variant: 'destructive'
            });
            return;
        }
        if (!hasLocationConsent) {
            setShowConsentDialog(true);
            return;
        }

        const trackingStarted = await startLocationTracking();
        if (trackingStarted) {
            updateDriverStatus('online');
        }
    };

const handleDisableLocation = () => {
        if (!locationActive && !requestingLocation) {
            return;
        }
        toast({
            title: 'Finalize a rota para desligar',
            description: 'O rastreamento permanece ativo durante a rota e desliga no botão Finalizar Rota.'
        });
    };

    const handleConsentAccept = () => {
        setHasLocationConsent(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem('driver_location_consent', 'true');
        }
        setShowConsentDialog(false);
        // Dispara tracking imediato após consentimento — antes precisava clicar
        // "Iniciar Rota" depois, e se 0 entregas ASSIGNED esse botão abortava
        // silenciosamente sem ativar GPS.
        if (!routeStarted) {
            setRouteStarted(true);
            void startLocationTracking().then((ok) => {
                if (!ok) setRouteStarted(false);
            });
        }
    };

    const handleConsentDecline = () => {
        setHasLocationConsent(false);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('driver_location_consent');
        }
        setShowConsentDialog(false);
        toast({
            title: 'Consentimento necessário',
            description: 'Para iniciar a rota é preciso autorizar o uso da localização apenas durante o trajeto.',
            variant: 'destructive'
        });
    };

    const confirmDeliveryLoading = useCallback(async (deliveryId: string) => {
        try {
            const response = await apiService.confirmDeliveryLoading(deliveryId);
            if (response.success) {
                toast({
                    title: 'Carga confirmada!',
                    description: 'A entrega foi confirmada como carregada.'
                });
                await loadTodayDeliveries();
            } else {
                throw new Error((response as any).error || 'Erro ao confirmar carga');
            }
        } catch (error: any) {
            toast({
                title: 'Erro',
                description: error.message || 'Não foi possível confirmar a carga.',
                variant: 'destructive'
            });
        }
    }, [toast, loadTodayDeliveries]);

    const startRoute = useCallback(async () => {
        try {
            // Coleta IDs das entregas carregadas (ASSIGNED na API)
            const assignedDeliveryIds = deliveries
                .filter(d => d.originalApiStatus === 'ASSIGNED')
                .map(d => d.id);

            // Garante tracking ATIVO mesmo sem entregas ASSIGNED — antes o return
            // silencioso aqui deixava o motorista sem GPS o dia inteiro.
            if (!routeStarted) {
                setRouteStarted(true);
                const trackingStarted = await startLocationTracking();
                if (!trackingStarted) {
                    setRouteStarted(false);
                    return;
                }
            }

            if (assignedDeliveryIds.length === 0) {
                toast({
                    title: 'Rastreamento ativo',
                    description: 'GPS ligado. Carregue as entregas para começar a rota.',
                });
                setPhase('ON_ROUTE');
                return;
            }

            const response = await apiService.startRoute(assignedDeliveryIds);
            if (response.success) {
                toast({
                    title: 'Rota iniciada!',
                    description: 'Boa viagem! Lembre-se de fotografar os comprovantes.'
                });
                setPhase('ON_ROUTE');
            } else {
                throw new Error((response as any).error || 'Erro ao marcar entregas em trânsito');
            }
        } catch (error: any) {
            toast({
                title: 'Erro ao iniciar rota',
                description: error.message || 'Não foi possível iniciar a rota. Tente novamente.',
                variant: 'destructive'
            });
        }
    }, [deliveries, routeStarted, toast, startLocationTracking]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'REALIZADA': return 'bg-green-500 text-white';
            case 'EM_ANDAMENTO': return 'bg-yellow-500 text-white';
            case 'PROBLEMA': return 'bg-red-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'REALIZADA': return 'Realizada';
            case 'EM_ANDAMENTO': return 'Em Andamento';
            case 'PROBLEMA': return 'Problema';
            default: return 'Pendente';
        }
    };

    // Abre o seletor de arquivo para a câmera
    const handleTakePhotoClick = (delivery: Delivery) => {
        setSelectedDelivery(delivery);
        fileInputRef.current?.click();
    };

    // Chamado quando o motorista tira a foto
    const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCapturedPhoto({ file, dataUrl: e.target?.result as string });
                setShowPhotoConfirmModal(true);
            };
            reader.readAsDataURL(file);
        }
        // Limpa o input para permitir tirar a mesma foto novamente se necessário
        event.target.value = '';
    };

    // Advance from photo step to notes step
    const handlePhotoStepNext = () => {
        if (!capturedPhoto) return;
        setFinalizeStep(2);
    };

    // Chamado quando o motorista confirma foto + notas e finaliza
    const handleConfirmPhoto = async () => {
        if (!capturedPhoto || !selectedDelivery) return;

        const driverId = resolveDriverId();
        if (!driverId) {
            toast({ title: "Erro", description: "Não foi possível identificar o motorista.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        try {
            let ocrData: Record<string, any> | undefined;
            if (ocrResult) {
                ocrData = {
                    cnpj: editOcrCnpj,
                    clientName: editOcrClient,
                    nfNumber: editOcrNf,
                    rawText: ocrResult.rawText,
                    confidence: ocrResult.confidence,
                };
            }

            // Build notes: driver notes + OCR summary
            const notesParts: string[] = [];
            if (finalizeNotes.trim()) notesParts.push(finalizeNotes.trim());
            if (ocrData) notesParts.push(`OCR: CNPJ=${editOcrCnpj} NF=${editOcrNf} Cliente=${editOcrClient}`);
            const combinedNotes = notesParts.join(' | ') || undefined;

            const response = await apiService.attachReceipt(
                selectedDelivery.id,
                driverId,
                capturedPhoto.file,
                { notes: combinedNotes }
            );
            if (response.success) {
                if (ocrData && response.data?.id) {
                    await apiService.processReceiptOCR(response.data.id, ocrData);
                }

                toast({ title: "Entrega finalizada!", description: "Canhoto enviado. O cliente já pode visualizar na plataforma." });
                setDeliveries(prevDeliveries =>
                    prevDeliveries.map(d =>
                        d.id === selectedDelivery.id
                            ? { ...d, status: 'REALIZADA', hasReceipt: true, receiptImageUrl: response.data?.url || response.data?.publicUrl || null }
                            : d
                    )
                );
                setShowPhotoConfirmModal(false);
                setCapturedPhoto(null);
                setOcrResult(null);
                setEditOcrCnpj('');
                setEditOcrClient('');
                setEditOcrNf('');
                setFinalizeStep(1);
                setFinalizeNotes('');
            } else {
                throw new Error((response as any).message || 'Erro desconhecido');
            }
        } catch (error: any) {
            toast({
                title: "Erro ao enviar",
                description: error.message || "Não foi possível enviar o comprovante. Verifique sua conexão.",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
        }
    };

    // Process OCR on captured canhoto photo
    const handleOcrOnPhoto = async () => {
        if (!capturedPhoto) return;
        setOcrProcessing(true);
        setOcrProgress(0);
        setOcrStatus('Iniciando...');
        try {
            const result = await processImageOCR(capturedPhoto.file, (progress, status) => {
                setOcrProgress(progress);
                setOcrStatus(status);
            });
            setOcrResult(result);
            setEditOcrCnpj(result.cnpj);
            setEditOcrClient(result.clientName);
            setEditOcrNf(result.nfNumber);
            const fieldsFound = [result.cnpj, result.clientName, result.nfNumber].filter(Boolean).length;
            toast({
                title: 'OCR concluído',
                description: fieldsFound > 0
                    ? `${fieldsFound} campo(s) identificado(s)`
                    : 'Nenhum dado encontrado automaticamente.',
            });
        } catch (err) {
            toast({ title: 'Erro no OCR', description: 'Tente novamente', variant: 'destructive' });
        } finally {
            setOcrProcessing(false);
        }
    };

    const handleUploadButtonClick = (delivery: Delivery) => {
        setSelectedDelivery(delivery);
        setShowDeliveryUpload(true);
    };

    const handleOpenOccurrence = (delivery: Delivery) => {
        if (!resolveDriverId()) {
            toast({
                title: 'Motorista não vinculado',
                description: 'Seu acesso ainda não está ligado ao cadastro operacional. Avise o administrador antes de sair em rota.',
                variant: 'destructive',
            });
            return;
        }
        setOccurrenceDelivery(delivery);
        setOccurrenceType('reentrega');
        setOccurrenceDescription('');
        setOccurrencePhoto(null);
        setShowOccurrenceModal(true);
    };

    const handleOccurrencePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!OCCURRENCE_PHOTO_ALLOWED_TYPES.has(file.type)) {
                toast({
                    title: 'Foto inválida',
                    description: 'Envie uma imagem JPG, PNG ou WEBP.',
                    variant: 'destructive',
                });
                event.target.value = '';
                return;
            }

            if (file.size > OCCURRENCE_PHOTO_MAX_SIZE) {
                toast({
                    title: 'Foto muito grande',
                    description: 'A foto da ocorrência deve ter no máximo 5 MB.',
                    variant: 'destructive',
                });
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                setOccurrencePhoto({ file, dataUrl: e.target?.result as string });
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    };

    const handleReportOccurrence = async () => {
        if (!occurrenceDelivery || !occurrenceDescription.trim()) {
            toast({
                title: 'Observação obrigatória',
                description: 'Descreva o que impediu a entrega.',
                variant: 'destructive',
            });
            return;
        }

        if (!resolveDriverId()) {
            toast({
                title: 'Motorista não vinculado',
                description: 'Seu acesso ainda não está ligado ao cadastro operacional. Avise o administrador antes de registrar ocorrências.',
                variant: 'destructive',
            });
            return;
        }

        setReportingOccurrence(true);
        try {
            const response = await apiService.createOccurrence(occurrenceDelivery.id, {
                type: occurrenceType,
                description: occurrenceDescription.trim(),
                latitude: lastKnownPosition?.latitude,
                longitude: lastKnownPosition?.longitude,
                photo: occurrencePhoto?.file,
            });

            if (!response.success) {
                throw new Error(response.error || 'Não foi possível registrar a ocorrência.');
            }

            const nextDate = (response.data as any)?.next_scheduled_date;
            toast({
                title: 'Ocorrência registrada',
                description: nextDate
                    ? `Entrega reagendada para ${new Date(`${nextDate}T00:00:00`).toLocaleDateString('pt-BR')}.`
                    : 'A ocorrência foi enviada para a operação.',
            });

            setDeliveries(prev =>
                prev.map(delivery =>
                    delivery.id === occurrenceDelivery.id
                        ? { ...delivery, status: 'PROBLEMA' }
                        : delivery
                )
            );
            setShowOccurrenceModal(false);
            setOccurrenceDelivery(null);
            setOccurrenceDescription('');
            setOccurrencePhoto(null);
        } catch (error: any) {
            toast({
                title: 'Erro ao reportar',
                description: error.message || 'Tente novamente em instantes.',
                variant: 'destructive',
            });
        } finally {
            setReportingOccurrence(false);
        }
    };

    const getInitialDataForUpload = () => {
        if (!selectedDelivery) return undefined;
        return {
            summary: {
                nfNumber: selectedDelivery.nfNumber,
                clientName: selectedDelivery.client,
                deliveryAddress: selectedDelivery.address,
                merchandiseValue: selectedDelivery.value.toString(),
                volume: selectedDelivery.volume.toString(),
            },
        };
    };

    // Função para buscar e exibir o canhoto de forma segura
    const handleViewReceipt = async (receiptUrl: string) => {
        if (!receiptUrl) return;

        setReceiptLoading(true);
        setShowReceiptModal(true);
        setReceiptImage(null);

        try {
            const imageUrl = await apiService.getSecureFile(receiptUrl);
            if (imageUrl) {
                setReceiptImage(imageUrl);
            } else {
                throw new Error("Não foi possível carregar a imagem do canhoto.");
            }
        } catch (error: any) {
            toast({
                title: "Erro ao carregar canhoto",
                description: error.message || "Ocorreu um problema ao buscar a imagem.",
                variant: "destructive",
            });
            setShowReceiptModal(false);
        } finally {
            setReceiptLoading(false);
        }
    };

    // Limpa a imagem do blob quando o modal é fechado para liberar memória
    useEffect(() => {
        if (!showReceiptModal && receiptImage && receiptImage.startsWith('blob:')) {
            URL.revokeObjectURL(receiptImage);
        }
    }, [showReceiptModal]);

    const handleOpenDelete = (delivery: Delivery) => {
        setDeliveryToDelete(delivery);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!deliveryToDelete) return;
        setDeletingDelivery(true);
        try {
            const response = await apiService.deleteDelivery(deliveryToDelete.id);
            if (response.success) {
                setDeliveries(prev => prev.filter(d => d.id !== deliveryToDelete.id));
                toast({ title: 'Entrega excluída', description: `NF ${deliveryToDelete.nfNumber} removida.` });
                setShowDeleteModal(false);
                setDeliveryToDelete(null);
            } else {
                toast({ title: 'Erro ao excluir', description: (response as any).error, variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Erro', description: err.message || 'Não foi possível excluir.', variant: 'destructive' });
        } finally {
            setDeletingDelivery(false);
        }
    };

    return (
        <main className="container mx-auto px-4 py-6 space-y-6 max-w-md lg:max-w-4xl">
            {/* Input de arquivo oculto para a câmera */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handlePhotoCapture}
                style={{ display: 'none' }}
            />
            <Card className={`border-2 ${dayStarted ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
                <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${dayStarted ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                            <span className="font-medium">
                                {dayStarted ? 'Dia Iniciado' : 'Aguardando Início do Dia'}
                            </span>
                        </div>

                        {/* Indicador de GPS — torna óbvio pro motorista se está enviando localização */}
                        {dayStarted && (
                            <div className={`flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-full inline-flex mx-auto ${
                                locationActive
                                    ? 'bg-green-100 text-green-800 border border-green-300'
                                    : requestingLocation
                                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                        : 'bg-orange-100 text-orange-800 border border-orange-300'
                            }`}>
                                <MapPin className="h-3 w-3" />
                                <span className="font-medium">
                                    {locationActive ? 'GPS ativo' : requestingLocation ? 'Conectando GPS...' : 'GPS pausado'}
                                </span>
                            </div>
                        )}

                        {!dayStarted ? (
                            <Button onClick={handleStartDay} className="bg-blue-600 hover:bg-blue-700 w-full" size="lg">
                                <Play className="mr-2 h-5 w-5" />
                                Iniciar Dia
                            </Button>
                        ) : !routeStarted ? (
                            <Button onClick={handleStartRoute} className="bg-green-600 hover:bg-green-700 w-full" size="lg">
                                <Route className="mr-2 h-5 w-5" />
                                Iniciar Rota
                            </Button>
                        ) : (
                            <Button onClick={handleFinishRoute} variant="destructive" className="w-full" size="lg">
                                <Square className="mr-2 h-5 w-5" />
                                Finalizar Rota
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-3 text-sm text-blue-950">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                        <div className="space-y-1">
                            <p className="font-semibold">Modo entrega pelo navegador</p>
                            <p>
                                Mantenha esta tela aberta e ligada durante a rota. No navegador, o rastreamento pode pausar se o celular bloquear a tela ou se o app ficar em segundo plano.
                            </p>
                            {routeStarted && (
                                <p className="text-xs text-blue-800">
                                    {screenAwake
                                        ? 'Protecao de tela ativa enquanto a rota estiver em andamento.'
                                        : wakeLockUnavailable
                                            ? 'Nao foi possivel manter a tela ligada automaticamente neste navegador. Ajuste o tempo de bloqueio do celular.'
                                            : 'Tentando manter a tela ligada enquanto a rota estiver ativa.'}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {phase === 'LOADING' ? (
                // FASE LOADING: Carregamento do dia
                <Card className="border-2 border-blue-500 bg-blue-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Carregamento do Dia
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {deliveries.filter(d => d.status === 'PENDENTE').length}
                                </div>
                                <p className="text-xs text-gray-600">NFs Pré-atribuídas</p>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                    {deliveries.filter(d => d.originalApiStatus === 'ASSIGNED').length}
                                </div>
                                <p className="text-xs text-gray-600">NFs Carregadas</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                // FASE ON_ROUTE: Rota em andamento
                <div className="grid grid-cols-2 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <Package className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                                <div className="text-2xl font-bold">{deliveries.length}</div>
                                <p className="text-sm text-gray-500">Total Entregas</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                                <div className="text-2xl font-bold">
                                    {deliveries.filter(d => d.status === 'REALIZADA').length}
                                </div>
                                <p className="text-sm text-gray-500">Concluídas</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        {phase === 'LOADING' ? 'Preparar Entrega' : 'Ações Rápidas'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                    {phase === 'LOADING' ? (
                        <Button
                            variant="outline"
                            className="justify-start h-12"
                            onClick={() => setShowAddDelivery(true)}
                        >
                            <Plus className="mr-3 h-4 w-4" />
                            <div className="text-left">
                                <div className="font-medium">+ Adicionar NF</div>
                                <div className="text-xs text-gray-500">Adicione novas entregas</div>
                            </div>
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            className="justify-start h-12"
                            onClick={() => { setSelectedDelivery(null); setShowDeliveryUpload(true); }}
                        >
                            <Upload className="mr-3 h-4 w-4" />
                            <div className="text-left">
                                <div className="font-medium">Cadastrar Entrega Manual</div>
                                <div className="text-xs text-gray-500">Usar documento SEFAZ</div>
                            </div>
                        </Button>
                    )}

                    {routeStarted && (
                        <div className="pl-12 mt-2 text-xs text-gray-500">
                            {requestingLocation
                                ? 'Aguardando confirmação da localização...'
                                : locationActive
                                    ? lastKnownPosition
                                        ? `Última atualização às ${new Date(lastKnownPosition.recordedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (lat ${lastKnownPosition.latitude.toFixed(5)}, lon ${lastKnownPosition.longitude.toFixed(5)}, precisão ±${Math.round(lastKnownPosition.accuracy ?? 0)}m)`
                                        : 'Localização ativa. Aguardando primeira atualização...'
                                    : 'Localização desligada no momento.'}
                        </div>
                    )}
                </CardContent>
            </Card>

            {phase === 'LOADING' ? (
                // FASE LOADING: Seções de Carregamento
                <>
                    {/* Seção 1: NFs Pré-atribuídas (PENDENTE) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                NFs Pré-atribuídas ({deliveries.filter(d => d.status === 'PENDENTE').length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {deliveries.filter(d => d.status === 'PENDENTE').length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-500">Nenhuma NF pré-atribuída</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {deliveries.filter(d => d.status === 'PENDENTE').map((delivery) => (
                                        <Card key={delivery.id} className="border-l-4 border-l-yellow-500">
                                            <CardContent className="pt-3">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <p className="font-medium">NF {delivery.nfNumber}</p>
                                                        <p className="text-sm text-gray-500">{delivery.client}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm mb-3">
                                                    <MapPin className="h-4 w-4 text-gray-500" />
                                                    <span className="text-gray-500">{delivery.address}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => confirmDeliveryLoading(delivery.id)}
                                                        className="flex-1"
                                                    >
                                                        <CheckCircle className="mr-2 h-4 w-4" />
                                                        Confirmar Carga
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleOpenDelete(delivery)}
                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Seção 2: NFs Carregadas (REALIZADA para exibição de carregadas) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                NFs Carregadas ({deliveries.filter(d => d.originalApiStatus === 'ASSIGNED').length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {deliveries.filter(d => d.originalApiStatus === 'ASSIGNED').length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-500">Nenhuma NF carregada ainda</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {deliveries.filter(d => d.originalApiStatus === 'ASSIGNED').map((delivery) => (
                                        <Card key={delivery.id} className="border-l-4 border-l-green-500 bg-green-50">
                                            <CardContent className="pt-3">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="font-medium">NF {delivery.nfNumber}</p>
                                                        <p className="text-sm text-gray-500">{delivery.client}</p>
                                                    </div>
                                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Botão Iniciar Rota */}
                    <Button
                        onClick={startRoute}
                        className="bg-green-600 hover:bg-green-700 w-full h-14 text-lg font-semibold"
                        disabled={deliveries.filter(d => d.originalApiStatus === 'ASSIGNED').length === 0}
                    >
                        <Route className="mr-2 h-5 w-5" />
                        Iniciar Rota ({deliveries.filter(d => d.originalApiStatus === 'ASSIGNED').length} NFs)
                    </Button>
                </>
            ) : (
                // FASE ON_ROUTE: Lista de Entregas Normal
                <Card>
                    <CardHeader>
                        <CardTitle>Minhas Entregas - Hoje</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {deliveries.length === 0 ? (
                            <div className="text-center py-8">
                                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-500">Nenhuma entrega programada para hoje</p>
                            </div>
                        ) : (
                            <div className="space-y-4">

                            {deliveries.map((delivery) => (

                                <Card key={delivery.id} className="border" data-testid="entrega-pendente">
                                    <CardContent className="pt-4">

                                        {/* Bloco de NF, Nome e Status */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-medium">NF {delivery.nfNumber}</p>
                                                <p className="text-sm text-gray-500">{delivery.client}</p>
                                            </div>
                                            <Badge className={getStatusColor(delivery.status)}>
                                                {getStatusText(delivery.status)}
                                            </Badge>
                                        </div>

                                        {/* Bloco de ENDEREÇO */}
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-gray-500" />
                                                <span className="text-gray-500">{delivery.address}</span>
                                            </div>

                                            {/* VALOR E VOLUME REMOVIDOS DE PROPÓSITO */}

                                        </div>

                                        {/* Bloco de AÇÕES (Botões) */}
                                        <div className="mt-4 space-y-2">
                                            <div className="flex gap-2 flex-wrap">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleViewDetails(delivery)}
                                                >
                                                    Ver Detalhes
                                                </Button>

                                                {!delivery.hasReceipt && delivery.originalApiStatus !== 'DELIVERED' && delivery.originalApiStatus !== 'FAILED' && (
                                                    <Button size="sm" onClick={() => handleTakePhotoClick(delivery)}>
                                                        <Camera className="mr-1 h-4 w-4" />
                                                        Finalizar Entrega
                                                    </Button>
                                                )}
                                                {!delivery.hasReceipt && delivery.originalApiStatus !== 'DELIVERED' && delivery.originalApiStatus !== 'FAILED' && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleOpenOccurrence(delivery)}
                                                        data-testid="report-occurrence"
                                                    >
                                                        <AlertTriangle className="mr-1 h-4 w-4" />
                                                        Ocorrência
                                                    </Button>
                                                )}
                                                {!delivery.hasReceipt && delivery.originalApiStatus !== 'DELIVERED' && delivery.originalApiStatus !== 'FAILED' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleOpenDelete(delivery)}
                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>

                                            {delivery.hasReceipt && delivery.receiptImageUrl && (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <button
                                                        onClick={() => handleViewReceipt(delivery.receiptImageUrl!)}
                                                        className="text-sm font-medium text-blue-600 hover:underline disabled:text-gray-400"
                                                        disabled={receiptLoading}
                                                    >
                                                        Ver Canhoto
                                                    </button>
                                                </div>
                                            )}
                                            {delivery.hasReceipt && !delivery.receiptImageUrl && (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span className="text-sm">Entrega Finalizada</span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
                            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{deliveryDetails ? `Detalhes NF ${deliveryDetails.nfNumber}` : 'Carregando Detalhes...'}</DialogTitle>
                                    <DialogDescription>
                                        {deliveryDetails ? 'Informações completas da entrega.' : 'Aguarde o carregamento.'}
                                    </DialogDescription>
                                </DialogHeader>
                                
                                {detailsLoading && (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500">Carregando dados...</p>
                                    </div>
                                )}

                                {deliveryDetails && (
                                    <div className="space-y-4 text-sm">
                                        {/* Seção de Status e Atribuição */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Dados Gerais da Nota</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Status</span> <Badge className="w-fit mt-1">{deliveryDetails.status}</Badge></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Motorista</span> <span>{deliveryDetails.driver_name || 'N/A'}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Data Emissão</span> <span>{deliveryDetails.nf_data?.data_emissao ? new Date(deliveryDetails.nf_data.data_emissao).toLocaleDateString('pt-BR') : (deliveryDetails.emission_date ? new Date(deliveryDetails.emission_date).toLocaleDateString('pt-BR') : 'N/A')}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Data Saída</span> <span>{deliveryDetails.nf_data?.data_saida ? new Date(deliveryDetails.nf_data.data_saida).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                                                <div className="flex flex-col sm:col-span-2"><span className="font-medium text-gray-500 text-xs">Chave de Acesso</span> <code className="text-xs break-all">{deliveryDetails.nf_data?.chave_acesso || deliveryDetails.nf_data?.chave || 'N/A'}</code></div>
                                                <div className="flex flex-col sm:col-span-2"><span className="font-medium text-gray-500 text-xs">Protocolo</span> <code className="text-xs">{deliveryDetails.nf_data?.protocolo_autorizacao || 'N/A'}</code></div>
                                            </div>
                                        </div>

                                        {/* Seção do Destinatário */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Destinatário</h3>
                                            <div className="space-y-1">
                                                <p className="font-bold">{deliveryDetails.destinatario?.razao_social || deliveryDetails.clientName}</p>
                                                <p className="text-gray-600">{deliveryDetails.destinatario?.endereco || deliveryDetails.deliveryAddress}</p>
                                                <p className="text-gray-600">{deliveryDetails.destinatario?.municipio} - {deliveryDetails.destinatario?.uf}, CEP: {deliveryDetails.destinatario?.cep}</p>
                                                <p className="text-gray-600">CNPJ: {deliveryDetails.destinatario?.cnpj_cpf || deliveryDetails.clientCnpj}</p>
                                            </div>
                                        </div>

                                        {/* Seção do Remetente */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Remetente</h3>
                                            <div className="space-y-1">
                                                <p className="font-bold">{deliveryDetails.remetente?.razao_social || 'N/A'}</p>
                                                <p className="text-gray-600">CNPJ: {deliveryDetails.remetente?.cnpj_cpf || 'N/A'}</p>
                                            </div>
                                        </div>

                                        {/* Seção de Valores */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Valores</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Total da Nota</span> <span>R$ {Number(deliveryDetails.valores?.valor_total_nota || deliveryDetails.merchandise_value || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Total Produtos</span> <span>R$ {Number(deliveryDetails.valores?.valor_total_produtos || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Frete</span> <span>R$ {Number(deliveryDetails.valores?.valor_frete || 0).toFixed(2)}</span></div>
                                            </div>
                                        </div>

                                        {/* Seção de Impostos */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Impostos</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Base Cálculo ICMS</span> <span>R$ {Number(deliveryDetails.impostos?.base_calculo_icms || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Valor ICMS</span> <span>R$ {Number(deliveryDetails.impostos?.valor_icms || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Valor IPI</span> <span>R$ {Number(deliveryDetails.impostos?.valor_ipi || 0).toFixed(2)}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Total Tributos</span> <span>R$ {Number(deliveryDetails.impostos?.valor_total_tributos || 0).toFixed(2)}</span></div>
                                            </div>
                                        </div>

                                        {/* Seção de Volumes */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Volumes</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Quantidade</span> <span>{deliveryDetails.volumes?.quantidade || deliveryDetails.delivery_volume || 'N/A'}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Espécie</span> <span>{deliveryDetails.volumes?.especie || 'N/A'}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Peso Bruto</span> <span>{deliveryDetails.volumes?.peso_bruto || 'N/A'}</span></div>
                                                <div className="flex flex-col"><span className="font-medium text-gray-500 text-xs">Peso Líquido</span> <span>{deliveryDetails.volumes?.peso_liquido || 'N/A'}</span></div>
                                            </div>
                                        </div>

                                        {/* Seção de Itens da Nota */}
                                        {deliveryDetails.itens_de_linha && deliveryDetails.itens_de_linha.length > 0 && (
                                            <div className="p-3 bg-gray-50 rounded-md border">
                                                <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Itens da Nota</h3>
                                                <ul className="space-y-2">
                                                    {deliveryDetails.itens_de_linha.map((item: any, index: number) => (
                                                        <li key={index}>
                                                            <div className="flex justify-between">
                                                                <span className="pr-2">{item.quantity || 'N/A'}x {item.description || 'Item sem descrição'}</span>
                                                                <span className="font-medium">R$ {Number(item.total_price || 0).toFixed(2)}</span>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Seção de Faturas (Duplicatas) */}
                                        {deliveryDetails.duplicatas && deliveryDetails.duplicatas.length > 0 && (
                                            <div className="p-3 bg-gray-50 rounded-md border">
                                                <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Faturas</h3>
                                                <ul className="space-y-2">
                                                    {deliveryDetails.duplicatas.map((dup: any, index: number) => (
                                                        <li key={index}>
                                                            <div className="flex justify-between">
                                                                <span>Parcela {dup.installment_number || String(index + 1).padStart(3, '0')}</span>
                                                                <div className="text-right">
                                                                    <span className="font-medium">R$ {Number(dup.amount || 0).toFixed(2)}</span>
                                                                    <span className="ml-2 text-gray-500 text-xs">Venc: {dup.due_date ? new Date(dup.due_date).toLocaleDateString('pt-BR') : 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Seção de Observações */}
                                        <div className="p-3 bg-gray-50 rounded-md border">
                                            <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Informações Complementares</h3>
                                            <p className="text-gray-600 whitespace-pre-wrap">{deliveryDetails.informacoes_complementares || 'Nenhuma.'}</p>
                                        </div>
                                        
                                        {/* Seção do Canhoto Anexado */}
                                        {deliveryDetails.receipt_image_url && (
                                            <div className="p-3 bg-gray-50 rounded-md border">
                                                <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Canhoto</h3>
                                                <a href={deliveryDetails.receipt_image_url} target="_blank" rel="noopener noreferrer">
                                                    <img src={deliveryDetails.receipt_image_url} alt="Prévia do canhoto" className="rounded-md w-full h-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" />
                                                </a>
                                                <p className="text-xs text-center text-gray-500 mt-2">Clique para ampliar</p>
                                                {deliveryDetails.receipt_notes && (
                                                    <p className="text-xs text-gray-600 mt-2 bg-white border rounded p-2">{deliveryDetails.receipt_notes}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* NF-e Source Document */}
                                        {deliveryDetails.source_document_url && (
                                            <div className="p-3 bg-gray-50 rounded-md border">
                                                <h3 className="font-semibold text-gray-800 border-b pb-2 mb-2">Documento NF-e</h3>
                                                <a
                                                    href={deliveryDetails.source_document_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                    Ver NF-e original
                                                </a>
                                            </div>
                                        )}
                                        
                                    </div>
                                )}
                                
                                <DialogFooter>
                                    <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>Fechar</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        </div>
                    )}
                </CardContent>
            </Card>
            )}

            <SimpleDeliveryForm
                open={showDeliveryUpload}
                onOpenChange={setShowDeliveryUpload}
                mode="driver"
                onSuccess={() => {
                    loadTodayDeliveries();
                    toast({
                        title: "Entrega cadastrada",
                        description: "A entrega foi cadastrada com sucesso!",
                    });
                }}
            />

            {/* SimpleDeliveryForm para Adicionar NF na Fase LOADING */}
            <SimpleDeliveryForm
                open={showAddDelivery}
                onOpenChange={setShowAddDelivery}
                mode="driver"
                onSuccess={() => {
                    setShowAddDelivery(false);
                    loadTodayDeliveries();
                    toast({
                        title: "NF adicionada com sucesso!",
                        description: "A entrega foi adicionada à sua carga.",
                    });
                }}
            />

            {/* Modal para Visualizar o Canhoto */}
            <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Canhoto da Entrega</DialogTitle>
                        <DialogDescription>Visualização do comprovante anexado.</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center items-center min-h-[300px]">
                        {receiptLoading && <p>Carregando imagem...</p>}
                        {receiptImage && (
                            <a href={receiptImage} target="_blank" rel="noopener noreferrer">
                                <img src={receiptImage} alt="Canhoto da entrega" className="max-w-full max-h-[70vh] object-contain rounded-md" />
                            </a>
                        )}
                        {!receiptLoading && !receiptImage && <p className="text-red-500">Não foi possível carregar a imagem.</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setShowReceiptModal(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showOccurrenceModal}
                onOpenChange={(open) => {
                    setShowOccurrenceModal(open);
                    if (!open) setOccurrencePhoto(null);
                }}
            >
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Reportar Problema</DialogTitle>
                        <DialogDescription>
                            NF {occurrenceDelivery?.nfNumber}. A entrega será reagendada automaticamente para o próximo dia.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipo</label>
                            <Select value={occurrenceType} onValueChange={(value: 'reentrega' | 'recusa' | 'avaria') => setOccurrenceType(value)}>
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
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Observação</label>
                            <Textarea
                                name="observacao"
                                data-testid="occurrence-description"
                                value={occurrenceDescription}
                                onChange={(event) => setOccurrenceDescription(event.target.value)}
                                placeholder="Ex: destinatário ausente, estabelecimento fechado, mercadoria recusada..."
                                rows={4}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Foto (opcional)</label>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                ref={occurrencePhotoInputRef}
                                onChange={handleOccurrencePhotoCapture}
                                className="hidden"
                            />
                            {occurrencePhoto ? (
                                <div className="space-y-2">
                                    <img
                                        src={occurrencePhoto.dataUrl}
                                        alt="Prévia da ocorrência"
                                        className="rounded-md max-h-48 w-full object-contain border"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => occurrencePhotoInputRef.current?.click()}
                                            disabled={reportingOccurrence}
                                        >
                                            Tirar outra
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setOccurrencePhoto(null)}
                                            disabled={reportingOccurrence}
                                        >
                                            Remover
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full gap-2"
                                    onClick={() => occurrencePhotoInputRef.current?.click()}
                                    disabled={reportingOccurrence}
                                >
                                    <Camera className="h-4 w-4" />
                                    Adicionar foto da ocorrência
                                </Button>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowOccurrenceModal(false)} disabled={reportingOccurrence}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleReportOccurrence}
                            disabled={reportingOccurrence || !occurrenceDescription.trim()}
                            data-testid="submit-occurrence"
                        >
                            {reportingOccurrence ? 'Enviando...' : 'Registrar e Reagendar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Compartilhamento de localização</DialogTitle>
                        <DialogDescription>
                            Precisamos da sua autorização para coletar a localização apenas enquanto a rota estiver ativa, em conformidade com a LGPD.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm text-muted-foreground">
                                    <p>Com a localização ativa podemos acompanhar o trajeto e oferecer suporte caso surja algum imprevisto.</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>A localização é utilizada somente com a rota iniciada.</li>
                            <li>Você pode desativar o compartilhamento a qualquer momento.</li>
                            <li>Os dados são tratados conforme a Lei Geral de Proteção de Dados (LGPD).</li>
                        </ul>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={handleConsentDecline}>Não concordo</Button>
                        <Button onClick={handleConsentAccept}>Concordo e iniciar rota</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Confirmação da Foto + Notas (2 passos) */}
            <Dialog open={showPhotoConfirmModal} onOpenChange={(open) => {
                if (!open) { setFinalizeStep(1); setFinalizeNotes(''); setOcrResult(null); setEditOcrCnpj(''); setEditOcrClient(''); setEditOcrNf(''); setCapturedPhoto(null); }
                setShowPhotoConfirmModal(open);
            }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {finalizeStep === 1
                                ? `Passo 1/2 — Canhoto NF ${selectedDelivery?.nfNumber}`
                                : `Passo 2/2 — Notas da Entrega`}
                        </DialogTitle>
                        <DialogDescription>
                            {finalizeStep === 1
                                ? 'Verifique a foto e identifique os dados via OCR.'
                                : 'Adicione observações (opcional) e confirme.'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* PASSO 1: Foto + OCR */}
                    {finalizeStep === 1 && (
                        <div className="space-y-3">
                            {capturedPhoto && (
                                <img src={capturedPhoto.dataUrl} alt="Prévia do canhoto" className="rounded-md max-h-60 w-full object-contain" />
                            )}

                            {!ocrResult && !ocrProcessing && (
                                <Button variant="outline" size="sm" onClick={handleOcrOnPhoto} disabled={!capturedPhoto} className="gap-1 w-full">
                                    <Eye className="h-4 w-4" />
                                    Identificar dados via OCR
                                </Button>
                            )}

                            {ocrProcessing && (
                                <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        <span className="text-xs font-medium text-blue-800">{ocrStatus}</span>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-1.5">
                                        <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                                    </div>
                                </div>
                            )}

                            {ocrResult && (
                                <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                                    <p className="text-xs font-medium text-gray-700">Dados identificados (editáveis):</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-500">CNPJ</label>
                                            <input value={editOcrCnpj} onChange={(e) => setEditOcrCnpj(e.target.value)} className="w-full text-sm border rounded px-2 py-1" placeholder="00.000.000/0000-00" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-500">Nº NF-e</label>
                                            <input value={editOcrNf} onChange={(e) => setEditOcrNf(e.target.value)} className="w-full text-sm border rounded px-2 py-1" placeholder="12345" />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs text-gray-500">Cliente</label>
                                            <input value={editOcrClient} onChange={(e) => setEditOcrClient(e.target.value)} className="w-full text-sm border rounded px-2 py-1" placeholder="Nome do cliente" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <DialogFooter className="grid grid-cols-2 gap-2 pt-2">
                                <Button variant="outline" onClick={() => { setShowPhotoConfirmModal(false); }} disabled={isUploading}>
                                    Tirar Outra
                                </Button>
                                <Button onClick={handlePhotoStepNext} disabled={!capturedPhoto || ocrProcessing}>
                                    Próximo
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {/* PASSO 2: Notas */}
                    {finalizeStep === 2 && (
                        <div className="space-y-4">
                            {capturedPhoto && (
                                <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                    <span className="text-xs text-green-700">Foto do canhoto pronta para envio.</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Observações (opcional)</label>
                                <Textarea
                                    value={finalizeNotes}
                                    onChange={(e) => setFinalizeNotes(e.target.value)}
                                    placeholder="Ex: destinatário assinou, produto conferido, entregue ao porteiro..."
                                    rows={4}
                                />
                            </div>

                            <DialogFooter className="grid grid-cols-2 gap-2">
                                <Button variant="outline" onClick={() => setFinalizeStep(1)} disabled={isUploading}>
                                    Voltar
                                </Button>
                                <Button onClick={handleConfirmPhoto} disabled={isUploading}>
                                    {isUploading ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                                    ) : (
                                        <><CheckCircle className="mr-2 h-4 w-4" />Confirmar Entrega</>
                                    )}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal de confirmação de exclusão */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Excluir entrega</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir a NF {deliveryToDelete?.nfNumber} — {deliveryToDelete?.client}? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deletingDelivery}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmDelete} disabled={deletingDelivery}>
                            {deletingDelivery ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</>
                            ) : (
                                <><Trash2 className="mr-2 h-4 w-4" />Excluir</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </main>
    );
};
