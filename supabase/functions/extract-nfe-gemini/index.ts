import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_DECODED_BYTES = 10 * 1024 * 1024; // 10 MB

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT =
  "Você é um especialista em leitura de DANFE (Documento Auxiliar da Nota Fiscal Eletrônica brasileira). " +
  "Sua tarefa é transcrever com exatidão visual, sem resumir, sem completar e sem corrigir palavras.";

const USER_PROMPT =
  "Analise a imagem inteira e extraia exatamente os seguintes campos em JSON:\n\n" +
  "- numero_nfe: número da NF-e no campo 'Nº', somente dígitos\n" +
  "- nome_destinatario: razão social completa do destinatário, sem cortar sufixos como LTDA, ME, EPP, COMERCIO, IMPORTACAO\n" +
  "- cnpj_destinatario: CNPJ completo do destinatário, exatamente do campo CNPJ/CPF da seção DESTINATÁRIO/REMETENTE, no formato XX.XXX.XXX/XXXX-XX\n" +
  "- endereco_destinatario: endereço completo do destinatário, juntando linhas quebradas quando necessário e preservando logradouro, número, bairro, município, UF e CEP\n" +
  "- cnpj_emitente: retorne null; este campo é fixo no sistema\n" +
  "- cnpj_transportadora: retorne null; este campo é fixo no sistema\n\n" +
  "Regras obrigatórias:\n" +
  "- Leia o nome, CNPJ e endereço do destinatário somente na seção DESTINATÁRIO/REMETENTE\n" +
  "- Não use o CNPJ do emitente nem o da transportadora no campo cnpj_destinatario\n" +
  "- Não abrevie, não corte e não omita partes do nome ou do endereço quando elas estiverem visíveis\n" +
  "- Se o texto estiver quebrado em mais de uma linha, una as linhas corretamente\n" +
  "- Se um campo estiver ilegível, retorne null\n" +
  "- Retorne apenas JSON válido";

const EXTRACTION_SCHEMA = {
  name: "nfe_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      numero_nfe: { type: ["string", "null"] },
      nome_destinatario: { type: ["string", "null"] },
      cnpj_destinatario: { type: ["string", "null"] },
      endereco_destinatario: { type: ["string", "null"] },
      cnpj_emitente: { type: ["string", "null"] },
      cnpj_transportadora: { type: ["string", "null"] },
    },
    required: [
      "numero_nfe",
      "nome_destinatario",
      "cnpj_destinatario",
      "endereco_destinatario",
      "cnpj_emitente",
      "cnpj_transportadora",
    ],
    additionalProperties: false,
  },
};

// Mesmo contrato do EXTRACTION_SCHEMA, no dialeto de schema do Gemini.
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    numero_nfe: { type: "STRING", nullable: true },
    nome_destinatario: { type: "STRING", nullable: true },
    cnpj_destinatario: { type: "STRING", nullable: true },
    endereco_destinatario: { type: "STRING", nullable: true },
    cnpj_emitente: { type: "STRING", nullable: true },
    cnpj_transportadora: { type: "STRING", nullable: true },
  },
  required: [
    "numero_nfe",
    "nome_destinatario",
    "cnpj_destinatario",
    "endereco_destinatario",
    "cnpj_emitente",
    "cnpj_transportadora",
  ],
};

function normalizeWhitespace(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+-\s+/g, " - ")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNfNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return digits.replace(/^0+/, "") || "0";
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * weights1[i];
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (Number(digits[12]) !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(digits[i]) * weights2[i];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return Number(digits[13]) === digit2;
}

function normalizeCnpj(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  const formatted = formatCnpj(digits);
  return isValidCnpj(formatted) ? formatted : null;
}

function normalizeAddress(value: unknown): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return normalized
    .replace(/\bCEP\s*:?\s*/i, "CEP ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isSuspiciousField(value: string | null, minLength: number): boolean {
  if (!value) return true;
  if (value.length < minLength) return true;
  return /(?:\.\.\.|[_|]{2,}|[A-Z0-9]{1,3}\s*$)/.test(value);
}

function parseJsonPayload(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

async function requestOpenAiExtraction(
  apiKey: string,
  contentType: string,
  imageBase64: string,
  prompt: string,
  model = "gpt-4o",
) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 500,
      response_format: {
        type: "json_schema",
        json_schema: EXTRACTION_SCHEMA,
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${contentType};base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[extract-nfe-gemini] OpenAI API error:", response.status, errText.slice(0, 300));
    throw new Error(`OPENAI_${response.status}`);
  }

  const json = await response.json();
  const rawText: string = json?.choices?.[0]?.message?.content ?? "";
  return parseJsonPayload(rawText);
}

async function requestGeminiExtraction(
  apiKey: string,
  contentType: string,
  imageBase64: string,
  prompt: string,
  model = "gemini-2.5-flash",
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                inline_data: {
                  mime_type: contentType,
                  data: imageBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("[extract-nfe-gemini] Gemini API error:", response.status, errText.slice(0, 300));
    throw new Error(`GEMINI_${response.status}`);
  }

  const json = await response.json();
  const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseJsonPayload(rawText);
}

