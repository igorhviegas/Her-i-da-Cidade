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
  const [final, cost] = planCompletion('o1', order(), { bookedRevenue: 500 }, 'FIM');
  assert.deepEqual([final.kind, final.type, final.amount, final.date], ['final', 'revenue', 500, 'FIM']);
  assert.deepEqual([cost.kind, cost.type, cost.amount, cost.category, cost.date], ['cost', 'expense', 150, 'Despesa evento', 'FIM']);
});

test('reabrir e concluir de novo: o que já existe no livro não é planejado outra vez', () => {
  assert.deepEqual(planCompletion('o1', order(), { bookedRevenue: 500, final: true, cost: true }, 'D'), []);
  assert.deepEqual(planCompletion('o1', order(), { bookedRevenue: 500, final: true }, 'D').map((r) => r.kind), ['cost']);
});

test('valores editados depois da criação: a 2ª parcela fecha o total sobre a entrada JÁ lançada', () => {
  const edited = order({ totalValue: 1200, entryValue: 700 }); // pedido editado; o livro ainda tem a entrada de 500
  const [final] = planCompletion('o1', edited, { bookedRevenue: 500 }, 'D');
  assert.equal(final.amount, 700);
  assert.equal(planCompletion('o1', order({ totalValue: 400 }), { bookedRevenue: 500 }, 'D')[0].amount, 0); // nunca negativa
});

test('dados financeiros incompletos bloqueiam a conclusão sem lançar nada', () => {
  assert.throws(() => planCompletion('o1', order({ totalValue: undefined }), {}, 'D'), /incompletos/);
  assert.throws(() => planCompletion('o1', order({ cost: NaN }), {}, 'D'), EventFinanceError);
  assert.throws(() => planCompletion('o1', order({ cost: null }), {}, 'D'), /informe o custo/); // custo em branco bloqueia só a conclusão
  assert.throws(() => planCompletion('o1', { clientId: 'c', serviceId: 's' }, {}, 'D'), EventFinanceError);
});

