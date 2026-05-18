import React, { useEffect, useState, useRef } from 'react';
import { apiService } from '@/services/api';
import { processImageOCR, type NFeExtractedData } from '@/services/ocrService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, Upload, FileText, Eye, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { csvFilenameWithDate, downloadCsv, formatCsvDateTime } from '@/lib/csv';

interface Receipt {
  id: string;
  delivery_id: string;
  driver_id: string;
  filename: string;
  status: string;
  ocr_data?: Record<string, unknown>;
  validated: boolean;
  created_at: string;
  nf_number?: string;
  client_name?: string;
  driver_name?: string;
  image_url?: string;
  receipt_image_url?: string;
}

interface OcrData {
  cnpj: string;
  clientName: string;
  nfNumber: string;
  rawText: string;
  confidence: number;
}

const Deliveries: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === 'CLIENT';
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [uploadDialog, setUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OcrData | null>(null);
  const [showOcrPreview, setShowOcrPreview] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Editable OCR fields
  const [editCnpj, setEditCnpj] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editNfNumber, setEditNfNumber] = useState('');

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    setError(null);
    const filters: Record<string, string> = {};
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    const response = await apiService.getReceipts(filters);
    if (response.success && response.data) {
      setReceipts(response.data as Receipt[]);
    } else {
      setError(response.error || 'Erro ao carregar canhotos');
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReceipts();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      toast({
        title: 'Erro ao acessar câmera',
        description: 'Verifique as permissões do navegador',
        variant: 'destructive'
      });
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `canhoto-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setSelectedFile(file);
            setPreview(canvas.toDataURL('image/jpeg', 0.9));
            setShowCamera(false);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Tipo de arquivo não suportado',
        description: 'Apenas imagens JPG, PNG, WebP e BMP são aceitas para OCR',
        variant: 'destructive'
      });
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo deve ter no máximo 10MB',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    setOcrData(null);
    setShowOcrPreview(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProcessOCR = async () => {
    if (!selectedFile) return;

    setProcessing(true);
    setOcrProgress(0);
    setOcrStatus('Iniciando...');

    try {
      const result = await processImageOCR(selectedFile, (progress, status) => {
        setOcrProgress(progress);
        setOcrStatus(status);
      });

      setOcrData(result);

      // Populate editable fields
      setEditCnpj(result.cnpj);
      setEditClientName(result.clientName);
      setEditNfNumber(result.nfNumber);
      setShowOcrPreview(true);

      const fieldsFound = [result.cnpj, result.clientName, result.nfNumber].filter(Boolean).length;

      toast({
        title: 'OCR processado com sucesso',
        description: fieldsFound > 0
          ? `${fieldsFound} campo(s) identificado(s) — confiança: ${result.confidence.toFixed(0)}%`
          : 'Nenhum dado encontrado automaticamente. Preencha manualmente.',
      });
    } catch (err) {
      console.error('OCR Error:', err);
      toast({
        title: 'Erro ao processar OCR',
        description: 'Tente novamente com uma imagem mais nítida',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveReceipt = async () => {
    if (!selectedFile) return;

    setSaving(true);
    try {
      const finalOcrData = {
        cnpj: editCnpj,
        clientName: editClientName,
        nfNumber: editNfNumber,
        rawText: ocrData?.rawText || '',
        confidence: ocrData?.confidence || 0,
      };

      const response = await apiService.uploadStandaloneReceipt(selectedFile, finalOcrData);

      if (response.success) {
        const data = response.data as any;

        toast({
          title: 'Canhoto salvo com sucesso!',
          description: data.matched_delivery
            ? `Vinculado à entrega NF ${editNfNumber}`
            : editNfNumber
              ? `Salvo como avulso (NF ${editNfNumber} não encontrada no sistema)`
              : 'Salvo sem vínculo a entrega',
        });

        // Reset state
        setUploadDialog(false);
        setSelectedFile(null);
        setPreview(null);
        setOcrData(null);
        setShowOcrPreview(false);
        setEditCnpj('');
        setEditClientName('');
        setEditNfNumber('');

        // Refresh list
        fetchReceipts();
      } else {
        toast({
          title: 'Erro ao salvar canhoto',
          description: response.error,
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: 'Erro inesperado ao enviar arquivo',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseUploadDialog = () => {
    setUploadDialog(false);
    setSelectedFile(null);
    setPreview(null);
    setOcrData(null);
    setShowOcrPreview(false);
    setProcessing(false);
    setOcrProgress(0);
    setOcrStatus('');
    setEditCnpj('');
    setEditClientName('');
    setEditNfNumber('');
    stopCamera();
  };

  const filteredReceipts = receipts.filter(r =>
    (r.filename && r.filename.toLowerCase().includes(search.toLowerCase())) ||
    (r.nf_number && r.nf_number.includes(search)) ||
    (r.client_name && r.client_name.toLowerCase().includes(search.toLowerCase())) ||
    (r.driver_name && r.driver_name.toLowerCase().includes(search.toLowerCase()))
  );

  const PAGE_SIZE = 10;
  const exportToCSV = (data: Receipt[], filename: string) => {
    if (!data.length) return;
    const headers = ['ID Canhoto', 'ID Entrega', 'NF', 'CNPJ', 'Cliente', 'Arquivo', 'Motorista', 'Status', 'Validado', 'Criado em', 'URL Canhoto'];
    const rows = data.map((r) => {
      const ocr = r.ocr_data as Record<string, unknown> | undefined;
      return [
        r.id,
        r.delivery_id || '',
        r.nf_number || ocr?.nf_number || '',
        ocr?.cnpj || '',
        r.client_name || ocr?.client_name || '',
        r.filename || '',
        r.driver_name || '',
        r.status || '',
        r.validated ? 'Sim' : 'Nao',
        formatCsvDateTime(r.created_at),
        r.image_url || r.receipt_image_url || '',
      ];
    });
    downloadCsv(filename, headers, rows);
  };
  const [page, setPage] = useState(1);
  const paginatedReceipts = filteredReceipts.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const getStatusBadge = (status: string, validated: boolean) => {
    if (validated) {
      return <Badge className="bg-green-100 text-green-800">Validado</Badge>;
    }
    switch (status) {
      case 'UPLOADED':
        return <Badge variant="secondary">Enviado</Badge>;
      case 'PROCESSED':
        return <Badge className="bg-blue-100 text-blue-800">Processado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 md:px-6 py-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Canhotos de Entregas</h1>
          {!isReadOnly && (
            <Button onClick={() => setUploadDialog(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Novo Canhoto
            </Button>
          )}
        </div>
        <form onSubmit={handleSearch} className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-2 md:flex-row md:gap-2">
            <Input
              placeholder="Buscar por NF, cliente, arquivo ou motorista"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-h-[44px] text-base"
            />
            <Button type="submit" className="w-full min-h-[44px] text-base md:w-auto">Buscar</Button>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:gap-2">
            <Input
              type="date"
              placeholder="De"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 min-h-[44px] text-base"
            />
            <Input
              type="date"
              placeholder="Até"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 min-h-[44px] text-base"
            />
          </div>
        </form>
      </div>

      {/* Dialog de Upload + OCR */}
      <Dialog open={uploadDialog} onOpenChange={(open) => { if (!open) handleCloseUploadDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Canhoto — Upload + Identificação NF-e</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Step 1: Select file or take photo */}
            {!selectedFile ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="text-center mb-4">
                      <FileText className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Envie uma imagem do canhoto ou NF-e</p>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP ou BMP (máx. 10MB)</p>
                    </div>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Selecionar Arquivo
                    </Button>
                    <div className="text-center text-sm text-gray-500">ou</div>
                    <Button
                      onClick={startCamera}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Tirar Foto da Câmera
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Image preview */}
                {preview && (
                  <div className="max-w-full rounded-lg overflow-hidden border">
                    <img src={preview} alt="Preview do Canhoto" className="w-full max-h-64 object-contain bg-gray-50" />
                  </div>
                )}

                {/* File info */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                      setOcrData(null);
                      setShowOcrPreview(false);
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    Trocar
                  </Button>
                </div>

                {/* OCR Processing */}
                {!showOcrPreview && (
                  <div className="space-y-3">
                    {processing ? (
                      <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">{ocrStatus}</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${ocrProgress}%` }}
                          />
                        </div>
                        <span className="text-xs text-blue-600">{ocrProgress}%</span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleProcessOCR}
                          className="flex-1 gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Analisar com OCR
                        </Button>
                        <Button
                          onClick={() => {
                            // Skip OCR, go directly to manual entry
                            setShowOcrPreview(true);
                            setEditCnpj('');
                            setEditClientName('');
                            setEditNfNumber('');
                          }}
                          variant="outline"
                        >
                          Preencher Manual
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* OCR Results — Editable fields */}
                {showOcrPreview && (
                  <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      {ocrData && ocrData.confidence > 0 ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">
                            Dados extraídos — Confiança: {ocrData.confidence.toFixed(0)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">
                            Preencha ou corrija os dados abaixo
                          </span>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          CNPJ
                        </label>
                        <Input
                          value={editCnpj}
                          onChange={(e) => setEditCnpj(e.target.value)}
                          placeholder="00.000.000/0000-00"
                          className="bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Número da NF-e
                        </label>
                        <Input
                          value={editNfNumber}
                          onChange={(e) => setEditNfNumber(e.target.value)}
                          placeholder="Ex: 12345"
                          className="bg-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Nome do Cliente (Razão Social)
                        </label>
                        <Input
                          value={editClientName}
                          onChange={(e) => setEditClientName(e.target.value)}
                          placeholder="Nome completo ou razão social"
                          className="bg-white"
                        />
                      </div>
                    </div>

                    {/* Raw OCR text preview (collapsible) */}
                    {ocrData?.rawText && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                          Ver texto bruto do OCR
                        </summary>
                        <pre className="mt-2 p-2 bg-white rounded border text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {ocrData.rawText}
                        </pre>
                      </details>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => {
                          setShowOcrPreview(false);
                          setOcrData(null);
                        }}
                        variant="outline"
                      >
                        Reprocessar
                      </Button>
                      <Button
                        onClick={handleSaveReceipt}
                        disabled={saving}
                        className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Confirmar e Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Camera view */}
            {showCamera && (
              <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg max-h-96"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2">
                  <Button onClick={takePhoto} className="flex-1 gap-2">
                    <Camera className="h-4 w-4" />
                    Capturar Foto
                  </Button>
                  <Button onClick={stopCamera} variant="outline">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Carregando canhotos...</span>
        </div>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Canhotos</CardTitle>
            <div className="flex gap-2 mt-2">
              <Button type="button" onClick={() => exportToCSV(filteredReceipts, csvFilenameWithDate('canhotos'))} className="min-h-[44px] text-base">Exportar CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left">NF</th>
                    <th className="px-4 py-2 text-left">CNPJ</th>
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Arquivo</th>
                    <th className="px-4 py-2 text-left">Motorista</th>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReceipts.map((r) => {
                    const ocr = r.ocr_data as Record<string, any> | undefined;
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">
                          {ocr?.nf_number || r.nf_number || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono">
                          {ocr?.cnpj || 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {ocr?.client_name || r.client_name || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{r.filename || 'N/A'}</td>
                        <td className="px-4 py-2">{r.driver_name || 'N/A'}</td>
                        <td className="px-4 py-2">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2">
                          {getStatusBadge(r.status, r.validated)}
                        </td>
                        <td className="px-4 py-2 space-y-1">
                          {(r.image_url || r.receipt_image_url) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full gap-1 h-auto py-1"
                              onClick={() => window.open(r.image_url || r.receipt_image_url, '_blank')}
                            >
                              <Eye className="h-3 w-3" />
                              Ver Imagem
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedReceipts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        Nenhum canhoto encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredReceipts.length > PAGE_SIZE && (
              <div className="flex justify-end gap-2 mt-4">
                <Button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="min-h-[44px] text-base">Anterior</Button>
                <span className="flex items-center px-2">Página {page} de {Math.ceil(filteredReceipts.length / PAGE_SIZE)}</span>
                <Button disabled={page === Math.ceil(filteredReceipts.length / PAGE_SIZE)} onClick={() => setPage(p => p + 1)} className="min-h-[44px] text-base">Próxima</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Deliveries;
