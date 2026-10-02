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
