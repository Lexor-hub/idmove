# SKILL_PRODUCTION.md — Regras de Engenharia para o idmove

> **Quem deve ler isso:** todo agente autônomo (Maker ou Checker) deve ler este arquivo **antes** de qualquer alteração no código. Junto com `MEMORY.md`, é a fonte da verdade para o loop de engenharia.
>
> **Por que ele existe:** o repo **não tem CI, branch protection, lint em PR, nem suíte de teste automatizada confiável**. A disciplina precisa viver aqui. Se o agente desrespeitar este arquivo, o usuário sente em produção — há motoristas em campo agora.

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + TypeScript | 18.3.1 / 5.5.3 |
| Build | Vite (SWC) + Vite PWA (autoUpdate) | 5.4.1 |
| UI | shadcn/ui (Radix UI) + Tailwind CSS | 3.4.11 |
| Ícones / mídia | Lucide React, Embla Carousel, Recharts | — |
| Estado | TanStack React Query + React Context (`AuthContext`) | 5.56.2 |
| Forms | React Hook Form + Zod | 7.53 / 3.23.8 |
| Roteamento | React Router (HashRouter) | 6.26 |
| Backend | Supabase (Postgres + RPC + Edge Functions + Realtime) | 2.105.1 |
| Mobile | Capacitor (Android) | 8.3.1 |
| Plugins Mobile | BackgroundGeolocation, SplashScreen | — |
| Integrações | Google Maps API, Leaflet 1.9.4, Tesseract.js 6 (OCR NF-e), PDFjs-dist | — |
| Testes | Cypress 14.5.2 (E2E — **status não-confiável**) | — |
| Deploy | Vite build → `dist/` (estático, SPA) | — |

**App config:**
- `appId`: `com.idtransportes.idmove`
- Vite dev server: porta 8080
- Base path: `./`

**Env vars (`.env`):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_APP_NAME`

**Estrutura `src/`:**
- `components/` — UI (shadcn) + features (occurrences, dashboard, delivery)
- `pages/` — rotas (dashboard, auth, driver)
- `contexts/` — `AuthContext`
- `lib/` — utils, tracking, CSV, dates
- `services/` — integração de backend
- `hooks/`, `types/`, `integrations/`, `config/`

---

## 2. Regras Absolutas — ALWAYS

> Calibradas para repo **sem proteção automatizada**. O Maker SEMPRE faz; o Checker SEMPRE confere que foi feito.

1. **Ler `MEMORY.md` antes de escolher a próxima task.** Sem exceção.
2. **Trabalhar em branch separada** (`fix/...`, `cleanup/...`, `feat/...`). Nunca commitar direto em `main`.
3. **Antes de remover qualquer export, símbolo ou arquivo:** rodar `grep -r "<nome>" src/` e listar todos os call-sites no PR. Se houver **qualquer** uso, parar e perguntar.
4. **Antes de marcar task como concluída:** rodar `npm run build` e `npx tsc --noEmit`. Build verde é pré-requisito não-negociável.
5. **Mudanças em fluxo crítico** (auth, RPC `create_managed_user`, tracking GPS, ocorrências, cadastro de motorista): rodar a suíte Cypress relevante (`npx cypress run --spec ...`) e anexar resultado no log.
6. **Atualizar checkbox em `MEMORY.md`** na mesma PR que resolve o item. Sem isso, o item não está fechado.
7. **Documentar decisão não-óbvia** no "Log de Decisões" do `MEMORY.md`. Foco no porquê, não no quê. Inclua data ISO e nome do agente (Maker/Checker).
8. **Migrations Supabase:** sempre criar arquivo em `supabase/migrations/<YYYYMMDDHHMMSS>_<descricao>.sql`. Versionar. Os arquivos `AGORA_*.sql` e `SQL_*.sql` na raiz são o anti-padrão a ser eliminado, não imitado.
9. **Antes de mexer em RPC ou tabela do Supabase:** ler `supabase/migrations/` em ordem cronológica para entender o estado atual do schema.
10. **Permissões Android (LGPD / Play Store):** ao adicionar/justificar qualquer permissão (camera, location, background), redigir o texto da Privacy Policy correspondente **na mesma PR**.
11. **Erros de Supabase em runtime:** sempre tratar `error` da resposta antes de usar `data`. Mensagem para o usuário em PT-BR (padrão estabelecido nos commits recentes).
12. **Commits:** prefixo `Fix:` / `Add:` / `Refactor:` / `Chore:`. Mensagem em PT-BR (padrão observado no git log).

## 3. Regras Absolutas — NEVER

1. **Nunca commitar direto em `main`.**
2. **Nunca aplicar SQL no Supabase Dashboard sem criar migration versionada antes.** O estado atual é fruto desse anti-padrão — não perpetuar.
3. **Nunca deletar arquivo, função exportada, RPC ou tabela sem mostrar 100% dos call-sites no PR.** Se a busca não achar usos, ainda assim marcar com `// @deprecated` por **um loop completo** antes de remover.
4. **Nunca remover `console.log` sem checar se é diagnóstico ativo.** Os `console.log` em `AuthContext.tsx` estão sendo usados para debugar token JWT — confirmar status antes.
5. **Nunca usar `git push --force`**, nem rebase em branch que já tem PR aberta.
6. **Nunca usar `--no-verify`** para skipar pre-commit hooks.
7. **Nunca desabilitar checks** (`// @ts-ignore`, `// eslint-disable`) sem comentário explicando porquê + referência à task em `MEMORY.md`.
8. **Nunca mexer no plugin Capacitor BackgroundGeolocation sem testar em device físico Android.** Emulador mente sobre geolocação.
9. **Nunca alterar `appId`, `versionCode` ou `versionName` em `capacitor.config.ts` sem alinhar com o usuário.** Afeta diretamente a publicação na Play Store.
10. **Nunca tocar em `RELATORIO_TESTE_CAMPO_IDMOVE.pdf` ou `APRESENTACAO_TESTE_CAMPO_IDMOVE.md`.** São o registro do piloto, fonte da verdade para bugs reportados em campo.
11. **Nunca expor `VITE_SUPABASE_ANON_KEY` em logs, nem committar `.env`.** Apenas `.env.example` é versionado.
12. **Nunca criar "fix-temporário" colando SQL hotfix na raiz.** É exatamente o tipo de lixo que estamos eliminando.
13. **Nunca prosseguir com `npm run build` quebrado.** Não há "vou arrumar depois" — arruma agora ou reverte.

