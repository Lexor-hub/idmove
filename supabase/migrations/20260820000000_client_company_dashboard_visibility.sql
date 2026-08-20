-- O painel CLIENT representa a empresa escolhida pelo administrador no profile.
-- A leitura abaixo libera entregas e comprovantes somente dessa empresa.
-- Escritas continuam restritas aos perfis operacionais.

drop policy if exists "drivers company scoped" on public.drivers;
drop policy if exists "drivers scoped select" on public.drivers;
drop policy if exists "drivers scoped insert" on public.drivers;
drop policy if exists "drivers scoped update" on public.drivers;
drop policy if exists "drivers scoped delete" on public.drivers;

create policy "drivers scoped select" on public.drivers
for select to authenticated
using (
  public.current_role() = 'MASTER'
  or company_id = public.current_company_id()
);

create policy "drivers scoped insert" on public.drivers
for insert to authenticated
with check (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR')
  )
);

create policy "drivers scoped update" on public.drivers
for update to authenticated
using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and (
      public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR')
      or profile_id = (public.current_profile()).id
    )
  )
)
with check (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and (
      public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR')
      or profile_id = (public.current_profile()).id
    )
  )
);

create policy "drivers scoped delete" on public.drivers
for delete to authenticated
using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR')
  )
);

drop policy if exists "deliveries role scoped" on public.deliveries;
drop policy if exists "deliveries scoped select" on public.deliveries;
drop policy if exists "deliveries scoped insert" on public.deliveries;
drop policy if exists "deliveries scoped update" on public.deliveries;
drop policy if exists "deliveries scoped delete" on public.deliveries;

create policy "deliveries scoped select" on public.deliveries
for select to authenticated
using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and (
      public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'CLIENT')
      or driver_id in (
        select id from public.drivers
        where profile_id = (public.current_profile()).id
      )
    )
  )
);

create policy "deliveries scoped insert" on public.deliveries
for insert to authenticated
with check (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER')
  )
);

create policy "deliveries scoped update" on public.deliveries
for update to authenticated
using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and (
      public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR')
      or driver_id in (
        select id from public.drivers
        where profile_id = (public.current_profile()).id
      )
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

create policy "deliveries scoped delete" on public.deliveries
for delete to authenticated
using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and (
      public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR')
      or driver_id in (
        select id from public.drivers
        where profile_id = (public.current_profile()).id
      )
    )
  )
);

drop policy if exists "receipts role scoped" on public.delivery_receipts;
drop policy if exists "receipts scoped select" on public.delivery_receipts;
drop policy if exists "receipts scoped insert" on public.delivery_receipts;
drop policy if exists "receipts scoped update" on public.delivery_receipts;
drop policy if exists "receipts scoped delete" on public.delivery_receipts;

create policy "receipts scoped select" on public.delivery_receipts
for select to authenticated
using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT')
  )
);

create policy "receipts scoped insert" on public.delivery_receipts
for insert to authenticated
with check (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER')
  )
);

create policy "receipts scoped update" on public.delivery_receipts
for update to authenticated
using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER')
  )
)
with check (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER')
  )
);

create policy "receipts scoped delete" on public.delivery_receipts
for delete to authenticated
using (
  public.current_role() = 'MASTER'
  or (
    company_id = public.current_company_id()
    and public.current_role() in ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER')
  )
);
