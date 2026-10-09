import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRevenueEntries } from './financeCalculations.js';
import { clientRetention, dailyBreakdown, periodRange, periodTotals, seasonality, serviceBreakdown, shiftPeriod } from './reports.js';

const at = (iso) => new Date(`${iso}T12:00:00`); // meio-dia local: sem virar o dia por fuso
const order = (id, over = {}) => ({ id, status: 'completed', clientId: 'c1', serviceId: 's1', totalPaid: 100, completedAt: at('2026-10-05'), ...over });
const build = (orders) => buildRevenueEntries(orders);

test('periodRange: dia, semana (segunda a domingo) e mês; shiftPeriod anda por período e o mês cai sempre no dia 1', () => {
  const sat = at('2026-10-10'); // sábado
  assert.deepEqual(periodRange('day', sat), { start: new Date(2026, 9, 10), end: new Date(2026, 9, 11) });
  assert.deepEqual(periodRange('week', sat), { start: new Date(2026, 9, 5), end: new Date(2026, 9, 12) }); // seg 05 a dom 11
  assert.deepEqual(periodRange('week', at('2026-10-11')), periodRange('week', at('2026-10-05'))); // domingo ainda é a mesma semana
  assert.deepEqual(periodRange('month', sat), { start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) });
  assert.deepEqual(shiftPeriod('month', at('2026-01-31'), 1), new Date(2026, 1, 1)); // 31/01 + 1 mês não vira 03/03
  assert.deepEqual(shiftPeriod('week', sat, -1), new Date(2026, 9, 3));
  assert.throws(() => periodRange('ano', sat), /inválido/);
});

test('periodTotals: faturamento, serviços, ticket e custos variáveis só do período; semana e dia respeitam os limites', () => {
  const { entries, costs } = build([
    order('a', { completedAt: at('2026-10-05'), totalPaid: 60, serviceId: '3', editingCost: 25 }),
    order('b', { completedAt: at('2026-10-07'), totalPaid: 140 }),
    order('c', { completedAt: at('2026-10-12'), totalPaid: 500 }), // semana seguinte
    { id: 'evt-x-cost', orderId: 'x', ledger: true, ledgerKind: 'cost', status: 'completed', clientId: 'c2', serviceId: 's2', eventCost: 30, completedAt: at('2026-10-06') },
  ]);
  const week = periodTotals(entries, costs, periodRange('week', at('2026-10-08')));
  assert.deepEqual(week, { revenue: 200, count: 2, ticket: 100, editingCost: 25, eventCost: 30, variableCost: 55, result: 145 });
  assert.equal(periodTotals(entries, costs, periodRange('day', at('2026-10-07'))).revenue, 140);
  assert.deepEqual(periodTotals(entries, costs, periodRange('day', at('2026-10-20'))), { revenue: 0, count: 0, ticket: null, editingCost: 0, eventCost: 0, variableCost: 0, result: 0 });
});

test('livro de evento: entrada e parcela final contam como um serviço; ajuste de receita muda o valor, não a contagem', () => {
  const ledger = (id, kind, amount, date) => ({ id, orderId: 'ev1', ledger: true, ledgerKind: kind, status: 'completed', clientId: 'c1', serviceId: 'sp', totalPaid: amount, completedAt: at(date) });
  const { entries, costs } = build([ledger('evt-ev1-entry', 'entry', 200, '2026-10-02'), ledger('evt-ev1-final', 'final', 200, '2026-10-09'), ledger('evt-ev1-adjrev-1', 'adjrev', -50, '2026-10-09')]);
  const month = periodTotals(entries, costs, periodRange('month', at('2026-10-15')));
  assert.deepEqual([month.revenue, month.count], [350, 1]);
  assert.deepEqual(serviceBreakdown(entries, periodRange('month', at('2026-10-15'))), [{ serviceId: 'sp', count: 1, revenue: 350, share: 1 }]);
});

