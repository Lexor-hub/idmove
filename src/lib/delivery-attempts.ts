import { toBrtIsoDate } from '@/lib/date';

type DeliveryLike = Record<string, unknown>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toIsoDate = (date: Date) => toBrtIsoDate(date);

const addDaysToIsoDate = (dateIso: string, days: number) => {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return toIsoDate(date);
};

export const getNextScheduledDate = (delivery: DeliveryLike, now = new Date()) => {
  const baseDate =
    typeof delivery.scheduled_date === 'string' && ISO_DATE_PATTERN.test(delivery.scheduled_date)
      ? delivery.scheduled_date
      : toIsoDate(now);

  return addDaysToIsoDate(baseDate, 1);
};

export const buildRetryDeliveryPayload = (
  delivery: DeliveryLike,
  options: {
    occurrenceId: string;
    nextScheduledDate: string;
    description: string;
  }
) => {
  const currentAttempt = Number(delivery.attempt_number || 1);
  const rootDeliveryId = delivery.original_delivery_id || delivery.id;
  const retryNote = [
    `Reentrega automatica gerada a partir da ocorrencia ${options.occurrenceId}.`,
    options.description ? `Motivo: ${options.description}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    company_id: delivery.company_id,
    client_id: delivery.client_id || null,
    driver_id: delivery.driver_id || null,
    vehicle_id: delivery.vehicle_id || null,
    nf_number: delivery.nf_number,
    client_name: delivery.client_name || delivery.client_name_extracted || 'Cliente nao informado',
    client_name_extracted: delivery.client_name_extracted || delivery.client_name || null,
    delivery_address: delivery.delivery_address || delivery.client_address || 'Endereco nao informado',
    client_address: delivery.client_address || delivery.delivery_address || null,
    delivery_volume: Number(delivery.delivery_volume || 1),
    merchandise_value: Number(delivery.merchandise_value || 0),
    status: delivery.driver_id ? 'ASSIGNED' : 'PENDING',
    scheduled_date: options.nextScheduledDate,
    delivered_at: null,
    notes: [delivery.notes, retryNote].filter(Boolean).join('\n\n'),
    source_document_path: delivery.source_document_path || null,
    original_delivery_id: rootDeliveryId,
    attempt_number: currentAttempt + 1,
    rescheduled_from_occurrence_id: options.occurrenceId,
  };
};
