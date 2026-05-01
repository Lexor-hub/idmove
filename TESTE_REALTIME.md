# ✅ Teste Completo: Rastreamento em Tempo Real

## 🧪 Teste Prático End-to-End (5 minutos)

### Pré-requisitos
- ✅ Migration `motoristas_posicao.sql` foi executada no Supabase
- ✅ Build passou sem erros (`npm run build` ✓)
- ✅ Acesso a 2 navegadores/abas (ou 2 máquinas)

---

## Teste 1: Verificar DB (Supabase Dashboard)

### 1.1 Verificar tabelas criadas
1. Abra: https://supabase.com/projects/jmxckbbunoyrsxkaubmi/editor
2. Procure por `motoristas_posicao` na lista de tabelas
   - ✅ Deve aparecer em **public** schema
   - Clique nela → deve estar vazia (0 rows)

### 1.2 Verificar view
1. Vá para **SQL Editor**
2. Execute:
   ```sql
   SELECT * FROM public.v_motoristas_posicao LIMIT 5;
   ```
   - ✅ Deve retornar 0 linhas (nenhum motorista rastreando ainda)

### 1.3 Verificar função RPC
1. Vá para **Database** → **Functions**
2. Procure por `upsert_driver_position`
   - ✅ Deve estar listada em **public** schema

### 1.4 Verificar Realtime
1. Vá para **Database** → **Replication**
2. Procure por `supabase_realtime` publication
3. Expanda e procure por `motoristas_posicao`
   - ✅ Deve estar marcada como habilitada para Realtime

**Resultado esperado:** ✅ Tudo existe e está configurado

---

## Teste 2: Teste de Código (Browser)

### 2.1 Iniciar Dev Server
```bash
npm run dev
```
Aguarde:
```
VITE v5.4.10 ready in X ms
➜ Local:   http://localhost:8080/
```

### 2.2 Abrir 2 Abas/Janelas

**Aba A (Driver):**
- URL: `http://localhost:8080`
- Login com credenciais de motorista (DRIVER role)
- Navegue para: Dashboard → DriverDashboard
- Click: "Iniciar Dia" → "Iniciar Rota"
- Quando solicitar GPS: **Clique "Permitir"**

**Aba B (Admin):**
- URL: `http://localhost:8080`
- Login com credenciais de admin (ADMIN role)
- Navegue para: Dashboard → Rastreamento em Tempo Real
- Deve mostrar um mapa vazio inicialmente

### 2.3 Teste Realtime (Aba A → Aba B)

**Em Aba A (Driver):**
1. Clique em "Solicitar Localização"
2. Aguarde permissão de acesso ao GPS
3. Você verá no **Console** (F12):
   ```
   [useDriverLocation] Enviando posição: lat=-23.55, lon=-46.63
   ```

**Em Aba B (Admin - NÃO CLIQUE F5):**
1. **Sem atualizar a página**, aguarde ~2-3 segundos
2. ✅ Um marcador deve aparecer no mapa com o nome do motorista
3. Clique no marcador → popup mostra:
   - Nome: "João da Silva" (ou nome do motorista)
   - Status: **"Ativo"** (verde)
   - Última atualização: timestamp

**Resultado esperado:** ✅ Marcador aparece automaticamente SEM F5

---

## Teste 3: Atualização Reativa

### 3.1 Movimento do Marcador

**Em Aba A (Driver):**
1. Abra o **Console do navegador** (F12 → Console)
2. Você verá logs como:
   ```
   [useDriverLocation] Enviando posição...
   ```

**Em Aba B (Admin):**
1. Aguarde 15-30 segundos
2. ✅ Marcador deve **se mover ligeiramente** (mesmo que seja no mesmo lugar)
3. Popup deve mostrar novo timestamp

**Resultado esperado:** ✅ Posição atualiza a cada 15s

---

## Teste 4: Detecção de Offline

### 4.1 Parar o rastreamento

**Em Aba A (Driver):**
1. Clique em "Parar Rastreamento" (ou "Finalizar Rota")