test('dailyBreakdown devolve um item por dia do período; serviceBreakdown ordena por faturamento com participação', () => {
  const { entries } = build([order('a', { completedAt: at('2026-10-05'), totalPaid: 30, serviceId: 'x' }), order('b', { completedAt: at('2026-10-06'), totalPaid: 90, serviceId: 'y' }), order('c', { completedAt: at('2026-10-06'), totalPaid: 30, serviceId: 'x' })]);
  const week = periodRange('week', at('2026-10-05'));
  const days = dailyBreakdown(entries, week);
  assert.deepEqual([days.length, days[0].revenue, days[1].revenue, days[1].count, days[6].revenue], [7, 30, 120, 2, 0]);
  assert.deepEqual(serviceBreakdown(entries, week).map((r) => [r.serviceId, r.revenue, r.count, r.share]), [['y', 90, 1, 0.6], ['x', 60, 2, 0.4]]);
  assert.equal(dailyBreakdown(entries, periodRange('month', at('2026-10-05'))).length, 31);
});

test('seasonality: média por mês do ano só com meses completos (zero quando não faturou), classifica forte/fraco e ignora o mês corrente', () => {
  const now = at('2026-10-15');
  const { entries } = build([
    order('a', { completedAt: at('2025-12-10'), totalPaid: 1000 }), order('b', { completedAt: at('2026-12-10'), totalPaid: 3000 }),
    order('c', { completedAt: at('2026-03-10'), totalPaid: 200 }),
    order('d', { completedAt: at('2026-10-02'), totalPaid: 9999 }), // mês corrente: fora das médias, dentro da matriz
  ]);
  const { months, matrix, monthsAnalyzed } = seasonality(entries, now);
  assert.equal(monthsAnalyzed, 10); // 2025-12 até 2026-09
  const dec = months[11];
  assert.deepEqual([dec.samples, dec.avgRevenue], [1, 1000]); // dez/2026 ainda não é completo
  assert.equal(months[2].avgRevenue, 200);
  assert.equal(months[5].avgRevenue, 0); // junho/2026 sem faturamento conta zero
  assert.equal(months[9].samples, 0); // outubro: só tem o mês corrente
  assert.equal(months[9].avgRevenue, null);
  assert.equal(dec.level, 'strong');
  assert.equal(months[5].level, 'weak');
  assert.deepEqual(matrix.map((m) => m.year), [2025, 2026]);
  assert.equal(matrix[1].months[9], 9999);
  assert.deepEqual(seasonality([], now), { months: [], matrix: [], monthsAnalyzed: 0 });
});

test('clientRetention: retorno, LTV, mediana entre pedidos, melhores clientes e janela de reativação (10 a 14 meses)', () => {
  const now = at('2026-10-10');
  const { entries } = build([
    order('a1', { clientId: 'ana', completedAt: at('2024-10-05'), totalPaid: 300 }),
    order('a2', { clientId: 'ana', completedAt: at('2025-10-05'), totalPaid: 500 }),
    order('b1', { clientId: 'bia', completedAt: at('2025-10-01'), totalPaid: 100 }), // ~12 meses atrás: reativar
    order('c1', { clientId: 'caio', completedAt: at('2026-09-20'), totalPaid: 60 }),
    order('i1', { clientId: 'interno', scriptId: 's', completedAt: at('2026-09-01'), totalPaid: 0 }), // roteiro interno: fora
  ]);
  const r = clientRetention(entries, now);
  assert.deepEqual([r.clients, r.returning, r.returnRate], [3, 1, 1 / 3]);
  assert.equal(r.avgLtv, (800 + 100 + 60) / 3);
  assert.equal(r.avgOrders, 4 / 3);
  assert.equal(r.medianGapDays, 365);
  assert.deepEqual(r.top.map((c) => [c.clientId, c.revenue, c.orders]), [['ana', 800, 2], ['bia', 100, 1], ['caio', 60, 1]]);
  assert.deepEqual(r.winback.map((c) => c.clientId), ['ana', 'bia']); // última compra há ~12 meses, maior LTV primeiro; caio (3 semanas) fica de fora
  assert.deepEqual(clientRetention([], now), { clients: 0, returning: 0, returnRate: null, avgLtv: null, avgOrders: null, medianGapDays: null, top: [], winback: [] });
});

test('seasonality: dois meses muito fortes não fazem os meses típicos parecerem fracos (referência = mediana)', () => {
  const now = at('2027-01-15');
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
  const { entries } = build(months.map((m, i) => order(`o${i}`, { completedAt: at(`${m}-10`), totalPaid: m.endsWith('-10') || m.endsWith('-12') ? 3000 : 100 })));
  const { months: result } = seasonality(entries, now);
  assert.deepEqual(result.map((m) => m.level), ['medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'strong', 'medium', 'strong']);
});
