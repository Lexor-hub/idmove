import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldSendTrackingPoint, toKmh } from './driver-tracking.ts';

describe('driver tracking decisions', () => {
  it('sends the first point immediately', () => {
    assert.equal(
      shouldSendTrackingPoint({
        previous: null,
        next: { latitude: -23.55, longitude: -46.63, accuracy: 12, recordedAt: 1_000 },
      }),
      true
    );
  });

  it('waits at least 3 seconds before sending small movement updates', () => {
    assert.equal(
      shouldSendTrackingPoint({
        previous: { latitude: -23.55, longitude: -46.63, accuracy: 12, recordedAt: 1_000 },
        next: { latitude: -23.55002, longitude: -46.63002, accuracy: 12, recordedAt: 2_500 },
      }),
      false
    );
  });

  it('sends movement updates after 3 seconds when the driver moved at least 2 meters', () => {
    assert.equal(
      shouldSendTrackingPoint({
        previous: { latitude: -23.55, longitude: -46.63, accuracy: 12, recordedAt: 1_000 },
        next: { latitude: -23.55003, longitude: -46.63003, accuracy: 12, recordedAt: 4_500 },
      }),
      true
    );
  });

  it('sends a heartbeat after 10 seconds even when stopped', () => {
    assert.equal(
      shouldSendTrackingPoint({
        previous: { latitude: -23.55, longitude: -46.63, accuracy: 12, recordedAt: 1_000 },
        next: { latitude: -23.55, longitude: -46.63, accuracy: 12, recordedAt: 11_500 },
      }),
      true
    );
  });

  it('sends early when GPS accuracy improves substantially', () => {
    assert.equal(
      shouldSendTrackingPoint({
        previous: { latitude: -23.55, longitude: -46.63, accuracy: 80, recordedAt: 1_000 },
        next: { latitude: -23.55, longitude: -46.63, accuracy: 20, recordedAt: 2_000 },
      }),
      true
    );
  });

  it('converts native meters per second to kilometers per hour', () => {
    assert.equal(toKmh(10), 36);
    assert.equal(toKmh(null), null);
  });
});
