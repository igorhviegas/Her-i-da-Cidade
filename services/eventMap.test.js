import test from 'node:test';
import assert from 'node:assert/strict';
import { eventKey, groupPlaces } from './eventMap.js';

test('groupPlaces junta eventos a poucos metros, conta e marca o local com evento futuro', () => {
  const places = groupPlaces([
    { lat: -19.9, lng: -43.9, label: 'Ana', upcoming: false },
    { lat: -19.90002, lng: -43.90003, label: 'Bia', upcoming: true }, // ~4 m
    { lat: -19.95, lng: -44.0, label: 'Caio', upcoming: false },
    { label: 'Sem endereço', upcoming: true },
  ]);
  assert.equal(places.length, 2);
  assert.deepEqual(places[0], { kind: 'upcoming', lat: -19.9, lng: -43.9, count: 2, label: 'Ana · Bia' });
  assert.equal(places[1].kind, 'visited');
  assert.equal(places[1].count, 1);
});

test('eventKey ignora acentos, maiúsculas e espaços', () => {
  assert.equal(eventKey('2024-05-10', ' Maria  Clara Ávila '), '2024-05-10-maria-clara-avila');
  assert.equal(eventKey('2024-05-10', 'maria clara avila'), eventKey('2024-05-10', 'MARIA CLARA ÁVILA'));
});
