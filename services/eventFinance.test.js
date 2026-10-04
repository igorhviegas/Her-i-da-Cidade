import test from 'node:test';
import assert from 'node:assert/strict';
import { EventFinanceError, ledgerId, ledgerToOrders, planCompletion, planEntry } from './eventFinance.js';
import { buildRevenueEntries, buildStatement, eventCostForMonth, monthTotals } from './financeCalculations.js';

const order = (over = {}) => ({
  clientId: 'c1', serviceId: 's1', childName: 'Pedro',
  eventForm: { totalValue: 1000, entryValue: 500, cost: 150, ...over },
});
const day = (iso) => new Date(`${iso}T12:00:00`);
const withId = (record) => ({ ...record, id: ledgerId(record.orderId, record.kind) });

test('IDs determinísticos por pedido e tipo', () => {
  assert.equal(ledgerId('abc', 'entry'), 'evt-abc-entry');
  assert.equal(ledgerId('abc', 'final'), 'evt-abc-final');
  assert.equal(ledgerId('abc', 'cost'), 'evt-abc-cost');
});

test('criação: lança a entrada (valor de entrada, data de criação, ligada ao pedido)', () => {
  const entry = planEntry('o1', order(), 'DATA');
  assert.deepEqual([entry.kind, entry.type, entry.amount, entry.orderId, entry.date], ['entry', 'revenue', 500, 'o1', 'DATA']);
  assert.throws(() => planEntry('o1', order({ entryValue: undefined }), 'D'), EventFinanceError);
});

test('conclusão: 2ª parcela (total − entrada lançada) e Despesa evento, uma vez cada', () => {
  const [final, cost] = planCompletion('o1', order(), { bookedEntry: 500 }, 'FIM');
  assert.deepEqual([final.kind, final.type, final.amount, final.date], ['final', 'revenue', 500, 'FIM']);
  assert.deepEqual([cost.kind, cost.type, cost.amount, cost.category, cost.date], ['cost', 'expense', 150, 'Despesa evento', 'FIM']);
});

test('reabrir e concluir de novo: o que já existe no livro não é planejado outra vez', () => {
  assert.deepEqual(planCompletion('o1', order(), { bookedEntry: 500, final: true, cost: true }, 'D'), []);
  assert.deepEqual(planCompletion('o1', order(), { bookedEntry: 500, final: true }, 'D').map((r) => r.kind), ['cost']);
});

test('valores editados depois da criação: a 2ª parcela fecha o total sobre a entrada JÁ lançada', () => {
  const edited = order({ totalValue: 1200, entryValue: 700 }); // pedido editado; o livro ainda tem a entrada de 500
  const [final] = planCompletion('o1', edited, { bookedEntry: 500 }, 'D');
  assert.equal(final.amount, 700);
  assert.equal(planCompletion('o1', order({ totalValue: 400 }), { bookedEntry: 500 }, 'D')[0].amount, 0); // nunca negativa
});

test('dados financeiros incompletos bloqueiam a conclusão sem lançar nada', () => {
  assert.throws(() => planCompletion('o1', order({ totalValue: undefined }), {}, 'D'), /incompletos/);
  assert.throws(() => planCompletion('o1', order({ cost: NaN }), {}, 'D'), EventFinanceError);
  assert.throws(() => planCompletion('o1', { clientId: 'c', serviceId: 's' }, {}, 'D'), EventFinanceError);
});

test('Financeiro: as duas parcelas entram nas datas dos lançamentos; a despesa vai para "Despesa evento"; o pedido em si não conta', () => {
  const docs = [
    withId(planEntry('o1', order(), day('2026-09-20'))),
    ...planCompletion('o1', order(), { bookedEntry: 500 }, day('2026-10-10')).map(withId),
  ];
  const completedEvent = { id: 'o1', status: 'completed', eventLedger: { entry: 500 }, totalPaid: 1000, completedAt: day('2026-10-10') };
  const { entries, costs } = buildRevenueEntries([completedEvent, ...ledgerToOrders(docs)]);
  assert.equal(entries.length, 2); // o pedido (eventLedger) não duplica o faturamento
  assert.equal(monthTotals(entries, '2026-09').total, 500);
  assert.equal(monthTotals(entries, '2026-10').total, 500);
  assert.equal(entries.reduce((s, e) => s + e.value, 0), 1000);
  assert.equal(eventCostForMonth(costs, '2026-10').total, 150);
  assert.equal(eventCostForMonth(costs, '2026-09').total, 0);
  const october = buildStatement(entries, [], '2026-10', costs);
  assert.deepEqual([october.totalIn, october.totalOut, october.balance], [500, 150, 350]);
  assert.ok(october.rows.some((r) => r.source === 'eventCost' && r.amount === -150));
});

test('pedido reaberto continua gerando as mesmas entradas do livro (fora da lista de concluídos)', () => {
  const docs = [withId(planEntry('o1', order(), day('2026-09-20')))];
  const { entries } = buildRevenueEntries([...ledgerToOrders(docs)]); // pedido aberto: não vem na consulta de concluídos
  assert.equal(entries.length, 1);
  assert.equal(entries[0].value, 500);
});

test('pedidos antigos (sem eventLedger) mantêm o cálculo por pedido concluído; lançamentos de valor zero são ignorados', () => {
  const legacy = { id: 'old', status: 'completed', totalPaid: 300, completedAt: day('2026-10-02') };
  assert.equal(buildRevenueEntries([legacy]).entries[0].value, 300);
  assert.equal(ledgerToOrders([{ id: 'x', orderId: 'o', kind: 'final', amount: 0, date: day('2026-10-02') }]).length, 0);
});
