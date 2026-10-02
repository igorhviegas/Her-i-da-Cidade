import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultInitialStatus, resolveInitialStatus } from './orderInitialStatus.js';

test('o status inicial é o configurado no serviço, inclusive Entregar em serviços imediatos', () => {
  assert.equal(resolveInitialStatus({ productionType: 'immediate', initialStatus: 'delivery' }), 'delivery');
  for (const status of ['scheduled', 'recording', 'editing', 'delivery', 'completed']) {
    assert.equal(resolveInitialStatus({ initialStatus: status }), status);
  }
});

test('conclusão automática não sobrescreve o status configurado; só vale sem status', () => {
  assert.equal(resolveInitialStatus({ initialStatus: 'delivery', autoComplete: true }), 'delivery');
  assert.equal(resolveInitialStatus({ initialStatus: 'recording', autoComplete: true }), 'recording');
  assert.equal(resolveInitialStatus({ autoComplete: true }), 'completed');
});

test('sem status válido nem conclusão automática o serviço não está configurado', () => {
  assert.equal(resolveInitialStatus({}), null);
  assert.equal(resolveInitialStatus({ initialStatus: 'foo' }), null);
  assert.equal(resolveInitialStatus(null), null);
});

test('novos serviços imediatos sugerem Entregar; os demais não sugerem nada', () => {
  assert.equal(defaultInitialStatus('immediate'), 'delivery');
  for (const type of ['scheduled', 'recording', 'editing', '']) assert.equal(defaultInitialStatus(type), '');
});
