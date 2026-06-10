-- Auditoria segura de vinculo operacional dos motoristas.
-- Nao apaga NF, canhoto, entrega, ocorrencia, storage, motorista ou usuario.

create or replace function public.audit_driver_integrity(p_target_date date default null)
returns table (
  driver_id uuid,
  driver_name text,
  driver_company_id uuid,
  profile_id uuid,
  profile_company_id uuid,
  auth_user_id uuid,
  profile_role public.user_role,
  issue text
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped_drivers as (
    select distinct d.id
    from public.drivers d
    where d.status = 'ATIVO'
    union
    select distinct d.id
    from public.drivers d
    join public.deliveries dl on dl.driver_id = d.id
    where p_target_date is not null
      and dl.scheduled_date = p_target_date
  ),
  rows as (
    select
      d.id as driver_id,
      d.name as driver_name,
      d.company_id as driver_company_id,
      p.id as profile_id,
      p.company_id as profile_company_id,
      p.auth_user_id,
      p.role as profile_role,
      case
        when d.profile_id is null then 'DRIVER_SEM_PROFILE_ID'
        when p.id is null then 'PROFILE_NAO_ENCONTRADO'
        when p.auth_user_id is null then 'PROFILE_SEM_AUTH_USER'
        when au.id is null then 'AUTH_USER_NAO_ENCONTRADO'
        when p.role <> 'DRIVER' then 'PROFILE_ROLE_NAO_DRIVER'
        when p.company_id is null then 'PROFILE_SEM_EMPRESA'
        when d.company_id <> p.company_id then 'EMPRESA_DIVERGENTE_DRIVER_PROFILE'
        when exists (
          select 1
          from public.deliveries dl
          where dl.driver_id = d.id
            and (p_target_date is null or dl.scheduled_date = p_target_date)
            and dl.company_id <> d.company_id
        ) then 'EMPRESA_DIVERGENTE_DRIVER_DELIVERY'
        else null
      end as issue
    from scoped_drivers sd
    join public.drivers d on d.id = sd.id
    left join public.profiles p on p.id = d.profile_id
    left join auth.users au on au.id = p.auth_user_id
  )
  select *
  from rows
  where issue is not null
  order by driver_name, issue;
$$;

create or replace function public.repair_driver_company_from_profile(p_target_date date default null)
returns table (
  driver_id uuid,
  driver_name text,
  previous_company_id uuid,
  repaired_company_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select
      d.id,
      d.name,
      d.company_id as old_company_id,
      p.company_id as new_company_id
    from public.drivers d
    join public.profiles p on p.id = d.profile_id
    join auth.users au on au.id = p.auth_user_id
    where d.status = 'ATIVO'
      and p.role = 'DRIVER'
      and p.company_id is not null
      and d.company_id <> p.company_id
      and not exists (
        select 1
        from public.deliveries dl
        where dl.driver_id = d.id
          and (p_target_date is null or dl.scheduled_date = p_target_date)
          and dl.company_id <> p.company_id
      )
  ),
  updated as (
    update public.drivers d
    set company_id = c.new_company_id
    from candidates c
    where d.id = c.id
    returning d.id, d.name, c.old_company_id, d.company_id
  )
  select
    updated.id,
    updated.name,
    updated.old_company_id,
    updated.company_id
  from updated
  order by updated.name;
end;
$$;

create or replace function public.assert_driver_integrity_for_date(p_target_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.audit_driver_integrity(p_target_date);

  if v_count > 0 then
    raise exception 'Existem % motoristas com vinculo operacional pendente para %. Rode public.audit_driver_integrity(%) e corrija antes da operacao.', v_count, p_target_date, p_target_date;
  end if;
end;
$$;

grant execute on function public.audit_driver_integrity(date) to authenticated;
grant execute on function public.repair_driver_company_from_profile(date) to authenticated;
grant execute on function public.assert_driver_integrity_for_date(date) to authenticated;
