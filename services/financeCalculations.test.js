import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevenueEntries, dailyRevenue, monthTotals, revenueSeries, topDay, variationPct,
  expensesForMonth, expenseAmountForMonth, patrimonySummary, financeMetrics, orderValue,
} from './financeCalculations.js';

const order = (id, status, eventDate, totalPaid, extra = {}) => ({ id, status, eventDate, totalPaid, servicePrice: totalPaid, rushFee: 0, ...extra });
const orders = [
  order('a', 'completed', new Date(2026, 9, 3, 10), 100),
  order('a', 'completed', new Date(2026, 9, 3, 10), 100), // duplicado
  order('b', 'completed', new Date(2026, 9, 3, 20), 50, { paidAt: null }), // concluído e não pago
  order('c', 'delivery', new Date(2026, 9, 4), 999), // não concluído
  order('d', 'completed', new Date(2026, 8, 30, 23, 30), 70), // evento em setembro (conclusão em outubro não importa)
  order('e', 'completed', null, 40), // sem data do evento
  order('f', 'completed', new Date(2026, 9, 5), 0, { scriptId: 's1' }), // interno de conteúdo
];

test('faturamento: só concluídos, sem duplicidade, agrupado pela data do evento', () => {
  const { entries, withoutEventDate } = buildRevenueEntries(orders);
  assert.equal(entries.length, 3);
  assert.equal(withoutEventDate, 1);
  assert.deepEqual(monthTotals(entries, '2026-10'), { total: 150, count: 2 });
  assert.deepEqual(monthTotals(entries, '2026-09'), { total: 70, count: 1 });
  const days = dailyRevenue(entries, '2026-10');
  assert.equal(days.length, 31);
  assert.equal(days[2].total, 150);
  assert.equal(topDay(days).day, 3);
  assert.equal(topDay(dailyRevenue(entries, '2026-08')), null);
});

test('mudanças no pedido refletem no recálculo', () => {
  const changed = orders.map((o) => (o.id === 'c' ? { ...o, status: 'completed', totalPaid: 10 } : o.id === 'b' ? { ...o, eventDate: new Date(2026, 10, 1) } : o));
  const { entries } = buildRevenueEntries(changed);
  assert.deepEqual(monthTotals(entries, '2026-10'), { total: 110, count: 2 });
  assert.deepEqual(monthTotals(entries, '2026-11'), { total: 50, count: 1 });
});

test('valor cai para servicePrice + rushFee sem totalPaid; série cobre meses vazios; variação', () => {
  assert.equal(orderValue({ servicePrice: 80, rushFee: 20 }), 100);
  const series = revenueSeries(buildRevenueEntries(orders).entries, '2026-10', 3);
  assert.deepEqual(series.map((s) => s.total), [0, 70, 150]);
  assert.equal(variationPct(150, 70), (80 / 70) * 100);
  assert.equal(variationPct(150, 0), null);
});

const rent = {
  id: 'x', startMonth: '2026-03', active: true, amountHistory: { '2026-03': 100, '2026-06': 150 }, adjustments: { '2026-05': 300 },
};
test('despesas: recorrência, mudança de padrão e ajuste pontual sem efeito retroativo', () => {
  assert.equal(expenseAmountForMonth(rent, '2026-02'), 0);
  assert.equal(expenseAmountForMonth(rent, '2026-03'), 100);
  assert.equal(expenseAmountForMonth(rent, '2026-05'), 300); // ajuste só nesse mês
  assert.equal(expenseAmountForMonth(rent, '2026-04'), 100);
  assert.equal(expenseAmountForMonth(rent, '2026-06'), 150);
  assert.equal(expenseAmountForMonth(rent, '2026-12'), 150);
});

test('despesas: desativação preserva histórico e remove meses posteriores', () => {
  const off = { ...rent, active: false, deactivatedFrom: '2026-07' };
  assert.equal(expenseAmountForMonth(off, '2026-06'), 150);
  assert.equal(expenseAmountForMonth(off, '2026-07'), 0);
  const { items, total } = expensesForMonth([rent, off], '2026-08');
  assert.equal(items.length, 1);
  assert.equal(total, 150);
  assert.equal(expensesForMonth([rent, off], '2026-05').total, 600);
});

test('patrimônio: soma apenas ativos', () => {
  const assets = [
    { status: 'active', currentValue: 100, acquisitionValue: 200 },
    { status: 'active', currentValue: 50, acquisitionValue: 80 },
    { status: 'sold', currentValue: 999, acquisitionValue: 999 },
    { status: 'discarded', currentValue: 999, acquisitionValue: 999 },
  ];
  assert.deepEqual(patrimonySummary(assets), { activeCount: 2, currentTotal: 150, acquisitionTotal: 280 });
});

test('métricas para gamificação futura', () => {
  const { entries } = buildRevenueEntries(orders);
  const m = financeMetrics(entries, [rent], '2026-10', 60);
  assert.deepEqual(m.recordMonth, { monthKey: '2026-10', total: 150 });
  assert.equal(m.cumulative, 220);
  assert.equal(m.servicesCount, 2);
  assert.equal(m.goalStreak, 2); // out (150) e set (70) >= 60; ago = 0
  assert.equal(m.operatingMarginPct, ((150 - 150) / 150) * 100);
});

