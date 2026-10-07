import type { TravelDayEvent, TravelResult } from '../functions/travel-route.js';

export type { TravelDayEvent, TravelResult };

/** Corpo do cálculo em /api/travel-route (ver validateTravelInput): start/end ausentes = padrão; stop null = sem parada, ausente = padrão. */
export interface TravelRequest { events: string[]; start?: string; end?: string; stop?: string | null; kmRate: string; eventFee: string }

/** `unauthorized` = o código de acesso foi recusado (a tela pede o código de novo). */
export class TravelRequestError extends Error {
  constructor(message: string, public unauthorized = false) { super(message); this.name = 'TravelRequestError'; }
}

/** Chamada ao servidor (sem login: o acesso é pelo código no header). Só resolve com a resposta confirmada. */
async function call<T>(code: string, payload: unknown, failure: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);
  let response: Response;
  try {
    response = await fetch('/api/travel-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-travel-code': code },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error: any) {
    throw new TravelRequestError(error?.name === 'AbortError' ? 'A consulta demorou demais. Tente novamente.' : 'Sem conexão com o servidor. Tente novamente.');
  } finally {
    clearTimeout(timeoutId);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new TravelRequestError(body?.error?.message ?? failure, response.status === 401);
  return body as T;
}

export const calculateTravelRoute = (code: string, payload: TravelRequest) => call<TravelResult>(code, payload, 'Não foi possível calcular agora.');

/** Eventos cadastrados no dia ('YYYY-MM-DD'), em ordem de horário: só horário, local e tipo. */
export async function fetchDayEvents(code: string, date: string): Promise<TravelDayEvent[]> {
  const { events } = await call<{ events: TravelDayEvent[] }>(code, { action: 'events', date }, 'Não foi possível consultar os eventos agora.');
  return events;
}
