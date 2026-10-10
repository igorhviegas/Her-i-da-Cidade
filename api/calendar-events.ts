import { logger } from '../lib/logger.js';
import type { Request, Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../functions/firebase-admin.js';
import { authorizeAdminRequest } from '../functions/admin-auth.js';
import { GoogleCalendarError, createCalendarEvent, deleteCalendarEvent, syncOrderToCalendar, listCalendarEvents, updateCalendarEvent } from '../functions/google-calendar.js';

const STATUS_BY_CODE: Record<string, number> = {
  not_configured: 503, invalid_credentials: 503, auth: 502, permission: 502, calendar_not_found: 502, rate_limited: 429, unavailable: 503, api_error: 502,
  invalid_order: 422, invalid_event: 422, invalid_range: 400, event_not_found: 404,
};

type Auth = 'unauthenticated' | 'forbidden' | 'authorized';
const ACTIONS = { list: listCalendarEvents, create: createCalendarEvent, update: updateCalendarEvent, delete: deleteCalendarEvent };

/**
 * POST { action: 'list' | 'create' | 'update' | 'delete' | 'sync', ... } + ID token do Firebase de um administrador.
 * Opera direto na agenda (Calendar API v3, mesma conta de serviço do envio de pedidos). Não lê nem grava pedidos, missões ou
 * lançamentos: excluir ou editar um evento nunca mexe no CRM. Resposta ok só depois da confirmação do Google.
 * `sync` { orderId }: cria/atualiza o evento do pedido salvo (o servidor lê o pedido, nunca dados do navegador) e grava o vínculo nele.
 * Fica aqui, e não em outra função, porque a Vercel limita o número de funções em api/.
 */
export async function handleCalendarEvents(
  req: Request | any,
  res: Response | any,
  deps: { authorize?: (req: Request) => Promise<Auth>; actions?: Partial<typeof ACTIONS>; db?: any; sync?: typeof syncOrderToCalendar } = {},
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
  if (body.action === 'sync') return syncOrder(body.orderId, deps, send, fail);
  if (!Object.hasOwn(ACTIONS, action)) return fail(400, 'invalid_request', 'Ação inválida.');
  const run: (args: unknown) => Promise<any> = (deps.actions?.[action] ?? ACTIONS[action]) as any;

  try {
    const data = await run({ from: body.from, to: body.to, q: body.q, id: body.id, input: body.event });
    return send(200, { ok: true, ...(action === 'list' ? data : action === 'delete' ? {} : { event: data }) });
  } catch (error) {
    if (error instanceof GoogleCalendarError) return fail(STATUS_BY_CODE[error.code] ?? 502, error.code, error.message);
    logger.error('[Calendar Events] falha inesperada:', error instanceof Error ? error.name : 'erro');
    return fail(500, 'internal_error', 'A operação falhou; consulte os logs do servidor.');
  }
}

async function syncOrder(
  orderId: unknown,
  deps: { db?: any; sync?: typeof syncOrderToCalendar },
  send: (status: number, body: unknown) => unknown,
  fail: (status: number, code: string, message: string) => unknown,
) {
  if (typeof orderId !== 'string' || !orderId.trim() || orderId.includes('/')) return fail(400, 'invalid_request', 'Informe o pedido.');
  try {
    const db = deps.db ?? getAdminFirestore();
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return fail(404, 'order_not_found', 'Pedido não encontrado.');
    const order = orderSnap.data();
    if (!order.eventForm) return fail(422, 'not_event', 'Este pedido não é um evento cadastrado pelo formulário manual.');
    const clientSnap = await db.collection('clients').doc(String(order.clientId)).get();
    if (!clientSnap.exists) return fail(422, 'client_not_found', 'Cliente do pedido não encontrado.');

    const result = await (deps.sync ?? syncOrderToCalendar)({ orderId, order, client: clientSnap.data() });
    let persisted = true;
    try {
      await orderRef.update({ googleCalendar: { eventId: result.eventId, calendarId: result.calendarId, htmlLink: result.htmlLink ?? null, syncedAt: FieldValue.serverTimestamp() } });
    } catch {
      persisted = false; // o Google confirmou; o ID é determinístico, então um novo envio atualiza este mesmo evento
    }
    return send(200, { ok: true, created: result.created, htmlLink: result.htmlLink ?? null, persisted });
  } catch (error) {
    if (error instanceof GoogleCalendarError) return fail(STATUS_BY_CODE[error.code] ?? 502, error.code, error.message);
    logger.error('[Google Calendar] falha inesperada:', error instanceof Error ? error.name : 'erro');
    return fail(500, 'internal_error', 'O envio falhou; consulte os logs do servidor.');
  }
}

export default handleCalendarEvents;
