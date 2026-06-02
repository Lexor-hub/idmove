-- ==============================================================
-- URGENTE v2 — Cinto + suspensório.
-- Rodar AGORA no Supabase Dashboard.
--
-- 1. https://supabase.com/dashboard/project/jmxckbbunoyrsxkaubmi/sql/new
-- 2. Cola TUDO abaixo
-- 3. Run
--
-- Esta versão substitui completamente a função (CREATE OR REPLACE), com
-- TODAS as chamadas pgcrypto qualificadas explicitamente (extensions.crypt,
-- extensions.gen_salt). Não depende de search_path — funciona mesmo se a
-- versão anterior do ALTER FUNCTION não tiver pego.
--
-- Tempo de execução: ~1 segundo. Não derruba nada em produção.
-- Não apaga dados. Não modifica auth.users, profiles, drivers, deliveries.
-- ==============================================================

-- (1) Garante extensão instalada (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- (2) Recria a função com chamadas pgcrypto QUALIFICADAS por schema.
-- Comportamento idêntico ao original; só muda como chama gen_salt/crypt.
create or replace function public.create_managed_user(
  p_email     text,
  p_password  text,
  p_full_name text,
  p_role      public.user_role,
  p_company_id uuid,
  p_username  text    default null,
  p_cpf       text    default null,
  p_status    text    default 'ATIVO'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_role       text;
  v_caller_company_id uuid;
  v_instance_id       uuid;
  v_new_user_id       uuid;
  v_new_profile_id    uuid;
  v_driver_id         uuid;
  v_client_id         uuid;
  v_cpf_clean         text;
begin
  -- Verificar permissão do usuário que está chamando a função
  v_caller_role       := public.current_role();
  v_caller_company_id := public.current_company_id();

  if v_caller_role not in ('MASTER', 'ADMIN', 'SUPERVISOR') then
    raise exception 'Permissão negada para criar usuários.';
  end if;

  if v_caller_role = 'SUPERVISOR' and p_role not in ('OPERATOR', 'DRIVER') then
    raise exception 'Supervisor só pode criar Operador e Motorista.';
  end if;

  if v_caller_role != 'MASTER' and p_company_id != v_caller_company_id then
    raise exception 'Não é possível criar usuários para outra empresa.';
  end if;

  -- Verificar e-mail duplicado com mensagem amigável
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'Já existe um usuário cadastrado com o e-mail %.', p_email;
  end if;

  -- Obter instance_id da instalação Supabase
  select instance_id into v_instance_id from auth.users limit 1;
  if v_instance_id is null then
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  end if;

  -- Normalizar CPF (só dígitos)
  v_cpf_clean := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');

  -- Criar usuário em auth.users (bcrypt da senha via pgcrypto qualificada)
  v_new_user_id := gen_random_uuid();

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    v_new_user_id,
    v_instance_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf'::text)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role::text),
    now(),
    now()
  );

  -- Criar identity para login com e-mail/senha
  insert into auth.identities (
    provider_id,
    user_id,
    provider,
    identity_data,
    created_at,
    updated_at,
    last_sign_in_at
  ) values (
    lower(p_email),
    v_new_user_id,
    'email',
    jsonb_build_object(
      'sub',            v_new_user_id::text,
      'email',          lower(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    now(),
    now(),
    now()
  );

  -- Criar perfil
  insert into public.profiles (
    auth_user_id,
    company_id,
    username,
    email,
    full_name,
    role,
    cpf,
    status,
    is_active
  ) values (
    v_new_user_id,
    p_company_id,
    coalesce(nullif(trim(p_username), ''), lower(p_email)),
    lower(p_email),
    p_full_name,
    p_role,
    v_cpf_clean,
    p_status,
    p_status = 'ATIVO'
  )
  returning id into v_new_profile_id;

  -- Criar registro de motorista se necessário
  if p_role = 'DRIVER' then
    insert into public.drivers (company_id, profile_id, name, cpf, status)
    values (p_company_id, v_new_profile_id, p_full_name, v_cpf_clean, p_status)
    returning id into v_driver_id;
  end if;

  -- Criar registro de cliente se necessário
  if p_role = 'CLIENT' then
    insert into public.clients (company_id, profile_id, name, email, document)
    values (p_company_id, v_new_profile_id, p_full_name, lower(p_email), v_cpf_clean)
    returning id into v_client_id;
  end if;

  return jsonb_build_object(
    'id',           v_new_profile_id,
    'auth_user_id', v_new_user_id,
    'email',        lower(p_email),
    'full_name',    p_full_name,
    'username',     coalesce(nullif(trim(p_username), ''), lower(p_email)),
    'role',         p_role::text,
    'company_id',   p_company_id,
    'status',       p_status,
    'is_active',    (p_status = 'ATIVO'),
    'driver_id',    v_driver_id,
    'client_id',    v_client_id
  );
end;
$$;

-- (3) Permissão de execução (já existia, mantém pra garantir)
GRANT EXECUTE ON FUNCTION public.create_managed_user(
  text, text, text, public.user_role, uuid, text, text, text
) TO authenticated;

-- (4) Sanity check — deve retornar 1 linha com search_path no proconfig
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname = 'create_managed_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- (5) Teste de hash — deve retornar string longa começando com $2a$
SELECT extensions.crypt('teste123', extensions.gen_salt('bf'::text)) AS hash_teste;
