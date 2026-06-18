-- Fix: linhas em auth.users com colunas de token NULL quebram o GoTrue.
--
-- Sintoma reproduzido em 2026-06-17: GET /auth/v1/admin/users?per_page=200
-- retorna HTTP 500 "Database error finding users"; paginando de 1 em 1, 3 linhas
-- específicas dão 500 enquanto as demais retornam 200. Efeitos em produção:
--   (1) a lista de usuários no admin não carrega;
--   (2) o login dos usuários afetados falha (caso reportado: motorista "Ricardo");
--   (3) novas criações de usuário falham pela metade, gerando drivers órfãos.
--
-- Causa raiz: o RPC create_managed_user inseria em auth.users sem preencher as
-- colunas de token (ver 20260603000000_create_managed_user_upsert.sql, INSERT
-- nas linhas 70-82) — elas ficavam NULL. O scanner do GoTrue (Go string, não
-- *string) falha ao ler NULL nessas colunas.
--
-- Correção: normalizar NULL -> '' nas colunas de token. Operação NÃO destrutiva,
-- idempotente. Nenhum registro é apagado; apenas valores NULL viram string vazia.
-- A blindagem do RPC (impede recorrência) está em 20260617120100.
--
-- IMPORTANTE: rodar no SQL Editor do Supabase — o schema `auth` não é exposto
-- via PostgREST/REST.

-- Evidência antes: quantas linhas estão corrompidas
select count(*) as linhas_corrompidas_antes
from auth.users
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or email_change_confirm_status is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

-- (Opcional) identificar quem são — útil para localizar o "Ricardo"
-- select id, email, created_at from auth.users
-- where confirmation_token is null or recovery_token is null or email_change is null
--    or email_change_token_new is null or email_change_token_current is null
--    or phone_change is null or phone_change_token is null or reauthentication_token is null;

update auth.users set
  confirmation_token          = coalesce(confirmation_token, ''),
  recovery_token              = coalesce(recovery_token, ''),
  email_change                = coalesce(email_change, ''),
  email_change_token_new      = coalesce(email_change_token_new, ''),
  email_change_token_current  = coalesce(email_change_token_current, ''),
  email_change_confirm_status = coalesce(email_change_confirm_status, 0),
  phone_change                = coalesce(phone_change, ''),
  phone_change_token          = coalesce(phone_change_token, ''),
  reauthentication_token      = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or email_change_confirm_status is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

-- Evidência depois: deve retornar 0
select count(*) as linhas_corrompidas_depois
from auth.users
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or email_change_confirm_status is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;
