import Tesseract from 'tesseract.js';

export interface NFeExtractedData {
  cnpj: string;
  clientName: string;
  nfNumber: string;
  address: string;
  rawText: string;
  confidence: number;
}

type ProgressCallback = (progress: number, status: string) => void;

const SECTION_HEADERS = [
  'FORMA DE PAGAMENTO',
  'CALCULO DE IMPOSTO',
  'CÁLCULO DE IMPOSTO',
  'TRANSPORTADOR',
  'DADOS DO PRODUTO',
  'DADOS ADICIONAIS',
  'INFORMAÇÕES COMPLEMENTARES',
];

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

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

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * w1[i];
  let rem = sum % 11;
  const d1 = rem < 2 ? 0 : 11 - rem;
  if (parseInt(digits[12]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * w2[i];
  rem = sum % 11;
  const d2 = rem < 2 ? 0 : 11 - rem;
  return parseInt(digits[13]) === d2;
}

/**
 * Extract all valid CNPJs from a text block, validated by checksum
 */
function extractCNPJsFromBlock(text: string): string[] {
  const found: string[] = [];
  const raw = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;
  for (const m of text.matchAll(raw)) {
    const fmt = formatCNPJ(m[1]);
    if (isValidCNPJ(fmt) && !found.includes(fmt)) found.push(fmt);
  }
  return found;
}

function extractDestinatarioBlock(fullText: string): string {
  const match = fullText.match(/DESTINAT[AÁA]RIO/i);
  if (!match || match.index === undefined) {
    return fullText; // Fallback to full text if section not found
  }
  return sliceUntilNextSection(fullText, match.index);
}

function sliceUntilNextSection(text: string, fromIdx: number): string {
  const sub = text.slice(fromIdx + 15); // skip the word DESTINATÁRIO itself
  const match = sub.match(/FORMA\s*DE\s*PAGAMENTO|C[AÁ]LCULO\s*D[EO]\s*IMPOSTO|TRANSPORTADOR|DADOS\s*DO\s*PRODUTO|DADOS\s*ADICIONAIS|INFORMA[CÇ][OÕ]ES/i);
  if (match && match.index !== undefined) {
    return text.slice(fromIdx, fromIdx + 15 + match.index);
  }
  return text.slice(fromIdx);
}

/**
 * Extract CNPJ specifically from the DESTINATÁRIO section.
 * Skips the own company CNPJ that appears in the header area (remetente / transportadora).
 */
function extractDestinatarioCNPJ(block: string): string {
  const cnpjs = extractCNPJsFromBlock(block);
  return cnpjs.length > 0 ? cnpjs[0] : '';
}

/**
 * Extract company name from the DESTINATÁRIO block.
 * Looks for the line after NOME / RAZÃO SOCIAL label or the first substantive line.
 */
function extractDestinatarioName(block: string): string {
  // Regex to find Name on the line below the label
  const match = block.match(/NOME\s*[\/|1lI]?\s*RAZ[AÃA0]O\s*SOCIAL\s*[\r\n]+([^\r\n]+)/i);
  if (match && isLikelyCompanyName(match[1])) {
    return cleanName(match[1]);
  }
  
  // Regex to find Name on the same line
  const matchInline = block.match(/NOME\s*[\/|1lI]?\s*RAZ[AÃA0]O\s*SOCIAL\s*[:\-]*\s*([^\r\n]+)/i);
  if (matchInline && matchInline[1].length > 3) {
      const name = cleanName(matchInline[1]);
      if (isLikelyCompanyName(name)) return name;
  }
  
  const lines = block.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (/NOME\s*[\/|]\s*RAZ[AÃ]O/i.test(lines[i])) {
      if (lines[i + 1] && isLikelyCompanyName(lines[i + 1])) {
        return cleanName(lines[i + 1]);
      }
    }
  }

  // Fallback: first line in the block that looks like a company name
  // Skip the section header line itself
  for (let i = 1; i < lines.length; i++) {
    if (isLikelyCompanyName(lines[i])) return cleanName(lines[i]);
  }

  return '';
}

