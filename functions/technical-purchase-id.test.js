import test from 'node:test';
import assert from 'node:assert/strict';
import { createTechnicalPurchaseId } from './technical-purchase-id.js';

test('generates distinct UUIDs for each accepted request attempt', () => {
  const ids = Array.from({ length: 100 }, createTechnicalPurchaseId);
  assert.equal(new Set(ids).size, 100);
  assert.ok(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)));
});
