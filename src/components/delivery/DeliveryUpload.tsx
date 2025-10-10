import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  Camera,
  FileText,
  CheckCircle,
  AlertTriangle,
  Edit,
  Save,
  X,
  Plus,
  Trash2
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

// ##########################################################################
// ########### NOVAS INTERFACES UNIFICADAS (COPIADAS DA SUA ï¿½LTIMA MENSAGEM)
// ##########################################################################
interface DeliverySummary {
  nfNumber: string;
  clientName: string;
  clientCnpj: string;
  deliveryAddress: string;
  merchandiseValue: string;
  volume: string;
  weight: string;
  issueDate: string;
  dueDate: string;
  observations: string;
}

interface InvoiceParty {
  razao_social: string;
  cnpj_cpf: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  inscricao_estadual: string;
}

interface InvoiceValues {
  valor_total_nota: string;
  valor_total_produtos: string;
  valor_frete: string;
  outras_despesas: string;
  desconto: string;
  valor_seguro: string;
  valor_ipi: string;
  valor_icms: string;
  valor_total_tributos: string;
}

interface InvoiceVolumes {
  quantidade: string;
  especie: string;
  marca: string;
  numero: string;
  peso_bruto: string;
  peso_liquido: string;
}

interface InvoiceImpostos {
  base_calculo_icms: string;
  valor_icms: string;
  valor_total_tributos: string;
  valor_icms_st: string;
  valor_ipi: string;
}

interface InvoiceDuplicata {
  identificador: string;
  valor: string;
  data_vencimento: string;
  raw?: Record<string, unknown> | null;
}

interface InvoiceItem {
  codigo_prod: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valor_unitario: string;
  valor_total: string;
  ncm?: string;
  cfop?: string;
  raw?: Record<string, unknown> | null;
}

interface StructuredInvoiceData {
  nf_data: {
    numero: string;
    serie: string;
    chave: string;
    data_emissao: string;
    data_saida: string;
    protocolo_autorizacao: string;
  };
  remetente: InvoiceParty;
  destinatario: InvoiceParty;
  valores: InvoiceValues;
  transportadora: InvoiceParty;
  volumes: InvoiceVolumes;
  impostos: InvoiceImpostos;
  duplicatas: InvoiceDuplicata[];
  itens_de_linha: InvoiceItem[];
  informacoes_complementares: string;
  status: string;
  raw_text: string;
  raw_fields: Record<string, string[]>;
  document_ai_confidence: number | null;
  document_ai_entities: Array<Record<string, unknown>>;
}

type CameraPermissionState = 'unknown' | 'granted' | 'denied';

const CAMERA_PERMISSION_STORAGE_KEY = 'delivery_camera_permission';

const readInitialCameraPermission = (): CameraPermissionState => {
  if (typeof window === 'undefined') {
    return 'unknown';
  }
  try {
    const stored = window.localStorage.getItem(CAMERA_PERMISSION_STORAGE_KEY);
    if (stored === 'granted' || stored === 'denied') {
      return stored;
    }
  } catch (error) {
    console.warn('[DeliveryUpload] Não foi possível ler a permissão da câmera armazenada:', error);
  }
  return 'unknown';
};

interface DeliveryUploadInitialData {
  summary?: Partial<DeliverySummary>;
  structured?: Partial<StructuredInvoiceData>;
  supplier_name?: string;
  supplier_tax_id?: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_website?: string;
  supplier_registration?: string;
  receiver_name?: string;
  receiver_tax_id?: string;
  receiver_address?: string;
  receiver_phone?: string;
  invoice_date?: string;
  nro?: string;
  serie?: string;
  chave?: string;
  total_amount?: string;
  vat_amount?: string;
  freight_amount?: string;
  line_item?: any[];
}

interface Driver {
  id: string;
  name: string;
  userId?: string;
}

const ALLOWED_FILE_EXTENSIONS = ['.xml', '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

interface DeliveryUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialData?: DeliveryUploadInitialData;
  // Propriedade adicionada para controlar a exibiï¿½ï¿½o do seletor de motorista.
  allowDriverSelection?: boolean;
}

// ##########################################################################
// ##########################################################################
// ##########################################################################

type StructuredSectionKey = 'nf_data' | 'remetente' | 'destinatario' | 'valores' | 'transportadora' | 'volumes' | 'impostos';

type DocumentAIParsedPayload = {
  extractedData?: Record<string, unknown>;
  entities?: Array<Record<string, unknown>>;
  rawText?: string;
  rawFields?: Record<string, string[]>;
  confidence?: number;
  detail?: DocumentAIParsedPayload;
};

// ## Funï¿½ï¿½es Auxiliares
const createEmptyStructuredData = (): StructuredInvoiceData => ({
  nf_data: {
    numero: '',
    serie: '',
    chave: '',
    data_emissao: '',
    data_saida: '',
    protocolo_autorizacao: ''
  },
  remetente: {
    razao_social: '',
    cnpj_cpf: '',
    endereco: '',
    municipio: '',
    uf: '',
    cep: '',
    telefone: '',
    inscricao_estadual: ''
  },
  destinatario: {
    razao_social: '',
    cnpj_cpf: '',
    endereco: '',
    municipio: '',
    uf: '',
    cep: '',
    telefone: '',
    inscricao_estadual: ''
  },
  valores: {
    valor_total_nota: '',
    valor_total_produtos: '',
    valor_frete: '',
    outras_despesas: '',
    desconto: '',
    valor_seguro: '',
    valor_ipi: '',
    valor_icms: '',
    valor_total_tributos: ''
  },
  transportadora: {
    razao_social: '',
    cnpj_cpf: '',
    endereco: '',
    municipio: '',
    uf: '',
    cep: '',
    telefone: '',
    inscricao_estadual: ''
  },
  volumes: {
    quantidade: '',
    especie: '',
    marca: '',
    numero: '',
    peso_bruto: '',
    peso_liquido: ''
  },
  impostos: {
    base_calculo_icms: '',
    valor_icms: '',
    valor_total_tributos: '',
    valor_icms_st: '',
    valor_ipi: ''
  },
  duplicatas: [],
  itens_de_linha: [],
  informacoes_complementares: '',
  status: 'PENDENTE',
  raw_text: '',
  raw_fields: {},
  document_ai_confidence: null,
  document_ai_entities: []
});

