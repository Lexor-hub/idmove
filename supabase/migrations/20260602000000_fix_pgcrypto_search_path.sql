-- Fix: create_managed_user RPC não conseguia chamar gen_salt/crypt (pgcrypto).
--
-- Sintoma (02/06/2026): admin tentava criar motorista no painel e recebia
-- "function gen_salt(unknown) does not exist" (código 42883).
--
-- Causa: pgcrypto no Supabase fica no schema `extensions`. O RPC tinha
-- `SET search_path = public` na declaração — não enxergava as funções da
-- extensão. Resultado: o hash da senha falhava antes de qualquer INSERT.
--
-- Correção: garantir extensão instalada e incluir `extensions` no search_path
-- do RPC. Sem reescrever o corpo da função.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER FUNCTION public.create_managed_user(
  text,                 -- p_email
  text,                 -- p_password
  text,                 -- p_full_name
  public.user_role,     -- p_role
  uuid,                 -- p_company_id
  text,                 -- p_username
  text,                 -- p_cpf
  text                  -- p_status
) SET search_path = public, extensions;
