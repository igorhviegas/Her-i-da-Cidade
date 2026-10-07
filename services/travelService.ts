import type { TravelResult } from '../functions/travel-route.js';

export type { TravelResult };

/** Corpo aceito por /api/travel-route (ver validateTravelInput): start/end ausentes = padrão; stop null = sem parada, ausente = padrão. */
export interface TravelRequest { events: string[]; start?: string; end?: string; stop?: string | null; kmRate: string; eventFee: string }

/** `unauthorized` = o código de acesso foi recusado (a tela pede o código de novo). */
export class TravelRequestError extends Error {
  constructor(message: string, public unauthorized = false) { super(message); this.name = 'TravelRequestError'; }
}

/** Calcula o deslocamento no servidor (sem login: o acesso é pelo código no header). Só resolve com o resultado confirmado. */
export async function calculateTravelRoute(code: string, payload: TravelRequest): Promise<TravelResult> {
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
    throw new TravelRequestError(error?.name === 'AbortError' ? 'O cálculo demorou demais. Tente novamente.' : 'Sem conexão com o servidor. Tente novamente.');
  } finally {
    clearTimeout(timeoutId);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new TravelRequestError(body?.error?.message ?? 'Não foi possível calcular agora.', response.status === 401);
  return body as TravelResult;
}
