-- ============================================================
-- SEED DEMO - ID TRANSPORTES
-- Executar no Supabase SQL Editor (com role service_role)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. LIMPEZA PRÉVIA (segura – só apaga dados criados pelo seed)
-- ────────────────────────────────────────────────────────────
do $$
declare
  v_id_transp_id uuid;
  v_disalerno_id uuid;
begin
  select id into v_id_transp_id from public.companies where name = 'ID Transportes' limit 1;
  select id into v_disalerno_id from public.companies where name = 'Di Salerno' limit 1;

  if v_id_transp_id is not null then
    delete from public.occurrences       where company_id = v_id_transp_id;
    delete from public.delivery_receipts where company_id = v_id_transp_id;
    delete from public.tracking_points   where company_id = v_id_transp_id;
    delete from public.delivery_events   where company_id = v_id_transp_id;
    delete from public.deliveries        where company_id = v_id_transp_id;
    delete from public.vehicles          where company_id = v_id_transp_id;
  end if;

  if v_disalerno_id is not null then
    delete from public.clients  where company_id = v_disalerno_id;
    delete from public.profiles where company_id = v_disalerno_id;
    -- apaga auth user de Di Salerno
    delete from auth.identities where user_id in (
      select auth_user_id from public.profiles where company_id = v_disalerno_id
    );
    delete from auth.users where id in (
      select auth_user_id from public.profiles where company_id = v_disalerno_id
    );
    delete from public.companies where id = v_disalerno_id;
  end if;

  -- Apaga motorista / driver vinculado à ID Transportes (exceto admin)
  if v_id_transp_id is not null then
    delete from public.drivers where company_id = v_id_transp_id
      and profile_id in (
        select id from public.profiles
        where company_id = v_id_transp_id
        and email = 'motorista@idtransportes.com'
      );
    -- apaga profile do motorista e seu auth user
    delete from auth.identities where user_id in (
      select auth_user_id from public.profiles
      where company_id = v_id_transp_id
      and email in ('motorista@idtransportes.com')
    );
    delete from auth.users where id in (
      select auth_user_id from public.profiles
      where company_id = v_id_transp_id
      and email in ('motorista@idtransportes.com')
    );
    delete from public.profiles
      where company_id = v_id_transp_id
      and email in ('motorista@idtransportes.com');
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- 1. EMPRESAS
-- ────────────────────────────────────────────────────────────

-- 1.1 ID Transportes (upsert seguro)
insert into public.companies (id, name, cnpj, email, status, subscription_plan, max_users, max_drivers)
values (
  '11111111-0000-0000-0000-000000000001',
  'ID Transportes',
  '00.000.000/0001-00',
  'contato@idtransportes.com',
  'ACTIVE',
  'ENTERPRISE',
  50,
  20
)
on conflict (id) do update set
  name              = excluded.name,
  cnpj              = excluded.cnpj,
  status            = excluded.status,
  subscription_plan = excluded.subscription_plan,
  max_users         = excluded.max_users,
  max_drivers       = excluded.max_drivers;

-- 1.2 Di Salerno (empresa cliente)
insert into public.companies (id, name, cnpj, email, status, subscription_plan, max_users, max_drivers)
values (
  '22222222-0000-0000-0000-000000000002',
  'Di Salerno',
  '11.111.111/0001-11',
  'logistica@disalerno.com',
  'ACTIVE',
  'BASIC',
  10,
  5
)
on conflict (id) do update set
  name   = excluded.name,
  cnpj   = excluded.cnpj,
  status = excluded.status;

-- ────────────────────────────────────────────────────────────
-- 2. AUTH USERS  (instance_id = 00000000-...-0000)
-- ────────────────────────────────────────────────────────────

-- 2.1 Motorista - João Motorista
do $$
declare
  v_uid uuid := '33333333-0000-0000-0000-000000000003';
  v_instance_id uuid;