test('cálculo diário e mensal usam a mesma regra (soma dos dias = total do mês)', () => {
  const { entries } = buildRevenueEntries(orders);
  const days = dailyRevenue(entries, '2026-10');
  assert.equal(days.reduce((s, d) => s + d.total, 0), monthTotals(entries, '2026-10').total);
  assert.equal(days.reduce((s, d) => s + d.count, 0), monthTotals(entries, '2026-10').count);
});

test('total do pedido editado (pagamento parcial) é o que entra hoje: totalPaid prevalece sobre servicePrice + rushFee', () => {
  assert.equal(orderValue({ totalPaid: 60, servicePrice: 100, rushFee: 20 }), 60);
});

// ---- Rankings por serviço ----
import { serviceRanking, entryInPeriod, monthKeyOf } from './financeCalculations.js';
const NOW = new Date(2026, 9, 15, 14, 0); // 15/10/2026 14:00 local
const o = (id, serviceId, eventDate, totalPaid, extra = {}) => ({ id, serviceId, status: 'completed', eventDate, totalPaid, servicePrice: totalPaid, rushFee: 0, ...extra });
const ranked = [
  o('1', 'A', new Date(2026, 9, 14, 10), 30), o('2', 'A', new Date(2026, 9, 10, 10), 30), o('3', 'A', new Date(2026, 8, 20, 10), 30), // A: 2 no mês, 3 em 30d
  o('4', 'B', new Date(2026, 9, 12, 10), 500), o('5', 'B', new Date(2026, 5, 1, 10), 500), // B: 1 no mês; 2 no geral
  o('6', 'C', new Date(2026, 9, 14, 23, 59), 75), o('7', 'C', new Date(2026, 9, 9, 14, 0), 75), o('8', 'C', new Date(2026, 9, 9, 13, 59), 75),
  o('9', 'A', new Date(2026, 9, 14, 10), 30, { status: 'delivery' }), // não concluído: fora
  o('1', 'A', new Date(2026, 9, 14, 10), 30), // duplicado do pedido 1
  o('10', 'A', new Date(2026, 9, 20, 10), 30), // evento futuro: fora de 7d/30d/mês
  o('11', 'A', new Date(2026, 9, 5, 10), 0, { scriptId: 's' }), // roteiro interno: fora
];
const rk = (period, by) => serviceRanking(buildRevenueEntries(ranked).entries, period, by, NOW).map((r) => [r.serviceId, r.count, r.revenue]);

test('ranking: agrupa por serviço, ordena por pedidos e por faturamento, sem duplicar nem contar não concluídos', () => {
  assert.deepEqual(rk('all', 'count'), [['A', 4, 120], ['C', 3, 225], ['B', 2, 1000]]); // A: pedidos 1,2,3,10 (o duplicado e o de entrega ficam fora)
  assert.deepEqual(rk('all', 'revenue').map((r) => r[0]), ['B', 'C', 'A']);
});

test('ranking: filtros 30d, 7d (janelas móveis) e mês vigente (calendário) e exclusão fora do período', () => {
  assert.deepEqual(rk('month', 'count'), [['C', 3, 225], ['A', 2, 60], ['B', 1, 500]]);
  assert.deepEqual(rk('30d', 'count').find((r) => r[0] === 'A'), ['A', 3, 90]); // 20/09 está dentro de 30 dias; evento futuro não
  // janela de 7 dias: de 08/10 14:00 até 15/10 14:00 (09/10 13:59 ainda entra; 20/09 e 01/06 não)
  assert.deepEqual(rk('7d', 'count'), [['C', 3, 225], ['A', 2, 60], ['B', 1, 500]]);
  assert.deepEqual(rk('7d', 'revenue').map((r) => r[0]), ['B', 'C', 'A']);
});

test('ranking: viradas de dia e de mês no fuso local', () => {
  const at = (y, m, d, h, mi) => ({ eventDate: new Date(y, m, d, h, mi), monthKey: monthKeyOf(new Date(y, m, d, h, mi)) });
  const first = new Date(2026, 9, 1, 0, 30); // 01/10 00:30 local
  assert.equal(entryInPeriod(at(2026, 8, 30, 23, 59), 'month', first), false); // 30/09 23:59 ainda é setembro
  assert.equal(entryInPeriod(at(2026, 9, 1, 0, 0), 'month', first), true); // 01/10 00:00 já é outubro
  assert.equal(entryInPeriod(at(2026, 9, 1, 0, 31), 'month', first), false); // depois de agora
  assert.equal(entryInPeriod(at(2026, 9, 8, 14, 0), '7d', NOW), true); // exatamente 7 dias
  assert.equal(entryInPeriod(at(2026, 9, 8, 13, 59), '7d', NOW), false);
  assert.throws(() => entryInPeriod(at(2026, 9, 1, 0, 0), 'ano', NOW));
});

test('ranking: faturamento = totalPaid do pedido; custo de edição e despesas não entram nem duplicam', () => {
  const e = buildRevenueEntries([o('p', 'V', new Date(2026, 9, 14, 10), 60, { editingCost: 25, installments: [{ v: 30 }, { v: 30 }], payments: [{ v: 60 }] })]).entries;
  assert.deepEqual(serviceRanking(e, 'month', 'revenue', NOW), [{ serviceId: 'V', count: 1, revenue: 60 }]);
  const rent = { id: 'x', startMonth: '2026-10', active: true, amountHistory: { '2026-10': 25 } };
  assert.equal(expensesForMonth([rent], '2026-10').total, 25); // despesas seguem separadas
  assert.equal(serviceRanking(e, 'month', 'revenue', NOW)[0].revenue, 60);
});
