# Documento Tecnico da Logica do App ID Transportes

## 1. Objetivo do Produto

O objetivo final do ID Transportes e manter um webapp e um app Android sincronizados, usando o backend atual no Supabase como fonte oficial dos dados. A prioridade de entrega e:

1. Tela do ADMIN funcionando perfeitamente para operacao diaria.
2. App do MOTORISTA no Android para gerir entregas, cadastrar entregas do dia, rastrear rota e anexar canhotos.
3. Tela do CLIENTE para acompanhar suas entregas e visualizar canhotos.
4. Publicacao na Play Store quando o fluxo do motorista estiver estavel, testado e com permissoes Android/LGPD corretas.

O app atual e um frontend React/Vite com Supabase direto no client. O Android deve ser tratado inicialmente como empacotamento Capacitor/PWA do mesmo app web, pois `@capacitor/core`, `@capacitor/android` e `@capacitor/cli` ja estao no `package.json`.

## 2. Arquitetura Atual

### 2.1 Frontend

- Stack: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query e Supabase JS.
- Entrada: `src/main.tsx` renderiza `src/App.tsx`.
- Rotas: `HashRouter` com paginas protegidas por `ProtectedRoute`.
- Autenticacao e contexto: `src/contexts/AuthContext.tsx`.
- Servico de dados: `src/services/api.ts`, que encapsula chamadas ao Supabase.
- Cliente Supabase: `src/integrations/supabase/client.ts`.
- Tipos Supabase principais: `src/integrations/supabase/types.ts`.

### 2.2 Backend Supabase

O backend atual oficial e o Supabase descrito em `supabase/migrations/001_initial_schema.sql`. Ele usa:

- Supabase Auth para login.
- Tabelas publicas com `company_id` para isolamento multi-tenant.
- Row Level Security (RLS) em todas as tabelas principais.
- Funcoes `current_profile()`, `current_company_id()` e `current_role()` para regras de permissao.
- Storage buckets publicos autenticados:
  - `receipts`: imagens de canhotos e fotos de ocorrencias.
  - `delivery-documents`: documentos/imagens da nota fiscal usados no cadastro da entrega.

### 2.3 Modelo Multi-Tenant

Cada usuario possui um registro em `profiles`. Exceto `MASTER`, os usuarios devem estar vinculados a uma empresa por `profiles.company_id`. As entidades operacionais tambem possuem `company_id`, e as politicas RLS restringem leitura/escrita a:

- `MASTER`: todas as empresas.
- Demais perfis: apenas dados da propria empresa.
- `DRIVER`: entregas vinculadas ao seu registro em `drivers`.
- `CLIENT`: entregas vinculadas ao seu registro em `clients`.

## 3. Entidades Supabase Essenciais

### `companies`

Representa cada empresa/tenant. Campos importantes:

- `id`, `name`, `cnpj`, `domain`, `email`.
- `logo`, `primary_color`, `secondary_color`.
- `status`, `subscription_plan`, `max_users`, `max_drivers`.

Uso no app:

- `MASTER` cria e gerencia empresas.
- Usuarios nao-master operam dentro da empresa vinculada.

### `profiles`

Perfil interno de cada usuario autenticado.

- Liga `auth.users` ao dominio do app por `auth_user_id`.
- Define `company_id`, `full_name`, `email`, `username`, `cpf`, `role`, `status`, `is_active`.
- Roles validas: `MASTER`, `ADMIN`, `SUPERVISOR`, `OPERATOR`, `DRIVER`, `CLIENT`.

Uso no app:

- Login carrega o profile e converte para o tipo `User`.
- Criacao de usuario cria `profiles`; se role for `DRIVER`, cria tambem `drivers`; se for `CLIENT`, cria tambem `clients`.

### `clients`

Representa clientes finais que recebem ou acompanham entregas.

