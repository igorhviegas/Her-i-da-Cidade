import test from 'node:test';
import assert from 'node:assert/strict';
import { formatOrderReference, extractBirthdayPerson } from './orderReference.js';

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

test('extractBirthdayPerson: extracts name from ManyChat content format', () => {
  assert.equal(extractBirthdayPerson({ content: 'Aniversariante: Pedro' }), 'Pedro');
  assert.equal(extractBirthdayPerson({ content: 'Aniversariante: Maria Clara\nTema: Homem-Aranha' }), 'Maria Clara');
  assert.equal(extractBirthdayPerson({ content: 'Nome do aniversariante: Lucas Silva.' }), 'Lucas Silva');
  assert.equal(extractBirthdayPerson({ content: 'aniversariante - Júlia' }), 'Júlia');
});

test('extractBirthdayPerson: extracts from childName property if present', () => {
  assert.equal(extractBirthdayPerson({ childName: 'Bernardo' }), 'Bernardo');
  assert.equal(extractBirthdayPerson({ childName: '  Helena  ' }), 'Helena');
});

test('extractBirthdayPerson: returns null when birthday person is absent or invalid', () => {
  assert.equal(extractBirthdayPerson({ content: 'Apenas detalhes gerais sem aniversariante' }), null);
  assert.equal(extractBirthdayPerson({ content: '' }), null);
  assert.equal(extractBirthdayPerson({ content: 'Aniversariante: ' }), null);
  assert.equal(extractBirthdayPerson({ content: 'Aniversariante: undefined' }), null);
  assert.equal(extractBirthdayPerson({ content: 'Aniversariante: null' }), null);
  assert.equal(extractBirthdayPerson({ childName: 'undefined' }), null);
  assert.equal(extractBirthdayPerson(null), null);
  assert.equal(extractBirthdayPerson(undefined), null);
  assert.equal(extractBirthdayPerson({}), null);
});