const normalizeString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
};

const digitsOnly = (value: unknown): string => normalizeString(value).replace(/\D/g, '');

const formatCurrencyValue = (value: string): string => {
  if (!value) return '';
  const numeric = value
    .replace(/[^\d.,-]/g, '')
    .replace(/\.(?=\d{3}(?:\.|,))/g, '')
    .replace(',', '.');
  const parsed = parseFloat(numeric);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : normalizeString(value);
};

const formatTaxId = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return digits || value;
};

const normalizeDateValue = (value: unknown): string => {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().split('T')[0];
  }
  const asString = normalizeString(value);
  if (!asString) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
    return asString;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(asString)) {
    const [day, month, year] = asString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const timestamp = Date.parse(asString);
  return Number.isNaN(timestamp) ? asString : new Date(timestamp).toISOString().split('T')[0];
};

const sanitizeDocumentNumber = (value: string): string => value.replace(/\D/g, '');

const takeFirstFromRaw = (rawFields: Record<string, string[]>, ...labels: string[]): string => {
  for (const label of labels) {
    const bucket = rawFields?.[label];
    if (bucket && bucket.length) {
      const match = bucket.find((entry) => normalizeString(entry));
      if (match) return normalizeString(match);
    }
  }
  return '';
};

const parseDuplicatasFromText = (text: string): InvoiceDuplicata[] => {
  if (!text) return [];
  const results: InvoiceDuplicata[] = [];
  const regex = /Duplicata\s*(\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const slice = text.slice(match.index);
    const valueMatch = slice.match(/([\d.,]+)/);
    const dateMatch = slice.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (valueMatch && dateMatch) {
      results.push({
        identificador: match[1].padStart(3, '0'),
        valor: formatCurrencyValue(valueMatch[1]),
        data_vencimento: normalizeDateValue(dateMatch[1]),
        raw: { source: slice.split('\n')[0] }
      });
    }
  }
  return results;
};

const buildItemsFromRawFields = (rawFields: Record<string, string[]>): InvoiceItem[] => {
  const codes = rawFields['line_item/product_code'] ?? [];
  const descriptions = rawFields['line_item/description'] ?? [];
  const fallback = rawFields['line_item'] ?? [];
  const quantities = rawFields['line_item/quantity'] ?? [];
  const units = rawFields['line_item/unit'] ?? [];
  const unitPrices = rawFields['line_item/unit_price'] ?? [];
  const totals = rawFields['line_item/amount'] ?? rawFields['line_item/total'] ?? [];
  const ncmValues = rawFields['line_item/ncm'] ?? [];
  const cfopValues = rawFields['line_item/cfop'] ?? [];

  const max = Math.max(
    codes.length,
    descriptions.length,
    fallback.length,
    quantities.length,
    units.length,
    unitPrices.length,
    totals.length,
    ncmValues.length,
    cfopValues.length
  );

  const items: InvoiceItem[] = [];

  for (let index = 0; index < max; index++) {
    const codigo = normalizeString(codes[index]);
    const descricao = normalizeString(descriptions[index] ?? fallback[index]);
    const quantidade = normalizeString(quantities[index]);
    const unidade = normalizeString(units[index]);
    const valorUnitario = normalizeString(unitPrices[index]);
    const valorTotal = normalizeString(totals[index]);
    const ncm = normalizeString(ncmValues[index]);
    const cfop = normalizeString(cfopValues[index]);

    if (!codigo && !descricao) continue;

    items.push({
      codigo_prod: codigo,
      descricao,
      quantidade,
      unidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      ncm: ncm || undefined,
      cfop: cfop || undefined,
      raw: {
        product_code: codes[index] ?? null,
        description: descriptions[index] ?? fallback[index] ?? null,
        quantity: quantities[index] ?? null,
        unit: units[index] ?? null,
        unit_price: unitPrices[index] ?? null,
        amount: totals[index] ?? null
      }
    });
  }

  return items;
};

