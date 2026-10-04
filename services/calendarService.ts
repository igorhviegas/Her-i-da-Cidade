import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import type { CalendarEvent, CalendarEventInput } from '../functions/google-calendar.js';

export type { CalendarEvent, CalendarEventInput };

const CACHE_TTL_MS = 2 * 60_000;

/** Chamada autenticada a /api/calendar-events. Só resolve com a confirmação do servidor (que só responde ok após o Google confirmar). */
async function call<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Faça login como administrador.');
  let response: Response;
  try {
    response = await fetch('/api/calendar-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Nada foi alterado na agenda.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? 'Não foi possível falar com o Google Agenda.');
  return body as T;
}

// Cache em memória por período (compartilhado entre o widget da Principal e o Calendário). Mutações e sincronizações o invalidam.
type Entry = { at: number; promise: Promise<{ events: CalendarEvent[]; truncated: boolean }> };
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

export function invalidateCalendarCache(): void {
  cache.clear();
  listeners.forEach((listener) => listener());
}
export function onCalendarChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function listCalendarEvents(from: string, to: string): Promise<{ events: CalendarEvent[]; truncated: boolean }> {
  const key = `${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = call<{ events: CalendarEvent[]; truncated: boolean }>({ action: 'list', from, to })
    .then(({ events, truncated }) => ({ events, truncated: !!truncated }));
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key); }); // falha não fica em cache
  return promise;
}

/** Busca (título, descrição — onde ficam cliente e criança — e local) em um período; não passa pelo cache. */
export const searchCalendarEvents = (q: string, from: string, to: string) =>
  call<{ events: CalendarEvent[]; truncated: boolean }>({ action: 'list', q, from, to });

export async function saveCalendarEvent(event: CalendarEventInput, id?: string): Promise<CalendarEvent> {
  const { event: saved } = await call<{ event: CalendarEvent }>({ action: id ? 'update' : 'create', id, event });
  invalidateCalendarCache();
  return saved;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await call({ action: 'delete', id });
  invalidateCalendarCache();
}

export type CalendarLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: CalendarEvent[]; truncated: boolean };

/** Eventos do período [from, to]. Recarrega quando o cache é invalidado (edição, exclusão, envio de pedido ao Google Agenda). */
export function useCalendarEvents(from: string, to: string): { state: CalendarLoad; reload: () => void } {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ range: string; load: CalendarLoad } | null>(null);
  useEffect(() => onCalendarChange(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    const range = `${from}|${to}`;
    listCalendarEvents(from, to).then(
      ({ events, truncated }) => { if (!cancelled) setResult({ range, load: { status: 'ready', events, truncated } }); },
      (error) => { if (!cancelled) setResult({ range, load: { status: 'error', message: error instanceof Error ? error.message : 'Falha ao carregar a agenda.' } }); },
    );
    return () => { cancelled = true; };
  }, [from, to, version]);
  // Resultado de outro período (navegação em andamento) conta como carregando; o mesmo período mantém os dados durante a recarga.
  const state: CalendarLoad = result && result.range === `${from}|${to}` ? result.load : { status: 'loading' };
  return { state, reload: invalidateCalendarCache };
}