function isLikelyCompanyName(line: string): boolean {
  if (line.length < 5) return false;
  // Discard pure field labels or lines that are mostly numbers/codes
  if (/^(CNPJ|CPF|IE|IM|CEP|UF|DATA|DT|BAIRRO|ENDERE|MUNIC|FONE|INSCR|HORA|NOME|RAZ|VALOR|QUANTIDADE)/i.test(line.trim())) return false;
  if (/^\d+[\.\-\/\s]/.test(line.trim())) return false; // starts with digits
  const digitRatio = (line.match(/\d/g) || []).length / line.length;
  return digitRatio < 0.4;
}

function cleanName(name: string): string {
  return name
    .replace(/\s*(?:CNPJ|CPF)[:\s].*$/i, '') // remove inline CNPJ suffix
    .replace(/\s*\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}.*$/, '') // remove CNPJ digits
    .replace(/[_\-=]{2,}.*$/, '') // trailing separator
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface AddressParts {
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
  cep: string;
}

/**
 * Extract address parts from the DESTINATÁRIO block.
 */
function extractDestinatarioAddress(block: string): string {
  const parts: AddressParts = { street: '', neighborhood: '', city: '', uf: '', cep: '' };
  
  // Extract Street
  const endMatch = block.match(/ENDERE[CÇ][O0]?\s*[\r\n]+([^\r\n]+)/i);
  if (endMatch && !isFieldLabel(endMatch[1])) {
      parts.street = endMatch[1].trim();
  } else {
      const endInline = block.match(/ENDERE[CÇ][O0]?\s*[:\-]*\s*([^\r\n]+)/i);
      if (endInline && endInline[1].length > 3 && !isFieldLabel(endInline[1])) {
          parts.street = endInline[1].trim();
      }
  }
  
  // Extract Neighborhood
  const bairroMatch = block.match(/BAIRRO(?:[\s\/]*DISTRITO)?\s*[\r\n]+([^\r\n]+)/i);
  if (bairroMatch && !isFieldLabel(bairroMatch[1])) {
      parts.neighborhood = bairroMatch[1].trim();
  } else {
      const bairroInline = block.match(/BAIRRO(?:[\s\/]*DISTRITO)?\s*[:\-]*\s*([^\r\n]+)/i);
      if (bairroInline && bairroInline[1].length > 2 && !isFieldLabel(bairroInline[1])) {
          parts.neighborhood = bairroInline[1].trim();
      }
  }
  
  // Extract City
  const munMatch = block.match(/MUNIC[IÍ1]PIO\s*[\r\n]+([^\r\n]+)/i);
  if (munMatch && !isFieldLabel(munMatch[1])) {
      parts.city = munMatch[1].replace(/\s+(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b.*/, '').trim();
  } else {
      const munInline = block.match(/MUNIC[IÍ1]PIO\s*[:\-]*\s*([^\r\n]+)/i);
      if (munInline && munInline[1].length > 2 && !isFieldLabel(munInline[1])) {
          parts.city = munInline[1].replace(/\s+(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b.*/, '').trim();
      }
  }

  // Extract CEP
  const cepMatch = block.match(/\b(\d{2}\.?\d{3}-?\d{3})\b/);
  if (cepMatch) {
    parts.cep = cepMatch[1].replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
  }

  // Extract UF
  const ufMatch = block.match(new RegExp(`\\b(${BR_STATES.join('|')})\\b`));
  if (ufMatch) parts.uf = ufMatch[1];
  
  const pieces: string[] = [];
  if (parts.street) pieces.push(parts.street);
  if (parts.neighborhood) pieces.push(parts.neighborhood);
  if (parts.city && parts.uf) pieces.push(`${parts.city}-${parts.uf}`);
  else if (parts.city) pieces.push(parts.city);
  else if (parts.uf) pieces.push(parts.uf);
  if (parts.cep) pieces.push(`CEP ${parts.cep}`);

  return pieces.join(', ');
}

function isFieldLabel(line: string): boolean {
  return /^(CNPJ|CPF|IE|IM|CEP|UF|DATA|DT|BAIRRO|ENDERE|MUNIC|FONE|INSCR|HORA|NOME|RAZ|FORMA|CALC|TRANS|DADOS|INFO|VALOR|QUANT|NUMERO|S[EÉ]RIE)/i.test(line.trim());
}

/**
 * Extract NF-e number from OCR text
 */
function extractNFNumber(text: string): string {
  const patterns = [
    /(?:NF-?e?|Nota\s+Fiscal|DANFE|N[uú]mero|N[ºo°]\.?)\s*(?:Eletr[oô]nica)?\s*[:\s-]*\s*(\d{1,15})/gi,
    /(?:NOTA\s+FISCAL)[^]*?(?:N[ºo°]\.?\s*|Numero\s*[:\s]*)(\d{1,15})/gi,
    /(?:CHAVE\s+DE\s+ACESSO)[:\s]*(\d{44})/gi,
    /(?:S[eé]rie)\s*[:\s]*\d+\s*(?:N[ºo°]\.?\s*|Numero\s*)(\d{1,15})/gi,
    /NF[:\s-]*(\d{3,15})/gi,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match?.[1]) {
      const num = match[1].trim();
      if (num.length === 44) {
        return num.slice(25, 34).replace(/^0+/, '') || num.slice(25, 34);
      }
      return num;
    }
  }
  return '';
}

/**
 * Fallback CNPJ extraction from full text (when section extraction fails)
 */
function extractCNPJFallback(text: string): string {
  // Prefer CNPJs found near "Destinatário" context
  const cnpjs = extractCNPJsFromBlock(text);
  return cnpjs.length > 0 ? cnpjs[0] : '';
}

/**
 * Fallback name extraction from full text
 */
function extractClientNameFallback(text: string): string {
  const patterns = [
    /(?:Destinat[aá]rio|DESTINAT[AÁ]RIO)[\/\s]*(?:Remetente)?[^]*?(?:Nome|Raz[aã]o\s*Social|RAZAO\s*SOCIAL)\s*[:\s]*([^\n\r\d]{3,80})/gi,
    /(?:Raz[aã]o\s*Social|RAZAO\s*SOCIAL)\s*[:\s]*([^\n\r\d]{3,80})/gi,
    /(?:Nome\s*(?:do\s*)?(?:Cliente|Destinat[aá]rio))\s*[:\s]*([^\n\r\d]{3,80})/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m?.[1]) return cleanName(m[1]);
  }
  return '';
}

