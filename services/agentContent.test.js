import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTimer, formatClock, dueAlert, markFired, resetFired, moveItem, sortByOrder,
  DEFAULT_AGENT_STEPS, EVENT_DURATION_MS,
} from './agentContent.js';

const MIN = 60_000;

test('timer: 1 h contratada, ajuste soma/subtrai, termina em zero', () => {
  const t0 = 1_000_000;
  assert.equal(computeTimer({ startedAt: t0 }, t0).remainingMs, EVENT_DURATION_MS);
  assert.equal(computeTimer({ startedAt: t0, adjustMs: 10 * MIN }, t0 + 20 * MIN).remainingMs, 50 * MIN);
  assert.equal(computeTimer({ startedAt: t0, adjustMs: -5 * MIN }, t0 + 20 * MIN).elapsedMs, 20 * MIN);
  assert.equal(computeTimer({ startedAt: t0 }, t0 + 60 * MIN).finished, true);
  assert.equal(computeTimer({ startedAt: t0 }, t0 + 59 * MIN).finished, false);
});

test('formatClock: mm:ss, h:mm:ss e valor absoluto', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(61_000), '01:01');
  assert.equal(formatClock(60 * MIN), '1:00:00');
  assert.equal(formatClock(-90_000), '01:30');
});

test('alertas: 30 min e 5 min disparam uma vez; 5 min tem prioridade e encerra o de 30', () => {
  assert.equal(dueAlert(31 * MIN, {}), null);
  assert.equal(dueAlert(30 * MIN, {}), 'm30');
  assert.equal(dueAlert(30 * MIN, { m30: true }), null);
  assert.equal(dueAlert(5 * MIN, { m30: true }), 'm5');
  assert.equal(dueAlert(3 * MIN, {}), 'm5'); // app voltou do segundo plano já nos 5 min finais
  assert.deepEqual(markFired({}, 'm5'), { m30: true, m5: true });
  assert.deepEqual(markFired({}, 'm30'), { m30: true });
  assert.equal(dueAlert(2 * MIN, markFired({}, 'm5')), null);
});

test('alertas: adicionar tempo rearma só os limiares que voltaram ao futuro', () => {
  assert.deepEqual(resetFired(40 * MIN, { m30: true, m5: true }), { m30: false, m5: false });
  assert.deepEqual(resetFired(20 * MIN, { m30: true, m5: true }), { m30: true, m5: false });
  assert.deepEqual(resetFired(4 * MIN, { m30: true, m5: true }), { m30: true, m5: true });
});

test('moveItem e sortByOrder', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
  assert.deepEqual(sortByOrder([{ order: 2, n: 'x' }, { order: 0, n: 'y' }]).map((x) => x.n), ['y', 'x']);
});

test('roteiro padrão: ordem operacional, alerta de voltagem na instalação, ids únicos', () => {
  const ids = DEFAULT_AGENT_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(DEFAULT_AGENT_STEPS.map((s) => s.order), ids.map((_, i) => i));
  const install = DEFAULT_AGENT_STEPS.find((s) => s.id === 'instalacao');
  assert.match(install.alert, /voltagem/i);
  assert.ok(ids.indexOf('chegada') < ids.indexOf('instalacao'));
  assert.ok(ids.indexOf('dez-minutos') < ids.indexOf('parabens'));
  for (const s of DEFAULT_AGENT_STEPS) {
    const itemIds = s.items.map((i) => i.id);
    assert.equal(new Set(itemIds).size, itemIds.length);
  }
  // progresso salvo depende de IDs estáveis entre cargas do módulo
  assert.equal(install.items[0].id, 'instalacao-1');
});
