// Seleções da página Principal do Admin (puras). "Hoje" = data de Brasília, a mesma do módulo Missões.
import { dateKey } from '../functions/missions-core.js';

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isToday = (value, now) => { const date = toDate(value); return !!date && dateKey(date) === dateKey(now); };

/**
 * Pedidos em andamento (qualquer etapa do Kanban exceto Concluído) com prazo de entrega ao cliente (customerDueDate) hoje.
 * `attention`: ainda não chegou na etapa Entregar. Ordem: os que precisam de atenção primeiro.
 */
export function deliveriesToday(activeOrders, now = new Date()) {
  return activeOrders
    .filter((order) => order.status !== 'completed' && isToday(order.customerDueDate, now))
    .map((order) => ({ order, attention: order.status !== 'delivery' }))
    .sort((a, b) => Number(b.attention) - Number(a.attention));
}

/** HH:mm em Brasília; vazio quando é o fim do dia (prazo "até o dia", 23:59). */
function timeOf(date) {
  const shifted = new Date(date.getTime() - 3 * 3600000);
  const h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes();
  return h === 23 && m === 59 ? '' : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Tarefas recorrentes de hoje e missões avulsas com prazo hoje, com contagem de concluídas/pendentes. Ignora 'skipped'. */
export function tasksToday(occurrences, missions, now = new Date()) {
  const today = dateKey(now);
  const recurring = occurrences.filter((o) => o.date === today && o.status !== 'skipped').sort((a, b) => a.time.localeCompare(b.time));
  const due = missions.filter((m) => isToday(m.dueAt, now)).sort((a, b) => toDate(a.dueAt) - toDate(b.dueAt));
  const items = [
    ...recurring.map((o) => ({ key: `t_${o.id}`, title: o.title, time: o.time, status: o.status })),
    ...due.map((m) => ({ key: `m_${m.id}`, title: m.title, time: timeOf(toDate(m.dueAt)), status: m.status })),
  ];
  return {
    items,
    completed: items.filter((i) => i.status === 'completed').length,
    pending: items.filter((i) => i.status === 'pending').length,
    missed: items.filter((i) => i.status === 'missed').length,
  };
}
