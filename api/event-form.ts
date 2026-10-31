import { logger } from '../lib/logger.js';
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../functions/firebase-admin.js';
import { authorizeAdminRequest } from '../functions/admin-auth.js';
import { clientIp, verifyTurnstile } from '../functions/turnstile.js';
import { TravelRouteError } from '../functions/travel-route.js';
import { EventFormError, calculateQuote, calculateSchedule, geocodeEvents, getQuotePrefill, loadFormConfig, saveQuote, submitEventForm } from '../functions/event-form.js';
import { publicFormConfig } from '../services/eventFormConfig.js';
import { CollabFormError, submitCollabForm } from '../functions/collab.js';

const STATUS_BY_CODE: Record<string, number> = {
  validation_error: 400, already_pending: 409, terms_changed: 409, service_unavailable: 503,
  not_configured: 503, address_not_found: 422, no_route: 422, auth: 503, rate_limited: 429, unavailable: 503, api_error: 502,
};

type Auth = 'unauthenticated' | 'forbidden' | 'authorized';

/**
 * Formulário do evento presencial (/formulario-evento) e orçamentos do Calendário. Uma função só (a Vercel limita o número de funções).
 * Público:
 *   GET  [?orcamento=ID]               -> { config, prefill }: textos/preços/termos atuais do CRM e o orçamento enviado (ou null)
 *   POST { action: 'submit', ... }     -> grava o formulário (captcha Turnstile quando ligado) e devolve número + link do WhatsApp
 *   POST { action: 'collab', ... }     -> cadastro das Mamães em Collab (/mamaes-em-collab), mesmo captcha (functions/collab.js)
 * Administrador (ID token do Firebase):
 *   POST { action: 'quote', address, date, packageId, companyBase? } -> cálculo com a rota casa → evento
 *   POST { action: 'schedule', stops: [{label, address}] } -> { legs: [{minutes, km}], resolved, withVitor } (viabilidade de horários)
 *   POST { action: 'geocode-events', orderIds } -> { results: [{id, eventGeo}] } (aba Mapa; até 25 por chamada)
 *   POST { action: 'save-quote', packageId, date, location, total, km, city } -> { id } para o link
 */
export async function handleEventForm(
  req: Request | any,
  res: Response | any,
  deps: { database?: unknown; authorize?: (req: Request) => Promise<Auth>; captcha?: typeof verifyTurnstile; submit?: typeof submitEventForm; quote?: typeof calculateQuote; collab?: typeof submitCollabForm } = {},
) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(status).json(body);
  };
  const fail = (status: number, code: string, message: string) => send(status, { ok: false, error: { code, message } });
  if (req.method !== 'GET' && req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use GET ou POST.');

  try {
    const database = (deps.database ?? getAdminFirestore()) as any;
    if (req.method === 'GET') {
      const [config, prefill] = await Promise.all([loadFormConfig(database), getQuotePrefill({ database, quoteId: req.query?.orcamento })]);
      return send(200, { ok: true, config: publicFormConfig(config), prefill });
    }

    const body = req.body ?? {};
    if (body.action === 'submit' || body.action === 'collab') {
      const captcha = await (deps.captcha ?? verifyTurnstile)({ token: body.turnstileToken, secret: process.env.TURNSTILE_SECRET_KEY, ip: clientIp(req.headers) });
      if (captcha.ok && captcha.unavailable) logger.warn('[EventForm] Turnstile indisponível: envio liberado sem verificação.');
      if (!captcha.ok) return fail(403, 'captcha_failed', 'Não foi possível confirmar a verificação de segurança. Atualize a página e tente de novo.');
      const { turnstileToken: _token, action: _action, ...input } = body;
      if (body.action === 'collab') return send(200, { ok: true, result: await (deps.collab ?? submitCollabForm)({ database, input }) });
      return send(200, { ok: true, result: await (deps.submit ?? submitEventForm)({ database, input }) });
    }

    if (!['quote', 'save-quote', 'schedule', 'geocode-events'].includes(body.action)) return fail(400, 'invalid_action', 'Ação inválida.');
    let auth: Auth;
    try { auth = await (deps.authorize ?? authorizeAdminRequest)(req); } catch { return fail(503, 'auth_unavailable', 'Não foi possível validar o acesso agora.'); }
    if (auth === 'unauthenticated') return fail(401, 'unauthorized', 'Faça login novamente.');
    if (auth === 'forbidden') return fail(403, 'forbidden', 'Acesso restrito a administradores.');
    if (body.action === 'schedule') return send(200, { ok: true, ...(await calculateSchedule({ input: body })) });
    if (body.action === 'geocode-events') return send(200, { ok: true, ...(await geocodeEvents({ database, input: body })) });
    if (body.action === 'quote') return send(200, { ok: true, ...(await (deps.quote ?? calculateQuote)({ database, input: body })) });
    return send(200, { ok: true, ...(await saveQuote({ database, input: body })) });
  } catch (error) {
    if (error instanceof EventFormError || error instanceof TravelRouteError || error instanceof CollabFormError) {
      if (error instanceof TravelRouteError) logger.error('[EventForm] Google Maps:', error.code, (error as any).detail ?? '');
      return fail(STATUS_BY_CODE[error.code] ?? 400, error.code, error.message);
    }
    logger.error('[EventForm] falha inesperada:', error instanceof Error ? error.message : 'erro');
    return fail(500, 'internal_error', 'Não foi possível concluir agora. Tente novamente.');
  }
}

export default handleEventForm;