test('Financeiro: as duas parcelas entram nas datas dos lançamentos; a despesa vai para "Despesa evento"; o pedido em si não conta', () => {
  const docs = [
    withId(planEntry('o1', order(), day('2026-09-20'))),
    ...planCompletion('o1', order(), { bookedRevenue: 500 }, day('2026-10-10')).map(withId),
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

// ---- Ajustes (alterar valores depois dos lançamentos) ----
import { ledgerIdsFor, planAdjustments } from './eventFinance.js';

const booked = (over = {}) => ({ clientId: 'c1', serviceId: 's1', childName: 'Pedro', eventLedger: { entry: 500, ...over } });
const form = (over = {}) => ({ totalValue: 1000, entryValue: 500, cost: 150, ...over });

test('ajuste: sem diferença não gera nada', () => {
  assert.deepEqual(planAdjustments('o1', booked(), form(), 'D').records, []);
  assert.deepEqual(planAdjustments('o1', booked({ final: 500, cost: 150 }), form(), 'D').records, []);
  assert.deepEqual(planAdjustments('o1', booked(), form({ totalValue: 9999, cost: 9 }), 'D').records, []); // antes da conclusão só a entrada conta
});

test('ajuste antes da conclusão: mudar a entrada lança a diferença (com sinal) na receita', () => {
  const up = planAdjustments('o1', booked(), form({ entryValue: 700 }), 'D');
  assert.deepEqual(up.records.map((r) => [r.kind, r.type, r.amount, r.seq]), [['adjrev', 'revenue', 200, 1]]);
  assert.deepEqual(up.next, { entry: 500, seq: 1, adj: 200 });
  const down = planAdjustments('o1', booked({ adj: 200, seq: 1 }), form({ entryValue: 300 }), 'D'); // alvo 300 − (500 + 200)
  assert.deepEqual(down.records.map((r) => [r.kind, r.amount, r.seq]), [['adjrev', -400, 2]]);
  assert.deepEqual(down.next, { entry: 500, seq: 2, adj: -200 });
});

test('ajuste depois da conclusão: receita fecha no valor total e despesa no custo atual', () => {
  const done = { final: 500, cost: 150 };
  const r = planAdjustments('o1', booked(done), form({ totalValue: 1200, cost: 100 }), 'D');
  assert.deepEqual(r.records.map((x) => [x.kind, x.type, x.amount, x.category ?? null, x.seq]), [
    ['adjrev', 'revenue', 200, null, 1], ['adjcost', 'expense', -50, 'Despesa evento', 1],
  ]);
  assert.deepEqual(r.next, { entry: 500, final: 500, cost: 150, seq: 1, adj: 200, adjCost: -50 });
  // entrada editada depois da conclusão, total igual: a receita total não muda
  assert.deepEqual(planAdjustments('o1', booked(done), form({ entryValue: 900 }), 'D').records, []);
  // segundo ajuste soma sobre o primeiro (idempotente quando o formulário não muda de novo)
  assert.deepEqual(planAdjustments('o1', booked(r.next), form({ totalValue: 1200, cost: 100 }), 'D').records, []);
});

test('ajuste: a 2ª parcela da conclusão considera a entrada ajustada (receita total = valor total)', () => {
  const adjusted = planAdjustments('o1', booked(), form({ entryValue: 700 }), 'D').next; // entrada efetiva 700
  const [final] = planCompletion('o1', { ...booked(adjusted), eventForm: form({ entryValue: 700 }) }, { bookedRevenue: 500 + adjusted.adj }, 'FIM');
  assert.equal(final.amount, 300);
});

test('ajuste: ignora valores ausentes, custo em branco e pedido sem livro', () => {
  assert.deepEqual(planAdjustments('o1', booked({ final: 500, cost: 150 }), form({ cost: null }), 'D').records, []);
  assert.deepEqual(planAdjustments('o1', booked({ final: 500 }), form({ totalValue: undefined }), 'D').records, []);
  assert.deepEqual(planAdjustments('o1', { clientId: 'c' }, form(), 'D').records, []);
});

test('ajustes entram no Financeiro com sinal: receita ± e despesa ±, sem inflar a contagem de serviços', () => {
  const docs = [
    withId(planEntry('o1', order(), day('2026-09-20'))),
    ...planCompletion('o1', order(), { bookedRevenue: 500 }, day('2026-10-10')).map(withId),
  ];
  const adj = planAdjustments('o1', booked({ final: 500, cost: 150 }), form({ totalValue: 1200, cost: 100 }), day('2026-10-15'));
  const adjDocs = adj.records.map((r) => ({ ...r, id: ledgerId(r.orderId, r.kind, r.seq) }));
  assert.deepEqual(adjDocs.map((d) => d.id), ['evt-o1-adjrev-1', 'evt-o1-adjcost-1']);
  const { entries, costs } = buildRevenueEntries(ledgerToOrders([...docs, ...adjDocs]));
  assert.equal(monthTotals(entries, '2026-10').total, 700); // 500 (2ª parcela) + 200 (ajuste)
  assert.equal(monthTotals(entries, '2026-10').count, 1); // o ajuste não conta como outro serviço
  assert.equal(eventCostForMonth(costs, '2026-10').total, 100); // 150 − 50
  const oct = buildStatement(entries, [], '2026-10', costs);
  // despesa reduzida em 50 aparece como entrada de 50 (ajuste), a despesa original de 150 como saída: saldo = 700 − 100
  assert.deepEqual([oct.totalIn, oct.totalOut, oct.balance], [750, 150, 600]);
  // ajustes negativos viram saída (receita) / entrada (despesa reduzida) no extrato
  const down = planAdjustments('o1', booked({ final: 500, cost: 150 }), form({ totalValue: 800, cost: 200 }), day('2026-10-16'));
  const downDocs = down.records.map((r) => ({ ...r, id: ledgerId(r.orderId, r.kind, r.seq) }));
  const s = buildStatement(...(() => { const b = buildRevenueEntries(ledgerToOrders([...docs, ...downDocs])); return [b.entries, [], '2026-10', b.costs]; })());
  assert.ok(s.rows.some((r) => r.kind === 'out' && r.source === 'order' && r.amount === -200));
  assert.deepEqual([s.totalIn, s.totalOut, s.balance], [500, 400, 100]); // receita 500 − 200 de ajuste; despesa 150 + 50 de ajuste
});

test('ledgerIdsFor lista entrada, 2ª parcela, custo e todos os ajustes do pedido', () => {
  assert.deepEqual(ledgerIdsFor('o1', { entry: 1 }), ['evt-o1-entry', 'evt-o1-final', 'evt-o1-cost']);
  assert.deepEqual(ledgerIdsFor('o1', { entry: 1, seq: 2 }), ['evt-o1-entry', 'evt-o1-final', 'evt-o1-cost', 'evt-o1-adjrev-1', 'evt-o1-adjcost-1', 'evt-o1-adjrev-2', 'evt-o1-adjcost-2']);
  assert.equal(ledgerId('o1', 'adjrev', 3), 'evt-o1-adjrev-3');
});
