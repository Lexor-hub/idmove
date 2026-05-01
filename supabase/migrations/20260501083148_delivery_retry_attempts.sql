alter table public.deliveries
  add column if not exists original_delivery_id uuid references public.deliveries(id) on delete set null,
  add column if not exists attempt_number integer not null default 1,
  add column if not exists rescheduled_from_occurrence_id uuid references public.occurrences(id) on delete set null;

alter table public.occurrences
  add column if not exists rescheduled_delivery_id uuid references public.deliveries(id) on delete set null,
  add column if not exists next_scheduled_date date;

create index if not exists idx_deliveries_original_delivery_id
  on public.deliveries(original_delivery_id);

create index if not exists idx_occurrences_rescheduled_delivery_id
  on public.occurrences(rescheduled_delivery_id);
