import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../functions/firebase-admin.js';
import { authorizeAdminRequest } from '../functions/admin-auth.js';
import { InstagramSyncError, runInstagramSync } from '../functions/instagram-sync.js';

type Auth = 'unauthenticated' | 'forbidden' | 'authorized';

const STATUS_BY_CODE: Record<string, number> = { not_configured: 503, token_invalid: 502, permission: 502, rate_limited: 429, unavailable: 503, api_error: 502 };

/**
 * GET  + `Authorization: Bearer $CRON_SECRET` -> sincronização agendada (Vercel Cron, 1x/dia).
 * POST + ID token do Firebase de um administrador -> sincronização manual (com intervalo mínimo de 60 s).
 */
export async function handleInstagramSync(
  req: Request | any,
  res: Response | any,
  deps: { secret?: string; authorize?: (req: any) => Promise<Auth>; run?: (manual: boolean) => Promise<unknown> } = {},
) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(status).json(body);
  };
  const fail = (status: number, code: string, message: string) => send(status, { ok: false, error: { code, message } });

  const manual = req.method === 'POST';
  if (req.method !== 'GET' && !manual) return fail(405, 'method_not_allowed', 'Use GET (cron) ou POST (admin).');

  if (manual) {
    let auth: Auth;
    try { auth = await (deps.authorize ?? authorizeAdminRequest)(req); } catch { return fail(503, 'auth_unavailable', 'Não foi possível validar o acesso agora.'); }
    if (auth === 'unauthenticated') return fail(401, 'unauthorized', 'Faça login novamente.');
    if (auth === 'forbidden') return fail(403, 'forbidden', 'Acesso restrito a administradores.');
  } else {
    const secret = deps.secret ?? process.env.CRON_SECRET;
    if (!secret) return fail(500, 'server_misconfigured', 'Serviço indisponível: configuração pendente.');
    const header = req.headers?.authorization;
    const supplied = Buffer.from(typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '');
    const expected = Buffer.from(secret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return fail(401, 'unauthorized', 'Credencial ausente ou inválida.');
  }

  try {
    const result = await (deps.run ?? ((isManual) => runInstagramSync({ db: getAdminFirestore(), manual: isManual })))(manual);
    return send(200, { ok: true, ...(result as object) });
  } catch (error) {
    if (error instanceof InstagramSyncError) return fail(STATUS_BY_CODE[error.code] ?? 502, error.code, error.message);
    console.error('[Instagram Sync] falha inesperada:', error instanceof Error ? error.name : 'erro');
    return fail(500, 'internal_error', 'A sincronização falhou; consulte os logs.');
  }
}

export default handleInstagramSync;
