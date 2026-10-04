import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRevenueEntries, dailyRevenue, monthTotals, revenueSeries, topDay, variationPct,
  expensesForMonth, expenseAmountForMonth, patrimonySummary, financeMetrics, orderValue,
} from './financeCalculations.js';

const order = (id, status, completedAt, totalPaid, extra = {}) => ({ id, status, completedAt, totalPaid, servicePrice: totalPaid, rushFee: 0, ...extra });
const orders = [
  order('a', 'completed', new Date(2026, 9, 3, 10), 100),
  order('a', 'completed', new Date(2026, 9, 3, 10), 100), // duplicado
  order('b', 'completed', new Date(2026, 9, 3, 20), 50, { paidAt: null }), // concluído e não pago
  order('c', 'delivery', new Date(2026, 9, 4), 999), // não concluído
  order('d', 'completed', new Date(2026, 8, 30, 23, 30), 70), // concluído em setembro
  order('e', 'completed', null, 40), // sem nenhuma data
  order('f', 'completed', new Date(2026, 9, 5), 0, { scriptId: 's1' }), // interno de conteúdo
];

test('faturamento: só concluídos, sem duplicidade, agrupado pela data de conclusão', () => {
  const { entries, undated } = buildRevenueEntries(orders);
  assert.equal(entries.length, 3);
  assert.equal(undated, 1);
  assert.deepEqual(monthTotals(entries, '2026-10'), { total: 150, count: 2 });
  assert.deepEqual(monthTotals(entries, '2026-09'), { total: 70, count: 1 });
  const days = dailyRevenue(entries, '2026-10');
  assert.equal(days.length, 31);
  assert.equal(days[2].total, 150);
  assert.equal(topDay(days).day, 3);
  assert.equal(topDay(dailyRevenue(entries, '2026-08')), null);
});

test('mudanças no pedido refletem no recálculo', () => {
  const changed = orders.map((o) => (o.id === 'c' ? { ...o, status: 'completed', totalPaid: 10 } : o.id === 'b' ? { ...o, completedAt: new Date(2026, 10, 1) } : o));
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

test('data do faturamento: completedAt (automática) tem prioridade; sem ela cai em eventDate e depois paidAt', () => {
  const june = new Date(2026, 5, 10);
  const { entries, undated } = buildRevenueEntries([
    { id: 'x', status: 'completed', totalPaid: 10, completedAt: new Date(2026, 9, 2), eventDate: june, paidAt: june },
    { id: 'y', status: 'completed', totalPaid: 20, eventDate: new Date(2026, 8, 5), paidAt: june },
    { id: 'z', status: 'completed', totalPaid: 30, paidAt: new Date(2026, 7, 1) },
    { id: 'w', status: 'completed', totalPaid: 40 },
  ]);
  assert.deepEqual(entries.map((e) => [e.orderId, e.monthKey]), [['x', '2026-10'], ['y', '2026-09'], ['z', '2026-08']]);
  assert.equal(undated, 1);
});

// ---- Custo de edição (Vídeo Personalizado) ----
import { EDITING_COST, editingCostFields, editingCostForMonth } from './financeCalculations.js';

// Espelha a regra de updateOrder: o campo só é gravado na transição para "concluído".
const complete = (current, serviceId = '3') => ({ ...current, status: 'completed', ...(current.status !== 'completed' ? editingCostFields(serviceId, current) : {}) });
const monthCost = (list, month = '2026-10') => editingCostForMonth(buildRevenueEntries(list).entries, month).total;
const video = (id, extra = {}) => ({ id, serviceId: '3', status: 'delivery', totalPaid: 85, completedAt: new Date(2026, 9, 10), ...extra });

test('custo de edição: concluir gera R$ 25 e é igual para prazos de 2, 4 e 7 dias', () => {
  assert.equal(EDITING_COST, 25);
  for (const deliveryDays of [2, 4, 7]) {
    const done = complete(video(`v${deliveryDays}`, { deliveryDays }));
    assert.equal(done.editingCost, 25);
    assert.equal(monthCost([done]), 25);
  }
});

test('custo de edição: concluir de novo ou editar pedido concluído não gera custo extra', () => {
  const done = complete(video('a'));
  assert.deepEqual(editingCostFields('3', done), {});
  const again = complete(done);
  const edited = { ...again, content: 'novo texto', totalPaid: 90 };
  assert.equal(edited.editingCost, 25);
  assert.equal(monthCost([edited]), 25);
});

test('custo de edição: não concluído e outros serviços não geram custo', () => {
  assert.equal(monthCost([video('a')]), 0);
  assert.equal(monthCost([complete(video('b', { serviceId: '1' }), '1')]), 0);
  assert.equal(monthCost([video('c', { status: 'completed' })]), 0); // concluído antes da regra: sem retroativo
});

test('custo de edição: reabrir tira o custo do mês e concluir de novo devolve um único custo', () => {
  const done = complete(video('a'));
  const reopened = { ...done, status: 'editing', completedAt: undefined };
  assert.equal(monthCost([reopened]), 0);
  const recompleted = complete(reopened);
  assert.equal(recompleted.editingCost, 25);
  assert.equal(monthCost([{ ...recompleted, completedAt: new Date(2026, 10, 2) }], '2026-11'), 25);
  assert.equal(monthCost([{ ...recompleted, completedAt: new Date(2026, 10, 2) }], '2026-10'), 0);
});

test('custo de edição: entra no resultado sem alterar faturamento nem despesas fixas', () => {
  const done = complete(video('a'));
  const { entries } = buildRevenueEntries([done]);
  const fixed = [{ id: 'x', name: 'n', category: 'c', startMonth: '2026-01', active: true, amountHistory: { '2026-01': 100 } }];
  assert.equal(monthTotals(entries, '2026-10').total, 85);
  assert.equal(expensesForMonth(fixed, '2026-10').total, 100);
  assert.equal(expensesForMonth(fixed, '2026-10').total + editingCostForMonth(entries, '2026-10').total, 125);
});

test('despesa única: deactivatedFrom no mês seguinte conta só no mês de início', () => {
  const once = { id: 'u', name: 'n', category: 'c', startMonth: '2026-12', active: true, deactivatedFrom: '2027-01', amountHistory: { '2026-12': 80 } };
  assert.equal(expensesForMonth([once], '2026-11').total, 0);
  assert.equal(expensesForMonth([once], '2026-12').total, 80);
  assert.equal(expensesForMonth([once], '2027-01').total, 0);
});

test('extrato: entradas, custo de edição individual e despesas no dia 1, com saídas negativas', async () => {
  const { buildStatement } = await import('./financeCalculations.js');
  const done = complete(video('a'));
  const { entries } = buildRevenueEntries([done]);
  const fixed = [{ id: 'x', name: 'Ferramenta', category: 'c', startMonth: '2026-01', active: true, amountHistory: { '2026-01': 100 } }];
  const s = buildStatement(entries, fixed, '2026-10');
  assert.deepEqual(s.rows.map((r) => [r.source, r.kind, r.amount]), [['order', 'in', 85], ['editing', 'out', -25], ['expense', 'out', -100]]);
  assert.equal(s.rows[2].date.getDate(), 1);
  assert.deepEqual([s.totalIn, s.totalOut, s.balance], [85, 125, -40]);
});
