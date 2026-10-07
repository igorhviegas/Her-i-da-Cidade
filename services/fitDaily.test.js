import test from 'node:test';
import assert from 'node:assert/strict';
import { average, dayKey, lastDays, movingAverage, series, summarize } from './fitDaily.js';

const rows = [
  { day: '2026-10-05', steps: 1000, walkRunKm: 0.8 },
  { day: '2026-10-07', steps: 3000, walkRunKm: 2.2, weightKg: 72 },
  { day: '2026-10-03', weightKg: 73.5 },
];

test('dayKey usa o dia local do navegador', () => {
  assert.equal(dayKey(new Date(2026, 9, 7, 23, 59)), '2026-10-07');
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('lastDays: janela cronológica terminando no dia pedido; dia sem registro é null (também na virada de mês e de ano)', () => {
  const days = lastDays(rows, '2026-10-07', 5);
  assert.deepEqual(days.map((d) => d.day), ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
  assert.deepEqual(days.map((d) => d.row !== null), [true, false, true, false, true]);
  assert.deepEqual(lastDays([], '2027-01-02', 4).map((d) => d.day), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.equal(lastDays([], '2026-10-07', 90).length, 90);
});

test('series e average: ausente não vira zero e não puxa a média para baixo; zero real conta', () => {
  const days = lastDays([...rows, { day: '2026-10-06', steps: 0 }], '2026-10-07', 5);
  assert.deepEqual(series(days, 'steps'), [null, null, 1000, 0, 3000]);
  assert.equal(average(series(days, 'steps')), 4000 / 3);
  assert.equal(average([null, null]), null);
  assert.equal(average([]), null);
});

test('movingAverage: só com os pontos existentes da janela', () => {
  assert.deepEqual(movingAverage([null, 72, null, 74, null, null, null, null, 80], 3), [null, 72, 72, 73, 74, 74, null, null, 80]);
});

test('summarize: último dia com passos, média, km, peso mais recente e variação do período', () => {
  const s = summarize(lastDays(rows, '2026-10-07', 5));
  assert.deepEqual(s.latestSteps, { day: '2026-10-07', value: 3000 });
  assert.equal(s.avgSteps, 2000);
  assert.ok(Math.abs(s.totalKm - 3) < 1e-9);
  assert.equal(s.daysWithData, 3);
  assert.deepEqual(s.weight, { day: '2026-10-07', value: 72, change: -1.5 });
});

test('summarize sem dados: tudo null, sem NaN nem zero inventado', () => {
  const s = summarize(lastDays([], '2026-10-07', 7));
  assert.deepEqual(s, { latestSteps: null, avgSteps: null, totalKm: null, daysWithData: 0, weight: null });
  assert.equal(summarize(lastDays([{ day: '2026-10-07', weightKg: 72 }], '2026-10-07', 7)).weight.change, null); // uma pesagem só: sem variação
});