- Campos: `company_id`, `profile_id`, `name`, `document`, `email`, `phone`, `address`, `status`.
- `document` deve guardar CPF ou CNPJ somente com digitos, pois ele e usado para vincular entregas importadas por NF-e ao cliente correto.
- Quando um usuario `CLIENT` e criado, o app tambem cria um registro em `clients`.

Uso no app:

- Cliente logado deve ver apenas entregas cujo `client_id` corresponda ao seu registro.
- Dashboard do cliente usa `getDeliveryReports({ client: 'current' })`.
- No cadastro de usuario com perfil `CLIENT`, o admin deve informar CPF/CNPJ para permitir o rastreamento das entregas pelo cliente.

### `drivers`

Representa motoristas operacionais.

- Campos: `company_id`, `profile_id`, `name`, `cpf`, `phone`, `license`, `status`, `current_status`.
- `current_status`: `offline`, `online`, `idle`, `active`.

Uso no app:

- Motorista logado recebe `driver_id` no contexto.
- Entregas sao filtradas por `driver_id`.
- Rastreamento atualiza `drivers.current_status`.

### `vehicles`

Representa veiculos da frota.

- Campos: `company_id`, `driver_id`, `plate`, `model`, `brand`, `year`, `color`, `status`.
- Placa e unica por empresa.

Uso no app:

- Admin gerencia veiculos.
- Pode ser usado para vincular veiculo a entrega, embora o fluxo atual ainda foque mais em motorista/entrega.

### `deliveries`

Entidade central da operacao.

- Campos principais: `company_id`, `client_id`, `driver_id`, `vehicle_id`, `nf_number`, `client_name`, `client_name_extracted`, `delivery_address`, `client_address`, `delivery_volume`, `merchandise_value`, `status`, `scheduled_date`, `delivered_at`, `notes`, `source_document_path`, `original_delivery_id`, `attempt_number`, `rescheduled_from_occurrence_id`.
- Status: `PENDING`, `ASSIGNED`, `IN_TRANSIT`, `DELIVERED`, `FAILED`, `CANCELLED`.

Uso no app:

- Admin cria e atribui entregas.
- Motorista ve as entregas atribuidas a ele.
- Cliente ve entregas associadas ao seu `client_id`.
- Upload de canhoto atualiza a entrega para `DELIVERED` e preenche `delivered_at`.
- Quando uma tentativa falha, a tentativa original permanece como `FAILED` e o sistema cria uma nova entrega para o proximo dia, vinculada por `original_delivery_id`.

### `delivery_events`

Historico de eventos da entrega.

- Campos: `company_id`, `delivery_id`, `driver_id`, `event_type`, `description`, `created_at`.

Uso recomendado:

- Registrar mudancas importantes de status, inicio de rota, entrega finalizada, falha, canhoto anexado e ajustes administrativos.
- A implementacao atual ainda nao usa esse historico de forma central.

### `tracking_points`

Pontos de GPS enviados pelo motorista.

- Campos: `company_id`, `driver_id`, `delivery_id`, `latitude`, `longitude`, `accuracy`, `speed`, `heading`, `created_at`.

Uso no app:

- `DriverDashboard` envia localizacao com `apiService.sendDriverLocation`.
- `Tracking` e dashboards operacionais consultam ultimos pontos por motorista.
- O app filtra localizacoes recentes e mostra motoristas ativos no mapa.

### `delivery_receipts`

Canhotos/comprovantes de entrega.

- Campos: `company_id`, `delivery_id`, `driver_id`, `file_path`, `file_url`, `filename`, `status`, `notes`, `ocr_data`, `validated`.
- Status: `PENDING`, `UPLOADED`, `VALIDATED`, `REJECTED`.

Uso no app:

- Motorista fotografa/anexa canhoto para uma entrega.
- Admin consulta, processa/valida e exporta relatorios.
- Cliente deve conseguir visualizar o comprovante das entregas dele.

### `occurrences`

Ocorrencias de rota/entrega.

