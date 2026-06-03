-- ============================================================
-- URGENTE v3 — CORRIGE A CAUSA REAL do erro 23505
--
-- Reproduzi o bug via API: existe um TRIGGER em auth.users que cria
-- profile automaticamente (role=CLIENT, company_id=NULL). Depois o RPC
-- tenta INSERT manual no mesmo profile e dá duplicate key.
--
-- Fix: usar UPSERT (ON CONFLICT) no profile e drivers/clients. Idempotente.
--
-- Cola em:
-- https://supabase.com/dashboard/project/jmxckbbunoyrsxkaubmi/sql/new
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'Já existe um usuário cadastrado com o e-mail %.', p_email;
  end if;

  select instance_id into v_instance_id from auth.users limit 1;
  if v_instance_id is null then
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  end if;

  v_cpf_clean := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');

  v_new_user_id := gen_random_uuid();

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_new_user_id, v_instance_id, 'authenticated', 'authenticated',
    lower(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf'::text)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role::text),
    now(), now()
  );

  insert into auth.identities (
    provider_id, user_id, provider, identity_data,
    created_at, updated_at, last_sign_in_at
  ) values (
    lower(p_email), v_new_user_id, 'email',
    jsonb_build_object(
      'sub',            v_new_user_id::text,
      'email',          lower(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    now(), now(), now()
  );

  -- *** MUDANÇA PRINCIPAL: UPSERT em vez de INSERT ***
  -- Trigger em auth.users pode ter criado o profile com defaults; aqui
  -- garantimos que os campos finais ficam corretos.
  insert into public.profiles (
    auth_user_id, company_id, username, email, full_name,
    role, cpf, status, is_active
  ) values (
    v_new_user_id, p_company_id,
    coalesce(nullif(trim(p_username), ''), lower(p_email)),
    lower(p_email), p_full_name, p_role, v_cpf_clean, p_status,
    p_status = 'ATIVO'
  )
  on conflict (auth_user_id) do update set
    company_id = excluded.company_id,
    username   = excluded.username,
    email      = excluded.email,
    full_name  = excluded.full_name,
    role       = excluded.role,
    cpf        = excluded.cpf,
    status     = excluded.status,
    is_active  = excluded.is_active
  returning id into v_new_profile_id;

  if p_role = 'DRIVER' then
    insert into public.drivers (company_id, profile_id, name, cpf, status)
    values (p_company_id, v_new_profile_id, p_full_name, v_cpf_clean, p_status)
    on conflict do nothing
    returning id into v_driver_id;
    if v_driver_id is null then
      select id into v_driver_id from public.drivers where profile_id = v_new_profile_id limit 1;
    end if;
  end if;

  if p_role = 'CLIENT' then
    insert into public.clients (company_id, profile_id, name, email, document)
    values (p_company_id, v_new_profile_id, p_full_name, lower(p_email), v_cpf_clean)
    on conflict do nothing
    returning id into v_client_id;
    if v_client_id is null then
      select id into v_client_id from public.clients where profile_id = v_new_profile_id limit 1;
    end if;
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

GRANT EXECUTE ON FUNCTION public.create_managed_user(
  text, text, text, public.user_role, uuid, text, text, text
) TO authenticated;
