-- Adiciona a flag view_company_data em profiles e atualiza RLS para
-- permitir que clientes "demo" enxerguem todas as entregas e canhotos
-- da empresa em que estão vinculados.

alter table public.profiles
  add column if not exists view_company_data boolean not null default false;

-- Atualiza policy de deliveries para respeitar a nova flag
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
      or coalesce((public.current_profile()).view_company_data, false)
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

-- Atualiza policy de delivery_receipts: continua restrito por company,
-- mas agora a flag view_company_data garante leitura mesmo se o CLIENT
-- não tiver registros próprios em clients.
drop policy if exists "receipts role scoped" on public.delivery_receipts;
create policy "receipts role scoped" on public.delivery_receipts
for all using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and (
      public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER')
      or coalesce((public.current_profile()).view_company_data, false)
      or delivery_id in (
        select d.id from public.deliveries d
        where d.client_id in (
          select id from public.clients where profile_id = (public.current_profile()).id
        )
      )
    )
  )
)
with check (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
);

-- Idem para occurrences (para o cliente demo conseguir ver as ocorrências
-- ligadas às entregas que ele agora enxerga).
drop policy if exists "occurrences company scoped" on public.occurrences;
create policy "occurrences company scoped" on public.occurrences
for all using (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
)
with check (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
);

-- Marca o cliente de teste como demo (idempotente)
update public.profiles
set view_company_data = true
where lower(email) = 'cliente@test.com';