### 3.1 DADOS SAGRADOS — NUNCA APAGAR (regra de ouro)

> Estes dados são **a operação** do cliente. Apagar qualquer um deles, mesmo por engano em refactor, é incidente grave e potencialmente irreversível.

14. **Nunca executar `DELETE`, `DROP`, `TRUNCATE` em nenhuma tabela ou storage bucket que contenha:**
    - **Canhotos** (comprovantes de entrega — fotos, assinaturas, qualquer mídia de prova de entrega). Padrões de nome a proteger: `canhoto`, `canhotos`, `delivery_proof`, `proof_of_delivery`, `signature`, `signatures`, e os buckets de storage correspondentes (ex: `canhotos`, `signatures`).
    - **Entregas** (registros de delivery). Padrões: `entrega`, `entregas`, `delivery`, `deliveries`, `delivery_*`.
    - **Notas fiscais** (registros de NF/NF-e + arquivos OCR-processados). Padrões: `nf`, `nfe`, `notas_fiscais`, `invoice`, `invoices`, `nfe_*`, e buckets de storage de PDFs/imagens de NF.

15. **Nunca remover ou refatorar código que faz CRUD nesses dados sem alinhar com o usuário ANTES.** Especificamente: arquivos em `src/components/delivery/*`, `src/components/occurrences/*` (quando tocam entrega), serviços que falam com tabelas acima, qualquer componente com nome contendo `Canhoto`, `Entrega`, `Delivery`, `NF`, `NotaFiscal`, `OCR`.

16. **Nunca executar `mcp__plugin_supabase_supabase__execute_sql` ou `apply_migration` que contenha `DELETE FROM`, `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE`, ou `DELETE FROM storage.objects` sem o usuário ter pedido explicitamente, e mesmo assim só com `WHERE` específico e `LIMIT` quando aplicável.**

17. **Nunca apagar arquivos do Supabase Storage** (`storage.objects`) via SQL, RPC, dashboard ou client. Arquivos órfãos ficam órfãos — não apagamos.

