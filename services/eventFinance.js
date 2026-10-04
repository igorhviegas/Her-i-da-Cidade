// Lançamentos financeiros dos pedidos de evento (sem Firebase/React; testado em Node).
//
// Livro de lançamentos imutável na coleção `financeEntries`, com ID determinístico por pedido e tipo:
//   evt-{pedido}-entry  receita: entrada (1ª parcela), na criação do pedido
//   evt-{pedido}-final  receita: 2ª parcela, na PRIMEIRA conclusão
//   evt-{pedido}-cost   despesa "Despesa evento", na PRIMEIRA conclusão
// Cada ID existe no máximo uma vez (create-only nas regras + checagem na mesma transação do pedido): reabrir, concluir de
// novo ou repetir a ação não gera lançamento novo, e editar o pedido depois não altera o que já foi lançado.

import { roundMoney } from './eventForm.js';

export const LEDGER_COLLECTION = 'financeEntries';
export const EVENT_EXPENSE_CATEGORY = 'Despesa evento';
export const LEDGER_KINDS = ['entry', 'final', 'cost'];
export const LEDGER_LABELS = { entry: 'Entrada (1ª parcela)', final: '2ª parcela', cost: EVENT_EXPENSE_CATEGORY };

export class EventFinanceError extends Error {
  constructor(code, message) { super(message); this.name = 'EventFinanceError'; this.code = code; }
}

export const ledgerId = (orderId, kind) => `evt-${orderId}-${kind}`;

const base = (orderId, order, kind, amount, date) => ({
  orderId, kind, type: kind === 'cost' ? 'expense' : 'revenue', amount: roundMoney(amount), date,
  clientId: order.clientId, serviceId: order.serviceId, childName: order.childName ?? order.eventForm?.childName ?? '',
  ...(kind === 'cost' ? { category: EVENT_EXPENSE_CATEGORY } : {}),
});

/** Entrada: valor de entrada do formulário. `order` = dados do pedido (com eventForm). */
export function planEntry(orderId, order, date) {
  const entry = order?.eventForm?.entryValue;
  if (!Number.isFinite(entry) || entry < 0) throw new EventFinanceError('incomplete', 'Valor de entrada ausente ou inválido: o pedido não foi criado.');
  return base(orderId, order, 'entry', entry, date);
}

/**
 * Conclusão: 2ª parcela = valor total − entrada já lançada (com a entrada padrão de 50%, é igual à entrada) e despesa = custo.
 * `booked` indica o que já existe no livro ({ final?: true, cost?: true }); só o que falta é planejado.
 * Valores incompletos bloqueiam a conclusão com erro explícito (nada é lançado).
 */
export function planCompletion(orderId, order, { bookedEntry, final: hasFinal = false, cost: hasCost = false }, date) {
  const { totalValue, cost } = order?.eventForm ?? {};
  if (!Number.isFinite(totalValue) || totalValue < 0 || !Number.isFinite(cost) || cost < 0) {
    throw new EventFinanceError('incomplete', 'Dados financeiros do evento incompletos: informe o custo em "Editar pedido" antes de concluir.');
  }
  const entry = Number.isFinite(bookedEntry) ? bookedEntry : order.eventForm.entryValue;
  const records = [];
  if (!hasFinal) records.push(base(orderId, order, 'final', Math.max(0, totalValue - (Number.isFinite(entry) ? entry : 0)), date));
  if (!hasCost) records.push(base(orderId, order, 'cost', cost, date));
  return records;
}

/**
 * Documentos do livro -> "pedidos" sintéticos que o cálculo de faturamento já entende (concluídos, valor = totalPaid, data = completedAt).
 * Receita de valor zero é ignorada; despesas ganham ledgerKind 'cost' e `eventCost` (tratadas à parte em buildRevenueEntries).
 */
export function ledgerToOrders(docs) {
  return docs
    .filter((d) => d && d.amount > 0)
    .map((d) => ({
      id: d.id, orderId: d.orderId, ledger: true, ledgerKind: d.kind, status: 'completed', source: 'manual',
      clientId: d.clientId, serviceId: d.serviceId, childName: d.childName || undefined, content: '', completedAt: d.date,
      ...(d.kind === 'cost' ? { eventCost: d.amount } : { totalPaid: d.amount }),
    }));
}
