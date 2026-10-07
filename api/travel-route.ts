import type { Request, Response } from 'express';
import { TravelRouteError, calculateTravel, codeMatches, readTravelConfig } from '../functions/travel-route.js';
import { validateTravelInput } from '../services/travelCost.js';

const STATUS_BY_CODE: Record<string, number> = {
  not_configured: 503, stop_not_configured: 422, address_not_found: 422, no_route: 422, auth: 503, rate_limited: 429, unavailable: 503, api_error: 502,
};

/**
 * POST (área do agente, sem login) com o código de acesso no header `x-travel-code`.
 * Corpo: { events: string[], start?, stop?, end?, kmRate, eventFee } (ver validateTravelInput).
 * Resposta { ok: true, ...resultado }: trechos em km, valores, endereços entendidos, avisos e texto/link do WhatsApp.
 * Os endereços padrão e o número do WhatsApp ficam só no servidor; o número só sai depois de o código ser validado.
 */
export async function handleTravelRoute(
  req: Request | any,
  res: Response | any,
  deps: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; calculate?: typeof calculateTravel } = {},
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

  const parsed = validateTravelInput(req.body);
  if (parsed.error) return fail(400, 'invalid_request', parsed.error);

  try {
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