begin
  select instance_id into v_instance_id from auth.users limit 1;
  if v_instance_id is null then
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  end if;

  insert into auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_uid, v_instance_id, 'authenticated', 'authenticated',
    'motorista@idtransportes.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"João Motorista","role":"DRIVER"}'::jsonb,
    now(), now()
  );

  insert into auth.identities (provider_id, user_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  values (
    'motorista@idtransportes.com',
    v_uid,
    'email',
    jsonb_build_object('sub', v_uid::text, 'email', 'motorista@idtransportes.com', 'email_verified', true, 'phone_verified', false),
    now(), now(), now()
  );
end $$;

-- 2.2 Di Salerno Logística (cliente)
do $$
declare
  v_uid uuid := '44444444-0000-0000-0000-000000000004';
  v_instance_id uuid;
begin
  select instance_id into v_instance_id from auth.users limit 1;
  if v_instance_id is null then
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  end if;

  insert into auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_uid, v_instance_id, 'authenticated', 'authenticated',
    'logistica@disalerno.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Di Salerno Logística","role":"OPERATOR"}'::jsonb,
    now(), now()
  );

  insert into auth.identities (provider_id, user_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
  values (
    'logistica@disalerno.com',
    v_uid,
    'email',
    jsonb_build_object('sub', v_uid::text, 'email', 'logistica@disalerno.com', 'email_verified', true, 'phone_verified', false),
    now(), now(), now()
  );
end $$;

-- ────────────────────────────────────────────────────────────
-- 3. PROFILES
-- ────────────────────────────────────────────────────────────

-- 3.1 Admin ID Transportes
-- Garante que o admin já existe ou ajusta company_id / role caso tenha sido criado
insert into public.profiles (id, auth_user_id, company_id, username, email, full_name, role, status, is_active)
select
  '55555555-0000-0000-0000-000000000005',
  u.id,
  '11111111-0000-0000-0000-000000000001',
  'admin',
  'admin@idtransportes.com',
  'Admin ID Transportes',
  'ADMIN',
  'ATIVO',
  true
from auth.users u
where u.email = 'admin@idtransportes.com'
limit 1
on conflict (auth_user_id) do update set
  company_id = '11111111-0000-0000-0000-000000000001',
  role       = 'ADMIN',
  is_active  = true,
  status     = 'ATIVO';

-- 3.2 João Motorista
insert into public.profiles (id, auth_user_id, company_id, username, email, full_name, role, status, is_active)
values (
  '66666666-0000-0000-0000-000000000006',
  '33333333-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000001',
  'joao.motorista',
  'motorista@idtransportes.com',
  'João Motorista',
  'DRIVER',
  'ATIVO',
  true
)
on conflict (auth_user_id) do update set
  company_id = '11111111-0000-0000-0000-000000000001',
  role       = 'DRIVER',
  is_active  = true,
  status     = 'ATIVO';

-- 3.3 Di Salerno Logística (OPERATOR na empresa Di Salerno)
insert into public.profiles (id, auth_user_id, company_id, username, email, full_name, role, status, is_active)
values (
  '77777777-0000-0000-0000-000000000007',
  '44444444-0000-0000-0000-000000000004',
  '22222222-0000-0000-0000-000000000002',
  'disalerno.logistica',
  'logistica@disalerno.com',
  'Di Salerno Logística',
  'OPERATOR',
  'ATIVO',
  true
)
on conflict (auth_user_id) do update set
  company_id = '22222222-0000-0000-0000-000000000002',
  role       = 'OPERATOR',
  is_active  = true,
  status     = 'ATIVO';

-- ────────────────────────────────────────────────────────────
-- 4. DRIVER (João Motorista)
-- ────────────────────────────────────────────────────────────
insert into public.drivers (id, company_id, profile_id, name, cpf, phone, license, status, current_status)
values (
  '88888888-0000-0000-0000-000000000008',
  '11111111-0000-0000-0000-000000000001',
  '66666666-0000-0000-0000-000000000006',
  'João Motorista',
  '12345678901',
  '(11) 99999-0001',
  'AB12345',
  'ATIVO',
  'offline'
)
on conflict (id) do update set
  profile_id     = '66666666-0000-0000-0000-000000000006',
  company_id     = '11111111-0000-0000-0000-000000000001',
  status         = 'ATIVO',
  current_status = 'offline';

-- ────────────────────────────────────────────────────────────
-- 5. VEHICLE
-- ────────────────────────────────────────────────────────────
insert into public.vehicles (id, company_id, driver_id, plate, model, brand, year, color, status)
values (
  '99999999-0000-0000-0000-000000000009',
  '11111111-0000-0000-0000-000000000001',
  '88888888-0000-0000-0000-000000000008',
  'ABC-1234',
  'Sprinter',
  'Mercedes-Benz',
  2022,
  'Branca',
  'ATIVO'
)
on conflict (company_id, plate) do update set
  driver_id = '88888888-0000-0000-0000-000000000008',
  status    = 'ATIVO';

-- ────────────────────────────────────────────────────────────
-- 6. CLIENT (Di Salerno na perspectiva de ID Transportes)
-- ────────────────────────────────────────────────────────────
insert into public.clients (id, company_id, profile_id, name, document, email, phone, address, status)
values (
  'aaaaaaaa-0000-0000-0000-00000000000a',
  '11111111-0000-0000-0000-000000000001',   -- pertence à ID Transportes (transportadora)
  '77777777-0000-0000-0000-000000000007',   -- profile Di Salerno
  'Di Salerno',
  '11.111.111/0001-11',
  'logistica@disalerno.com',
  '(11) 3333-4444',
  'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  'ACTIVE'
)
on conflict (id) do update set
  name       = excluded.name,
  document   = excluded.document,
  status     = excluded.status;

-- ────────────────────────────────────────────────────────────
-- 7. ENTREGAS DE TESTE
-- ────────────────────────────────────────────────────────────

-- 7.1 Entrega PENDENTE
insert into public.deliveries (
  id, company_id, client_id, driver_id, vehicle_id,
  nf_number, client_name, delivery_address,
  delivery_volume, merchandise_value,
  status, scheduled_date, notes
)
values (
  'b0000001-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-00000000000a',
  '88888888-0000-0000-0000-000000000008',
  '99999999-0000-0000-0000-000000000009',
  'NF-001234',
  'Di Salerno',
  'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  3,
  1500.00,
  'PENDING',
  current_date,
  'Entrega de teste - produto frágil'
)
on conflict (id) do update set status = 'PENDING';

-- 7.2 Entrega EM TRÂNSITO
insert into public.deliveries (
  id, company_id, client_id, driver_id, vehicle_id,
  nf_number, client_name, delivery_address,
  delivery_volume, merchandise_value,
  status, scheduled_date, notes
)
values (
  'b0000002-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-00000000000a',
  '88888888-0000-0000-0000-000000000008',
  '99999999-0000-0000-0000-000000000009',
  'NF-001235',
  'Di Salerno',
  'Rua Augusta, 500 - Consolação, São Paulo - SP',
  1,
  800.00,
  'IN_TRANSIT',
  current_date,
  'Entrega em andamento'
)
on conflict (id) do update set status = 'IN_TRANSIT';

-- 7.3 Entrega ENTREGUE
insert into public.deliveries (
  id, company_id, client_id, driver_id, vehicle_id,
  nf_number, client_name, delivery_address,
  delivery_volume, merchandise_value,
  status, scheduled_date, delivered_at, notes
)
values (
  'b0000003-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-00000000000a',
  '88888888-0000-0000-0000-000000000008',
  '99999999-0000-0000-0000-000000000009',
  'NF-001233',
  'Di Salerno',
  'Rua da Consolação, 200 - Centro, São Paulo - SP',
  2,
  2200.00,
  'DELIVERED',
  current_date - 1,
  now() - interval '2 hours',
  'Entregue com sucesso - canhoto assinado'
)
on conflict (id) do update set
  status       = 'DELIVERED',
  delivered_at = now() - interval '2 hours';

-- ────────────────────────────────────────────────────────────
-- 8. EVENTOS DAS ENTREGAS
-- ────────────────────────────────────────────────────────────
insert into public.delivery_events (company_id, delivery_id, driver_id, event_type, description)
values
  ('11111111-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000008', 'ROUTE_STARTED',  'Rota iniciada pelo motorista João'),
  ('11111111-0000-0000-0000-000000000001', 'b0000002-0000-0000-0000-000000000002', '88888888-0000-0000-0000-000000000008', 'LOCATION_UPDATE', 'Motorista a caminho do destino'),
  ('11111111-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000008', 'ROUTE_STARTED',  'Rota iniciada'),
  ('11111111-0000-0000-0000-000000000001', 'b0000003-0000-0000-0000-000000000003', '88888888-0000-0000-0000-000000000008', 'DELIVERED',       'Entrega concluída - canhoto coletado');

-- ────────────────────────────────────────────────────────────
-- 9. TRACKING POINTS (posição simulada para entrega em trânsito)
-- ────────────────────────────────────────────────────────────
insert into public.tracking_points (company_id, driver_id, delivery_id, latitude, longitude, speed)
values
  ('11111111-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000008', 'b0000002-0000-0000-0000-000000000002', -23.5614,  -46.6558, 45.0),
  ('11111111-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000008', 'b0000002-0000-0000-0000-000000000002', -23.5620,  -46.6540, 50.0),
  ('11111111-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000008', 'b0000002-0000-0000-0000-000000000002', -23.5635,  -46.6520, 55.0);

-- ────────────────────────────────────────────────────────────
-- 10. OCORRÊNCIA DE TESTE
-- ────────────────────────────────────────────────────────────
insert into public.occurrences (company_id, delivery_id, driver_id, type, description)
values (
  '11111111-0000-0000-0000-000000000001',
  'b0000001-0000-0000-0000-000000000001',
  '88888888-0000-0000-0000-000000000008',
  'reentrega',
  'Cliente ausente no primeiro horário. Reagendado para período da tarde.'
);

-- ────────────────────────────────────────────────────────────
-- VERIFICAÇÃO FINAL
-- ────────────────────────────────────────────────────────────
select 'COMPANIES'  as tabela, count(*) from public.companies  where id in ('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002')
union all
select 'PROFILES',   count(*) from public.profiles   where company_id in ('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002')
union all
select 'DRIVERS',    count(*) from public.drivers    where company_id = '11111111-0000-0000-0000-000000000001'
union all
select 'VEHICLES',   count(*) from public.vehicles   where company_id = '11111111-0000-0000-0000-000000000001'
union all
select 'CLIENTS',    count(*) from public.clients    where company_id = '11111111-0000-0000-0000-000000000001'
union all
select 'DELIVERIES', count(*) from public.deliveries where company_id = '11111111-0000-0000-0000-000000000001'
union all
select 'EVENTS',     count(*) from public.delivery_events where company_id = '11111111-0000-0000-0000-000000000001'
union all
select 'TRACKING',   count(*) from public.tracking_points where company_id = '11111111-0000-0000-0000-000000000001'
union all
select 'OCCURRENCES',count(*) from public.occurrences where company_id = '11111111-0000-0000-0000-000000000001';
