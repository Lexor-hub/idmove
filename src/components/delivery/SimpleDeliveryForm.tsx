import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { processImageOCR } from '@/services/ocrService';
import { useAuth } from '@/contexts/AuthContext';
import {
  Upload,
  Camera,
  FileText,
  CheckCircle,
  Loader2,
  Eye,
  AlertCircle,
  Image as ImageIcon,
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
  const [cnpj, setCnpj] = useState('');
  const [clientName, setClientName] = useState('');
  const [nfNumber, setNfNumber] = useState('');
  const [nfDate, setNfDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // File & OCR state
  const [nfImageFile, setNfImageFile] = useState<File | null>(null);
  const [nfImagePreview, setNfImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
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
    setCnpj('');
    setClientName('');
    setNfNumber('');
    setNfDate(new Date().toISOString().split('T')[0]);
    setSelectedDriverId('');
    setDeliveryAddress('');
    setNfImageFile(null);
    setNfImagePreview(null);
    setProcessing(false);
    setOcrProgress(0);
    setOcrStatus('');
    setOcrDone(false);
    setSaving(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Tipo não suportado',
        description: 'Apenas imagens JPG, PNG, WebP e BMP',
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

    // Reset input so the same file can be selected again
    event.target.value = '';
  };

  const handleProcessOCR = async () => {
    if (!nfImageFile) return;

    setProcessing(true);
    setOcrProgress(0);
    setOcrStatus('Iniciando...');

    try {
      const result = await processImageOCR(nfImageFile, (progress, status) => {
        setOcrProgress(progress);
        setOcrStatus(status);
      });

      // Auto-fill fields if available
      if (result.cnpj) setCnpj(result.cnpj);
      if (result.clientName) setClientName(result.clientName);
      if (result.nfNumber) setNfNumber(result.nfNumber);

      setOcrDone(true);

      const fieldsFound = [result.cnpj, result.clientName, result.nfNumber].filter(Boolean).length;

      if (fieldsFound === 0 && result.confidence === 0) {
        // OCR service unavailable
        toast({
          title: 'OCR indisponível',
          description: 'Preencha os dados manualmente',
          variant: 'default',
        });
      } else if (fieldsFound > 0) {
        toast({
          title: 'OCR concluído com sucesso',
          description: `${fieldsFound} campo(s) identificado(s) — confiança: ${result.confidence.toFixed(0)}%`,
        });
      } else {
        toast({
          title: 'OCR concluído',
          description: 'Nenhum dado identificado automaticamente. Preencha manualmente.',
          variant: 'default',
        });
      }
    } catch (err) {
      console.error('OCR Error:', err);
      toast({
        title: 'Erro ao processar documento',
        description: err instanceof Error ? err.message : 'Tente com uma imagem mais nítida ou preencha manualmente',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
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
      // Determine driver_id
      let driverId: string | null = null;
      if (mode === 'driver') {
        driverId = user?.driver_id?.toString() || user?.id?.toString() || null;
      } else if (selectedDriverId) {
        driverId = selectedDriverId;
      }

      const payload: Record<string, any> = {
        nf_number: nfNumber.trim(),
        client_name: clientName.trim(),
        client_cnpj: cnpj.trim(),
        delivery_address: deliveryAddress.trim() || 'Endereço não informado',
        scheduled_date: nfDate,
        driver_id: driverId,
        notes: cnpj ? `CNPJ: ${cnpj}` : undefined,
      };

      // Attach the NF image file for upload
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
          {/* Step 1: NF-e Image */}
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
                {/* Image preview */}
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
                    {!ocrDone && !processing && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleProcessOCR}
                        className="gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        OCR
                      </Button>
                    )}
                    {!ocrDone && !processing && (
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

                {/* OCR Progress */}
                {processing && (
                  <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-xs font-medium text-blue-800">{ocrStatus}</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* OCR Success indicator */}
                {ocrDone && !processing && (
                  <div className="flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle className="h-3 w-3" />
                    Dados extraídos via OCR — verifique abaixo
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Form Fields */}
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nfNumber" className="text-xs">
                  Nº NF-e *
                </Label>
                <Input
                  id="nfNumber"
                  value={nfNumber}
                  onChange={(e) => setNfNumber(e.target.value)}
                  placeholder="Ex: 12345"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cnpj" className="text-xs">
                  CNPJ
                </Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-3">
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
