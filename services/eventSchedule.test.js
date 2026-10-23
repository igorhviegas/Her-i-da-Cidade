import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalMessage, formatTime, parseTime, planDay } from './eventSchedule.js';

const t = parseTime;
const legs = (...m) => m.map((minutes) => ({ minutes }));

test('horários: leitura e formatação', () => {
  assert.equal(t('9:05'), 545);
  assert.equal(t('24:00'), null);
  assert.equal(formatTime(t('16:05')), '16:05');
  assert.equal(formatTime(1470), '00:30 (dia seguinte)');
});

test('1º evento: sai 35 min + trajeto antes; sempre cabe', () => {
  const plan = planDay([{ label: 'A', start: t('14:00'), end: t('15:00') }], legs(30, 20, 15));
  assert.equal(formatTime(plan.rows[0].leaveAt), '12:55');
  assert.equal(formatTime(plan.homeAt), '15:30'); // 15:00 + 10 + 20
  assert.equal(formatTime(plan.vitorAt), '15:45');
  assert.ok(plan.feasible);
});

test('2º evento: fim + 10 + trajeto + 30 precisa caber no início', () => {
  const stops = [{ label: 'A', start: t('10:00'), end: t('11:00') }, { label: 'B', start: t('12:00'), end: t('13:00') }];
  const ok = planDay(stops, legs(20, 20, 20), { first: 35, next: 30, after: 10 });
  assert.equal(ok.rows[1].slack, 0); // 11:00+10+20 = 11:30 = 12:00-30
  assert.ok(ok.feasible);
  const no = planDay(stops, legs(20, 21, 20));
  assert.equal(no.rows[1].slack, -1);
  assert.ok(!no.feasible);
  assert.equal(no.vitorAt, null);
});

test('mensagem inclui a previsão', () => {
  assert.match(arrivalMessage({ arrivalAt: t('17:40'), now: t('14:10') }), /às 14:10[\s\S]*~17:40/);
});