const calculateDueDate = (issueDate: string): string => {
  if (!issueDate) return '';
  const d = new Date(issueDate);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

// Funï¿½ï¿½o unificada para construir o estado inicial
const buildInitialState = (initialData?: DeliveryUploadInitialData): StructuredInvoiceData => {
  const base = createEmptyStructuredData();

  if (!initialData) return base;

  // Mapeamento de initialData antiga para a nova estrutura
  if (initialData.structured) {
    Object.assign(base, initialData.structured);
  }
  if (initialData.summary) {
    base.nf_data.numero = initialData.summary.nfNumber || base.nf_data.numero;
    base.destinatario.razao_social = initialData.summary.clientName || base.destinatario.razao_social;
    base.destinatario.cnpj_cpf = initialData.summary.clientCnpj || base.destinatario.cnpj_cpf;
    base.destinatario.endereco = initialData.summary.deliveryAddress || base.destinatario.endereco;
    base.valores.valor_total_nota = initialData.summary.merchandiseValue || base.valores.valor_total_nota;
    base.volumes.quantidade = initialData.summary.volume || base.volumes.quantidade;
    base.volumes.peso_bruto = initialData.summary.weight || base.volumes.peso_bruto;
    base.nf_data.data_emissao = initialData.summary.issueDate || base.nf_data.data_emissao;
    // O dueDate ï¿½ calculado ou preenchido pelo Document AI, nï¿½o ï¿½ um campo direto na NF_Data
  }

  // Mapeamento de campos soltos para a nova estrutura
  base.nf_data.serie = initialData.serie || base.nf_data.serie;
  base.nf_data.chave = initialData.chave || base.nf_data.chave;
  base.valores.valor_frete = initialData.freight_amount || base.valores.valor_frete;

  return base;
};


// ##########################################################################
// ########################### COMPONENTE PRINCIPAL ###########################
// ##########################################################################

export const DeliveryUpload: React.FC<DeliveryUploadProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialData,
  allowDriverSelection = false // Valor padrï¿½o ï¿½ false
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();

  const [structuredData, setStructuredData] = useState<StructuredInvoiceData>(
    () => buildInitialState(initialData)
  );
  const [step, setStep] = useState<'upload' | 'form'>('upload');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [isSefazValid, setIsSefazValid] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverUserId, setSelectedDriverUserId] = useState<string | undefined>(undefined);
  const [cameraPermissionState, setCameraPermissionState] = useState<CameraPermissionState>(readInitialCameraPermission);
  const hasCameraConsent = cameraPermissionState === 'granted';
  const [showCameraPermissionDialog, setShowCameraPermissionDialog] = useState(false);
  const [cameraPermissionLoading, setCameraPermissionLoading] = useState(false);

  useEffect(() => {
    // Busca a lista de motoristas se a seleï¿½ï¿½o for permitida e o modal estiver aberto.
    if (allowDriverSelection && open) {
      const fetchDrivers = async () => {
        try {
          const response = await apiService.getDrivers({ status: 'active' });
          if (response.success && Array.isArray(response.data)) {
            const normalizedDrivers: Driver[] = (response.data as Array<Record<string, unknown>>)
              .map((rawDriver) => {
                const driverData = (rawDriver ?? {}) as Record<string, unknown>;
                const idCandidate = driverData['id'] ?? driverData['driver_id'] ?? driverData['user_id'] ?? driverData['userId'];
                const userIdCandidate = driverData['user_id'] ?? driverData['userId'] ?? idCandidate;
                const nameCandidate = driverData['name'] ?? driverData['full_name'] ?? driverData['username'] ?? driverData['email'];

                const id = idCandidate != null ? String(idCandidate) : '';
                const name = nameCandidate != null ? String(nameCandidate) : 'Motorista';
                const userId = userIdCandidate != null ? String(userIdCandidate) : undefined;

                return { id, name, userId } as Driver;
              })
              .filter((driver) => driver.id.length > 0);

            setDrivers(normalizedDrivers);
          }
        } catch (error) {
          console.error('Erro ao buscar motoristas:', error);
        }
      };

      fetchDrivers();
    }
  }, [allowDriverSelection, open]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setCameraPermissionState(readInitialCameraPermission());
    }
  }, [open]);

  useEffect(() => {
    if (initialData) {
      setStructuredData(buildInitialState(initialData));
    }
  }, [JSON.stringify(initialData)]);

  const updateStructuredField = <K extends StructuredSectionKey, F extends keyof StructuredInvoiceData[K]>(
    section: K,
    field: F,
    value: string
  ) => {
    setStructuredData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as Record<string, string>),
        [field]: value
      } as StructuredInvoiceData[K]
    }));
  };

  const updateDuplicataField = (index: number, key: keyof InvoiceDuplicata, value: string) => {
    setStructuredData(prev => {
      const duplicates = prev.duplicatas.slice();
      duplicates[index] = { ...duplicates[index], [key]: value };
      return { ...prev, duplicatas: duplicates };
    });
  };

  const addDuplicata = () => {
    setStructuredData(prev => ({
      ...prev,
      duplicatas: [
        ...prev.duplicatas,
        {
          identificador: `PARCELA-${String(prev.duplicatas.length + 1).padStart(2, '0')}`,
          valor: '',
          data_vencimento: '',
          raw: null
        }
      ]
    }));
  };

  const removeDuplicata = (index: number) => {
    setStructuredData(prev => ({
      ...prev,
      duplicatas: prev.duplicatas.filter((_, i) => i !== index)
    }));
  };

  const updateItemField = (index: number, key: keyof InvoiceItem, value: string) => {
    setStructuredData(prev => {
      const items = prev.itens_de_linha.slice();
      items[index] = { ...items[index], [key]: value };
      return { ...prev, itens_de_linha: items };
    });
  };

  const addItem = () => {
    setStructuredData(prev => ({
      ...prev,
      itens_de_linha: [
        ...prev.itens_de_linha,
        {
          codigo_prod: '',
          descricao: '',
          quantidade: '',
          unidade: '',
          valor_unitario: '',
          valor_total: '',
          raw: null
        }
      ]
    }));
  };

  const removeItem = (index: number) => {
    setStructuredData(prev => ({
      ...prev,
      itens_de_linha: prev.itens_de_linha.filter((_, i) => i !== index)
    }));
  };

  // ##########################################################################
// ########### NOVAS FUNï¿½ï¿½ES DE EXTRAï¿½ï¿½O DE TEXTO BRUTO
// ##########################################################################

// Funï¿½ï¿½o auxiliar para extrair dados do texto bruto usando regex
// Adicione esta nova funï¿½ï¿½o auxiliar ao seu componente
const extractFieldsFromRawText = (text: string): Record<string, string> => {
  if (!text) return {};
  const extracted: Record<string, string> = {};

  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  const digits = (s: string) => s.replace(/\D/g, '');
  const find = (regex: RegExp): string => {
    const match = text.match(regex);
    return match && match[1] ? clean(match[1]) : '';
  };

  // Mapeamento corrigido com base nos rï¿½tulos fornecidos
  extracted.nf_numero = find(/N[rï¿½o]\.?\s*[:\-\s]*(\d+)/i);
  extracted.nf_serie = find(/S[eï¿½]rie[:\-\s]*(\d+)/i);
  extracted.chave_acesso = find(/Chave de Acesso\s*([\d\s]{44})/i);
  extracted.data_emissao = find(/Data de Emiss[ï¿½a]o\s*(\d{2}\/\d{2}\/\d{4})/i);
  extracted.data_saida = find(/Dt\. Sa[ï¿½i]da\/Entrada\s*(\d{2}\/\d{2}\/\d{4})/i);
  extracted.protocolo_autorizacao = find(/Protocolo de autoriza[ï¿½c][ï¿½a]o de uso\s*(\d+)/i);
  
  // Remetente
  extracted.remetente_razao_social = find(/Raz[ï¿½a]o Social\s*([^\n\r]+)/i);
  extracted.remetente_cnpj = digits(find(/CNPJ\s*([\d.\-/\s]{14,})/i));
  extracted.remetente_endereco = find(/Remetente\s*Endere[ï¿½c]o\s*([^\n\r]+)/i);
  extracted.remetente_municipio = find(/Remetente\s*Munic[ï¿½i]pio\s*([^\n\r]+)/i);
  extracted.remetente_uf = find(/Remetente\s*UF\s*([A-Z]{2})/i);
  extracted.remetente_cep = find(/Remetente\s*CEP\s*([\d]{5}\-?[\d]{3})/i);
  extracted.remetente_telefone = find(/Remetente\s*Fone[:\-\s]*([\d\s\-\(\)]+)/i);

  // Destinatï¿½rio
  extracted.destinatario_razao_social = find(/Destinat[ï¿½a]rio \/ Remetente\s*Nome \/ Raz[ï¿½a]o Social\s*([^\n\r]+)/i);
  extracted.destinatario_cnpj = digits(find(/Destinat[ï¿½a]rio \/ Remetente\s*CNPJ\/CPF\s*([\d.\-/\s]{14,})/i));
  extracted.destinatario_endereco = find(/Destinat[ï¿½a]rio \/ Remetente\s*Endere[ï¿½c]o\s*([^\n\r]+)/i);
  extracted.destinatario_municipio = find(/Destinat[ï¿½a]rio \/ Remetente\s*Munic[ï¿½i]pio\s*([^\n\r]+)/i);
  extracted.destinatario_uf = find(/Destinat[ï¿½a]rio \/ Remetente\s*UF\s*([A-Z]{2})/i);
  extracted.destinatario_cep = find(/Destinat[ï¿½a]rio \/ Remetente\s*CEP\s*([\d]{5}\-?[\d]{3})/i);
  extracted.destinatario_telefone = find(/Destinat[ï¿½a]rio \/ Remetente\s*Fone\/Fax\s*([\d\s\-\(\)]+)/i);
  
  extracted.total_nota = find(/Valor Total da Nota\s*([\d.,]+)/i);
  extracted.valor_frete = find(/Valor do Frete\s*([\d.,]+)/i);
  extracted.peso_bruto = find(/Peso Bruto\s*([\d.,]+)/i);
  extracted.peso_liquido = find(/Peso Lï¿½quido\s*([\d.,]+)/i);
  extracted.volumes_quantidade = find(/Quantidade de Volume\(s\)\s*([\d\.,]+)/i);

  return extracted;
};

