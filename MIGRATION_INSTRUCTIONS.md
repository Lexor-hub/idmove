# 🚀 Como Executar a Migration PostGIS + Realtime

## Opção 1: Via Supabase Dashboard (Recomendado - 1 minuto)

### Passo 1: Abrir SQL Editor
1. Acesse: https://supabase.com/projects/jmxckbbunoyrsxkaubmi/sql
2. Click em "SQL Editor" (ou Nova Query)

### Passo 2: Copiar o SQL Puro

⚠️ **IMPORTANTE:** Copie do arquivo `motoristas_posicao.sql` (SQL puro, sem markdown)

**OU** copie o SQL abaixo sem os backticks:

```sql
-- ============================================
-- MIGRATION: Motoristas Posicao com PostGIS
-- ============================================

-- 1. Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabela de posição atual (1 linha por motorista)
CREATE TABLE IF NOT EXISTS public.motoristas_posicao (
  motorista_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  posicao      GEOGRAPHY(POINT, 4326) NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. View para leitura JS-friendly (extrai lat/lon do geography)
CREATE OR REPLACE VIEW public.v_motoristas_posicao AS
SELECT
  mp.motorista_id,
  d.name          AS driver_name,
  d.company_id,
  ST_Y(mp.posicao::geometry) AS latitude,
  ST_X(mp.posicao::geometry) AS longitude,
  mp.updated_at
FROM public.motoristas_posicao mp
JOIN public.drivers d ON d.id = mp.motorista_id;

-- 4. RPC para upsert com validação de ownership
CREATE OR REPLACE FUNCTION public.upsert_driver_position(
  p_motorista_id UUID,
  p_latitude     DOUBLE PRECISION,
  p_longitude    DOUBLE PRECISION
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_driver_id UUID;
BEGIN
  -- Verifica que o caller é o próprio motorista
  SELECT d.id INTO v_driver_id
  FROM public.drivers d
  JOIN public.profiles p ON p.id = d.profile_id
  WHERE p.auth_user_id = auth.uid() AND d.id = p_motorista_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: caller is not driver %', p_motorista_id;
  END IF;

  INSERT INTO public.motoristas_posicao (motorista_id, posicao, updated_at)
  VALUES (
    p_motorista_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    NOW()
  )
  ON CONFLICT (motorista_id) DO UPDATE
  SET posicao    = EXCLUDED.posicao,
      updated_at = EXCLUDED.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_driver_position TO authenticated;

-- 5. Habilitar Realtime nesta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas_posicao;

-- 6. RLS
ALTER TABLE public.motoristas_posicao ENABLE ROW LEVEL SECURITY;

-- Motorista lê/escreve a própria linha
CREATE POLICY "driver_own_position" ON public.motoristas_posicao
  FOR ALL TO authenticated
  USING (
    motorista_id IN (
      SELECT d.id FROM public.drivers d
      JOIN public.profiles p ON p.id = d.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    motorista_id IN (
      SELECT d.id FROM public.drivers d
      JOIN public.profiles p ON p.id = d.profile_id
      WHERE p.auth_user_id = auth.uid()
    )
  );

-- Admin/Supervisor/Operator lê todas as posições da própria empresa
CREATE POLICY "staff_read_positions" ON public.motoristas_posicao
  FOR SELECT TO authenticated
  USING (
    motorista_id IN (
      SELECT id FROM public.drivers WHERE company_id = current_company_id()
    )
  );
```

### Passo 3: Executar
1. Click no botão **"Run"** (atalho: `Ctrl+Enter`)
2. Aguarde 5-10 segundos
3. Você verá "Query executed successfully"

### Passo 4: Verificar
Execute em uma nova query para confirmar:
```sql
-- Verificar tabela
SELECT COUNT(*) FROM public.motoristas_posicao;

-- Verificar view
SELECT COUNT(*) FROM public.v_motoristas_posicao;

-- Verificar função
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'upsert_driver_position';
```

---

## Opção 2: Via Supabase CLI (Avançado)

Se tiver o Supabase CLI instalado:

```bash
# 1. Login (primeira vez)
supabase login

# 2. Link seu projeto
supabase link --project-ref jmxckbbunoyrsxkaubmi

# 3. Fazer push da migration
supabase db push

# 4. Verificar status
supabase migration list
```

---

## ✅ Checklist Pós-Execução

Depois de executar a migration, confirme que:

- [ ] Nenhum erro apareceu na execução
- [ ] Tabela `motoristas_posicao` existe (verificar em Data Editor)
- [ ] View `v_motoristas_posicao` existe
- [ ] Função `upsert_driver_position` existe (em Database → Functions)
- [ ] Realtime está habilitado (Database → Replication → supabase_realtime contém a tabela)

---

## 🚨 Se der erro...

| Erro | Solução |
|---|---|
| `ERROR: extension "postgis" does not exist` | PostGIS não está ativada no seu plano. Verificar em Settings → Extensions. Se em plano gratuito, pode precisar upgrade. |
| `ERROR: relation "public.drivers" does not exist` | A tabela `drivers` não existe. Verifique se a migration 001 foi aplicada. |
| `ERROR: column "profile_id" does not exist` | A coluna `profile_id` em `drivers` está faltando. Verify schema. |
| `Unauthorized` quando rodar o RPC | Normal — RPC valida ownership. Testar com um driver autenticado. |

---

## 📱 Próximo Passo

Após a migration estar OK, prossiga com:
1. Iniciar dev server: `npm run dev`
2. Testar DriverDashboard → Iniciar rota → Permitir GPS
3. Abrir Tracking em outra aba → Verificar se marcador aparece em tempo real

Aproveite! 🎉
