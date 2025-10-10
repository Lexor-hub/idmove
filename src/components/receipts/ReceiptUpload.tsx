import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { Camera, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

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
  const [uploadedReceipt, setUploadedReceipt] = useState<any>(null);
  const [ocrData, setOcrData] = useState<any>(null);
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Apenas JPG, PNG e PDF são aceitos",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 5MB",
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
      const formData = new FormData();
      formData.append('file', file);
      
      if (deliveryId) {
        formData.append('deliveryId', deliveryId);
      }
      
      if (driverId) {
        formData.append('driverId', driverId);
      }

      const response = await apiService.uploadReceipt(formData);
      
      if (response.success) {
        setUploadedReceipt(response.data);
        toast({
          title: "Upload realizado com sucesso",
          description: "Arquivo enviado para processamento",
        });
        
        onUploadSuccess?.(response.data.id);
      } else {
        toast({
          title: "Erro no upload",
          description: response.error,
          variant: "destructive",
        });
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
    if (!uploadedReceipt) return;

    setProcessing(true);
    try {
      const response = await apiService.processReceiptOCR(uploadedReceipt.id);
      
      if (response.success) {
        setOcrData(response.data);
        setShowOcrDialog(true);
        toast({
          title: "OCR processado com sucesso",
          description: "Dados extraídos do canhoto",
        });
      } else {
        toast({
          title: "Erro no processamento OCR",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro no processamento OCR",
        description: "Erro ao processar OCR",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleValidateOCR = async (validated: boolean, corrections?: any) => {
    if (!uploadedReceipt || !ocrData) return;

    try {
      const response = await apiService.validateReceipt(uploadedReceipt.id, {
        ocr_data: ocrData.ocr_data,
        validated,
        corrections
      });
      
      if (response.success) {
        toast({
          title: "Validação realizada",
          description: validated ? "Dados validados com sucesso" : "Dados corrigidos",
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
                  JPG, PNG ou PDF (máx. 5MB)
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
                      {uploading ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status do Upload */}
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
                  disabled={processing || uploadedReceipt.processed}
                  size="sm"
                >
                  {processing ? "Processando..." : "Processar OCR"}
                </Button>
                
                {uploadedReceipt.processed && (
                  <Button
                    onClick={() => setShowOcrDialog(true)}
                    variant="outline"
                    size="sm"
                  >
                    Ver Dados OCR
                  </Button>
                )}
              </div>
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
          
          {ocrData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Número da NF</Label>
                  <Input
                    value={ocrData.ocr_data.nf_number || ''}
                    readOnly
                  />
                </div>
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input
                    value={ocrData.ocr_data.client_name || ''}
                    readOnly
                  />
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    value={ocrData.ocr_data.address || ''}
                    readOnly
                  />
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input
                    value={`R$ ${ocrData.ocr_data.value ? ocrData.ocr_data.value.toFixed(2) : '0,00'}`}
                    readOnly
                  />
                </div>
              </div>

              <div>
                <Label>Texto Extraído</Label>
                <textarea
                  value={ocrData.raw_text || ''}
                  readOnly
                  className="w-full h-32 p-2 border rounded-md bg-gray-50"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => handleValidateOCR(false)}
                  variant="outline"
                >
                  Corrigir Dados
                </Button>
                <Button
                  onClick={() => handleValidateOCR(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Validar Dados
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}; 