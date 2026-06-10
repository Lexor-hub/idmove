-- Registro transacional de ocorrencias.
-- Nao apaga NF, canhoto, entrega, ocorrencia, storage ou usuario.

create or replace function public.report_delivery_occurrence(
  p_delivery_id uuid,
  p_type text,
  p_description text,
  p_photo_path text default null,
  p_photo_url text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_reschedule boolean default true,
  p_next_scheduled_date date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_driver public.drivers%rowtype;
  v_delivery public.deliveries%rowtype;
  v_occurrence public.occurrences%rowtype;
  v_retry public.deliveries%rowtype;
  v_next_date date;
  v_notes text;
begin
  if auth.uid() is null then
    raise exception 'Sessao expirada. Faca login novamente.';
  end if;

  select *
    into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;

  if v_profile.id is null then
    raise exception 'Perfil do usuario nao encontrado. Faca logout e login novamente.';
  end if;

  select *
    into v_driver
  from public.drivers
  where profile_id = v_profile.id
    and status = 'ATIVO'
  limit 1;

  if v_driver.id is null then
    raise exception 'Motorista nao vinculado ao cadastro operacional. Avise o administrador antes de sair em rota.';
  end if;

  if p_type not in ('reentrega', 'recusa', 'avaria') then
    raise exception 'Tipo de ocorrencia invalido.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Descricao da ocorrencia e obrigatoria.';
  end if;

  select *
    into v_delivery
  from public.deliveries
  where id = p_delivery_id
    and company_id = v_driver.company_id
    and driver_id = v_driver.id
  for update;

  if v_delivery.id is null then
    raise exception 'Entrega nao encontrada para este motorista.';
  end if;

  select *
    into v_occurrence
  from public.occurrences
  where delivery_id = p_delivery_id
    and driver_id = v_driver.id
    and type = p_type
    and description = trim(p_description)
    and created_at >= now() - interval '2 minutes'
  order by created_at desc
  limit 1;

  if v_occurrence.id is not null then
    return to_jsonb(v_occurrence) || jsonb_build_object(
      'rescheduled_delivery_id', v_occurrence.rescheduled_delivery_id,
      'next_scheduled_date', v_occurrence.next_scheduled_date,
      'retry_delivery', null,
      '_deduped', true
    );
  end if;

  insert into public.occurrences (
    company_id,
    delivery_id,
    driver_id,
    type,
    description,
    photo_path,
    photo_url,
    latitude,
    longitude
  ) values (
    v_driver.company_id,
    v_delivery.id,
    v_driver.id,
    p_type,
    trim(p_description),
    nullif(trim(coalesce(p_photo_path, '')), ''),
    nullif(trim(coalesce(p_photo_url, '')), ''),
    p_latitude,
    p_longitude
  )
  returning * into v_occurrence;

  update public.deliveries
  set status = 'FAILED'
  where id = v_delivery.id;

  insert into public.delivery_events (
    company_id,
    delivery_id,
    driver_id,
    event_type,
    description
  ) values (
    v_driver.company_id,
    v_delivery.id,
    v_driver.id,
    'FAILED',
    'Ocorrencia registrada: ' || trim(p_description)
  );

  if p_reschedule then
    v_next_date := coalesce(
      p_next_scheduled_date,
      case
        when v_delivery.scheduled_date is not null then v_delivery.scheduled_date + 1
        else ((now() at time zone 'America/Sao_Paulo')::date + 1)
      end
    );

    v_notes := concat_ws(
      E'\n\n',
      v_delivery.notes,
      'Reentrega automatica gerada a partir da ocorrencia ' || v_occurrence.id || '. Motivo: ' || trim(p_description)
    );

    insert into public.deliveries (
      company_id,
      client_id,
      driver_id,
      vehicle_id,
      nf_number,
      client_name,
      client_name_extracted,
      delivery_address,
      client_address,
      delivery_volume,
      merchandise_value,
      status,
      scheduled_date,
      delivered_at,
      notes,
      source_document_path,
      original_delivery_id,
      attempt_number,
      rescheduled_from_occurrence_id
    ) values (
      v_delivery.company_id,
      v_delivery.client_id,
      v_delivery.driver_id,
      v_delivery.vehicle_id,
      v_delivery.nf_number,
      coalesce(v_delivery.client_name, v_delivery.client_name_extracted, 'Cliente nao informado'),
      coalesce(v_delivery.client_name_extracted, v_delivery.client_name),
      coalesce(v_delivery.delivery_address, v_delivery.client_address, 'Endereco nao informado'),
      coalesce(v_delivery.client_address, v_delivery.delivery_address),
      coalesce(v_delivery.delivery_volume, 1),
      coalesce(v_delivery.merchandise_value, 0),
      case when v_delivery.driver_id is null then 'PENDING'::public.delivery_status else 'ASSIGNED'::public.delivery_status end,
      v_next_date,
      null,
      v_notes,
      v_delivery.source_document_path,
      coalesce(v_delivery.original_delivery_id, v_delivery.id),
      coalesce(v_delivery.attempt_number, 1) + 1,
      v_occurrence.id
    )
    returning * into v_retry;

    update public.occurrences
    set rescheduled_delivery_id = v_retry.id,
        next_scheduled_date = v_next_date
    where id = v_occurrence.id
    returning * into v_occurrence;
  end if;

  return to_jsonb(v_occurrence) || jsonb_build_object(
    'rescheduled_delivery_id', v_retry.id,
    'next_scheduled_date', v_next_date,
    'retry_delivery', case when v_retry.id is null then null else to_jsonb(v_retry) end,
    '_deduped', false
  );
end;
$$;

grant execute on function public.report_delivery_occurrence(
  uuid, text, text, text, text, double precision, double precision, boolean, date
) to authenticated;
