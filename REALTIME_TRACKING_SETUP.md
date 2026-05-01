# Setup: Rastreamento em Tempo Real com PostGIS + Supabase Realtime

## 🎯 Resumo da Implementação

Sistema de rastreamento de motoristas em tempo real usando:
- **PostGIS + motoristas_posicao** — tabela de "última posição" (1 linha/motorista)
- **Supabase Realtime** — Push de atualizações em tempo real para o admin
- **Background Geolocation** — Rastreamento em segundo plano no Android
- **Offline Detection** — Status visual após 2 minutos sem atualização

## 📋 Arquivos Criados/Modificados

| Arquivo | Alteração |
|---|---|
| `supabase/migrations/20260502000000_motoristas_posicao.sql` | ✨ Novo |
| `capacitor.config.ts` | ✨ Novo |
| `src/hooks/useDriverLocation.ts` | ✨ Novo |
| `src/services/api.ts` | 🔄 +`upsertDriverPosition()` |
| `src/pages/dashboard/DriverDashboard.tsx` | 🔄 +hook integração |
| `src/lib/driver-status.ts` | 🔄 +status "offline" |
| `src/pages/dashboard/Tracking.tsx` | 🔄 Realtime em vez de polling |

## 🚀 Setup do Banco de Dados

### 1. Executar a migration no Supabase

