import test from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, eventsOnDay, shiftDate, visibleRange } from './calendarEvents.js';

const ev = (id, startKey, startTime, extra = {}) => ({ id, title: id, startKey, endKey: startKey, startTime, allDay: startTime === null, ...extra });

test('eventsOnDay: dia inteiro primeiro, depois cronológico; eventos de vários dias aparecem em todos os dias', () => {
  const events = [ev('tarde', '2026-10-10', '15:00'), ev('manha', '2026-10-10', '09:00'), ev('dia', '2026-10-10', null), ev('outro', '2026-10-11', '08:00'), ev('viagem', '2026-10-09', null, { endKey: '2026-10-11' })];
  assert.deepEqual(eventsOnDay(events, '2026-10-10').map((e) => e.id), ['dia', 'viagem', 'manha', 'tarde']);
  assert.deepEqual(eventsOnDay(events, '2026-10-11').map((e) => e.id), ['viagem', 'outro']);
  assert.deepEqual(eventsOnDay(events, '2026-10-12'), []);
});

test('visibleRange: mês em semanas completas dom–sáb, semana dom–sáb, dia único', () => {
  assert.deepEqual(visibleRange('month', '2026-10-15'), { from: '2026-09-27', to: '2026-10-31' }); // 1/10 é quinta; 31/10 é sábado
  assert.deepEqual(visibleRange('month', '2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(visibleRange('month', '2026-12-31'), { from: '2026-11-29', to: '2027-01-02' });
  assert.deepEqual(visibleRange('week', '2026-10-10'), { from: '2026-10-04', to: '2026-10-10' });
  assert.deepEqual(visibleRange('day', '2026-10-10'), { from: '2026-10-10', to: '2026-10-10' });
  assert.equal(daysBetween('2026-09-27', '2026-10-31').length, 35);
});

test('shiftDate: mês limita ao último dia, semana ±7, dia ±1, virada de ano', () => {
  assert.equal(shiftDate('month', '2026-01-31', 1), '2026-02-28');
  assert.equal(shiftDate('month', '2026-01-15', -1), '2025-12-15');
  assert.equal(shiftDate('month', '2026-12-15', 1), '2027-01-15');
  assert.equal(shiftDate('week', '2026-10-10', 1), '2026-10-17');
  assert.equal(shiftDate('day', '2026-10-01', -1), '2026-09-30');
});
