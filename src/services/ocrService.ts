import Tesseract from 'tesseract.js';

export interface NFeExtractedData {
  cnpj: string;
  clientName: string;
  nfNumber: string;
  rawText: string;
  confidence: number;
}

type ProgressCallback = (progress: number, status: string) => void;

/**
 * Regex patterns for Brazilian NF-e data extraction
 */
const PATTERNS = {
  // CNPJ: 00.000.000/0000-00 or 14 digits
  cnpj: /(?:CNPJ|C\.N\.P\.J)[:\s]*(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})/gi,
  cnpjRaw: /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g,

  // NF-e number patterns
  nfNumber: [
    /(?:NF-?e?|Nota\s+Fiscal|DANFE|N[uú]mero|N[ºo°]\.?)\s*(?:Eletr[oô]nica)?\s*[:\s-]*\s*(\d{1,15})/gi,
    /(?:NOTA\s+FISCAL)[^]*?(?:N[ºo°]\.?\s*|Numero\s*[:\s]*)(\d{1,15})/gi,
    /(?:CHAVE\s+DE\s+ACESSO)[:\s]*(\d{44})/gi,
    /(?:S[eé]rie)\s*[:\s]*\d+\s*(?:N[ºo°]\.?\s*|Numero\s*)(\d{1,15})/gi,
    /NF[:\s-]*(\d{3,15})/gi,
  ],

  // Client name / Razão Social patterns
  clientName: [
    /(?:Destinat[aá]rio|DESTINAT[AÁ]RIO)[\/\s]*(?:Remetente)?[^]*?(?:Nome|Raz[aã]o\s*Social|RAZAO\s*SOCIAL)\s*[:\s]*([^\n\r\d]{3,80})/gi,
    /(?:Raz[aã]o\s*Social|RAZAO\s*SOCIAL)\s*[:\s]*([^\n\r\d]{3,80})/gi,
    /(?:Nome\s*(?:do\s*)?(?:Cliente|Destinat[aá]rio))\s*[:\s]*([^\n\r\d]{3,80})/gi,
    /(?:DESTINAT[AÁ]RIO)[:\s]*([^\n\r\d]{3,80})/gi,
  ],
};

/**
 * Clean and format CNPJ string to XX.XXX.XXX/XXXX-XX
 */
function formatCNPJ(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 14) return raw;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Validate CNPJ checksum
 */
function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let remainder = sum % 11;
  const d1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  remainder = sum % 11;
  const d2 = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(digits[13]) === d2;
}

/**
 * Extract CNPJ from OCR text
 */
function extractCNPJ(text: string): string {
  // First try labeled CNPJ
  for (const match of text.matchAll(PATTERNS.cnpj)) {
    const formatted = formatCNPJ(match[1]);
    if (isValidCNPJ(formatted)) return formatted;
  }

  // Then try raw 14-digit patterns
  for (const match of text.matchAll(PATTERNS.cnpjRaw)) {
    const formatted = formatCNPJ(match[1]);
    if (isValidCNPJ(formatted)) return formatted;
  }

  // Return first found even if invalid checksum
  const firstLabeled = PATTERNS.cnpj.exec(text);
  if (firstLabeled) return formatCNPJ(firstLabeled[1]);

  const firstRaw = PATTERNS.cnpjRaw.exec(text);
  if (firstRaw) return formatCNPJ(firstRaw[1]);

  return '';
}

/**
 * Extract NF-e number from OCR text
 */
function extractNFNumber(text: string): string {
  for (const pattern of PATTERNS.nfNumber) {
    // Reset lastIndex since we reuse patterns
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match?.[1]) {
      const num = match[1].trim();
      // If it's a 44-digit access key, extract the NF number (positions 25-33)
      if (num.length === 44) {
        return num.slice(25, 34).replace(/^0+/, '') || num.slice(25, 34);
      }
      return num;
    }
  }
  return '';
}

/**
 * Extract client name from OCR text
 */
function extractClientName(text: string): string {
  for (const pattern of PATTERNS.clientName) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match?.[1]) {
      // Clean up the name: trim, remove trailing special chars
      let name = match[1]
        .trim()
        .replace(/[\r\n]+.*$/, '') // Only take first line
        .replace(/[_\-=]+$/, '') // Remove trailing underscores/dashes
        .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
        .trim();

      // Discard if too short or looks like a field label
      if (name.length >= 3 && !/^(CNPJ|CPF|IE|IM|CEP|UF|Fone)/i.test(name)) {
        return name;
      }
    }
  }
  return '';
}

/**
 * Extract all NF-e data from raw OCR text
 */
export function extractNFeData(rawText: string): Omit<NFeExtractedData, 'rawText' | 'confidence'> {
  return {
    cnpj: extractCNPJ(rawText),
    clientName: extractClientName(rawText),
    nfNumber: extractNFNumber(rawText),
  };
}

/**
 * Process an image file through Tesseract.js OCR and extract NF-e data
 */
export async function processImageOCR(
  file: File,
  onProgress?: ProgressCallback
): Promise<NFeExtractedData> {
  try {
    onProgress?.(0, 'Preparando imagem...');

    // Convert file to image URL
    const imageUrl = await fileToDataUrl(file);

    onProgress?.(10, 'Iniciando reconhecimento de texto...');

    // Process with Tesseract.js v6 (simplified API)
    let result: any;
    try {
      result = await Tesseract.recognize(imageUrl, 'por', {
        logger: (info: { status: string; progress: number }) => {
          if (info.status === 'recognizing text') {
            const progress = Math.round(10 + info.progress * 80);
            onProgress?.(progress, 'Reconhecendo texto...');
          } else if (info.status === 'loading language traineddata') {
            onProgress?.(5, 'Carregando idioma português...');
          }
        },
      });
    } catch (tesseractError) {
      // Fallback: if Tesseract fails, return empty data
      console.warn('Tesseract.js error:', tesseractError);
      onProgress?.(100, 'OCR indisponível - preencha manualmente');
      return {
        cnpj: '',
        clientName: '',
        nfNumber: '',
        rawText: '',
        confidence: 0,
      };
    }

    const rawText = result.data?.text || '';
    const confidence = result.data?.confidence || 0;

    onProgress?.(90, 'Extraindo dados da NF-e...');

    const extracted = extractNFeData(rawText);

    onProgress?.(100, 'Concluído!');

    return {
      ...extracted,
      rawText,
      confidence,
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    throw new Error(`Erro ao processar documento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Convert a File to a data URL for Tesseract processing
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}
