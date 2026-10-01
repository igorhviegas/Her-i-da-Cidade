import test from 'node:test';
import assert from 'node:assert/strict';
import { formatOrderReference } from './orderReference.js';

test('keeps the sequential label for legacy orders', () => {
  assert.equal(formatOrderReference({ id: 'firestore-id', orderNumberDisplay: '0042' }), '#0042');
});

test('uses a short document-ID prefix when no legacy number exists', () => {
  assert.equal(formatOrderReference({ id: 'AbCdEfGh123456789012' }), '#AbCdEfGh');
});

test('extends the prefix when another order has the same short prefix', () => {
  const order = { id: 'abcdefgh111111111111' };
  const other = { id: 'abcdefgh222222222222' };
  assert.equal(formatOrderReference(order, [order, other]), '#abcdefgh1');
});

test('falls back to the full document ID if case-insensitive IDs collide', () => {
  const order = { id: 'abcdefgh111111111111' };
  const other = { id: 'ABCDEFGH111111111111' };
  assert.equal(formatOrderReference(order, [order, other]), `#${order.id}`);
});

test('avoids colliding with another legacy display number', () => {
  const order = { id: '00011234567890123456' };
  const legacy = { id: 'legacy-id', orderNumberDisplay: '00011234' };
  assert.equal(formatOrderReference(order, [order, legacy]), '#000112345');
});