- Tipos validos: `reentrega`, `recusa`, `avaria`.
- Campos: `company_id`, `delivery_id`, `driver_id`, `type`, `description`, `photo_path`, `photo_url`, `latitude`, `longitude`, `rescheduled_delivery_id`, `next_scheduled_date`, `created_at`.

Uso no app:

- Motorista registra problema.
- Admin/supervisor acompanha falhas e entregas com problema.
- Ao criar ocorrencia, a entrega e marcada como `FAILED` e a proxima tentativa fica vinculada em `rescheduled_delivery_id`.

## 4. Autenticacao, Sessao e Empresa

### Login

O login usa `supabase.auth.signInWithPassword`, chamado por `apiService.login`. O usuario informa email/senha, e o app:

1. Autentica no Supabase Auth.
2. Busca `profiles` por `auth_user_id`.
3. Se nao existir nenhum profile no banco, cria bootstrap `MASTER`.
4. Busca a empresa vinculada, quando houver.
5. Busca `driver_id` e `client_id` associados ao profile.
6. Retorna um objeto `User` normalizado para o frontend.

O `AuthContext` salva os dados em `localStorage`:

- `id_transporte_token`.
- `id_transporte_user`.
- `id_transporte_company`.

Tambem existe compatibilidade com roles antigas:

- `ADMINISTRADOR` -> `ADMIN`.
- `MOTORISTA` -> `DRIVER`.
- `OPERADOR` -> `OPERATOR`.
- `CLIENTE` -> `CLIENT`.

### Selecao de empresa

Para `MASTER`, `selectCompany(companyId)` permite escolher uma empresa operacional. Para usuarios nao-master, o contexto deve usar a propria empresa vinculada ao profile.

## 5. Papeis, Acessos e Funcionalidades

### MASTER

Objetivo: administrar a plataforma multi-tenant.

Acessos esperados:

- Dashboard Master.
- Gestao de empresas.
- Gestao global de usuarios.
- Relatorios globais.
- Visao de status multi-tenant.

Permissoes Supabase:

- RLS permite acessar todas as empresas e dados, pois `current_role() = 'MASTER'`.
- Pode criar/editar empresas em `companies`.
- Pode listar e gerenciar profiles de diferentes empresas.

Funcionalidades essenciais:

- Criar empresa.
- Editar dados da empresa.
- Definir limites basicos de plano (`max_users`, `max_drivers`).
- Criar usuarios administradores por empresa.
- Auditar uso geral.

### ADMIN

Objetivo: operar a empresa. Este e o perfil prioritario do webapp.

Acessos atuais/esperados:

- Dashboard Administrativo.
- Usuarios.
- Veiculos.
- Entregas/Canhotos em `/dashboard/entregas`.
- Relatorios.
- Rastreamento.
- Busca de canhotos em `/dashboard/receipts-report`.

Permissoes Supabase:

- Acesso limitado a `company_id = current_company_id()`.
- Pode gerenciar profiles da propria empresa.
- Pode criar entregas, motoristas, clientes, veiculos, canhotos e ocorrencias.
- Nao deve acessar dados de outra empresa.

Funcionalidades essenciais:

- Ver KPIs do dia: entregas totais, realizadas, pendentes, ocorrencias e motoristas ativos.
- Criar entrega manualmente ou a partir de imagem/documento de NF-e.
- Atribuir entrega a motorista.
- Ver entregas do dia por data, status e motorista.
- Cadastrar/editar/desativar usuarios.
- Cadastrar motoristas e clientes.
- Cadastrar veiculos.
- Ver mapa de rastreamento com status dos motoristas.
- Consultar canhotos, abrir imagem e exportar CSV.
- Validar OCR/canhoto quando aplicavel.
- Acompanhar ocorrencias.

Fluxo operacional recomendado para o ADMIN:

1. Login.
2. Conferir dashboard do dia.
3. Cadastrar ou importar entregas.
4. Atribuir entregas a motoristas.
5. Acompanhar rastreamento em tempo real.
6. Consultar canhotos enviados.
7. Resolver ocorrencias e validar entregas finalizadas.
8. Gerar relatorios.

