import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllPages } from '../src/lib/pagination.ts';

test('loads a history larger than the API cap, without skipped or repeated rows', async () => {
  const source = Array.from({ length: 3862 }, (_, id) => ({ id }));
  const calls = [];
  const rows = await fetchAllPages(async (from, to) => {
    calls.push([from, to]);
    // Simulate a server cap below the requested batch size.
    return { data: source.slice(from, Math.min(to + 1, from + 200)), error: null, count: source.length };
  });
  assert.deepEqual(rows, source);
  assert.equal(new Set(rows.map(row => row.id)).size, 3862);
  assert.equal(calls.length, 20);
});

test('stops at the exact total for a full final batch', async () => {
  let calls = 0;
  const rows = await fetchAllPages(async () => {
    calls++;
    return { data: Array(500).fill(null), error: null, count: 1000 };
  });
  assert.equal(rows.length, 1000);
  assert.equal(calls, 2);
});

test('returns an empty history', async () => {
  assert.deepEqual(await fetchAllPages(async () => ({ data: [], error: null, count: 0 })), []);
});

test('fails instead of returning a silently truncated history when a later page fails', async () => {
  const error = new Error('network unavailable');
  await assert.rejects(fetchAllPages(async (from) => from === 0
    ? { data: Array(500).fill(null), error: null, count: 1001 }
    : { data: null, error }), error);
});

test('reports unexpected gaps instead of presenting an incomplete history as complete', async () => {
  await assert.rejects(fetchAllPages(async (from) => ({
    data: from === 0 ? Array(500).fill(null) : [], error: null, count: 501,
  })), /histórico mudou/);
});
