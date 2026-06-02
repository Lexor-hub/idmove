-- ==============================================================
-- URGENTE — Limpa cadastro órfão do Arlex (freitasluizl472@gmail.com)
--
-- Tentativas anteriores com o pgcrypto quebrado deixaram registros parciais.
-- Agora qualquer nova tentativa esbarra em:
--   duplicate key on profiles_auth_user_id_key (23505)
--
-- 1. https://supabase.com/dashboard/project/jmxckbbunoyrsxkaubmi/sql/new
-- 2. PRIMEIRO roda o bloco DIAGNÓSTICO. Se confirmar que é mesmo o Arlex,
--    aí roda o bloco LIMPEZA.
-- 3. Depois tenta cadastrar de novo pelo painel.
--
-- O órfão tem auth_user_id = 14ec496e-306c-4a37-a751-b89ec5b0d9f6.
-- Esse UUID foi tirado direto da mensagem de erro do print.
-- ==============================================================

-- ============== DIAGNÓSTICO (roda primeiro) ==================
-- Mostra TUDO ligado a esse auth_user_id e ao email.
-- Se for de fato o cadastro parcial do Arlex/Alex, segue pra limpeza.

SELECT
  'auth.users' AS tabela,
  u.id::text   AS id,
  u.email,
  u.created_at::text AS criado_em
FROM auth.users u
WHERE u.id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
   OR u.email = 'freitasluizl472@gmail.com'

UNION ALL

SELECT
  'public.profiles',
  p.id::text,
  p.email,
  p.created_at::text
FROM public.profiles p
WHERE p.auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
   OR p.email = 'freitasluizl472@gmail.com'

UNION ALL

SELECT
  'public.drivers',
  d.id::text,
  d.name,
  d.created_at::text
FROM public.drivers d
WHERE d.profile_id IN (
  SELECT id FROM public.profiles
  WHERE auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
     OR email = 'freitasluizl472@gmail.com'
);

-- ============== LIMPEZA (só roda depois do diagnóstico bater) =====
-- BLOCO TRANSACIONAL: ou apaga tudo, ou não apaga nada (sem meio termo).
-- Não toca em deliveries, occurrences, tracking — apenas no cadastro órfão.
-- Se você cadastrou entregas associadas a esse motorista órfão (improvável,
-- já que ele nem conseguiu logar), avise antes de rodar.

BEGIN;

-- 1) Apaga driver órfão
DELETE FROM public.drivers
WHERE profile_id IN (
  SELECT id FROM public.profiles
  WHERE auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
     OR email = 'freitasluizl472@gmail.com'
);

-- 2) Apaga client órfão (caso role tenha sido CLIENT)
DELETE FROM public.clients
WHERE profile_id IN (
  SELECT id FROM public.profiles
  WHERE auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
     OR email = 'freitasluizl472@gmail.com'
);

-- 3) Apaga profile órfão
DELETE FROM public.profiles
WHERE auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
   OR email = 'freitasluizl472@gmail.com';

-- 4) Apaga identity órfã (login email/senha)
DELETE FROM auth.identities
WHERE user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
   OR (identity_data->>'email') = 'freitasluizl472@gmail.com';

-- 5) Apaga auth.users órfão
DELETE FROM auth.users
WHERE id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
   OR email = 'freitasluizl472@gmail.com';

COMMIT;

-- ============== CONFIRMAÇÃO ==================
-- Roda o diagnóstico de novo. Deve retornar zero linhas.

SELECT count(*) AS registros_remanescentes_arlex
FROM (
  SELECT 1 FROM auth.users
   WHERE id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
      OR email = 'freitasluizl472@gmail.com'
  UNION ALL
  SELECT 1 FROM public.profiles
   WHERE auth_user_id = '14ec496e-306c-4a37-a751-b89ec5b0d9f6'
      OR email = 'freitasluizl472@gmail.com'
) t;