### SUPERVISOR

Objetivo: acompanhar a operacao diaria sem administracao completa.

Acessos esperados:

- Dashboard Operacional.
- Entregas/Canhotos.
- Relatorios operacionais.
- Rastreamento.

Permissoes Supabase:

- Pode ver dados da propria empresa.
- Pode inserir/atualizar dados operacionais conforme RLS atual.
- Pode gerenciar alguns profiles da empresa pela politica atual, mas o frontend deve restringir criacao conforme regra de negocio.

Funcionalidades essenciais:

- Acompanhar entregas do dia.
- Monitorar motoristas.
- Consultar canhotos.
- Acompanhar ocorrencias.
- Gerar relatorios basicos.

### OPERATOR

Objetivo: executar tarefas operacionais.

Acessos esperados:

- Mesmo dashboard base de supervisor no app atual.
- Entregas/Canhotos.
- Relatorios basicos.
- Rastreamento, se autorizado pela operacao.

Permissoes Supabase:

- RLS permite acesso por empresa para dados operacionais.
- Deve ter menos poder que supervisor no frontend, especialmente em usuarios e configuracoes.

Funcionalidades essenciais:

- Consultar e atualizar entregas.
- Buscar canhotos.
- Apoiar operacao diaria.

### DRIVER

Objetivo: usar principalmente o app Android para gerir entregas do dia, rastrear rota e enviar canhotos.

Acessos atuais/esperados:

- Dashboard do motorista.
- Minhas entregas.
- Rastreamento/localizacao.
- Cadastro rapido de entrega/NF-e.
- Captura de canhoto.
- Registro de ocorrencia.

Permissoes Supabase:

- Pode ver entregas vinculadas ao seu `driver_id`.
- Pode criar entrega na propria empresa conforme RLS atual.
- Pode criar `tracking_points`.
- Pode anexar canhoto e ocorrencias.
- Nao deve ver entregas de outros motoristas.

Fluxo Android essencial:

1. Motorista faz login.
2. App identifica `driver_id` pelo profile.
3. Motorista toca em iniciar dia.
4. App lista entregas do dia atribuidas ao motorista.
5. Motorista pode cadastrar entrega do dia quando necessario:
   - fotografa/seleciona NF-e;
   - roda OCR quando disponivel;
   - confirma CNPJ, cliente, numero da NF e endereco;
   - salva entrega vinculada ao motorista.
6. Motorista inicia rota.
7. App solicita consentimento de localizacao com texto LGPD.
8. Com consentimento, app inicia `navigator.geolocation.watchPosition`.
9. App envia pontos para `tracking_points` enquanto a rota estiver ativa.
10. Motorista fotografa canhoto da entrega.
11. App faz upload no bucket `receipts` e cria `delivery_receipts`.
12. Entrega muda para `DELIVERED` com `delivered_at`.
13. Se houver problema, motorista registra ocorrencia com tipo, descricao, foto e coordenadas.
14. Motorista finaliza rota.
15. App envia ultima localizacao, muda status para `offline` e para rastreamento.

Regras de localizacao:

- A localizacao deve ser coletada somente com rota ativa.
- O consentimento deve ser registrado localmente e apresentado claramente.
- Motorista pode desativar localizacao durante a rota; status deve ir para `idle`.
- Ao finalizar rota, status deve ir para `offline`.
- Para Play Store, o app deve declarar uso de localizacao e justificar o motivo operacional.

### CLIENT

Objetivo: acompanhar entregas e comprovantes.

Acessos esperados:

- Dashboard "Minhas Entregas".
- Lista de entregas proprias.
- Status da entrega.
- Visualizacao do canhoto quando entregue.
- Relatorios proprios.

Permissoes Supabase:

- Pode ver entregas cujo `client_id` corresponda ao seu registro em `clients`.
- Pode ver canhotos dessas entregas por relacionamento com `deliveries`.
- Nao deve ver entregas/canhotos de outros clientes.