const handleDocumentAIData = (input: DocumentAIParsedPayload) => {
  const detail = input?.detail ?? input ?? {};
  const rawText = detail.rawText ?? input.rawText ?? '';
  const entities = Array.isArray(detail.entities) ? detail.entities : (Array.isArray(input.entities) ? input.entities : []);
  const rawFields = (detail.rawFields ?? input.rawFields ?? {}) as Record<string, string[]>;
  const confidence = typeof detail.confidence === 'number' ? detail.confidence : (typeof input.confidence === 'number' ? input.confidence : null);

  console.log('Texto extraÃ­do do PDF:', rawText);
  if (rawFields && Object.keys(rawFields).length) {
    console.log('RÃ³tulos Document AI recebidos:', rawFields);
  }
  
  const rawTextData = extractFieldsFromRawText(rawText);

  const newStructuredData = createEmptyStructuredData();
  newStructuredData.raw_text = rawText;
  newStructuredData.raw_fields = rawFields;
  newStructuredData.document_ai_confidence = confidence;
  newStructuredData.document_ai_entities = entities as Array<Record<string, unknown>>;
  
  // Preenchimento: Prioriza Document AI > Texto Bruto
  newStructuredData.nf_data.numero = sanitizeDocumentNumber(takeFirstFromRaw(rawFields, 'nro', 'invoice_id', 'invoice_number')) || rawTextData.nf_numero || '';
  newStructuredData.nf_data.serie = takeFirstFromRaw(rawFields, 'serie', 'invoice_series') || rawTextData.nf_serie || '';
  newStructuredData.nf_data.chave = takeFirstFromRaw(rawFields, 'chave', 'access_key', 'nfe_key', 'chave_de_acesso', 'chNFe') || rawTextData.chave_acesso || '';
  newStructuredData.nf_data.data_emissao = normalizeDateValue(takeFirstFromRaw(rawFields, 'invoice_date', 'issue_date', 'data_emissao', 'emission_date')) || normalizeDateValue(rawTextData.data_emissao) || '';
  newStructuredData.nf_data.data_saida = normalizeDateValue(takeFirstFromRaw(rawFields, 'saida', 'dt_saida_entrada', 'data_saida', 'shipment_date')) || normalizeDateValue(rawTextData.data_saida) || '';
  newStructuredData.nf_data.protocolo_autorizacao = takeFirstFromRaw(rawFields, 'protocolo', 'protocolo_de_autorizacao', 'protocol_number') || rawTextData.protocolo_autorizacao || '';
  
  newStructuredData.remetente.razao_social = takeFirstFromRaw(rawFields, 'supplier_name', 'ship_from_name') || rawTextData.remetente_razao_social || '';
  newStructuredData.remetente.cnpj_cpf = formatTaxId(takeFirstFromRaw(rawFields, 'supplier_tax_id', 'ship_from_tax_id')) || rawTextData.remetente_cnpj || '';
  newStructuredData.remetente.endereco = takeFirstFromRaw(rawFields, 'ship_from_name', 'ship_from_address') || rawTextData.remetente_endereco || '';
  newStructuredData.remetente.municipio = takeFirstFromRaw(rawFields, 'receiver_address', 'ship_from_city') || rawTextData.remetente_municipio || '';
  newStructuredData.remetente.uf = takeFirstFromRaw(rawFields, 'receiver_state', 'ship_from_state', 'currency') || rawTextData.remetente_uf || '';
  newStructuredData.remetente.cep = takeFirstFromRaw(rawFields, 'net_amount', 'supplier_postal_code') || rawTextData.remetente_cep || '';
  newStructuredData.remetente.telefone = takeFirstFromRaw(rawFields, 'supplier_phone') || rawTextData.remetente_telefone || '';

  newStructuredData.destinatario.razao_social = takeFirstFromRaw(rawFields, 'razao', 'customer_name', 'ship_to_name') || rawTextData.destinatario_razao_social || '';
  newStructuredData.destinatario.cnpj_cpf = formatTaxId(takeFirstFromRaw(rawFields, 'receiver_tax_id', 'customer_tax_id') || rawTextData.destinatario_cnpj) || '';
  newStructuredData.destinatario.endereco = takeFirstFromRaw(rawFields, 'endereco', 'ship_to_address') || rawTextData.destinatario_endereco || '';
  newStructuredData.destinatario.municipio = takeFirstFromRaw(rawFields, 'receiver_address', 'customer_city') || rawTextData.destinatario_municipio || '';
  newStructuredData.destinatario.uf = takeFirstFromRaw(rawFields, 'currency', 'customer_state') || rawTextData.destinatario_uf || '';
  newStructuredData.destinatario.cep = takeFirstFromRaw(rawFields, 'ship_to_address', 'receiver_postal_code') || rawTextData.destinatario_cep || '';
  newStructuredData.destinatario.telefone = takeFirstFromRaw(rawFields, 'receiver_phone', 'customer_phone') || rawTextData.destinatario_telefone || '';

  newStructuredData.valores.valor_total_nota = formatCurrencyValue(takeFirstFromRaw(rawFields, 'total_amount', 'valor_total_nota', 'amount_due', 'grand_total') || rawTextData.total_nota) || '';
  newStructuredData.valores.valor_total_produtos = formatCurrencyValue(takeFirstFromRaw(rawFields, 'valor_total_produtos', 'net_amount')) || '';
  newStructuredData.valores.valor_frete = formatCurrencyValue(takeFirstFromRaw(rawFields, 'freight_amount', 'valor_frete') || rawTextData.valor_frete) || '';
  
  newStructuredData.volumes.quantidade = takeFirstFromRaw(rawFields, 'volume', 'volumes', 'total_volume') || rawTextData.volumes_quantidade || '';
  newStructuredData.volumes.peso_bruto = takeFirstFromRaw(rawFields, 'weight', 'total_weight', 'gross_weight') || rawTextData.peso_bruto || '';
  newStructuredData.volumes.peso_liquido = takeFirstFromRaw(rawFields, 'net_weight', 'peso_liquido') || rawTextData.peso_liquido || '';
  
  const duplicatas = parseDuplicatasFromText(rawText);
  if (duplicatas.length) newStructuredData.duplicatas = duplicatas;
  
  const itens = buildItemsFromRawFields(rawFields);
  if (itens.length) newStructuredData.itens_de_linha = itens;
  
  newStructuredData.informacoes_complementares = rawText; 
  
  setStructuredData(newStructuredData);
  setIsSefazValid(true);
  setIsEditing(true);
  setStep('form');

  toast({
    title: 'Dados recebidos do Document AI',
    description: 'Os dados foram preenchidos automaticamente. Verifique e ajuste se necessÃ¡rio.'
  });
};

  const processDocumentWithAI = async (file: File) => {
    try {
      setLoading(true);
      const response = await apiService.smartProcessDocument(file);
      console.log('Resposta completa do Document AI:', response);

      if (response.success && response.data) {
        const { extractedData, entities, rawText, rawFields, confidence } = response.data;
        handleDocumentAIData({
          extractedData,
          entities: Array.isArray(entities) ? entities : (entities ? [entities] : []),
          rawText,
          rawFields: rawFields || {},
          confidence: typeof confidence === 'number' ? confidence : undefined
        });

        toast({
          title: 'Documento processado com sucesso',
          description: 'Os dados foram extraÃ­dos automaticamente. Verifique e ajuste se necessÃ¡rio.'
        });
      } else {
        setIsSefazValid(false);
        toast({
          title: 'Erro ao processar documento',
          
          variant: 'destructive'
        });
        setStep('form'); // Mantenha no formulÃ¡rio para preenchimento manual
      }
    } catch (error) {
      setIsSefazValid(false);
      console.error('Erro ao processar documento com Document AI:', error);
      toast({
        title: 'Erro ao processar documento',
        description: 'Ocorreu um erro ao enviar o documento para anÃ¡lise.',
        variant: 'destructive'
      });
      setStep('form'); // Mantenha no formulÃ¡rio para preenchimento manual
    } finally {
      setLoading(false);
    }
  };

  const validateSefazDocument = async (file: File): Promise<boolean> => {
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (fileExtension !== '.xml') {
      return true;
    }

    const textContent = await file.text();
    const sefazIndicators = ['<infNFe', '<emit>', '<dest>', '<det>', 'xmlns="http://www.portalfiscal.inf.br/nfe"'];
    const isSefaz = sefazIndicators.some((indicator) => textContent.includes(indicator));
    if (!isSefaz) {
      toast({
        title: 'Documento invÃ¡lido',
        description: 'O arquivo XML nÃ£o parece ser um documento SEFAZ vÃ¡lido',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_FILE_EXTENSIONS.includes(fileExtension)) {
    toast({
      title: 'Arquivo nÃ£o suportado',
      description: 'Envie um XML, PDF ou imagem (JPG, PNG, WEBP, HEIC).',
      variant: 'destructive'
    });
    e.target.value = '';
    setUploadedFile(null);
    return;
  }

  if (fileExtension === '.xml') {
    const isValid = await validateSefazDocument(file);
    if (!isValid) {
      e.target.value = '';
      setUploadedFile(null);
      return;
    }
  }

  setUploadedFile(file);
  await processDocumentWithAI(file);
};

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isMobileDevice() && cameraPermissionState !== 'granted') {
      persistCameraPermission('granted');
    }
    setUploadedFile(file);
    await processDocumentWithAI(file);
  };

  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent);
  };

  const persistCameraPermission = (value: CameraPermissionState) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CAMERA_PERMISSION_STORAGE_KEY, value);
      } catch (error) {
        console.warn('[DeliveryUpload] Falha ao registrar permissao da camera:', error);
      }
    }
    setCameraPermissionState(value);
  };

  const openCamera = async () => {
    if (isMobileDevice()) {
      if (!hasCameraConsent) {
        setShowCameraPermissionDialog(true);
        return;
      }
      cameraInputRef.current?.click();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: 'Camera indisponivel',
        description: 'Nao foi possivel acessar a camera automaticamente. Selecione a foto manualmente.',
        variant: 'destructive'
      });
      cameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();

      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          resolve();
        };
        video.addEventListener('canplay', onCanPlay);
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        setUploadedFile(file);
        await processDocumentWithAI(file);
      }

      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
       // Correção: Trata erros de permissão de forma mais específica
      if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
        console.warn('Acesso à câmera negado pelo usuário ou navegador.');
        toast({
          title: 'Acesso à câmera negado',
          description: 'Por favor, use a opção "Selecionar Arquivo" para enviar a foto.',
          variant: 'default'
        });
      } else {
        console.error('Erro ao acessar camera', error);
        toast({
          title: 'Erro na câmera',
          description: 'Não foi possível acessar a câmera. Tente enviar a foto manualmente.',
          variant: 'destructive'
        });
      }
      cameraInputRef.current?.click();
    }
  };

  const handleRequestCameraPermission = async () => {
    setCameraPermissionLoading(true);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('API de camera indisponivel neste dispositivo');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((track) => track.stop());
      persistCameraPermission('granted');
      setShowCameraPermissionDialog(false);
      toast({
        title: 'Permissao concedida',
        description: 'Voce pode tirar fotos diretamente pelo aplicativo.',
      });
      setTimeout(() => cameraInputRef.current?.click(), 50);
    } catch (error) {
      console.error('[DeliveryUpload] Falha ao solicitar permissao da camera:', error);
      persistCameraPermission('denied');
      setShowCameraPermissionDialog(false);
      toast({
        title: 'Permissao negada',
        description: 'Nao foi possivel acessar a camera. Selecione uma imagem da galeria.',
        variant: 'destructive',
      });
      cameraInputRef.current?.click();
    } finally {
      setCameraPermissionLoading(false);
    }
  };

  const handleDeclineCameraPermission = () => {
    persistCameraPermission('denied');
    setShowCameraPermissionDialog(false);
    toast({
      title: 'Permissao da camera nao concedida',
      description: 'Voce ainda pode anexar fotos selecionando arquivos da galeria.',
    });
    cameraInputRef.current?.click();
  };


