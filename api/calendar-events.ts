import type { Request, Response } from 'express';
import { authorizeAdminRequest } from '../functions/admin-auth.js';
import { GoogleCalendarError, createCalendarEvent, deleteCalendarEvent, listCalendarEvents, updateCalendarEvent } from '../functions/google-calendar.js';

const STATUS_BY_CODE: Record<string, number> = {
  not_configured: 503, invalid_credentials: 503, auth: 502, permission: 502, calendar_not_found: 502, rate_limited: 429, unavailable: 503, api_error: 502,
  invalid_event: 422, invalid_range: 400, event_not_found: 404,
};

type Auth = 'unauthenticated' | 'forbidden' | 'authorized';
const ACTIONS = { list: listCalendarEvents, create: createCalendarEvent, update: updateCalendarEvent, delete: deleteCalendarEvent };

/**
 * POST { action: 'list' | 'create' | 'update' | 'delete', ... } + ID token do Firebase de um administrador.
 * Opera direto na agenda (Calendar API v3, mesma conta de serviço do envio de pedidos). Não lê nem grava pedidos, missões ou
 * lançamentos: excluir ou editar um evento nunca mexe no CRM. Resposta ok só depois da confirmação do Google.
 */
export async function handleCalendarEvents(
  req: Request | any,
  res: Response | any,
  deps: { authorize?: (req: any) => Promise<Auth>; actions?: Partial<typeof ACTIONS> } = {},
) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(status).json(body);
  };
  const fail = (status: number, code: string, message: string) => send(status, { ok: false, error: { code, message } });

  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
  let auth: Auth;
  try { auth = await (deps.authorize ?? authorizeAdminRequest)(req); } catch { return fail(503, 'auth_unavailable', 'Não foi possível validar o acesso agora.'); }
  if (auth === 'unauthenticated') return fail(401, 'unauthorized', 'Faça login novamente.');
  if (auth === 'forbidden') return fail(403, 'forbidden', 'Acesso restrito a administradores.');

  const body = req.body ?? {};
  const action = body.action as keyof typeof ACTIONS;
  if (!Object.hasOwn(ACTIONS, action)) return fail(400, 'invalid_request', 'Ação inválida.');
  const run: (args: any) => Promise<any> = (deps.actions?.[action] ?? ACTIONS[action]) as any;

  try {
    const data = await run({ from: body.from, to: body.to, q: body.q, id: body.id, input: body.event });
    return send(200, { ok: true, ...(action === 'list' ? data : action === 'delete' ? {} : { event: data }) });
  } catch (error) {
    if (error instanceof GoogleCalendarError) return fail(STATUS_BY_CODE[error.code] ?? 502, error.code, error.message);
    console.error('[Calendar Events] falha inesperada:', error instanceof Error ? error.name : 'erro');
    return fail(500, 'internal_error', 'A operação falhou; consulte os logs do servidor.');
  }
}

export default handleCalendarEvents;
