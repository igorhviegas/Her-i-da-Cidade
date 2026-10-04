// Checklist das missões e missão automática "Check list do evento" (regras puras + rotina com store abstrato).
// Rodada pelo cron diário (functions/missions-sync.js); nada aqui conhece Firestore nem Google Agenda.
import { dateKey, endOfDay, occurrenceDueAt, startOfDay } from './missions-core.js';

export const EVENT_MISSION_TITLE = 'Check list do evento';
export const EVENT_MISSION_SOURCE = 'event_checklist';
export const EVENT_CHECKLIST_ITEMS = ['Traje', 'Certificados', 'Medalhas', 'Figurinhas', 'Microfone', 'Faceshell', 'Caixa de som'];
const MAX_ITEMS = 50;

/** ID determinístico: uma missão por pedido, qualquer que seja o número de execuções. */
export const eventMissionId = (orderId) => `evento-checklist-${orderId}`;

/** Normaliza o checklist: remove itens vazios, limita tamanhos, garante `id` único e `done` booleano. */
export function cleanChecklist(items) {
  const seen = new Set();
  const out = [];
  for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
    const text = typeof item?.text === 'string' ? item.text.trim().slice(0, 120) : '';
    if (!text || out.length >= MAX_ITEMS) continue;
    let id = typeof item.id === 'string' && item.id ? item.id : `i${index}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    out.push({ id, text, done: item.done === true });
  }
  return out;
}

const millis = (v) => (v instanceof Date ? v.getTime() : typeof v?.toDate === 'function' ? v.toDate().getTime() : v ? new Date(v).getTime() : NaN);

/** Dia (Brasília) e horário do evento presencial do pedido; null se o pedido não tem evento completo (rascunho do ManyChat, serviço comum). */
export function orderEventSlot(order) {
  const time = order?.eventForm?.eventTime;
  const at = millis(order?.eventDate);
  if (!order?.eventForm || order.eventDraft || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? '') || Number.isNaN(at)) return null;
  const key = dateKey(new Date(at));
  return { key, dueAt: occurrenceDueAt(key, time) };
}

/** Missão do pedido; só é criada quando o dia do evento chega. Todos os itens começam desmarcados. */
export function buildEventMission(order, now) {
  const slot = orderEventSlot(order);
  if (!slot) return null;
  const { childName, eventForm } = order;
  return {
    title: EVENT_MISSION_TITLE,
    description: [childName && `Aniversariante: ${childName}`, `Horário: ${eventForm.eventTime}`, eventForm.location && `Local: ${eventForm.location}`].filter(Boolean).join('\n'),
    difficulty: 1, status: 'pending', source: EVENT_MISSION_SOURCE, orderId: order.id, eventDateKey: slot.key, orderState: 'active',
    dueAt: slot.dueAt, createdAt: now,
    checklist: EVENT_CHECKLIST_ITEMS.map((text, index) => ({ id: `evento-${index + 1}`, text, done: false })),
  };
}

/**
 * Ajuste de uma missão pendente já criada quando o pedido mudou. Nunca toca no checklist nem em missão concluída:
 * - data do evento alterada → só o prazo é remarcado (e apenas quando a data do evento muda, preservando prazo editado à mão);
 * - pedido excluído → marca `orderState: 'deleted'`, sem apagar a missão nem o progresso (a tela sinaliza; apagar é decisão do usuário).
 */
export function eventMissionPatch(mission, order) {
  if (!order) return mission.orderState === 'deleted' ? null : { orderState: 'deleted' };
  const slot = orderEventSlot({ ...order, id: mission.orderId });
  const patch = {};
  if (mission.orderState !== 'active') patch.orderState = 'active';
  if (slot && slot.key !== mission.eventDateKey) Object.assign(patch, { eventDateKey: slot.key, dueAt: slot.dueAt });
  return Object.keys(patch).length ? patch : null;
}

/**
 * Rotina idempotente. `store`:
 *  listOrdersBetween(start, end) → pedidos com eventDate no intervalo (instantes), cada um com `id`
 *  createMissionIfAbsent(id, data) → true se criou   · listPendingEventMissions()   · getOrder(id) → pedido | null
 *  updateMission(id, patch)
 */
export async function syncEventMissions(store, now = new Date()) {
  const today = dateKey(now);
  let created = 0;
  let updated = 0;
  for (const order of await store.listOrdersBetween(startOfDay(today), endOfDay(today))) {
    const mission = buildEventMission(order, now);
    if (mission && await store.createMissionIfAbsent(eventMissionId(order.id), mission)) created += 1;
  }
  for (const mission of await store.listPendingEventMissions()) {
    const patch = eventMissionPatch(mission, await store.getOrder(mission.orderId));
    if (patch) { await store.updateMission(mission.id, patch); updated += 1; }
  }
  return { created, updated };
}
