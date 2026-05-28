import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { processImageOCR } from '@/services/ocrService';
import {
  FIXED_NFE_EMITENTE_CNPJ,
  FIXED_NFE_TRANSPORTADORA_CNPJ,
} from '@/lib/nfeDefaults';
import {
  Upload,
  Camera,
  FileText,
  CheckCircle,
  Loader2,
  Eye,
  AlertCircle,
  Image as ImageIcon,
  Building2,
  Truck,
  User,
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
}

interface SimpleDeliveryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** If true, show driver selector (admin mode). If false, auto-assign to current driver. */
  allowDriverSelection?: boolean;
  /** Operating mode */
  mode?: 'admin' | 'driver';
}

export const SimpleDeliveryForm: React.FC<SimpleDeliveryFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
  allowDriverSelection = false,
  mode = 'admin',
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [cnpjDestinatario, setCnpjDestinatario] = useState('');
  const [cnpjEmitente, setCnpjEmitente] = useState(FIXED_NFE_EMITENTE_CNPJ);
  const [cnpjTransportadora, setCnpjTransportadora] = useState(FIXED_NFE_TRANSPORTADORA_CNPJ);
  const [clientName, setClientName] = useState('');
  const [nfNumber, setNfNumber] = useState('');
  const [nfDate, setNfDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // File & OCR state
  const [nfImageFile, setNfImageFile] = useState<File | null>(null);
  const [nfImagePreview, setNfImagePreview] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drivers list
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Load drivers
  useEffect(() => {
    if (open && allowDriverSelection) {
      apiService.getDrivers().then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setDrivers(
            (res.data as any[]).map((d) => ({
              id: String(d.id),
              name: d.name || d.full_name || 'Motorista',
            }))
          );
        }
      });
    }
  }, [open, allowDriverSelection]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setCnpjDestinatario('');
    setCnpjEmitente(FIXED_NFE_EMITENTE_CNPJ);
    setCnpjTransportadora(FIXED_NFE_TRANSPORTADORA_CNPJ);
    setClientName('');
    setNfNumber('');
    setNfDate(new Date().toISOString().split('T')[0]);
    setSelectedDriverId('');
    setDeliveryAddress('');
    setNfImageFile(null);
    setNfImagePreview(null);
    setGeminiLoading(false);
    setOcrDone(false);
    setSaving(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Formato de imagem inválido.',
        description: 'Apenas imagens JPG, PNG e WebP são aceitas.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'Máximo 10MB',
        variant: 'destructive',
      });
      return;
    }

    setNfImageFile(file);
    setOcrDone(false);

    const reader = new FileReader();
    reader.onload = (e) => setNfImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  const handleReadNfe = async () => {
    if (!nfImageFile) return;

    setGeminiLoading(true);
    const applyExtractedData = (data: {
      numero_nfe?: string | null;
      cnpj_destinatario?: string | null;
      nome_destinatario?: string | null;
      endereco_destinatario?: string | null;
    }) => {
      if (data.numero_nfe) setNfNumber(data.numero_nfe);
      if (data.cnpj_destinatario) setCnpjDestinatario(data.cnpj_destinatario);
      setCnpjEmitente(FIXED_NFE_EMITENTE_CNPJ);
      setCnpjTransportadora(FIXED_NFE_TRANSPORTADORA_CNPJ);
      if (data.nome_destinatario) setClientName(data.nome_destinatario);
      if (data.endereco_destinatario) setDeliveryAddress(data.endereco_destinatario);
    };

    try {
      const response = await apiService.extractNfeWithGemini(nfImageFile);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Não foi possível ler a NF-e pela IA.');
      }

      const r = response.data;
      applyExtractedData(r);

      setOcrDone(true);

      const filled = [r.numero_nfe, r.cnpj_destinatario, r.nome_destinatario, r.endereco_destinatario].filter(Boolean).length;
      toast({
        title: filled > 0 ? 'NF-e lida com sucesso' : 'Nenhum dado identificado',
        description: filled > 0
          ? 'Verifique e ajuste os campos se necessário.'
          : 'Não foi possível ler a NF-e. Preencha os dados manualmente.',
      });
    } catch (err) {
      const remoteError = err instanceof Error ? err.message : 'Leitura por IA indisponível.';

      try {
        const fallback = await processImageOCR(nfImageFile);

        applyExtractedData({
          numero_nfe: fallback.nfNumber,
          cnpj_destinatario: fallback.cnpj,
          nome_destinatario: fallback.clientName,
          endereco_destinatario: fallback.address,
        });

        setOcrDone(true);

        const filled = [fallback.nfNumber, fallback.cnpj, fallback.clientName, fallback.address].filter(Boolean).length;
        toast({
          title: filled > 0 ? 'NF-e lida com fallback local' : 'Nenhum dado identificado',
          description: filled > 0
            ? `Leitura por IA indisponível; OCR local aplicado. Revise os dados antes de salvar.`
            : `${remoteError} Preencha os dados manualmente.`,
          variant: filled > 0 ? 'default' : 'destructive',
        });
      } catch (fallbackError) {
        toast({
          title: 'Erro na leitura da NF-e',
          description: remoteError,
          variant: 'destructive',
        });
      }
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!nfNumber.trim()) {
      toast({ title: 'Número da NF-e é obrigatório', variant: 'destructive' });
      return;
    }
    if (!clientName.trim()) {
      toast({ title: 'Nome do cliente é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let driverId: string | null = null;
      if (mode === 'driver') {
        driverId = user?.driver_id?.toString() || user?.id?.toString() || null;
      } else if (selectedDriverId) {
        driverId = selectedDriverId;
      }

      const notesParts: string[] = [];
      if (cnpjEmitente) notesParts.push(`Emitente: ${cnpjEmitente}`);
      if (cnpjTransportadora) notesParts.push(`Transportadora: ${cnpjTransportadora}`);

      const payload: Record<string, any> = {
        nf_number: nfNumber.trim(),
        client_name: clientName.trim(),
        client_cnpj: cnpjDestinatario.trim(),
        delivery_address: deliveryAddress.trim() || 'Endereço não informado',
        scheduled_date: nfDate,
        driver_id: driverId,
        notes: notesParts.length > 0 ? notesParts.join(' | ') : undefined,
      };

      if (nfImageFile) {
        payload.file = nfImageFile;
      }

      const response = await apiService.createDelivery(payload);

      if (response.success) {
        toast({
          title: 'Entrega cadastrada!',
          description: `NF-e ${nfNumber} — ${clientName}`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: 'Erro ao cadastrar',
          description: response.error,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Erro inesperado',
        description: 'Não foi possível salvar a entrega',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {mode === 'driver' ? 'Adicionar NF-e' : 'Nova Entrega'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* NF-e Image */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Imagem da NF-e</Label>

            {!nfImageFile ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center space-y-3">
                <ImageIcon className="h-10 w-10 mx-auto text-gray-400" />
                <p className="text-sm text-gray-500">Fotografe ou selecione a imagem da nota fiscal</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Arquivo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    Câmera
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg overflow-hidden border bg-gray-50">
                  <img
                    src={nfImagePreview!}
                    alt="NF-e"
                    className="w-full max-h-48 object-contain"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 truncate max-w-[180px]">
                    {nfImageFile.name}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNfImageFile(null);
                        setNfImagePreview(null);
                        setOcrDone(false);
                      }}
                    >
                      Trocar
                    </Button>
                    {!ocrDone && !geminiLoading && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleReadNfe}
                        className="gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        Ler NF-e
                      </Button>
                    )}
                    {!ocrDone && !geminiLoading && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOcrDone(true)}
                      >
                        Preencher Manual
                      </Button>
                    )}
                  </div>
                </div>

                {geminiLoading && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-xs font-medium text-blue-800">Lendo NF-e com IA...</span>
                  </div>
                )}

                {ocrDone && !geminiLoading && (
                  <div className="flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle className="h-3 w-3" />
                    Dados extraídos — verifique e ajuste abaixo
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NF-e number + date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="nfNumber" className="text-xs">
                Nº NF-e *
              </Label>
              <Input
                id="nfNumber"
                value={nfNumber}
                onChange={(e) => setNfNumber(e.target.value)}
                placeholder="Ex: 316318"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nfDate" className="text-xs">
                Data
              </Label>
              <Input
                id="nfDate"
                type="date"
                value={nfDate}
                onChange={(e) => setNfDate(e.target.value)}
              />
            </div>
          </div>

          {/* CNPJs section */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">CNPJs da Nota</p>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {/* Emitente / Remetente */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex items-center gap-1.5 w-28 shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">Remetente</span>
                </div>
                <Input
                  value={cnpjEmitente}
                  placeholder="00.000.000/0000-00"
                  className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 p-0"
                  disabled
                  readOnly
                />
              </div>

              {/* Destinatário / Cliente */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex items-center gap-1.5 w-28 shrink-0">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">Destinatário</span>
                </div>
                <Input
                  value={cnpjDestinatario}
                  onChange={(e) => setCnpjDestinatario(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 p-0"
                />
              </div>

              {/* Transportadora */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex items-center gap-1.5 w-28 shrink-0">
                  <Truck className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">Transportadora</span>
                </div>
                <Input
                  value={cnpjTransportadora}
                  placeholder="00.000.000/0000-00"
                  className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 p-0"
                  disabled
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Client name */}
          <div className="space-y-1">
            <Label htmlFor="clientName" className="text-xs">
              Nome do Cliente *
            </Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Razão social ou nome"
            />
          </div>

          {/* Address + driver */}
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label htmlFor="address" className="text-xs">
                Endereço de Entrega
              </Label>
              <Input
                id="address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Endereço completo (opcional)"
              />
            </div>

            {allowDriverSelection && (
              <div className="space-y-1">
                <Label htmlFor="driver" className="text-xs">
                  Motorista
                </Label>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem motorista</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving || !nfNumber.trim() || !clientName.trim()}
            className="w-full gap-2 h-11"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Salvar Entrega
              </>
            )}
          </Button>

          {!nfImageFile && (
            <p className="text-xs text-center text-amber-600 flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Você pode salvar sem imagem, mas recomendamos anexar a NF-e
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleDeliveryForm;