Funcionalidades essenciais:

- Ver total de entregas, entregas realizadas, pendentes e volume.
- Listar entregas recentes.
- Buscar por NF.
- Abrir comprovante/canhoto das entregas realizadas.
- Ver motorista associado quando disponivel.
- Acompanhar status em tempo real quando aplicavel.

## 6. Fluxos Criticos

### 6.1 Cadastro de usuario

Implementado em `apiService.createUser`.

Fluxo:

1. Admin/Master informa dados do usuario.
2. App cria usuario no Supabase Auth via `supabase.auth.signUp`.
3. App restaura sessao do usuario admin atual.
4. App cria registro em `profiles`.
5. Se role for `DRIVER`, cria registro em `drivers`.
6. Se role for `CLIENT`, cria registro em `clients`.

Ponto de atencao:

- Criar usuario pelo client usando `signUp` pode depender da configuracao de confirmacao de email do Supabase.
- Para producao, considerar Edge Function/admin API para criacao controlada de usuarios sem trocar sessao.
- Para usuarios `CLIENT`, CPF/CNPJ e obrigatorio no cadastro do admin. O valor preenche `profiles.cpf` e `clients.document`.

### 6.2 Cadastro e atribuicao de entrega

Fluxo atual principal:

1. Admin abre `/dashboard/entregas`.
2. Clica em "Nova Entrega".
3. `SimpleDeliveryForm` permite anexar imagem da NF-e ou usar camera.
4. OCR local tenta extrair CNPJ, cliente e numero da NF-e.
5. Admin confirma/corrige dados.
6. Admin seleciona motorista, se desejado.
7. App chama `apiService.createDelivery`.
8. Se houver arquivo, o app salva em `delivery-documents`.
9. Cria linha em `deliveries`.
10. Status fica `ASSIGNED` se tiver motorista; caso contrario `PENDING`.

Campos minimos:

- `nf_number`.
- `client_name`.
- `delivery_address`.
- `scheduled_date`.
- `driver_id` opcional.

### 6.3 Envio de canhoto

Fluxo:

1. Motorista escolhe entrega.
2. App abre input/camera para foto.
3. Motorista confirma preview.
4. App chama `apiService.attachReceipt` ou `uploadReceipt`.
5. Arquivo vai para bucket `receipts`.
6. App cria `delivery_receipts`.
7. App atualiza `deliveries.status = DELIVERED`.
8. App define `deliveries.delivered_at = now()`.

Regra importante:

- A conclusao da entrega depende do canhoto enviado, porque o objetivo do app do motorista e cadastrar entregas e comprovantes do dia.

### 6.4 Rastreamento

Fluxo:

1. Motorista inicia rota.
2. App pede consentimento.
3. App chama `watchPosition` com alta precisao.
4. A cada posicao valida, app chama `apiService.sendDriverLocation`.
5. Supabase insere em `tracking_points`.
6. App atualiza `drivers.current_status` para `active`.
7. Admin/Supervisor consulta `getCurrentLocations`.
8. Tela de mapa mostra ultimo ponto por motorista.

Pontos de atencao:

- No Android/Capacitor, usar API nativa de geolocalizacao pode ser mais confiavel que `navigator.geolocation`.
- Se for manter webview, testar comportamento em segundo plano. Play Store e Android restringem localizacao em background.
- Para MVP, rastreamento deve funcionar com app aberto e rota ativa.

### 6.5 Ocorrencias

Fluxo:

