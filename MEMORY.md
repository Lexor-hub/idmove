# MEMORY.md — Estado do Loop de Engenharia (idmove)

> Este arquivo é o rastreador de estado do loop Maker/Checker. Leia este arquivo **e** o `SKILL_PRODUCTION.md` antes de qualquer ação. Atualize-o na mesma PR que fecha o item.

---

## Estado Final Desejado

> **App idmove publicado e estável na Google Play Store**, com painel do motorista funcionando sem erros para **múltiplos motoristas operando simultaneamente em campo**. Rastreamento GPS confiável em produção, ocorrências sem duplicação, cadastros sem órfãos, **zero SQL hotfix solto na raiz**, suíte Cypress verde e raiz do repo limpa.

## ⚠️ DADOS SAGRADOS — INTOCÁVEIS

O sistema **NUNCA** apaga os seguintes dados, sob nenhuma circunstância automatizada:

| Dado | Tabelas / Buckets | Por quê |
|---|---|---|
| **Canhoto** (comprovante de entrega) | `canhotos`, `delivery_proof`, `signatures`, buckets de storage equivalentes | Prova jurídica de entrega. Apagar = motorista/empresa sem defesa. |
| **Entrega** | `entregas`, `deliveries`, `delivery_*` | Histórico operacional. Apagar = perde receita, auditoria, KPIs. |
| **Nota Fiscal (NF / NF-e)** | `notas_fiscais`, `nfe`, `invoices`, `nfe_*`, buckets de PDFs/imagens de NF | Obrigação fiscal. Apagar = problema legal. |