type Provider = {
  name: "gemini" | "openai";
  extract: (prompt: string) => Promise<Record<string, unknown>>;
};

// Cadeia de provedores: Gemini primeiro (chave ativa), OpenAI como reserva.
// Se um falhar por chave inválida/sem créditos/erro de API, o próximo assume.
function buildProviders(contentType: string, imageBase64: string): Provider[] {
  const providers: Provider[] = [];

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    providers.push({
      name: "gemini",
      extract: (prompt) => requestGeminiExtraction(geminiKey, contentType, imageBase64, prompt),
    });
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (openAiKey) {
    providers.push({
      name: "openai",
      extract: (prompt) => requestOpenAiExtraction(openAiKey, contentType, imageBase64, prompt),
    });
  }

  return providers;
}

async function extractWithFallback(
  providers: Provider[],
  prompt: string,
): Promise<{ parsed: Record<string, unknown>; provider: Provider }> {
  let lastError: unknown = null;
  for (const provider of providers) {
    try {
      const parsed = await provider.extract(prompt);
      return { parsed, provider };
    } catch (error) {
      lastError = error;
      console.error(
        `[extract-nfe-gemini] Provider ${provider.name} failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  throw lastError ?? new Error("NO_PROVIDER");
}

function normalizeExtraction(parsed: Record<string, unknown>) {
  return {
    numero_nfe: normalizeNfNumber(parsed.numero_nfe),
    nome_destinatario: normalizeWhitespace(parsed.nome_destinatario),
    cnpj_destinatario: normalizeCnpj(parsed.cnpj_destinatario),
    endereco_destinatario: normalizeAddress(parsed.endereco_destinatario),
    cnpj_emitente: null,
    cnpj_transportadora: null,
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  // Auth validation
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Parse body
  let body: { image_base64?: string; content_type?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Formato de imagem inválido." }, 400);
  }

  const { image_base64, content_type } = body;

  if (!content_type || !ALLOWED_MIME.includes(content_type)) {
    return jsonResponse({ error: "Formato de imagem inválido." }, 400);
  }

  if (!image_base64 || image_base64.length === 0) {
    return jsonResponse({ error: "Formato de imagem inválido." }, 400);
  }

  const approxDecodedBytes = (image_base64.length * 3) / 4;
  if (approxDecodedBytes > MAX_DECODED_BYTES) {
    return jsonResponse({ error: "Imagem muito grande. Tente uma foto mais leve." }, 400);
  }

  const providers = buildProviders(content_type, image_base64);
  if (providers.length === 0) {
    console.error("[extract-nfe-gemini] No API key configured (GEMINI_API_KEY / OPENAI_API_KEY)");
    return jsonResponse({ error: "Leitura automática indisponível. Preencha os dados manualmente." }, 503);
  }

  try {
    let extraction: { parsed: Record<string, unknown>; provider: Provider };
    try {
      extraction = await extractWithFallback(providers, USER_PROMPT);
    } catch {
      return jsonResponse(
        { error: "Leitura automática indisponível no momento. Preencha os dados manualmente." },
        503,
      );
    }

    let normalized = normalizeExtraction(extraction.parsed);
    console.log(`[extract-nfe-gemini] Extraction via ${extraction.provider.name}`);

    const needsRepair =
      !normalized.cnpj_destinatario ||
      isSuspiciousField(normalized.nome_destinatario, 8) ||
      isSuspiciousField(normalized.endereco_destinatario, 12);

    if (needsRepair) {
      try {
        const repairPrompt =
          USER_PROMPT +
          "\n\nFaça uma segunda verificação focando somente na seção DESTINATÁRIO/REMETENTE. " +
          "Confirme o CNPJ do destinatário com todos os 14 dígitos e transcreva o nome e endereço completos, sem cortar o final.";
        const repaired = await extraction.provider.extract(repairPrompt);
        normalized = {
          numero_nfe: normalizeNfNumber(repaired.numero_nfe) || normalized.numero_nfe,
          nome_destinatario: normalizeWhitespace(repaired.nome_destinatario) || normalized.nome_destinatario,
          cnpj_destinatario: normalizeCnpj(repaired.cnpj_destinatario) || normalized.cnpj_destinatario,
          endereco_destinatario: normalizeAddress(repaired.endereco_destinatario) || normalized.endereco_destinatario,
          cnpj_emitente: null,
          cnpj_transportadora: null,
        };
      } catch (repairError) {
        console.warn("[extract-nfe-gemini] Repair extraction failed:", repairError);
      }
    }

    return jsonResponse(normalized, 200);
  } catch (err) {
    console.error("[extract-nfe-gemini] Error:", err instanceof Error ? err.message : String(err));
    return jsonResponse(
      { error: "Leitura automática indisponível no momento. Preencha os dados manualmente." },
      503,
    );
  }
});