Copie o conteúdo de `supabase/migrations/20260502000000_motoristas_posicao.sql` e execute no **SQL Editor** do Supabase (https://supabase.com/projects/jmxckbbunoyrsxkaubmi/sql).

**O que a migration faz:**
- ✅ Habilita extensão `postgis`
- ✅ Cria tabela `motoristas_posicao` (1 linha/motorista com POINT geographic)
- ✅ Cria view `v_motoristas_posicao` para converter geography → lat/lon (legível no JS)
- ✅ Cria RPC `upsert_driver_position()` com segurança DEFINER
- ✅ Habilita Realtime nesta tabela
- ✅ Configura RLS (driver lê/escreve própria posição, staff lê todas)

**Verificar:**
```sql
SELECT * FROM v_motoristas_posicao;  -- deve estar vazia (sem motoristas com posição ainda)
```

## 📱 Setup do App Mobile (Capacitor)

### 1. Instalar plugin

```bash
npm install @capacitor-community/background-geolocation
```

### 2. Inicializar Capacitor (primeira vez)

```bash
npx cap init "ID Move" "com.idtransportes.idmove" --web-dir dist
npx cap add android
npm run build
npx cap sync android
```

### 3. Configurar permissões Android

Após `cap add android`, editar `android/app/src/main/AndroidManifest.xml` e adicionar:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

### 4. Build + Install APK

```bash
npm run build
npx cap sync android
# Abrir Android Studio e compilar a partir de android/
# OU usar: ./gradlew installDebug (se gradle está no PATH)
```

## 🌐 Como Funciona

### Fluxo do Driver (App Mobile)

1. Driver abre **DriverDashboard** e inicia a rota
2. `locationActive` muda para `true`
3. Hook `useDriverLocation` detecta plataforma:
   - **Native (Android):** ativa `BackgroundGeolocation.addWatcher()` → envia a cada 10m ou 15s
   - **Web (browser):** ativa `navigator.geolocation.watchPosition()` → envia a cada 15s
4. A cada atualização, chama RPC `upsert_driver_position()` → insere/atualiza `motoristas_posicao`

### Fluxo do Admin (Tracking.tsx)

1. Abre página **Rastreamento em Tempo Real**
2. Realtime subscription em `motoristas_posicao` escuta `INSERT` e `UPDATE`
3. A cada evento:
   - Re-fetch da view `v_motoristas_posicao` (converte geography → lat/lon)
   - Atualiza estado React com nova posição
   - Marcador se move no mapa sem F5
4. Timer a cada 30s recalcula `movementStatus`:
   - **moving** (velocidade > 3 km/h)
   - **stopped** (sem movimento por 10+ min)
   - **offline** (sem atualização por 2+ min) — ícone fica cinza

## 🧪 Teste End-to-End

### Teste 1: Fluxo DB

```bash
# Terminal 1: Abrir Supabase Table Editor
https://supabase.com/projects/jmxckbbunoyrsxkaubmi/editor/motoristas_posicao

# Terminal 2: Abrir SQL Editor
https://supabase.com/projects/jmxckbbunoyrsxkaubmi/sql
# Execute: SELECT * FROM v_motoristas_posicao;
```

### Teste 2: Fluxo Browser

1. **Abrir dois navegadores lado-a-lado:**
   - Tab A: http://localhost:8080/#/dashboard → Login → DriverDashboard → "Iniciar Dia" → "Iniciar Rota"
   - Tab B: http://localhost:8080/#/dashboard/rastreamento → Mapa em branco (nenhum motorista)

2. **Em Tab A:** Click "Solicitar Localização" → Permitir acesso ao GPS
   - Você verá logs no console: `[useDriverLocation] Enviando posição...`

3. **Observar Tab B:**
   - ❌ **Sem Realtime configurado:** Precisa F5 para ver o marcador
   - ✅ **Com Realtime:** Marcador aparece automaticamente em ~1s
   - Popup mostra: nome do motorista, status (Ativo/Parado/Offline), última atualização

4. **Aguardar 15s:**
   - Tab B: marcador se move (lat/lon atualiza)
   - Popup mostra novo timestamp

5. **Teste Offline (aguardar 2 minutos sem movimento):**
   - Tab A: Click "Parar Rastreamento"
   - Tab B: Após 2 min, ícone do motorista fica **cinza** ("Offline")
   - Popup mostra "Offline" em vez de "Ativo"

### Teste 3: Teste Nativo Android

1. Compilar APK:
   ```bash
   npm run build && npx cap sync android
   # Abrir Android Studio → Build → Run
   ```

2. No device Android:
   - Instalar APK
   - Abrir app → Login → DriverDashboard → "Iniciar Rota"
   - App pede permissão de localização + background
   - **Fechar o app** (não kill — minimize)
   - Abrir navegador web em `http://localhost:8080/#/dashboard/rastreamento` (em outro device ou máquina)
   - Confirmar que rastreamento continua → marcador se move no mapa

## 🔧 Troubleshooting

| Problema | Solução |
|---|---|
| **Build falha** — "BackgroundGeolocation not found" | Normal — plugin só existe em nativo. Hook trata com `try/catch`. |
| **Realtime não funciona** — marcador não aparece em 1s | Verificar: (1) SQL da migration foi executado? (2) `ALTER PUBLICATION supabase_realtime ADD TABLE motoristas_posicao;` funcionou? (3) Realtime está habilitado no Supabase? |
| **RLS bloqueia upsert** — erro "Unauthorized" | Verificar: (1) Driver tem `profile_id` preenchido? (2) `profiles.auth_user_id` = user_id do login? (3) RPC tem `SECURITY DEFINER`? |
| **Geografia inválida** — `ST_MakePoint` error | Verificar ordem: PostGIS é `(longitude, latitude)`, **não** lat/lon! |
| **APK não instala** | Verificar: `capacitor.config.ts` tem `appId: com.idtransportes.idmove`? Android SDK instalado? |

## 📚 Arquitetura de Dados

```sql
-- Tabela nova (1 linha/motorista)
motoristas_posicao {
  motorista_id UUID (PK)
  posicao GEOGRAPHY(POINT, 4326)  -- ST_MakePoint(lon, lat)
  updated_at TIMESTAMPTZ
}

-- View JS-friendly (extrai lat/lon)
v_motoristas_posicao {
  motorista_id UUID
  driver_name TEXT
  company_id UUID
  latitude FLOAT  -- ST_Y(posicao)
  longitude FLOAT -- ST_X(posicao)
  updated_at TIMESTAMPTZ
}

-- Tabela histórica (mantida intacta)
tracking_points {
  id UUID (PK)
  driver_id UUID
  company_id UUID
  delivery_id UUID
  latitude FLOAT
  longitude FLOAT
  accuracy FLOAT
  speed FLOAT
  heading FLOAT
  created_at TIMESTAMPTZ
}
```

## 🎨 Status Visual

| Status | Cor | Threshold |
|---|---|---|
| **Ativo (moving)** | Verde (#047857) | velocity > 3 km/h |
| **Parado (stopped)** | Amarelo (#b45309) | 10+ min sem movimento |
| **Offline** | Cinza (#6b7280) | 2+ min sem atualização |

## 📞 Contato

Se houver dúvidas sobre a implementação, consulte:
- `/plano` — Ver plano completo em `.claude/plans/`
- `supabase/migrations/20260502000000_motoristas_posicao.sql` — Script SQL
- `src/hooks/useDriverLocation.ts` — Hook de geolocalização
- `src/pages/dashboard/Tracking.tsx` — Realtime + Leaflet