/**
 * Extract all NF-e data from raw OCR text
 */
export function extractNFeData(rawText: string): Omit<NFeExtractedData, 'rawText' | 'confidence'> {
  const allCnpjs = extractCNPJsFromBlock(rawText);
  // O cliente que fez o carregamento é o Emitente, que na NF-e quase sempre é o primeiro CNPJ a aparecer
  const emitenteCnpj = allCnpjs.length > 0 ? allCnpjs[0] : '';
  
  const block = extractDestinatarioBlock(rawText);

  let clientName = '';
  let address = '';
  let destinatarioCnpj = '';

  if (block) {
    destinatarioCnpj = extractDestinatarioCNPJ(block);
    clientName = extractDestinatarioName(block);
    address = extractDestinatarioAddress(block);
  }

  if (!clientName) clientName = extractClientNameFallback(rawText);
  
  // Prioriza o CNPJ do carregamento (emitente), caso falhe usa o do destinatário
  const cnpj = emitenteCnpj || destinatarioCnpj || extractCNPJFallback(rawText);

  return { cnpj, clientName, nfNumber: extractNFNumber(rawText), address };
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

    const imageUrl = await fileToDataUrl(file);

    onProgress?.(10, 'Iniciando reconhecimento de texto...');

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
      console.warn('Tesseract.js error:', tesseractError);
      onProgress?.(100, 'OCR indisponível - preencha manualmente');
      return { cnpj: '', clientName: '', nfNumber: '', address: '', rawText: '', confidence: 0 };
    }

    const rawText = result.data?.text || '';
    const confidence = result.data?.confidence || 0;

    onProgress?.(90, 'Extraindo dados da NF-e...');

    const extracted = extractNFeData(rawText);

    onProgress?.(100, 'Concluído!');

    return { ...extracted, rawText, confidence };
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
