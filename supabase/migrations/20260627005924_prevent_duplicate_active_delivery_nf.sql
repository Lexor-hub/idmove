-- Evita criar duas entregas abertas para a mesma NF na mesma empresa.
--
-- Nao bloqueia historico preservado (DELIVERED/FAILED/CANCELLED) nem reentregas
-- geradas por ocorrencia, porque essas usam original_delivery_id /
-- rescheduled_from_occurrence_id e tentativa propria.

create unique index if not exists idx_deliveries_active_root_nf_unique
  on public.deliveries (company_id, lower(btrim(nf_number)))
  where nf_number is not null
    and btrim(nf_number) <> ''
    and status in ('PENDING', 'ASSIGNED', 'IN_TRANSIT')
    and original_delivery_id is null
    and rescheduled_from_occurrence_id is null;
