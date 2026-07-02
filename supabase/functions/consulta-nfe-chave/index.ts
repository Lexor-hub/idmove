import { createClient } from "npm:@supabase/supabase-js@2";

// Consulta o XML oficial da NF-e pela chave de acesso (44 dígitos) via API Meu Danfe.
// PUT /v2/fd/add/{chave}  -> busca na Receita (R$ 0,03; grátis se já buscada antes)
// GET /v2/fd/get/xml/{chave} -> baixa o XML (grátis)
// Retorna o mesmo contrato da extract-nfe-gemini para o cliente reaproveitar o fluxo.

const MEUDANFE_BASE = "https://api.meudanfe.com.br/v2";
const MAX_POLLS = 6; // ~7s no pior caso; doc exige >=1s entre consultas de status
const POLL_INTERVAL_MS = 1200;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Layout da chave: cUF(2) AAMM(4) CNPJemit(14) modelo(2) serie(3) nNF(9) tpEmis(1) cNF(8) DV(1)
function numeroNfDaChave(chave: string): string | null {
  const nNF = chave.substring(25, 34).replace(/^0+/, "");
  return nNF || null;
}

function isChaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  // Dígito verificador módulo 11
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * pesos[(42 - i) % 8];
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

function tagContent(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function parseNfeXml(xml: string) {
  // Seção do destinatário — evita pegar CNPJ do emitente/transportadora
  const destMatch = xml.match(/<dest>([\s\S]*?)<\/dest>/);
  const dest = destMatch ? destMatch[1] : "";

  const nome = tagContent(dest, "xNome");
  const cnpjDigits = tagContent(dest, "CNPJ") || tagContent(dest, "CPF");

  const enderMatch = dest.match(/<enderDest>([\s\S]*?)<\/enderDest>/);
  const ender = enderMatch ? enderMatch[1] : "";
  const partes = [
    tagContent(ender, "xLgr"),
    tagContent(ender, "nro"),
    tagContent(ender, "xCpl"),
    tagContent(ender, "xBairro"),
    tagContent(ender, "xMun"),
    tagContent(ender, "UF"),
  ].filter(Boolean);
  const cep = tagContent(ender, "CEP");
  let endereco = partes.join(", ");
  if (cep) endereco += ` - CEP ${cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`;

  const nNF = tagContent(xml, "nNF");

  return {
    numero_nfe: nNF ? nNF.replace(/^0+/, "") || "0" : null,
    nome_destinatario: nome ? decodeXmlEntities(nome) : null,
    cnpj_destinatario: cnpjDigits && cnpjDigits.length === 14 ? formatCnpj(cnpjDigits) : null,
    endereco_destinatario: endereco ? decodeXmlEntities(endereco) : null,
    cnpj_emitente: null,
    cnpj_transportadora: null,
  };
}

async function meudanfe(path: string, method: "GET" | "PUT", apiKey: string): Promise<Response> {
  return fetch(`${MEUDANFE_BASE}${path}`, {
    method,
    headers: { "Api-Key": apiKey },
  });
}

async function baixarXml(chave: string, apiKey: string): Promise<string | null> {
  const response = await meudanfe(`/fd/get/xml/${chave}`, "GET", apiKey);
  if (!response.ok) return null;
  const json = await response.json().catch(() => null);
  const data: string | undefined = json?.data;
  if (!data) return null;
  if (data.trimStart().startsWith("<")) return data;
  try {
    // Alguns retornos vêm em BASE64
    return new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: { chave?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Requisição inválida." }, 400);
  }

  const chave = (body.chave || "").replace(/\D/g, "");
  if (!isChaveValida(chave)) {
    return jsonResponse({ error: "Chave de acesso inválida." }, 400);
  }

  const apiKey = Deno.env.get("MEUDANFE_API_KEY");
  if (!apiKey) {
    console.error("[consulta-nfe-chave] MEUDANFE_API_KEY not set");
    return jsonResponse({ error: "Consulta por chave indisponível." }, 503);
  }

  try {
    // 1) Tenta baixar direto (grátis se a NF já foi consultada antes)
    let xml = await baixarXml(chave, apiKey);

    // 2) Se não existe ainda, solicita a busca na Receita e faz polling do status
    if (!xml) {
      for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        const addResponse = await meudanfe(`/fd/add/${chave}`, "PUT", apiKey);
        if (addResponse.status === 401 || addResponse.status === 403) {
          console.error("[consulta-nfe-chave] Api-Key rejeitada:", addResponse.status);
          return jsonResponse({ error: "Consulta por chave indisponível." }, 503);
        }
        const addJson = await addResponse.json().catch(() => null);
        const status: string = addJson?.status || addJson?.data?.status || "";

        if (status === "OK") break;
        if (status === "NOT_FOUND") {
          return jsonResponse(
            { error: "NF-e não encontrada na Receita para esta chave.", numero_nfe: numeroNfDaChave(chave) },
            404,
          );
        }
        if (status === "ERROR") {
          return jsonResponse(
            { error: "Falha na consulta à Receita. Tente de novo ou preencha manualmente.", numero_nfe: numeroNfDaChave(chave) },
            502,
          );
        }
        // WAITING / SEARCHING — doc exige >= 1s entre consultas de status
        await sleep(POLL_INTERVAL_MS);
      }

      xml = await baixarXml(chave, apiKey);
    }

    if (!xml) {
      return jsonResponse(
        { error: "Consulta demorou mais que o esperado. Tente de novo em instantes.", numero_nfe: numeroNfDaChave(chave) },
        504,
      );
    }

    const parsed = parseNfeXml(xml);
    if (!parsed.numero_nfe) parsed.numero_nfe = numeroNfDaChave(chave);
    console.log(`[consulta-nfe-chave] OK chave=${chave.slice(0, 6)}... nf=${parsed.numero_nfe}`);
    return jsonResponse({ ...parsed, fonte: "xml_oficial" }, 200);
  } catch (err) {
    console.error("[consulta-nfe-chave] Error:", err instanceof Error ? err.message : String(err));
    return jsonResponse(
      { error: "Falha inesperada na consulta por chave.", numero_nfe: numeroNfDaChave(chave) },
      500,
    );
  }
});
