import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRetryDeliveryPayload, getNextScheduledDate } from './delivery-attempts.ts';

describe('delivery retry attempts', () => {
  it('schedules the next attempt for the day after the failed delivery date', () => {
    assert.equal(getNextScheduledDate({ scheduled_date: '2026-05-01' }), '2026-05-02');
  });

  it('links the retry to the original delivery and increments the attempt number', () => {
    const payload = buildRetryDeliveryPayload(
      {
        id: 'failed-delivery-id',
        company_id: 'company-id',
        client_id: 'client-id',
        driver_id: 'driver-id',
        vehicle_id: 'vehicle-id',
        nf_number: '12345',
        client_name: 'Cliente ABC',
        client_name_extracted: 'Cliente ABC',
        delivery_address: 'Rua 1',
        client_address: 'Rua 1',
        delivery_volume: 3,
        merchandise_value: '120.50',
        scheduled_date: '2026-05-01',
        notes: 'Observacao original',
        source_document_path: 'documents/nf.jpg',
        original_delivery_id: 'root-delivery-id',
        attempt_number: 2,
      },
      {
        occurrenceId: 'occurrence-id',
        nextScheduledDate: '2026-05-02',
        description: 'Destinatario ausente',
      }
    );

    assert.equal(payload.original_delivery_id, 'root-delivery-id');
    assert.equal(payload.attempt_number, 3);
    assert.equal(payload.rescheduled_from_occurrence_id, 'occurrence-id');
    assert.equal(payload.scheduled_date, '2026-05-02');
    assert.equal(payload.status, 'ASSIGNED');
    assert.equal(payload.delivered_at, null);
    assert.match(payload.notes, /Reentrega automatica/);
    assert.match(payload.notes, /Destinatario ausente/);
  });
});
