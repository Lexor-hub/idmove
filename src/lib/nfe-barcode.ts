// Lê a chave de acesso da NF-e (44 dígitos) a partir da foto da DANFE,
// usando a BarcodeDetector API nativa (Chrome/Android — sem biblioteca).
// A DANFE modelo 55 imprime a chave em CODE-128C; NFC-e usa QR code cuja URL
// contém a chave. Se o navegador não suportar ou o código não for legível,
// retorna null e o fluxo cai para a leitura por IA/manual.

type BarcodeDetectorResult = { rawValue: string };

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

const CHAVE_REGEX = /\d{44}/;

// Dígito verificador (módulo 11) — evita aceitar sequências de 44 dígitos
// que não são chave de acesso (ex.: linha digitável de boleto).
export function isChaveAcessoValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * pesos[(42 - i) % 8];
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

function extrairChaveDeTexto(texto: string): string | null {
  // QR de NFC-e vem como URL (p=chave|...); CODE-128 vem como os 44 dígitos puros.
  const candidatos: string[] = texto.replace(/\D/g, ' ').match(/\d{44}/g) || [];
  const direto = texto.match(CHAVE_REGEX);
  if (direto) candidatos.unshift(direto[0]);
  for (const candidato of candidatos) {
    if (isChaveAcessoValida(candidato)) return candidato;
  }
  return null;
}

export async function extrairChaveDaImagem(file: File): Promise<string | null> {
  const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) return null;

  let bitmap: ImageBitmap | null = null;
  try {
    const formats = await Detector.getSupportedFormats();
    const desired = ['code_128', 'qr_code', 'itf'].filter((f) => formats.includes(f));
    if (desired.length === 0) return null;

    const detector = new Detector({ formats: desired });
    bitmap = await createImageBitmap(file);

    const results = await detector.detect(bitmap);
    for (const result of results) {
      const chave = extrairChaveDeTexto(result.rawValue || '');
      if (chave) return chave;
    }
    return null;
  } catch (error) {
    console.warn('[nfe-barcode] leitura de código de barras falhou:', error);
    return null;
  } finally {
    bitmap?.close();
  }
}
