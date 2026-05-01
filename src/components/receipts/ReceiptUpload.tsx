import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { processImageOCR, type NFeExtractedData } from '@/services/ocrService';
import { Camera, Upload, FileText, CheckCircle, AlertCircle, Loader2, Eye } from 'lucide-react';

interface ReceiptUploadProps {
  deliveryId?: string;
  driverId?: string;
  onUploadSuccess?: (receiptId: string) => void;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({
  deliveryId,
  driverId,
  onUploadSuccess
}) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [uploadedReceipt, setUploadedReceipt] = useState<any>(null);
  const [ocrData, setOcrData] = useState<NFeExtractedData | null>(null);
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable OCR fields
  const [editCnpj, setEditCnpj] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editNfNumber, setEditNfNumber] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Apenas JPG, PNG, WebP, BMP e PDF são aceitos",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);

    // Criar preview para imagens
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      if (deliveryId) {
        // Upload linked to specific delivery
        const formData = new FormData();
        formData.append('file', file);
        formData.append('deliveryId', deliveryId);
        if (driverId) formData.append('driverId', driverId);

        const response = await apiService.uploadReceipt(formData);

        if (response.success) {
          setUploadedReceipt(response.data);
          toast({
            title: "Upload realizado com sucesso",
            description: "Arquivo enviado. Agora processe o OCR para extrair os dados.",
          });
          onUploadSuccess?.(response.data.id);
        } else {
          toast({
            title: "Erro no upload",
            description: response.error,
            variant: "destructive",
          });
        }
      } else {
        // Standalone upload
        const response = await apiService.uploadStandaloneReceipt(file, ocrData ? {
          cnpj: editCnpj,
          clientName: editClientName,
          nfNumber: editNfNumber,
          rawText: ocrData.rawText,
          confidence: ocrData.confidence,
        } : undefined);

        if (response.success) {
          setUploadedReceipt(response.data);
          toast({
            title: "Upload realizado com sucesso",
            description: "Canhoto salvo com sucesso",
          });
          onUploadSuccess?.(response.data.id);
        } else {
          toast({
            title: "Erro no upload",
            description: response.error,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: "Erro ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleProcessOCR = async () => {
    if (!file) return;

    // Only process images (not PDFs)
    if (!file.type.startsWith('image/')) {
      toast({
        title: "OCR não disponível",
        description: "OCR funciona apenas com imagens. Para PDF, preencha os dados manualmente.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    setOcrProgress(0);
    setOcrStatus('Iniciando...');

    try {
      const result = await processImageOCR(file, (progress, status) => {
        setOcrProgress(progress);
        setOcrStatus(status);
      });

      setOcrData(result);
      setEditCnpj(result.cnpj);
      setEditClientName(result.clientName);
      setEditNfNumber(result.nfNumber);
      setShowOcrDialog(true);

      const fieldsFound = [result.cnpj, result.clientName, result.nfNumber].filter(Boolean).length;

      toast({
        title: "OCR processado com sucesso",
        description: fieldsFound > 0
          ? `${fieldsFound} campo(s) extraído(s) — confiança: ${result.confidence.toFixed(0)}%`
          : 'Nenhum dado encontrado. Preencha manualmente.',
      });

      // If we have an uploaded receipt, update it with OCR data
      if (uploadedReceipt) {
        await apiService.processReceiptOCR(uploadedReceipt.id, {
          cnpj: result.cnpj,
          clientName: result.clientName,
          nfNumber: result.nfNumber,
          rawText: result.rawText,
          confidence: result.confidence,
        });
      }
    } catch (error) {
      toast({
        title: "Erro no processamento OCR",
        description: "Tente novamente com uma imagem mais nítida",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleValidateOCR = async (validated: boolean) => {
    if (!uploadedReceipt) return;

    try {
      const response = await apiService.validateReceipt(uploadedReceipt.id, {
        ocr_data: {
          cnpj: editCnpj,
          client_name: editClientName,
          nf_number: editNfNumber,
          raw_text: ocrData?.rawText || '',
          confidence: ocrData?.confidence || 0,
        },
        validated,
      });
      
      if (response.success) {
        toast({
          title: "Validação realizada",
          description: validated ? "Dados validados com sucesso" : "Dados corrigidos e salvos",
        });
        setShowOcrDialog(false);
      } else {
        toast({
          title: "Erro na validação",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro na validação",
        description: "Erro ao validar dados",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'PROCESSING':
        return <Badge variant="outline">Processando</Badge>;
      case 'UPLOADED':
        return <Badge variant="secondary">Enviado</Badge>;
      case 'PROCESSED':
        return <Badge className="bg-green-100 text-green-800">Processado</Badge>;
      case 'VALIDATED':
        return <Badge className="bg-blue-100 text-blue-800">Validado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Upload de Canhoto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Área de Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {!file ? (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-gray-400" />
                <p className="text-sm text-gray-600">
                  Clique para selecionar ou arraste um arquivo
                </p>
                <p className="text-xs text-gray-500">
                  JPG, PNG, WebP, BMP ou PDF (máx. 10MB)
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  Selecionar Arquivo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {preview && (
                  <div className="max-w-xs mx-auto">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {file.size ? (file.size / 1024 / 1024).toFixed(2) : '0.00'} MB
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                        setUploadedReceipt(null);
                        setOcrData(null);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Trocar Arquivo
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={uploading}
                      size="sm"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          Enviando...
                        </>
                      ) : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* OCR Processing Progress */}
          {processing && (
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
          )}

          {/* Status do Upload + OCR actions */}
          {uploadedReceipt && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">{uploadedReceipt.filename}</p>
                    <p className="text-sm text-gray-500">
                      ID: {uploadedReceipt.id}
                    </p>
                  </div>
                </div>
                {getStatusBadge(uploadedReceipt.status)}
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                <Button
                  onClick={handleProcessOCR}
                  disabled={processing || !file}
                  size="sm"
                  className="gap-1"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Processar OCR
                    </>
                  )}
                </Button>
                
                {ocrData && (
                  <Button
                    onClick={() => setShowOcrDialog(true)}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <FileText className="h-4 w-4" />
                    Ver Dados OCR
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Direct OCR without upload (when no deliveryId) */}
          {file && !deliveryId && !uploadedReceipt && !processing && (
            <div className="flex gap-2">
              <Button
                onClick={handleProcessOCR}
                disabled={processing || !file.type.startsWith('image/')}
                size="sm"
                className="gap-1"
              >
                <Eye className="h-4 w-4" />
                Processar OCR antes de enviar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Visualizar/Validar OCR */}
      <Dialog open={showOcrDialog} onOpenChange={setShowOcrDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dados Extraídos do Canhoto</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {ocrData && ocrData.confidence > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Confiança do OCR: {ocrData.confidence.toFixed(0)}%
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={editCnpj}
                  onChange={(e) => setEditCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label>Número da NF-e</Label>
                <Input
                  value={editNfNumber}
                  onChange={(e) => setEditNfNumber(e.target.value)}
                  placeholder="Ex: 12345"
                />
              </div>
              <div className="col-span-2">
                <Label>Nome do Cliente</Label>
                <Input
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  placeholder="Razão social ou nome do cliente"
                />
              </div>
            </div>

            {ocrData?.rawText && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                  Ver texto bruto extraído
                </summary>
                <textarea
                  value={ocrData.rawText}
                  readOnly
                  className="w-full h-32 p-2 border rounded-md bg-gray-50 mt-2 text-xs"
                />
              </details>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => handleValidateOCR(false)}
                variant="outline"
              >
                Salvar Correções
              </Button>
              <Button
                onClick={() => handleValidateOCR(true)}
                className="bg-green-600 hover:bg-green-700 gap-1"
              >
                <CheckCircle className="h-4 w-4" />
                Validar Dados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};