**Regra prática:** o Maker JAMAIS executa `DELETE`, `DROP`, `TRUNCATE` ou `DELETE FROM storage.objects` nessas categorias. Refactor de código que toca esses fluxos exige aprovação humana explícita ANTES (não só grep prévio). Ver SKILL_PRODUCTION.md §3.1 (regras NEVER #14–#19).

Tudo neste arquivo existe para nos aproximar dessa imagem. Quando um item não contribuir para chegar lá, removê-lo.

---

## Bugs Abertos

Extraídos de `APRESENTACAO_TESTE_CAMPO_IDMOVE.md`, `MENSAGENS_HOJE.md` e do git log dos últimos 30 commits.

- [ ] **🔴 Ana Paula e Diego não conseguem iniciar rota "às vezes"** (reportado 2026-06-09) — Repro intermitente. Hipóteses ordenadas por probabilidade:
  - **#1 (70%)** `user.driver_id` chega nulo/`undefined` no `DriverDashboard.tsx:155` → `resolveDriverId()` retorna `null` → toast "Motorista não identificado" OU GPS preso em "Conectando GPS…". Origem: localStorage de sessão antiga (antes do fix `20260603000000_create_managed_user_upsert.sql`) ou `create_managed_user` antigo gravou sem `driver_id`.
  - **#2 (25%)** RPC `start_driver_tracking` (`supabase/migrations/20260503000100`) lança `Unauthorized: caller is not driver <uuid>` porque o JOIN `drivers ↔ profiles` está quebrado para Ana/Diego (vínculo `drivers.profile_id` ou `profiles.auth_user_id` divergente — mesmo padrão do Arlex/Ana/João resolvidos via `AGORA.sql` e `SQL_LIMPAR_ORFAO_ARLEX.sql`).
  - **#3 (5%)** Logs insuficientes em `startLocationTracking()` (`DriverDashboard.tsx:295`) — motorista vê toast genérico, dev não sabe qual ramo falhou.
  - **Arquivos-chave:** `src/pages/dashboard/DriverDashboard.tsx` (linhas 90-96, 155, 295-319, 596, 619, 740), `src/services/api.ts:1067-1076` (`startDriverTracking`), `src/contexts/AuthContext.tsx:38-72` (carga do user do localStorage), `supabase/migrations/20260503000100_driver_tracking_sessions.sql:122-142` (RPC + RLS).
  - **Ação:** rodar `AGORA.sql` no Supabase Dashboard contra Ana Paula e Diego (mesma rotina do Arlex). Só DEPOIS decidir patch em código (adicionar log + fallback amigável para `driver_id` nulo).

- [ ] **NF/contingência — simplificar entrada do motorista** (reportado 2026-06-18, resolver DEPOIS) — Na leitura da NF para contingência ocorrem erros. Contexto do negócio: o CNPJ da transportadora e o da **Disalerno** são SEMPRE os mesmos; o único campo que varia é o **destinatário** (quem recebe). Hoje o motorista digita à mão o CNPJ do destinatário + o número da NF-e. Objetivo: reduzir/eliminar digitação manual aproveitando os CNPJs fixos. Usuário acha que "já temos código para isso" — provável local: `src/components/delivery/DeliveryUpload.tsx`, `src/services/ocrService.ts`, `supabase/functions/extract-nfe-gemini`. Ação: recon antes de mexer; NÃO tocar agora (prioridade pós-Sessões 1-3).
- [ ] **Cadastro de veículo travando** — reportado em campo, sem repro detalhado. Ação: solicitar print do erro / passos de reprodução antes de mexer.
- [ ] **OCR de NF-e instável com fotos de baixa qualidade** — Tesseract erra com imagem ruim. Ação: avaliar pré-processamento (binarização, contraste) ou fallback manual.
- [ ] **Sincronização offline Android não implementada** — motorista perde dados sem sinal. Ação: arquitetura IndexedDB/SQLite local + fila de reenvio. Tarefa grande, quebrar em sub-itens antes de pegar.
- [ ] **Suíte Cypress não-validada** — não sabemos quais specs estão verdes. Ação: rodar `npx cypress run` e listar os que falham aqui antes de qualquer outra task crítica.
- [ ] **4 arquivos com mudança sem commit no working tree** (`OccurrenceManager.tsx`, `AdminDashboard.tsx`, `Users.tsx`, `dashboard/index.tsx`) — decidir: mergear (criar branch + PR) ou stash. Não deixar pendurado.
- [ ] **Confirmar se `SQL_URGENTE_FIX_PGCRYPTO.sql` foi aplicado em produção** — commit `cc20bb6` diz "resolvido" mas o SQL ainda está solto na raiz. Verificar no Supabase Dashboard e registrar no Log de Decisões.
- [ ] **Validar que `create_managed_user` RPC com UPSERT está funcionando** — fix em `c39facc`. Testar cadastro novo de motorista em ambiente real (criar + apagar).
- [ ] **`AGORA.sql` NÃO foi aplicado em produção** (diagnostica `company_id`/`profile_id` quebrados de motoristas — confirmado pelo bug Ana/Diego). Aplicar no Dashboard rodando contra Ana Paula e Diego, depois mover para `supabase/migrations/<timestamp>_diagnostic_orphan_drivers.sql`.
- [ ] **`AGORA_FIX_RPC_UPSERT.sql` é REDUNDANTE** com `supabase/migrations/20260603000000_create_managed_user_upsert.sql` — confirmar idempotência e deletar o duplicado da raiz.
- [ ] **Tratamento de erro vago em `src/services/api.ts:1067-1076`** — `startDriverTracking` engole o `error.message` do RPC e devolve "Sessão de rastreamento não criada" genérico. Trocar por mensagem que mostre `error.message` para que "Unauthorized" apareça pro usuário/dev.
- [ ] **Race condition no `src/contexts/AuthContext.tsx:38-72`** — localStorage pode trazer `user` SEM `driver_id` de sessão antiga. Adicionar refetch do profile via RPC ao montar app se `driver_id` faltando.
- [ ] **🔴 Painel admin "às vezes buga, não marca infos certas"** (reportado 2026-06-09) — sintoma vago. Hipótese forte: mesmo `company_id` divergente do bug Ana/Diego faz RLS filtrar entregas/ocorrências erradas no admin (RLS em `deliveries`, `occurrences`, `motoristas_posicao` casa por `company_id = current_company_id()`). Investigar APÓS o fix de vínculo — provavelmente resolve junto. Se persistir, abrir investigação separada (pode ser storage/canhoto, e aí precisa aprovação explícita por tocar DADOS SAGRADOS).

---

## Código Morto a Remover

### P0 — deletar imediato (sem impacto, baixíssimo risco)
- [ ] `RealtimeDashboard.tsx` na raiz (0 bytes — a versão real está em `src/components/dashboard/RealtimeDashboard.tsx`)
- [ ] `test_frontend_integration.js`
- [ ] `test_auth_integration.js`
- [ ] `test_config.js`
- [ ] `tmp_test_kpis_mapping.js`
- [ ] `debug_api_error.html`

### P1 — mover para `supabase/migrations/` (se ainda relevante) ou `docs/sql-hotfixes/` (se arquivo histórico)
- [ ] `AGORA.sql`
- [ ] `AGORA_FIX_RPC_UPSERT.sql`
- [ ] `AGORA_LIMPAR_AUTH_VESTIGIOS.sql`
- [ ] `SQL_URGENTE_FIX_PGCRYPTO.sql`
- [ ] `SQL_LIMPAR_ORFAO_ARLEX.sql`
- [ ] `motoristas_posicao.sql`

> Antes de mover, decidir item por item: este SQL precisa virar migration versionada (rodar de novo num ambiente novo)? Ou é só registro histórico (vai para `docs/`)? Não mover em bloco sem essa decisão.

### P2 — consolidar documentação em `docs/archived/`
- [ ] Mover bugfix histórico: `CORREÇÃO_ERRO_SINTAXE_JSX.md`, `CORREÇÃO_HEADER_DUPLICADO.md`, `CORREÇÕES_AUTH_SYSTEM.md`, `SOLUÇÃO_COMPLETA_TOKEN_HEADER.md`, `SOLUÇÃO_ERRO_3001.md`, `SOLUÇÃO_TOKEN_JWT.md`, `DEBUG_TOKEN.md`, `TESTE_DEBUG_TOKEN.md`, `TESTE_LOGIN_DEBUG.md`, `TESTE_REALTIME.md`, `RESUMO_CONFIGURACAO_API.md`, `RESUMO_CORREÇÕES.md`, `ERRO_500_LOGIN.md`, `IMPLEMENTATION_SUMMARY.md`, `STATUS_INTEGRAÇÃO_FRONTEND.md`
- [ ] Resolver duplicata: `ENV_EXAMPLE.md` vs `ENV_EXEMPLO.md` (manter um, deletar o outro)
- [ ] Decidir destino: `create-test-users-v2.ts` e `setup-test-users.ts` — mover para `scripts/` ou deletar

### P3 — limpeza de console.log
> ⚠️ Verificar primeiro se cada log é diagnóstico ativo (regra NEVER #4 do `SKILL_PRODUCTION.md`).
- [ ] `src/contexts/AuthContext.tsx` — 12 ocorrências (provavelmente usadas para debug de token JWT — confirmar status antes)
- [ ] `src/pages/dashboard/Companies.tsx` — 4 ocorrências
- [ ] `src/components/.../DeliveryUpload.tsx` — 2 ocorrências
- [ ] `src/components/dashboard/RealtimeDashboard.tsx` — 1 ocorrência

---

## Pendência Play Store — App do Motorista

Esta seção é o caminho crítico para o estado final desejado.

- [ ] Configurar release build assinado (gerar keystore, definir `versionCode` / `versionName` em alinhamento com o usuário)
- [ ] Redigir/revisar Política de Privacidade (LGPD + Google Play requirements)
- [ ] Justificar permissão `ACCESS_BACKGROUND_LOCATION` na Privacy Policy (alta barreira na Play Store) **OU** decidir remover do MVP e usar foreground location apenas
- [ ] Auditar permissões em `android/app/src/main/AndroidManifest.xml` — manter o mínimo necessário
- [ ] Build release + teste em **device físico Android** (regra NEVER #8 — emulador mente sobre GPS)
- [ ] Publicar em faixa "Teste Interno" da Play Console antes de produção
- [ ] Aguardar N dias de teste interno sem regressão antes de promover para "Produção" (definir N com o usuário)
- [ ] Listagem da loja: ícone, screenshots, descrição curta, descrição longa, classificação etária

---

## Refactorings Desejáveis

- [ ] Reorganizar raiz do repo (após P0/P1/P2 limpos): subpastas claras (`docs/`, `scripts/`, `supabase/`)
- [ ] Decidir destino do diretório `/Users/leonardomendonca/Id transporte/frontend-id-transportes` (legado — último commit Abr/2026) — arquivar como branch, deletar, ou manter como referência intocada
- [ ] Avaliar se `dist/` está versionado por engano (não deveria estar — checar `.gitignore`)
- [ ] Adicionar mínimo de CI (GitHub Actions com `npm run build` + `tsc --noEmit` em PR) — tira pressão de cima das regras manuais

---

## Log de Decisões

Formato: `YYYY-MM-DD — Agente (Maker/Checker/Setup) — Decisão — Porquê`

- `2026-06-09 — Setup — Criados SKILL_PRODUCTION.md e MEMORY.md na raiz do repo — base para arquitetura Maker/Checker. O repo não tem nenhuma proteção automatizada (sem CI, sem branch protection, sem migrations versionadas em produção, Cypress não-confiável), então toda disciplina vive nestes dois arquivos. Stack mapeada: React 18 + Vite 5.4 + Supabase 2.105 + Capacitor 8.3 (Android) + shadcn/Tailwind + TanStack Query + React Hook Form/Zod. Visão final fixada no topo: app publicado na Play Store com múltiplos motoristas operando sem erro.`
- `2026-06-18 — Orquestrador — Erro transitório no cadastro pós-migration diagnosticado e descartado — Ricardo (motorista) falhou ao cadastrar entrega logo após a migration, depois passou a funcionar sozinho. Causa: cache de schema do PostgREST demora alguns minutos a reconhecer colunas novas pós-ALTER TABLE. Provado por probe read-only com anon key (GET deliveries?select=created_by_profile_id retornou []/200, não 400 — colunas reconhecidas). NÃO era bug de código. Fallback que eu havia colocado em createDelivery foi REMOVIDO a pedido do usuário ("não é para mascarar") — insert voltou ao formato limpo, erro real aflora. Build verde.`
- `2026-06-18 — Orquestrador — Sessão 2.2 (painel Saúde dos Motoristas) implementada — api.ts getDriverIntegrity() chama RPC audit_driver_integrity (já existe, grant authenticated). Reports.tsx: nova aba "Motoristas" (DriverHealthTab) read-only que lista vínculos quebrados (motorista↔perfil↔empresa) com rótulos pt-BR e estado verde "todos íntegros". Serve para o admin checar antes de mandar motorista pra rua (sintoma "iniciar rota estranho"). Sem migration nova: a RPC já roda sobre motoristas ATIVOS por padrão. tsc/build verdes. Pendente: confirmar resultado do audit em produção e apagar 1 entrega de teste do Ricardo (aguardando id via SELECT).`
- `2026-06-18 — Orquestrador — Sessão 1 (Visibilidade no admin) implementada — Migration aditiva 20260618120000_deliveries_created_by.sql (ADD COLUMN created_by_profile_id + created_by_name + índice, não-destrutiva). api.ts: createDelivery grava criador (context.profile.id/full_name); updateDeliveryStatus grava delivered_at na finalização manual SÓ se nulo (não sobrescreve o que o canhoto gravou); mapDelivery expõe delivered_at e created_by_name. Reports.tsx: colunas "Criado por" e "Entregue em" na tabela + CSV. Ocorrências já exibiam data/hora (linha 338) — nenhuma mudança. tsc --noEmit e npm run build verdes. ⚠️ ORDEM CRÍTICA: a migration DEVE rodar no Supabase ANTES de publicar o frontend — senão o INSERT de createDelivery falha (coluna inexistente) e quebra o cadastro de entrega. Aguardando usuário rodar a migration.`
- `2026-06-09 — Orquestrador — Ciclo abortado em pré-flight — Working tree sujo (4 arquivos M + 5 novos não-commitados) impede delegação ao Maker conforme regra ALWAYS #2. Bug Ana/Diego investigado por agente Explore (sem alterar código): causa raiz #1 = driver_id nulo no localStorage; causa #2 = vínculo drivers↔profiles quebrado (padrão Arlex). AGORA.sql confirmado como não-aplicado. Decisão pendente do usuário: (a) commitar/stashar WIP, (b) rodar AGORA.sql contra Ana/Diego antes de patch em código, (c) só então delegar Maker para o patch defensivo (log + fallback amigável + mensagem de erro real). Bug e achados adjacentes registrados em "Bugs Abertos".`
- `2026-06-18 — Orquestrador — Diagnóstico consolidado dos 4 bugs de campo (iniciar rota / cadastrar ocorrência / cadastrar NF / painel admin) via 3 agentes Explore — Conclusão: NÃO são 4 problemas independentes, são 2 causas-raiz sobrepostas. CAUSA A (vínculo operacional quebrado drivers↔profiles↔company_id): derruba iniciar rota e ocorrência (driver_id/company_id não resolvem) e contamina o painel admin via RLS por company_id. Já existe RPC pronta no schema: audit_driver_integrity() lista todos os quebrados e os 8 tipos de issue; repair_driver_company_from_profile() conserta o caso EMPRESA_DIVERGENTE_DRIVER_PROFILE tratando profiles.company_id como fonte da verdade (só onde não há entrega conflitante). CAUSA B (erros engolidos + KPI mal mapeado): (1) DriverDashboard.tsx ~L107 catch(()=>{}) engole o erro do auto-recover de driver_id; (2) api.ts startDriverTracking ~L1108-1118 troca error.message do RPC por "Sessão de rastreamento não criada" genérico; (3) DeliveryUpload.tsx ~L869-878 mostra a variável `error` (1ª tentativa Gemini) em vez de `fallbackError` (erro real do OCR Tesseract), enganando o motorista; (4) api.ts extractNfeWithGemini ~L1567-1591 expõe "Serviço de leitura indisponível" fixo escondendo o corpo/status real da edge function; (5) AdminDashboard.tsx ~L81-86 lê o KPI pela chave pending_deliveries quando getDashboardKPIs (api.ts ~L1020-1035) devolve today_deliveries.pending/.in_progress → contador "Pendentes" diverge; ASSIGNED é contado como "pendente" no KPI e "carregada" no painel de carga (~L135-144) → total não fecha; active_drivers usa Math.max(drivers, posições) e diverge do RealtimeDashboard; audit_driver_integrity é SECURITY DEFINER SEM filtro de company_id → admin de uma empresa enxerga motorista de outra. DECISÕES DO USUÁRIO: (a) REGRA DE OURO — nada pode impedir os motoristas de trabalhar hoje; hoje é só capturar/registrar (read-only), correção e deploy ficam pra tarde em janela combinada; (b) para vínculo quebrado NÃO-reparável automaticamente (sem perfil/sem empresa), apenas melhorar a mensagem mostrando a causa real — sem bloqueio nem alerta proativo no admin; (c) acesso Supabase configurado via MCP remoto (.mcp.json, project_ref jmxckbbunoyrsxkaubmi) travado em read_only=true durante a operação — flipar para escrita só na janela da tarde. Plano completo em ~/.claude/plans/sleepy-inventing-crayon.md (WS0 leitura/escrita + WS1-4). PENDENTE AGORA: usuário autenticar o MCP (claude /mcp em terminal real) para eu rodar o inventário read-only audit_driver_integrity() — o "para todos os usuários".`
- `2026-06-18 — Orquestrador — Inventário READ-ONLY executado em produção (via REST + service_role, chave fornecida pelo usuário no chat → ROTACIONAR depois) — DADOS REAIS REFUTAM A CAUSA A COMO ATIVA. (1) audit_driver_integrity() e audit_driver_integrity('2026-06-18') retornaram [] → ZERO motoristas ATIVO com vínculo quebrado. Os 8 ATIVO (Joao, Motorista Teste, Rafael, Ana Paula, Arlex, Diego, Ricardo, Tiago) têm profile_id válido e TODOS na empresa real 382695a4-851d-483b-acf2-70c8be8a0010. profiles role=DRIVER com company_id nulo: []. → O reparo de vínculo (WS0-escrita / repair_driver_company_from_profile) NÃO é necessário; "iniciar rota às vezes" é client-side (driver_id nulo no localStorage + race) + erro engolido, não dado quebrado. (2) Colunas created_by_profile_id/created_by_name EXISTEM em deliveries (HTTP 200) → migration 20260618120000 já aplicada em prod; cadastro de NF/entrega não quebra por coluna. (3) PAINEL ADMIN não é RLS/empresa: ambos os perfis não-driver (Leonardo MASTER, Admin Teste ADMIN) estão na empresa real 382695a4; MASTER ignora RLS. A empresa DUPLICATA 11111111-0000-0000-0000-000000000001 tem 0 deliveries e 0 occurrences — está vazia, é só lixo a remover (não esconde dado). Logo o bug do painel é CÓDIGO: KPI mal mapeado (AdminDashboard lê pending_deliveries; API devolve today_deliveries.pending/.in_progress), ASSIGNED contado em dobro, e entrega presa sem filtro de tempo. (4) ANOMALIA DE DADO (não tocar sem aprovação — DADOS SAGRADOS): delivery id 7273faa9-df4c-4a99-bf2d-a0a3c6978bb5 (NF 1141538877, Ana Paula) presa em IN_TRANSIT desde 2026-06-08 (10 dias) infla "em rota". Distribuição geral: PENDING 20 / ASSIGNED 19 / IN_TRANSIT 2 / DELIVERED 360 / FAILED 15. (5) LIXO p/ limpeza à tarde (c/ aprovação): empresa duplicata vazia + 2 drivers INATIVO sem profile_id ("teste cego", "PROBE TESTE - REMOVER criado por engano 17/06"). NET: risco da operação de hoje é BAIXO; correções são quase todas frontend (mensagens reais + KPI), sem escrita no banco durante a operação. Chaves guardadas só em /tmp/idmove_sb.env (fora do git), apagar no fim da sessão.`
- `2026-06-18 — Orquestrador (Maker) — Correções de código aplicadas + entregas de teste do Ricardo apagadas, build/tsc verdes — A pedido do usuário ("arroz com feijão bem feito", nada pode atrapalhar motorista). (1) DELEÇÃO SAGRADA AUTORIZADA: apagadas as 3 entregas de teste do Ricardo (todas NF 9999 / cliente "Hshshs": ids 9f16df53, c1dff181, 78f14027) + 2 ocorrências e 2 delivery_events dependentes. Ordem FK-safe (filhos→pai), via REST service_role, return=representation. Verificado: os 3 ids retornam []; total deliveries 416→413. Nenhum canhoto/prova real existia (não há tabela canhotos/delivery_proofs; só source_document_path em storage, que NÃO apagamos — regra NEVER #17). Nenhum outro motorista tocado. (2) DIAGNÓSTICO REFINADO LENDO O CÓDIGO: responseError() (api.ts:100) JÁ expõe error.message+details+hint+code e passa por translateKnownErrors() — logo o "Unauthorized: caller is not driver" do RPC start_driver_tracking JÁ chega ao toast (DriverDashboard:344). A nota antiga "startDriverTracking engole erro" está obsoleta (referência api.ts:1067 mudou p/ 1108; código atual faz throw error correto). Auto-recover de driver_id já existe (ce28648/2435ba0). → WS1 saudável; só troquei o catch silencioso (DriverDashboard:107) por console.debug diagnóstico. (3) NF (DeliveryUpload.tsx processDocumentWithAI): quando IA E OCR falham, o catch mostrava error.message técnico do Gemini com variant destructive, assustando o motorista — mas o form já abre p/ digitação manual (contingência). Trocado por mensagem amigável "Leitura automática indisponível. Preencha manualmente" (sem variant destructive) + console.error dos DOIS erros (IA e OCR) p/ diagnóstico. api.ts extractNfeWithGemini: agora loga o erro real da edge function e usa error.message como base antes do fallback genérico. (4) PAINEL ADMIN (AdminDashboard.tsx:83): entregasPendentes lia today_deliveries.in_progress PRIMEIRO (só IN_TRANSIT), escondendo PENDING/ASSIGNED — esse era o "não marca infos certas". Corrigido para pending + in_progress (em andamento real, não-entregue e não-falho). npx tsc --noEmit e npm run build VERDES. Arquivos tocados: AdminDashboard.tsx, DeliveryUpload.tsx, api.ts, DriverDashboard.tsx. PENDENTE: loop-checker auditar o diff; usuário rotacionar service_role key; apagar /tmp/idmove_sb.env no fim.`
