import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_DECODED_BYTES = 10 * 1024 * 1024; // 10 MB

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT =
  "Você é um especialista em leitura de DANFE (Documento Auxiliar da Nota Fiscal Eletrônica brasileira).\n" +
  "Analise a imagem com atenção e extraia exatamente os seguintes campos em JSON:\n\n" +
  "- numero_nfe: número da NF-e (campo 'Nº' no canto superior direito, apenas os dígitos, sem zeros à esquerda desnecessários)\n" +
  "- nome_destinatario: Razão social ou nome do destinatário (seção DESTINATÁRIO/REMETENTE, campo NOME/RAZÃO SOCIAL)\n" +
  "- cnpj_destinatario: CNPJ do destinatário (seção DESTINATÁRIO/REMETENTE, campo CNPJ/CPF, formato XX.XXX.XXX/XXXX-XX)\n" +
  "- endereco_destinatario: Endereço completo do destinatário (logradouro, número, bairro, município, UF, CEP)\n" +
  "- cnpj_emitente: retorne null; este campo é fixo no sistema\n" +
  "- cnpj_transportadora: retorne null; este campo é fixo no sistema\n\n" +
  "Regras:\n" +
  "- Se um campo não estiver visível ou legível, use null\n" +
  "- Mantenha formatação original dos CNPJs (com pontos, barra e hífen)\n" +
  "- Retorne APENAS o JSON válido, sem markdown, sem texto adicional";

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

  // Call OpenAI GPT-4o-mini vision API
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("[extract-nfe-gemini] OPENAI_API_KEY not set");
    return jsonResponse({ error: "OPENAI_API_KEY não configurada na função de leitura." }, 503);
  }

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${content_type};base64,${image_base64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: PROMPT,
              },
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("[extract-nfe-gemini] OpenAI API error:", openaiRes.status, errText.slice(0, 300));
      return jsonResponse({ error: `Erro na API OpenAI (${openaiRes.status}).` }, 503);
    }

    const openaiJson = await openaiRes.json();
    const rawText: string = openaiJson?.choices?.[0]?.message?.content ?? "";

    // Strip markdown code fences in case model wraps response
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn("[extract-nfe-gemini] Could not parse OpenAI response:", cleaned.slice(0, 200));
      return jsonResponse(
        { error: "Não foi possível ler a NF-e. Preencha os dados manualmente." },
        422
      );
    }

    return jsonResponse(
      {
        numero_nfe: (parsed.numero_nfe as string) ?? null,
        cnpj_emitente: (parsed.cnpj_emitente as string) ?? null,
        nome_destinatario: (parsed.nome_destinatario as string) ?? null,
        cnpj_destinatario: (parsed.cnpj_destinatario as string) ?? null,
        cnpj_transportadora: (parsed.cnpj_transportadora as string) ?? null,
        endereco_destinatario: (parsed.endereco_destinatario as string) ?? null,
      },
      200
    );
  } catch (err) {
    console.error("[extract-nfe-gemini] Error:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: "Falha inesperada ao chamar a API OpenAI." }, 503);
  }
});