**Em Aba B (Admin):**
1. **Aguarde 2 minutos** (120 segundos)
2. ✅ Ícone do motorista deve **ficar CINZA**
3. Popup deve mostrar: **"Offline"** em vez de "Ativo"

**Resultado esperado:** ✅ Status muda para offline automaticamente

---

## Teste 5: Dados no Supabase (SQL)

### 5.1 Verificar dados foram inseridos

1. Abra **SQL Editor** do Supabase
2. Execute:
   ```sql
   SELECT motorista_id, driver_name, latitude, longitude, updated_at 
   FROM public.v_motoristas_posicao;
   ```
   - ✅ Deve retornar 1 linha com:
     - UUID do motorista
     - Nome do motorista
     - Latitude e Longitude válidas
     - Timestamp recente

3. Execute:
   ```sql
   SELECT motorista_id, updated_at 
   FROM public.motoristas_posicao;
   ```
   - ✅ Deve retornar a mesma linha (última posição)

**Resultado esperado:** ✅ Dados estão sendo salvos corretamente

---

## 🎯 Checklist Final

| Teste | Esperado | Resultado |
|---|---|---|
| **DB:** Tabela existe | ✅ motoristas_posicao em public | ☐ |
| **DB:** View existe | ✅ v_motoristas_posicao retorna 0-N | ☐ |
| **DB:** Função existe | ✅ upsert_driver_position em public | ☐ |
| **DB:** Realtime ativo | ✅ Em publication supabase_realtime | ☐ |
| **App:** Build sem erros | ✅ 1895 modules ✓ built | ☐ |
| **Realtime:** Marcador aparece | ✅ Sem F5 em ~2s | ☐ |
| **Realtime:** Posição atualiza | ✅ A cada 15s | ☐ |
| **Offline:** Status muda | ✅ Cinza após 2 min | ☐ |
| **SQL:** Dados salvos | ✅ 1 linha em v_motoristas_posicao | ☐ |

---

## 🚨 Troubleshooting

### Marcador não aparece em Aba B
**Causas possíveis:**
1. ❌ Migration não foi executada (verificar tabela existe)
2. ❌ Driver não tem `profile_id` preenchido
3. ❌ Realtime não está habilitado (verificar publication)
4. ❌ Usuário não tem permissão RLS

**Solução:**
```sql
-- Verificar RLS
SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motoristas_posicao';

-- Testar RPC diretamente (como motorista autenticado)
SELECT upsert_driver_position('UUID-DO-MOTORISTA', -23.55, -46.63);
```

### Build falha com erro de BackgroundGeolocation
**Normal!** O plugin só existe em plataforma nativa.
- ✅ Build do navegador ignora com `require()` dinâmico
- ✅ Só carrega em Android/iOS

### Dados não aparecem em SQL
1. Verificar se `locationActive` está `true` em DriverDashboard
2. Verificar console (F12) para logs de erro
3. Executar manualmente no SQL Editor:
   ```sql
   INSERT INTO public.motoristas_posicao (motorista_id, posicao, updated_at)
   VALUES ('UUID-DO-MOTORISTA', ST_GeographyFromText('POINT(-46.63 -23.55)'), NOW());
   ```

---

## ✅ Se Tudo Passou!

Parabéns! 🎉 Seu sistema de rastreamento em tempo real está **100% funcional**:

- ✅ Drivers enviam posição a cada 15s
- ✅ Admin vê atualização em tempo real (Realtime)
- ✅ Status offline funciona (2 min)
- ✅ Dados persistem no Supabase (PostGIS)
- ✅ App pronto para Android (Capacitor)

**Próximos passos (opcional):**
1. Build APK e testar em Android real
2. Adicionar geofencing (entradas/saídas em entregas)
3. Adicionar heatmap de rotas mais frequentes
4. Integrar push notifications

---

## 📞 Logs Úteis

Se precisa debugar, procure por estes logs no Console (F12):

```javascript
// useDriverLocation.ts
"[useDriverLocation] Enviando posição..."

// Tracking.tsx Realtime
"[rt_motoristas_posicao] Evento recebido"

// Driver-status
"[driver-status] Status computado: moving|stopped|offline"
```

Aproveite! 🚀
