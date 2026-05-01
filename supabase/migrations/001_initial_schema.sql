create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('MASTER', 'ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.delivery_status as enum ('PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.receipt_status as enum ('PENDING', 'UPLOADED', 'VALIDATED', 'REJECTED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.driver_status as enum ('offline', 'online', 'idle', 'active');
exception when duplicate_object then null;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  domain text,
  email text,
  logo text,
  primary_color text default '#3B82F6',
  secondary_color text default '#1E40AF',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  subscription_plan text default 'BASIC',
  max_users integer default 5,
  max_drivers integer default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  username text not null,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'CLIENT',
  cpf text,
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  document text,
  email text,
  phone text,
  address text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  cpf text,
  phone text,
  license text,
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  current_status public.driver_status not null default 'offline',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  plate text not null,
  model text not null,
  brand text,
  year integer,
  color text,
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, plate)
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  nf_number text not null,
  client_name text not null,
  client_name_extracted text,
  delivery_address text not null,
  client_address text,
  delivery_volume integer default 1,
  merchandise_value numeric(12,2) default 0,
  status public.delivery_status not null default 'PENDING',
  scheduled_date date default current_date,
  delivered_at timestamptz,
  notes text,
  source_document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  event_type text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.tracking_points (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  file_path text not null,
  file_url text,
  filename text not null,
  status public.receipt_status not null default 'UPLOADED',
  notes text,
  ocr_data jsonb,
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.occurrences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  type text not null check (type in ('reentrega', 'recusa', 'avaria')),
  description text not null,
  photo_path text,
  photo_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_auth_user_id on public.profiles(auth_user_id);
create index if not exists idx_profiles_company_id on public.profiles(company_id);
create index if not exists idx_deliveries_company_status on public.deliveries(company_id, status);
create index if not exists idx_deliveries_driver_date on public.deliveries(driver_id, scheduled_date);
create index if not exists idx_tracking_points_driver_created on public.tracking_points(driver_id, created_at desc);
create index if not exists idx_delivery_receipts_delivery_id on public.delivery_receipts(delivery_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_touch_updated_at on public.companies;
create trigger companies_touch_updated_at before update on public.companies for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at before update on public.clients for each row execute function public.touch_updated_at();
drop trigger if exists drivers_touch_updated_at on public.drivers;
create trigger drivers_touch_updated_at before update on public.drivers for each row execute function public.touch_updated_at();
drop trigger if exists vehicles_touch_updated_at on public.vehicles;
create trigger vehicles_touch_updated_at before update on public.vehicles for each row execute function public.touch_updated_at();
drop trigger if exists deliveries_touch_updated_at on public.deliveries;
create trigger deliveries_touch_updated_at before update on public.deliveries for each row execute function public.touch_updated_at();
drop trigger if exists delivery_receipts_touch_updated_at on public.delivery_receipts;
create trigger delivery_receipts_touch_updated_at before update on public.delivery_receipts for each row execute function public.touch_updated_at();

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where auth_user_id = auth.uid() limit 1
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;
alter table public.tracking_points enable row level security;
alter table public.delivery_receipts enable row level security;
alter table public.occurrences enable row level security;

drop policy if exists "companies same company or master" on public.companies;
create policy "companies same company or master" on public.companies
for all using (
  public.current_role() = 'MASTER'
  or id = public.current_company_id()
)
with check (
  public.current_role() = 'MASTER'
  or id = public.current_company_id()
);

drop policy if exists "profiles role scoped select" on public.profiles;
create policy "profiles role scoped select" on public.profiles
for select using (
  auth_user_id = auth.uid()
  or public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR')
  )
);

drop policy if exists "profiles role scoped insert" on public.profiles;
create policy "profiles role scoped insert" on public.profiles
for insert with check (
  auth_user_id = auth.uid()
  or public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR')
  )
);

drop policy if exists "profiles role scoped update" on public.profiles;
create policy "profiles role scoped update" on public.profiles
for update using (
  auth_user_id = auth.uid()
  or public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR')
  )
)
with check (
  auth_user_id = auth.uid()
  or public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR')
  )
);

drop policy if exists "profiles role scoped delete" on public.profiles;
create policy "profiles role scoped delete" on public.profiles
for delete using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR')
  )
);

drop policy if exists "clients company scoped" on public.clients;
create policy "clients company scoped" on public.clients
for all using (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
)
with check (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
);

drop policy if exists "drivers company scoped" on public.drivers;
create policy "drivers company scoped" on public.drivers
for all using (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
)
with check (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
);

drop policy if exists "vehicles company scoped" on public.vehicles;
create policy "vehicles company scoped" on public.vehicles
for all using (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
)
with check (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
);

drop policy if exists "deliveries role scoped" on public.deliveries;
create policy "deliveries role scoped" on public.deliveries
for all using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and (
      public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR')
      or driver_id in (select id from public.drivers where profile_id = (public.current_profile()).id)
      or client_id in (select id from public.clients where profile_id = (public.current_profile()).id)
    )
  )
)
with check (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER')
  )
);

drop policy if exists "events company scoped" on public.delivery_events;
create policy "events company scoped" on public.delivery_events
for all using (public.current_role() = 'MASTER' or company_id = public.current_company_id())
with check (public.current_role() = 'MASTER' or company_id = public.current_company_id());

drop policy if exists "tracking company scoped" on public.tracking_points;
create policy "tracking company scoped" on public.tracking_points
for all using (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
)
with check (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
);

drop policy if exists "receipts role scoped" on public.delivery_receipts;
create policy "receipts role scoped" on public.delivery_receipts
for all using (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
)
with check (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
);

drop policy if exists "occurrences company scoped" on public.occurrences;
create policy "occurrences company scoped" on public.occurrences
for all using (public.current_role() = 'MASTER' or company_id = public.current_company_id())
with check (public.current_role() = 'MASTER' or company_id = public.current_company_id());

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('delivery-documents', 'delivery-documents', true)
on conflict (id) do nothing;

drop policy if exists "receipts bucket authenticated read" on storage.objects;
create policy "receipts bucket authenticated read" on storage.objects
for select using (bucket_id in ('receipts', 'delivery-documents') and auth.role() = 'authenticated');

drop policy if exists "receipts bucket authenticated write" on storage.objects;
create policy "receipts bucket authenticated write" on storage.objects
for insert with check (bucket_id in ('receipts', 'delivery-documents') and auth.role() = 'authenticated');

drop policy if exists "receipts bucket authenticated update" on storage.objects;
create policy "receipts bucket authenticated update" on storage.objects
for update using (bucket_id in ('receipts', 'delivery-documents') and auth.role() = 'authenticated')
with check (bucket_id in ('receipts', 'delivery-documents') and auth.role() = 'authenticated');