const handleSaveDelivery = async () => {
  try {
    setLoading(true);

    // Validaï¿½ï¿½o no frontend antes de enviar
    if (!structuredData.nf_data.numero || !structuredData.destinatario.razao_social || !structuredData.destinatario.endereco) {
        toast({
            title: 'Campos obrigatÃ³rios',
            description: 'Preencha NÃºmero da NF, Nome do Cliente e EndereÃ§o.',
            variant: 'destructive'
        });
        setLoading(false);
        return;
    }

    // Usa driver_id do backend quando o usuario autenticado for motorista.
    const fallbackDriverUserId = user?.id ? String(user.id) : (user?.user_id ? String(user.user_id) : undefined);
    const driverIdForPayload = allowDriverSelection 
      ? selectedDriverUserId 
      : (user?.user_type === 'DRIVER' || user?.user_type === 'MOTORISTA' ? fallbackDriverUserId : undefined);

    if (allowDriverSelection && !driverIdForPayload) {
      toast({ title: 'Motorista nÃ£o selecionado', description: 'Por favor, atribua a entrega a um motorista.', variant: 'destructive' });
      setLoading(false);
      return;
    };

    // CORREï¿½ï¿½O: O `summaryPayload` foi adicionado para corresponder ï¿½ estrutura esperada pelo backend.
    const summaryPayload = {
        nf_number: structuredData.nf_data.numero,
        client_name: structuredData.destinatario.razao_social,
        delivery_address: structuredData.destinatario.endereco,
        merchandise_value: structuredData.valores.valor_total_nota,
        volume: structuredData.volumes.quantidade,
        weight: structuredData.volumes.peso_bruto,
    };
    
    // Garante que um arquivo foi selecionado antes do envio
    if (!uploadedFile) {
      toast({
        title: 'Documento obrigatÃ³rio',
        description: 'Selecione um XML ou PDF da NF antes de salvar a entrega.',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    // O payload completo para a API
    const payload = {
        structured: structuredData,
        summary: summaryPayload,
        isSefazValid,
        driver_id: driverIdForPayload, // Adiciona o driver_id ao payload
        file: uploadedFile,
    };

    console.log("Payload a ser enviado para a API:", payload);
    
    const response = await apiService.createDelivery(payload); // O mï¿½todo correto ï¿½ `createDelivery`
    if (response.success) {
      toast({
        title: 'Entrega cadastrada!',
        description: 'A entrega foi registrada com sucesso'
      });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    }
  } catch (error) {
    console.error('Erro ao salvar entrega', error);
    toast({
      title: 'Erro ao salvar',
      description: (error as Error).message || 'NÃo foi possí­vel salvar a entrega. Tente novamente.',
      variant: 'destructive'
    });
  } finally {
    setLoading(false);
  }
};

  const resetForm = () => {
    setStep('upload');
    setLoading(false);
    setIsEditing(true);
    setIsSefazValid(false);
    setUploadedFile(null);
    setStructuredData(createEmptyStructuredData());
    setSelectedDriverUserId(undefined);
  };
  
  const statusOptions = ['PENDENTE', 'IN_TRANSIT', 'DELIVERED', 'REFUSED', 'CANCELED'];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cadastrar Nova Entrega
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-6">
                Escolha como deseja adicionar o documento da entrega.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold">Selecionar Arquivo</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      XML, PDF ou Foto (extraÃ§Ã£o automÃ¡tica)
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={openCamera}>
                <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center">
                    <Camera className="h-8 w-8 text-secondary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold">Tirar Foto</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fotografar documento (OCR automÃ¡tico)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
              onChange={handleFileUpload}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />

            <Dialog open={showCameraPermissionDialog} onOpenChange={setShowCameraPermissionDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Permitir acesso a camera</DialogTitle>
                  <DialogDescription>
                    Precisamos da sua autorizacao para abrir a camera do dispositivo e registrar o canhoto.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Ao prosseguir você poderá tirar fotos diretamente pelo aplicativo.</p>
                  {cameraPermissionState === 'denied' && (
                    <p className="text-xs text-destructive">
                      O navegador registrou a permissão como negada. Se o problema persistir, habilite a camera nas
                      configurações do dispositivo ou do navegador.
                    </p>
                  )}
                </div>
                <DialogFooter className="grid w-full grid-cols-1 gap-2 sm:flex sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={handleDeclineCameraPermission}
                    disabled={cameraPermissionLoading}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleRequestCameraPermission} disabled={cameraPermissionLoading}>
                    {cameraPermissionLoading ? 'Solicitando...' : 'Permitir acesso'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {loading && (
              <div className="text-center">
                <p className="text-muted-foreground">Processando documento...</p>
              </div>
            )}
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/50">
              {isSefazValid ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Documento SEFAZ vÃ¡lido - Dados extraÃ­dos automaticamente</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm font-medium">Preenchimento manual necessÃ¡rio</span>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} className="ml-auto">
                <Edit className="h-4 w-4" />
                {isEditing ? 'Visualizar' : 'Editar'}
              </Button>
            </div>

            {/* Seletor de Motorista (renderizado condicionalmente) */}
            {allowDriverSelection && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Atribuir a Motorista</h3>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedDriverUserId || ''}
                  onChange={(e) => setSelectedDriverUserId(e.target.value || undefined)}
                  disabled={!isEditing || drivers.length === 0}
                >
                  <option value="" disabled>Selecione um motorista</option>
                  {drivers.map((driver) => (
                      <option key={driver.id} value={driver.userId ?? driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Dados da Nota Fiscal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>NÃºmero</Label>
                  <Input value={structuredData.nf_data.numero} onChange={(e) => updateStructuredField('nf_data', 'numero', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>SÃ©rie</Label>
                  <Input value={structuredData.nf_data.serie} onChange={(e) => updateStructuredField('nf_data', 'serie', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <Label>Chave de Acesso</Label>
                  <Input value={structuredData.nf_data.chave} onChange={(e) => updateStructuredField('nf_data', 'chave', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Data de EmissÃ£o</Label>
                  <Input type="date" value={structuredData.nf_data.data_emissao} onChange={(e) => updateStructuredField('nf_data', 'data_emissao', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Data de SaÃ­da</Label>
                  <Input type="date" value={structuredData.nf_data.data_saida} onChange={(e) => updateStructuredField('nf_data', 'data_saida', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Protocolo de AutorizaÃ§Ã£o</Label>
                  <Input value={structuredData.nf_data.protocolo_autorizacao} onChange={(e) => updateStructuredField('nf_data', 'protocolo_autorizacao', e.target.value)} disabled={!isEditing} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Remetente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>RazÃ£o Social</Label>
                  <Input value={structuredData.remetente.razao_social} onChange={(e) => updateStructuredField('remetente', 'razao_social', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ/CPF</Label>
                  <Input value={structuredData.remetente.cnpj_cpf} onChange={(e) => updateStructuredField('remetente', 'cnpj_cpf', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label>EndereÃ§o</Label>
                  <Input value={structuredData.remetente.endereco} onChange={(e) => updateStructuredField('remetente', 'endereco', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>MunicÃ­pio</Label>
                  <Input value={structuredData.remetente.municipio} onChange={(e) => updateStructuredField('remetente', 'municipio', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={structuredData.remetente.uf} onChange={(e) => updateStructuredField('remetente', 'uf', e.target.value)} disabled={!isEditing} maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={structuredData.remetente.cep} onChange={(e) => updateStructuredField('remetente', 'cep', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={structuredData.remetente.telefone} onChange={(e) => updateStructuredField('remetente', 'telefone', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>InscriÃ§Ã£o Estadual</Label>
                  <Input value={structuredData.remetente.inscricao_estadual} onChange={(e) => updateStructuredField('remetente', 'inscricao_estadual', e.target.value)} disabled={!isEditing} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">DestinatÃ¡rio</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>RazÃ£o Social</Label>
                  <Input value={structuredData.destinatario.razao_social} onChange={(e) => updateStructuredField('destinatario', 'razao_social', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ/CPF</Label>
                  <Input value={structuredData.destinatario.cnpj_cpf} onChange={(e) => updateStructuredField('destinatario', 'cnpj_cpf', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label>EndereÃ§o</Label>
                  <Input value={structuredData.destinatario.endereco} onChange={(e) => updateStructuredField('destinatario', 'endereco', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>MunicÃ­pio</Label>
                  <Input value={structuredData.destinatario.municipio} onChange={(e) => updateStructuredField('destinatario', 'municipio', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={structuredData.destinatario.uf} onChange={(e) => updateStructuredField('destinatario', 'uf', e.target.value)} disabled={!isEditing} maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={structuredData.destinatario.cep} onChange={(e) => updateStructuredField('destinatario', 'cep', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={structuredData.destinatario.telefone} onChange={(e) => updateStructuredField('destinatario', 'telefone', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>InscriÃ§Ã£o Estadual</Label>
                  <Input value={structuredData.destinatario.inscricao_estadual} onChange={(e) => updateStructuredField('destinatario', 'inscricao_estadual', e.target.value)} disabled={!isEditing} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Valores</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor Total da Nota</Label>
                  <Input value={structuredData.valores.valor_total_nota} onChange={(e) => updateStructuredField('valores', 'valor_total_nota', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Valor dos Produtos</Label>
                  <Input value={structuredData.valores.valor_total_produtos} onChange={(e) => updateStructuredField('valores', 'valor_total_produtos', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Valor do Frete</Label>
                  <Input value={structuredData.valores.valor_frete} onChange={(e) => updateStructuredField('valores', 'valor_frete', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Outras Despesas</Label>
                  <Input value={structuredData.valores.outras_despesas} onChange={(e) => updateStructuredField('valores', 'outras_despesas', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <Input value={structuredData.valores.desconto} onChange={(e) => updateStructuredField('valores', 'desconto', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Valor do Seguro</Label>
                  <Input value={structuredData.valores.valor_seguro} onChange={(e) => updateStructuredField('valores', 'valor_seguro', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Valor IPI</Label>
                  <Input value={structuredData.valores.valor_ipi} onChange={(e) => updateStructuredField('valores', 'valor_ipi', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Valor ICMS</Label>
                  <Input value={structuredData.valores.valor_icms} onChange={(e) => updateStructuredField('valores', 'valor_icms', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Total Tributos</Label>
                  <Input value={structuredData.valores.valor_total_tributos} onChange={(e) => updateStructuredField('valores', 'valor_total_tributos', e.target.value)} disabled={!isEditing} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Transportadora</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>RazÃ£o Social</Label>
                  <Input value={structuredData.transportadora.razao_social} onChange={(e) => updateStructuredField('transportadora', 'razao_social', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ/CPF</Label>
                  <Input value={structuredData.transportadora.cnpj_cpf} onChange={(e) => updateStructuredField('transportadora', 'cnpj_cpf', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label>EndereÃ§o</Label>
                  <Input value={structuredData.transportadora.endereco} onChange={(e) => updateStructuredField('transportadora', 'endereco', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>MunicÃ­pio</Label>
                  <Input value={structuredData.transportadora.municipio} onChange={(e) => updateStructuredField('transportadora', 'municipio', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={structuredData.transportadora.uf} onChange={(e) => updateStructuredField('transportadora', 'uf', e.target.value)} disabled={!isEditing} maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={structuredData.transportadora.telefone} onChange={(e) => updateStructuredField('transportadora', 'telefone', e.target.value)} disabled={!isEditing} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Volumes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input value={structuredData.volumes.quantidade} onChange={(e) => updateStructuredField('volumes', 'quantidade', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>EspÃ©cie</Label>
                  <Input value={structuredData.volumes.especie} onChange={(e) => updateStructuredField('volumes', 'especie', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input value={structuredData.volumes.marca} onChange={(e) => updateStructuredField('volumes', 'marca', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>NÃºmero</Label>
                  <Input value={structuredData.volumes.numero} onChange={(e) => updateStructuredField('volumes', 'numero', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Peso Bruto</Label>
                  <Input value={structuredData.volumes.peso_bruto} onChange={(e) => updateStructuredField('volumes', 'peso_bruto', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Peso LÃ­quido</Label>
                  <Input value={structuredData.volumes.peso_liquido} onChange={(e) => updateStructuredField('volumes', 'peso_liquido', e.target.value)} disabled={!isEditing} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Impostos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Base de CÃ¡lculo ICMS</Label>
                  <Input value={structuredData.impostos.base_calculo_icms} onChange={(e) => updateStructuredField('impostos', 'base_calculo_icms', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Valor ICMS</Label>
                  <Input value={structuredData.impostos.valor_icms} onChange={(e) => updateStructuredField('impostos', 'valor_icms', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Valor ICMS ST</Label>
                  <Input value={structuredData.impostos.valor_icms_st} onChange={(e) => updateStructuredField('impostos', 'valor_icms_st', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Valor IPI</Label>
                  <Input value={structuredData.impostos.valor_ipi} onChange={(e) => updateStructuredField('impostos', 'valor_ipi', e.target.value)} disabled={!isEditing} />
                </div>
                <div className="space-y-2">
                  <Label>Total de Tributos</Label>
                  <Input value={structuredData.impostos.valor_total_tributos} onChange={(e) => updateStructuredField('impostos', 'valor_total_tributos', e.target.value)} disabled={!isEditing} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Duplicatas</h3>
                {isEditing && (
                  <Button variant="outline" size="sm" onClick={addDuplicata}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                )}
              </div>
              {structuredData.duplicatas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma duplicata informada.</p>
              ) : (
                <div className="space-y-3">
                  {structuredData.duplicatas.map((duplicata, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end border rounded-md p-3">
                      <div className="space-y-2">
                        <Label>Identificador</Label>
                        <Input value={duplicata.identificador} onChange={(e) => updateDuplicataField(index, 'identificador', e.target.value)} disabled={!isEditing} />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor</Label>
                        <Input value={duplicata.valor} onChange={(e) => updateDuplicataField(index, 'valor', e.target.value)} disabled={!isEditing} />
                      </div>
                      <div className="space-y-2">
                        <Label>Data de Vencimento</Label>
                        <Input type="date" value={duplicata.data_vencimento} onChange={(e) => updateDuplicataField(index, 'data_vencimento', e.target.value)} disabled={!isEditing} />
                      </div>
                      {isEditing && (
                        <Button variant="ghost" size="sm" onClick={() => removeDuplicata(index)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Itens da Nota</h3>
                {isEditing && (
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                  </Button>
                )}
              </div>
              {structuredData.itens_de_linha.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item informado.</p>
              ) : (
                <div className="space-y-4">
                  {structuredData.itens_de_linha.map((item, index) => (
                    <div key={index} className="border rounded-md p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="space-y-2">
                          <Label>CÃ³digo</Label>
                          <Input value={item.codigo_prod} onChange={(e) => updateItemField(index, 'codigo_prod', e.target.value)} disabled={!isEditing} />
                        </div>
                        <div className="space-y-2 sm:col-span-2 md:col-span-3 lg:col-span-2">
                          <Label>DescriÃ§Ã£o</Label>
                          <Input value={item.descricao} onChange={(e) => updateItemField(index, 'descricao', e.target.value)} disabled={!isEditing} />
                        </div>
                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input value={item.quantidade} onChange={(e) => updateItemField(index, 'quantidade', e.target.value)} disabled={!isEditing} />
                        </div>
                        <div className="space-y-2">
                          <Label>Unidade</Label>
                          <Input value={item.unidade} onChange={(e) => updateItemField(index, 'unidade', e.target.value)} disabled={!isEditing} />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor UnitÃ¡rio</Label>
                          <Input value={item.valor_unitario} onChange={(e) => updateItemField(index, 'valor_unitario', e.target.value)} disabled={!isEditing} />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor Total</Label>
                          <Input value={item.valor_total} onChange={(e) => updateItemField(index, 'valor_total', e.target.value)} disabled={!isEditing} />
                        </div>
                        <div className="space-y-2">
                          <Label>NCM</Label>
                          <Input value={item.ncm ?? ''} onChange={(e) => updateItemField(index, 'ncm', e.target.value)} disabled={!isEditing} />
                        </div>
                        <div className="space-y-2">
                          <Label>CFOP</Label>
                          <Input value={item.cfop ?? ''} onChange={(e) => updateItemField(index, 'cfop', e.target.value)} disabled={!isEditing} />
                        </div>
                      </div>
                      {isEditing && (
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="infoComplementares">InformaÃ§Ãµes Complementares</Label>
              <Textarea
                id="infoComplementares"
                value={structuredData.informacoes_complementares}
                onChange={(e) => setStructuredData(prev => ({ ...prev, informacoes_complementares: e.target.value }))}
                disabled={!isEditing}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rawText">Texto bruto extraÃ­do</Label>
              <Textarea
                id="rawText"
                value={structuredData.raw_text}
                onChange={(e) => setStructuredData(prev => ({ ...prev, raw_text: e.target.value }))}
                disabled={!isEditing}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label>Status da entrega</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={structuredData.status}
                onChange={(e) => setStructuredData(prev => ({ ...prev, status: e.target.value }))}
                disabled={!isEditing}
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Voltar
              </Button>

              <Button onClick={handleSaveDelivery} disabled={loading} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Entrega'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
