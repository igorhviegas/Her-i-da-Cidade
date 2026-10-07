import type { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../functions/firebase-admin.js';
import { TravelRouteError, calculateTravel, codeMatches, listDayEvents, readTravelConfig } from '../functions/travel-route.js';
import { validateTravelInput } from '../services/travelCost.js';

const STATUS_BY_CODE: Record<string, number> = {
  not_configured: 503, stop_not_configured: 422, address_not_found: 422, invalid_date: 400, events_unavailable: 503, no_route: 422, auth: 503, rate_limited: 429, unavailable: 503, api_error: 502,
};

/** Pedidos com eventDate no intervalo, como o cron de missões consulta (Firestore Admin, só servidor). */
const ordersBetween = async (start: Date, end: Date) => {
  const snap = await getAdminFirestore().collection('orders')
    .where('eventDate', '>=', Timestamp.fromDate(start)).where('eventDate', '<=', Timestamp.fromDate(end)).get();
  return snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
};

/**
 * POST (área do agente, sem login) com o código de acesso no header `x-travel-code`.
 * - Cálculo (padrão): { events: string[], start?, stop?, end?, kmRate, eventFee } (ver validateTravelInput).
 *   Resposta { ok: true, ...resultado }: trechos em km, valores, endereços entendidos, avisos e a base do link do WhatsApp.
 * - { action: 'events', date: 'YYYY-MM-DD' }: eventos cadastrados no dia (só horário, local e tipo) para importar os endereços.
 * Os endereços padrão e o número do WhatsApp ficam só no servidor; o número só sai depois de o código ser validado.
 */
export async function handleTravelRoute(
  req: Request | any,
  res: Response | any,
  deps: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; calculate?: typeof calculateTravel; listOrdersBetween?: typeof ordersBetween } = {},
) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(status).json(body);
  };
  const fail = (status: number, code: string, message: string) => send(status, { ok: false, error: { code, message } });

  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  const config = readTravelConfig(deps.env ?? process.env);
  if (!config) return fail(503, 'not_configured', 'O cálculo de deslocamento ainda não foi configurado no servidor.');
  const header = req.headers?.['x-travel-code'];
  if (!codeMatches(Array.isArray(header) ? header[0] : header, config.accessCode)) return fail(401, 'unauthorized', 'Código de acesso inválido.');

  const action = req.body?.action;
  if (action !== undefined && action !== 'events') return fail(400, 'invalid_request', 'Ação inválida.');

  try {
    if (action === 'events') {
      const date = req.body?.date;
      const events = await listDayEvents({ date: typeof date === 'string' ? date : '', listOrdersBetween: deps.listOrdersBetween ?? ordersBetween }).catch((error) => {
        if (error instanceof TravelRouteError) throw error;
        console.error('[Travel] consulta de eventos falhou:', error instanceof Error ? error.name : 'erro'); // sem detalhes: podem citar dados do pedido
        throw new TravelRouteError('events_unavailable');
      });
      return send(200, { ok: true, date, events });
    }

    const parsed = validateTravelInput(req.body);
    if (parsed.error) return fail(400, 'invalid_request', parsed.error);
    const result = await (deps.calculate ?? calculateTravel)({ input: parsed.value, config, fetchImpl: deps.fetchImpl });
    return send(200, { ok: true, ...result });
  } catch (error) {
    if (error instanceof TravelRouteError) {
      // Falhas de chave/cota são do servidor: o agente vê a mensagem genérica; o log tem o código e o status do Google.
      if (['auth', 'rate_limited', 'api_error'].includes(error.code)) console.error('[Travel] Google:', error.code, error.detail);
      return fail(STATUS_BY_CODE[error.code] ?? 502, error.code, error.message);
    }
    console.error('[Travel] falha inesperada:', error instanceof Error ? error.name : 'erro');
    return fail(500, 'internal_error', 'Não foi possível calcular agora. Tente novamente.');
  }
}

export default handleTravelRoute;
