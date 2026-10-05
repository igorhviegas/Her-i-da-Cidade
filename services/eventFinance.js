// Lançamentos financeiros dos pedidos de evento (sem Firebase/React; testado em Node).
//
// Livro de lançamentos imutável na coleção `financeEntries`, com ID determinístico por pedido e tipo:
//   evt-{pedido}-entry  receita: entrada (1ª parcela), na criação do pedido
//   evt-{pedido}-final  receita: 2ª parcela, na PRIMEIRA conclusão
//   evt-{pedido}-cost   despesa "Despesa evento", na PRIMEIRA conclusão
//   evt-{pedido}-adjrev-{n} / evt-{pedido}-adjcost-{n}  AJUSTES (diferença com sinal) quando o valor do pedido é alterado depois
// Cada ID existe no máximo uma vez (create-only nas regras + checagem na mesma transação do pedido): reabrir, concluir de
// novo ou repetir a ação não gera lançamento novo. Lançamentos nunca são reescritos: editar valores depois gera um AJUSTE
// (nova linha com a diferença, datada do momento da edição), então o histórico fica íntegro e o Financeiro reflete o novo valor.

import { roundMoney } from './eventForm.js';

export const LEDGER_COLLECTION = 'financeEntries';
export const EVENT_EXPENSE_CATEGORY = 'Despesa evento';
export const LEDGER_KINDS = ['entry', 'final', 'cost'];
export const LEDGER_LABELS = {
  entry: 'Entrada (1ª parcela)', final: '2ª parcela', cost: EVENT_EXPENSE_CATEGORY,
  adjrev: 'Ajuste de receita', adjcost: `Ajuste de ${EVENT_EXPENSE_CATEGORY}`,
};
const isCostKind = (kind) => kind === 'cost' || kind === 'adjcost';

export class EventFinanceError extends Error {
  constructor(code, message) { super(message); this.name = 'EventFinanceError'; this.code = code; }
}

export const ledgerId = (orderId, kind, seq) => (seq ? `evt-${orderId}-${kind}-${seq}` : `evt-${orderId}-${kind}`);

/** Todos os IDs de lançamento já possíveis de um pedido (entrada, 2ª parcela, custo e ajustes 1..seq). */
export function ledgerIdsFor(orderId, eventLedger) {
  const ids = LEDGER_KINDS.map((kind) => ledgerId(orderId, kind));
  for (let n = 1; n <= (eventLedger?.seq ?? 0); n += 1) ids.push(ledgerId(orderId, 'adjrev', n), ledgerId(orderId, 'adjcost', n));
  return ids;
}

const base = (orderId, order, kind, amount, date, seq) => ({
  orderId, kind, type: isCostKind(kind) ? 'expense' : 'revenue', amount: roundMoney(amount), date,
  clientId: order.clientId, serviceId: order.serviceId, childName: order.childName ?? order.eventForm?.childName ?? '',
  ...(isCostKind(kind) ? { category: EVENT_EXPENSE_CATEGORY } : {}),
  ...(seq ? { seq } : {}),
});

/** Entrada: valor de entrada do formulário. `order` = dados do pedido (com eventForm). */
export function planEntry(orderId, order, date) {
  const entry = order?.eventForm?.entryValue;
  if (!Number.isFinite(entry) || entry < 0) throw new EventFinanceError('incomplete', 'Valor de entrada ausente ou inválido: o pedido não foi criado.');
  return base(orderId, order, 'entry', entry, date);
}

/**
 * Conclusão: 2ª parcela = valor total − receita já lançada (entrada + ajustes; com a entrada padrão de 50%, é igual à entrada) e despesa = custo.
 * `final`/`cost` indicam o que já existe no livro; só o que falta é planejado.
 * Valores incompletos bloqueiam a conclusão com erro explícito (nada é lançado).
 */