18. **Antes de qualquer migration que toque tabelas das categorias acima:** o Maker deve mostrar no relatório (a) o nome exato da tabela, (b) que a operação é *apenas* `ALTER`/`CREATE`/`SELECT`/`INSERT`/`UPDATE` (nunca destrutiva), e (c) que rodou `SELECT count(*)` antes e depois para evidenciar que nenhum registro sumiu. O Checker veta automaticamente qualquer migration sem essa evidência.

19. **Nunca deletar arquivos `*.tsx`/`*.ts` que contenham as palavras** `canhoto`, `entrega`, `delivery`, `nf`, `nota fiscal`, `nfe`, `OCR`, `proof`, `signature` **sem fazer um grep prévio e mostrar ao usuário para confirmação humana explícita.** O grep prévio normal da regra ALWAYS #3 não é suficiente aqui — precisa de aprovação do usuário, mesmo que o grep retorne 0 usos.

---

## 4. Padrão de Código

- **TypeScript estrito.** Nada de `any` implícito; use `unknown` + narrow.
- **Componentes funcionais + hooks.** Sem class components.
- **shadcn/ui primeiro.** Só criar componente custom se não existir variação na lib.
- **Data fetching = TanStack Query** (`useQuery`/`useMutation`). Não usar `useEffect` + `fetch` solto.
- **Forms = React Hook Form + `zodResolver`.** Schema Zod ao lado do componente ou em `src/lib/schemas/`.
- **Imports absolutos** via alias `@/` (configurado em `tsconfig.app.json`).
- **Nome de arquivo:** PascalCase para componentes (`OccurrenceManager.tsx`), camelCase para utils (`tracking.ts`).
- **Comentários:** apenas o "porquê" quando não-óbvio. Não documentar o que o código já diz (alinhado com `CLAUDE.md` global do usuário).
- **`console.log` apenas em diagnóstico ativo.** Em fluxo estável, remover. Nunca usar como tracking de produção (esse papel é do Supabase Logs / Realtime).
- **Mensagens de erro para o usuário em PT-BR** (padrão `cc20bb6`).

---

## 5. Protocolo Maker / Checker

### Maker
1. Lê `MEMORY.md` e escolhe **um** item (prioridade alta primeiro: bugs > P0 código morto > Play Store > P1+).
2. Cria branch (`fix/...`, `cleanup/...`, `feat/...`).
3. Antes de remover qualquer símbolo: `grep -r "<nome>" src/` e cola resultado no PR.
4. Implementa.
5. Roda `npm run build` + `npx tsc --noEmit`. Se quebrar, conserta antes de continuar.
6. Se mexeu em fluxo crítico, roda Cypress dos specs relevantes.
7. Atualiza `MEMORY.md`: marca checkbox + adiciona linha no Log de Decisões.
8. Abre PR com: diff resumido, lista de call-sites verificados, output do build, status dos testes.

### Checker
1. Lê o PR + relê `SKILL_PRODUCTION.md`.
2. Re-roda `npm run build` + `npx tsc --noEmit` localmente (não confia só no que o Maker diz).
3. Confere cada Regra ALWAYS uma a uma. Marca ✅ / ❌.
4. Confere cada Regra NEVER. Qualquer violação = devolver.
5. Confere que `MEMORY.md` foi atualizado coerentemente.
6. Aprova ou devolve com pontos numerados.

### Escalonamento
Se Maker e Checker discordarem **2x** na mesma PR, escalar para o usuário. Não tentar 3a iteração silenciosa.

---

## 6. Comandos de Referência Rápida

```bash
# build + typecheck (obrigatório antes de fechar task)
npm run build
npx tsc --noEmit

# rodar cypress em spec específico
npx cypress run --spec "cypress/e2e/<arquivo>.cy.ts"

# checar uso de símbolo antes de deletar
grep -rn "<NomeDoSimbolo>" src/

# criar migration Supabase versionada
# (timestamp em UTC, formato YYYYMMDDHHMMSS)
touch supabase/migrations/$(date -u +%Y%m%d%H%M%S)_<descricao>.sql

# build Android para Play Store
npm run build:android
npm run open:android
```
