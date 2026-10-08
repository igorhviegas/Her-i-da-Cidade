import test from 'node:test';
import assert from 'node:assert/strict';
import { checkinId, isDay, mondayOf, normalizeCheckin, normalizeWeight, weeklyCounts } from './fitCheckin.js';

test('isDay e checkinId: dia real do calendário; um id por tipo e dia', () => {
  for (const ok of ['2026-10-07', '2024-02-29']) assert.equal(isDay(ok), true);
  for (const bad of ['2026-02-31', '2026-13-01', '2026-10-7', '07/10/2026', '', null, 20261007, '2026-10-07 ']) assert.equal(isDay(bad), false, String(bad));
  assert.equal(checkinId('gym', '2026-10-07'), 'gym_2026-10-07');
  assert.notEqual(checkinId('gym', '2026-10-07'), checkinId('functional', '2026-10-07'));
});

test('normalizeCheckin: valida tipo, data, duração (1–1.440, vírgula vale) e observação; vazio some do resultado', () => {
  assert.deepEqual(normalizeCheckin({ kind: 'gym', day: '2026-10-07' }), { value: { kind: 'gym', day: '2026-10-07' } });
  assert.deepEqual(normalizeCheckin({ kind: 'functional', day: '2026-10-07', durationMin: '45,4', note: '  aula de terça  ' }), { value: { kind: 'functional', day: '2026-10-07', durationMin: 45, note: 'aula de terça' } });
  assert.deepEqual(normalizeCheckin({ kind: 'gym', day: '2026-10-07', durationMin: '', note: '   ' }), { value: { kind: 'gym', day: '2026-10-07' } });
  for (const bad of [{ kind: 'yoga', day: '2026-10-07' }, { kind: 'gym', day: '2026-02-31' }, { kind: 'gym', day: '2026-10-07', durationMin: 0 }, { kind: 'gym', day: '2026-10-07', durationMin: 2000 }, { kind: 'gym', day: '2026-10-07', durationMin: 'abc' }, { kind: 'gym', day: '2026-10-07', note: 'x'.repeat(301) }]) {
    assert.ok('error' in normalizeCheckin(bad), JSON.stringify(bad));
  }
});

test('normalizeWeight: 20–500 kg, vírgula vale, arredonda a 2 casas', () => {
  assert.deepEqual(normalizeWeight({ day: '2026-10-07', kg: '72,456' }), { value: { day: '2026-10-07', kg: 72.46 } });
  for (const kg of ['', 'abc', '19', '501', null]) assert.ok('error' in normalizeWeight({ day: '2026-10-07', kg }), String(kg));
  assert.ok('error' in normalizeWeight({ day: '2026-02-31', kg: 70 }));
});

test('mondayOf e weeklyCounts: semanas de segunda a domingo; semana sem treino conta 0; tipo desconhecido e fora da janela ficam de fora', () => {
  assert.equal(mondayOf('2026-10-07'), '2026-10-05'); // quarta
  assert.equal(mondayOf('2026-10-05'), '2026-10-05'); // segunda
  assert.equal(mondayOf('2026-10-11'), '2026-10-05'); // domingo
  assert.equal(mondayOf('2026-01-01'), '2025-12-29'); // virada de ano
  const rows = weeklyCounts([
    { kind: 'gym', day: '2026-10-05' }, { kind: 'gym', day: '2026-10-07' }, { kind: 'functional', day: '2026-10-11' },
    { kind: 'gym', day: '2026-09-22' }, { kind: 'yoga', day: '2026-10-06' }, { kind: 'gym', day: '2025-01-01' },
  ], '2026-10-08', 3);
  assert.deepEqual(rows.map((r) => r.weekStart), ['2026-09-21', '2026-09-28', '2026-10-05']);
  assert.deepEqual(rows.map((r) => [r.gym, r.functional, r.total]), [[1, 0, 1], [0, 0, 0], [2, 1, 3]]);
});
