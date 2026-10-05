// Regras puras do módulo Calendário (datas como chaves YYYY-MM-DD no fuso de Brasília, reutilizando missions-core).
import { addDays, weekdayOf } from '../functions/missions-core.js';

/** Eventos que ocupam o dia `key` (inclui multi-dia), dia inteiro primeiro e depois por horário/título. */
export function eventsOnDay(events, key) {
  return events
    .filter((e) => e.startKey <= key && key <= e.endKey)
    .sort((a, b) => (a.allDay === b.allDay ? (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title) : a.allDay ? -1 : 1));
}

/** Primeiro e último dia exibidos: mês = grade de semanas completas (dom–sáb), semana = dom–sáb, dia = o próprio dia. */
export function visibleRange(view, key) {
  if (view === 'day') return { from: key, to: key };
  if (view === 'week') { const from = addDays(key, -weekdayOf(key)); return { from, to: addDays(from, 6) }; }
  const first = `${key.slice(0, 7)}-01`;
  const from = addDays(first, -weekdayOf(first));
  const monthEnd = addDays(`${nextMonthKey(key)}`, -1);
  return { from, to: addDays(monthEnd, 6 - weekdayOf(monthEnd)) };
}

const nextMonthKey = (key) => { const [y, m] = key.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; };

/** Dias (chaves) entre from e to, inclusivos. */
export function daysBetween(from, to) {
  const days = [];
  for (let key = from; key <= to; key = addDays(key, 1)) days.push(key);
  return days;
}

/** Data selecionada após "anterior/próximo": mês preserva o dia (limitado ao último dia do mês), semana ±7, dia ±1. */
export function shiftDate(view, key, direction) {
  if (view === 'day') return addDays(key, direction);
  if (view === 'week') return addDays(key, 7 * direction);
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + direction, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