export function planCompletion(orderId, order, { bookedRevenue, final: hasFinal = false, cost: hasCost = false }, date) {
  const { totalValue, cost } = order?.eventForm ?? {};
  if (!Number.isFinite(totalValue) || totalValue < 0 || !Number.isFinite(cost) || cost < 0) {
    throw new EventFinanceError('incomplete', 'Dados financeiros do evento incompletos: informe o custo em "Editar pedido" antes de concluir.');
  }
  const entry = Number.isFinite(bookedRevenue) ? bookedRevenue : order.eventForm.entryValue;
  const records = [];
  if (!hasFinal) records.push(base(orderId, order, 'final', Math.max(0, totalValue - (Number.isFinite(entry) ? entry : 0)), date));
  if (!hasCost) records.push(base(orderId, order, 'cost', cost, date));
  return records;
}

/**
 * Ajustes ao alterar valores de um evento que já tem lançamentos. `order.eventLedger` = o que o livro registra
 * ({ entry, final?, cost?, adj?, adjCost?, seq? }); `form` = { totalValue, entryValue, cost } novos. Retorna os lançamentos de ajuste
 * (diferença com sinal, ID `...-adjrev-{n}` / `...-adjcost-{n}`) e o novo estado `next` do eventLedger.
 * - Receita: antes da conclusão o alvo é a entrada; depois, o valor total (entrada + 2ª parcela + ajustes = total).
 * - Despesa: só depois da conclusão (antes dela o custo ainda não foi lançado); alvo = custo atual.
 * Nada muda se a diferença for zero. Valores ausentes/inválidos não geram ajuste.
 */
export function planAdjustments(orderId, order, form, date) {
  const ledger = order?.eventLedger;
  if (!ledger || !Number.isFinite(ledger.entry)) return { records: [], next: ledger };
  const completed = Number.isFinite(ledger.final);
  const bookedRevenue = ledger.entry + (ledger.final ?? 0) + (ledger.adj ?? 0);
  const targetRevenue = completed ? form?.totalValue : form?.entryValue;
  const deltaRevenue = Number.isFinite(targetRevenue) && targetRevenue >= 0 ? roundMoney(targetRevenue - bookedRevenue) : 0;
  const bookedCost = Number.isFinite(ledger.cost) ? ledger.cost + (ledger.adjCost ?? 0) : null;
  const deltaCost = bookedCost !== null && Number.isFinite(form?.cost) && form.cost >= 0 ? roundMoney(form.cost - bookedCost) : 0;
  if (!deltaRevenue && !deltaCost) return { records: [], next: ledger };
  const seq = (ledger.seq ?? 0) + 1;
  const records = [];
  const next = { ...ledger, seq };
  if (deltaRevenue) { records.push(base(orderId, order, 'adjrev', deltaRevenue, date, seq)); next.adj = roundMoney((ledger.adj ?? 0) + deltaRevenue); }
  if (deltaCost) { records.push(base(orderId, order, 'adjcost', deltaCost, date, seq)); next.adjCost = roundMoney((ledger.adjCost ?? 0) + deltaCost); }
  return { records, next };
}

/**
 * Documentos do livro -> "pedidos" sintéticos que o cálculo de faturamento já entende (concluídos, valor = totalPaid, data = completedAt).
 * Valor zero é ignorado (ajustes podem ser negativos); despesas ganham ledgerKind 'cost' e `eventCost` (tratadas à parte em buildRevenueEntries).
 */
export function ledgerToOrders(docs) {
  return docs
    .filter((d) => d && Number.isFinite(d.amount) && d.amount !== 0)
    .map((d) => ({
      id: d.id, orderId: d.orderId, ledger: true, ledgerKind: d.kind, status: 'completed', source: 'manual',
      clientId: d.clientId, serviceId: d.serviceId, childName: d.childName || undefined, content: '', completedAt: d.date,
      ...(d.type === 'expense' ? { eventCost: d.amount } : { totalPaid: d.amount }),
    }));
}
