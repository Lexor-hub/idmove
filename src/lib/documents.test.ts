import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeBrazilianDocument } from './documents.ts';

describe('Brazilian document normalization', () => {
  it('keeps only digits from CPF or CNPJ values', () => {
    assert.equal(normalizeBrazilianDocument('12.345.678/0001-90'), '12345678000190');
    assert.equal(normalizeBrazilianDocument('123.456.789-00'), '12345678900');
  });

  it('returns null when no document is provided', () => {
    assert.equal(normalizeBrazilianDocument(''), null);
    assert.equal(normalizeBrazilianDocument(undefined), null);
  });
});
