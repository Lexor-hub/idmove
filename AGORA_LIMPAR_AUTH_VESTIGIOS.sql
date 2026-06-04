-- ============================================================
-- URGENTE — Limpa vestígios de Ricardo e Reserva no schema auth.*
--
-- Sintoma: ao tentar criar usuário via API admin com email
--   rricardosp2@gmail.com  ou  reserva@test.com
-- GoTrue retorna 500 "Database error checking email".
--
-- Causa: tentativas anteriores do painel deixaram registros órfãos em
-- auth.identities (ou outras tabelas auth.*) com esses emails, mesmo
-- após o auth.users ter sido apagado pelo cleanup automático.
-- PostgREST não expõe o schema auth — precisa rodar SQL no Dashboard.
--
-- Cola em:
-- https://supabase.com/dashboard/project/jmxckbbunoyrsxkaubmi/sql/new
-- ============================================================

-- (1) Diagnóstico — mostra tudo que existe pros 2 emails em todas as tabelas auth.*
SELECT 'auth.users' AS tabela, id::text AS id, email, NULL AS extra
FROM auth.users
WHERE email IN ('rricardosp2@gmail.com', 'reserva@test.com')

UNION ALL

SELECT 'auth.identities', identity_id::text, identity_data->>'email',
       'user_id=' || user_id::text
FROM auth.identities
WHERE identity_data->>'email' IN ('rricardosp2@gmail.com', 'reserva@test.com')

UNION ALL

SELECT 'auth.sessions', s.id::text, u.email, 'auth.users.id=' || u.id::text
FROM auth.sessions s
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE u.email IN ('rricardosp2@gmail.com', 'reserva@test.com')
   OR s.user_id IN (
     SELECT user_id FROM auth.identities
     WHERE identity_data->>'email' IN ('rricardosp2@gmail.com', 'reserva@test.com')
   );

-- ============================================================
-- (2) LIMPEZA — só rode depois de ver o diagnóstico acima
--     Bloco transacional: ou apaga tudo, ou nada.
-- ============================================================

BEGIN;

-- Identidades órfãs (sem auth.user correspondente)
DELETE FROM auth.identities
WHERE identity_data->>'email' IN ('rricardosp2@gmail.com', 'reserva@test.com');

-- auth.users (se sobrou algum)
DELETE FROM auth.users
WHERE email IN ('rricardosp2@gmail.com', 'reserva@test.com');

-- profiles que apontavam pra esses UIDs (deveria ser zero, já apagamos via REST)
DELETE FROM public.profiles
WHERE email IN ('rricardosp2@gmail.com', 'reserva@test.com');

COMMIT;

-- ============================================================
-- (3) Confirmação — deve retornar zero linhas em tudo
-- ============================================================

SELECT 'auth.users' AS tabela, count(*) FROM auth.users
WHERE email IN ('rricardosp2@gmail.com', 'reserva@test.com')

UNION ALL

SELECT 'auth.identities', count(*) FROM auth.identities
WHERE identity_data->>'email' IN ('rricardosp2@gmail.com', 'reserva@test.com')

UNION ALL

SELECT 'public.profiles', count(*) FROM public.profiles
WHERE email IN ('rricardosp2@gmail.com', 'reserva@test.com');