1. Motorista escolhe entrega.
2. Registra tipo: `reentrega`, `recusa` ou `avaria`.
3. Informa descricao.
4. Opcionalmente anexa foto e coordenadas.
5. App cria `occurrences`.
6. App atualiza entrega para `FAILED`.
7. App cria uma nova tentativa em `deliveries` para o proximo dia.
8. A nova tentativa copia cliente, motorista, endereco, NF, volume, valor e documento da tentativa original.
9. A nova tentativa recebe `original_delivery_id`, `attempt_number` incrementado e `rescheduled_from_occurrence_id`.
10. A ocorrencia recebe `rescheduled_delivery_id` e `next_scheduled_date`.
11. Admin/Supervisor visualiza a ocorrencia, o motorista responsavel e a data de reentrega.
12. Cliente visualiza o problema, a observacao e a previsao de reentrega.

## 7. Telas e Rotas Atuais

Rotas principais em `src/App.tsx`:

- `/login`: login.
- `/dashboard`: dashboard por role.
- `/dashboard/usuarios`: usuarios.
- `/dashboard/veiculos`: veiculos.
- `/dashboard/rastreamento`: mapa/rastreamento.
- `/dashboard/relatorios`: relatorios.
- `/dashboard/empresas`: empresas.
- `/dashboard/receipts-report`: relatorio/busca de canhotos.
- `/dashboard/entregas`: entregas do dia e cadastro por `CreateDelivery`.
- `/dashboard/gerenciamento-usuarios`: gerenciamento alternativo de usuarios.

Observacao: a rota `/dashboard/entregas` esta registrada no estado atual do workspace e usa `CreateDelivery`. Caso outra branch nao tenha essa rota, ela deve ser adicionada antes de validar o menu de Admin/Supervisor.

## 8. Prioridades de Implementacao

### Prioridade 1: Admin funcionando perfeitamente

Checklist:

- Login admin estavel.
- Dashboard com KPIs reais do Supabase.
- Criacao/listagem/filtro de entregas do dia.
- Atribuicao de motorista.
- Gestao de usuarios sem quebrar sessao do admin.
- Gestao de veiculos.
- Busca e visualizacao de canhotos.
- Rastreamento com mapa carregando motoristas ativos.
- Relatorios minimos de entregas/canhotos.
- Regras de acesso por empresa testadas.

### Prioridade 2: Motorista Android

Checklist:

- Login em tela mobile sem friccao.
- Minhas entregas filtradas por `driver_id`.
- Cadastro rapido de entrega/NF-e pelo celular.
- Captura de foto por camera traseira.
- Upload de canhoto.
- Iniciar/finalizar rota.
- Consentimento LGPD de localizacao.
- Envio de GPS com app aberto.
- Registro de ocorrencia.
- Feedback claro de erro/sucesso.
- Teste real em aparelho Android.

### Prioridade 3: Cliente

Checklist:

- Entregas filtradas por cliente.
- Busca por NF.
- Botao "Ver Comprovante" funcional.
- Status claros: pendente, em rota, entregue, falha.
- Relatorio simples por periodo.

### Prioridade 4: Play Store

Checklist:

- Configurar Capacitor Android.
- Definir `appId`, nome, icone, splash e versao.
- Configurar permissoes Android de camera, internet e localizacao.
- Revisar politica de privacidade e texto LGPD.
- Garantir que localizacao em background nao seja usada sem necessidade e aprovacao.
- Gerar build release assinado.
- Testar em aparelho fisico.
- Publicar teste interno antes da producao.

## 9. Lacunas Tecnicas Atuais

### Funcionalidades descritas por testes Cypress ainda podem estar acima da implementacao

Os testes em `cypress/e2e` descrevem cenarios como offline/sincronizacao, historico de viagens, marcacao manual de entrega realizada e OCR completo. Nem todos esses fluxos estao garantidos no estado atual do app.

Acao recomendada:

- Atualizar os testes para refletir o MVP real.
- Depois evoluir os testes conforme cada funcionalidade for implementada.

### Offline/sincronizacao do Android ainda nao esta definido

O objetivo cita webapp e Android sincronizados. O app atual usa Supabase online direto no client.

MVP recomendado:

- Exigir conexao para login, cadastro de entrega, GPS e upload de canhoto.
- Mostrar erro claro quando offline.

