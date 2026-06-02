-- ==============================================================
-- URGENTE — Rodar AGORA no Supabase Dashboard
--
-- 1. Abra https://supabase.com/dashboard
-- 2. Selecione o projeto idmove (jmxckbbunoyrsxkaubmi)
-- 3. Menu lateral: "SQL Editor"
-- 4. Cole o bloco abaixo
-- 5. Aperte "Run"
--
-- Tempo de execução: ~1 segundo. Não derruba nada em produção.
-- Após rodar, o admin já consegue criar motorista normalmente.
-- ==============================================================

-- (1) Garante que a extensão pgcrypto está instalada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- (2) Altera o search_path do RPC pra incluir o schema `extensions`
ALTER FUNCTION public.create_managed_user(
  text, text, text, public.user_role, uuid, text, text, text
) SET search_path = public, extensions;

-- (3) Sanity check — deve retornar 1 linha. Se retornar 0, avise.
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname = 'create_managed_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- (4) Teste rápido (opcional). Se retornar uma string longa, pgcrypto funciona:
SELECT extensions.crypt('teste123', extensions.gen_salt('bf'));