Evolucao posterior:

- Fila local em IndexedDB/SQLite.
- Reenvio automatico de canhotos, ocorrencias e pontos GPS.
- Estados locais: `pending_sync`, `syncing`, `synced`, `sync_failed`.

### Criacao de usuarios pelo client precisa endurecimento para producao

`apiService.createUser` usa `supabase.auth.signUp` no frontend e restaura sessao. Funciona como MVP, mas para producao e melhor mover a criacao de usuarios para backend seguro.

Acao recomendada:

- Criar Supabase Edge Function com service role para criar usuario Auth + profile + driver/client.
- Manter o frontend chamando apenas a funcao autenticada.

### Relacionamento cliente-entrega precisa regra operacional clara

`deliveries.client_id` existe, mas o cadastro atual pode salvar apenas `client_name`. Para o cliente ver suas entregas automaticamente, a entrega precisa ser vinculada ao registro correto em `clients`.

Acao recomendada:

- No cadastro, buscar/criar cliente por documento/CNPJ/email quando possivel.
- Preencher `deliveries.client_id`.
- Manter `client_name` como texto de exibicao.

### Historico de eventos ainda deve ser consolidado

A tabela `delivery_events` existe, mas o fluxo central ainda nao registra todos os eventos.

Acao recomendada:

- Registrar evento em criacao de entrega, atribuicao, inicio de rota, upload de canhoto, ocorrencia e finalizacao.

### Play Store exige politicas e testes especificos

O uso de camera e localizacao precisa estar coerente com o comportamento real do app.

Acao recomendada:

- Documentar coleta de localizacao somente durante rota ativa.
- Evitar background location no primeiro MVP.
- Adicionar politica de privacidade publicada.
- Testar permissao negada, permissao concedida e aparelho sem GPS.

## 10. Criterios de Aceite

### Admin

- Admin logado ve apenas dados da sua empresa.
- Admin cria entrega para hoje e atribui a motorista.
- Entrega aparece no dashboard do motorista.
- Admin ve o motorista no rastreamento apos rota iniciada.
- Admin consulta canhoto apos motorista enviar foto.
- Admin gera relatorio/exportacao minima dos canhotos.

### Motorista

- Motorista logado ve apenas suas entregas.
- Motorista inicia rota com consentimento de localizacao.
- App envia pontos para `tracking_points`.
- Motorista cadastra entrega do dia pelo celular.
- Motorista fotografa canhoto e finaliza entrega.
- Entrega finalizada aparece como entregue para admin e cliente.
- Motorista registra ocorrencia quando nao conseguir concluir entrega.

### Cliente

- Cliente logado ve apenas entregas vinculadas a ele.
- Cliente consegue identificar status e NF.
- Cliente abre o canhoto de entrega realizada.

### Segurança

- Usuario de uma empresa nao acessa dados de outra.
- Motorista nao acessa entregas de outro motorista.
- Cliente nao acessa canhotos de outro cliente.
- Buckets aceitam upload apenas autenticado.

## 11. Recomendacao de Roadmap

### Sprint 1: estabilizar Admin

- Validar rotas e menus.
- Ajustar dashboards para dados reais.
- Fechar CRUD de entregas, usuarios, motoristas, clientes e veiculos.
- Fechar busca/listagem de canhotos.
- Corrigir testes Cypress para o estado real.

### Sprint 2: motorista Android MVP

- Ajustar layout mobile.
- Testar camera e geolocalizacao em aparelho Android.
- Garantir fluxo completo de rota + canhoto.
- Adicionar estados de erro claros.
- Gerar build interno Capacitor.

### Sprint 3: cliente

- Garantir `client_id` nas entregas.
- Implementar busca por NF.
- Implementar "Ver Comprovante".
- Criar relatorio simples do cliente.

### Sprint 4: Play Store

- Configurar Android release.
- Revisar permissoes, politica de privacidade e LGPD.
- Teste interno.
- Ajustes finais e publicacao.
