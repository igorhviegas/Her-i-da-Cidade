import { logger } from '../lib/logger.js';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../functions/firebase-admin.js';
import { runMissionsSync } from '../functions/missions-sync.js';

/**
 * Chamado pelo Vercel Cron (GET, `Authorization: Bearer $CRON_SECRET`) à 00:00 de Brasília (03:00 UTC; no plano Hobby a execução
 * pode ocorrer em qualquer momento dessa hora). A rotina é idempotente e recupera dias perdidos, então execuções duplicadas ou
 * atrasadas são seguras. O CRM também roda a mesma sincronização ao ser aberto.
 */
export async function handleMissionsCron(
  req: Request | any,
  res: Response | any,
  deps: { secret?: string; run?: () => Promise<unknown> } = {},
) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    if (typeof res.status === 'function') return res.status(status).json(body);
    res.statusCode = status;
    res.setHeader?.('Content-Type', 'application/json');
    return res.end?.(JSON.stringify(body));
  };

  if (req.method !== 'GET') return send(405, { ok: false, error: { code: 'method_not_allowed', message: 'Use GET.' } });

  const secret = deps.secret ?? process.env.CRON_SECRET;
  if (!secret) {
    logger.error('[Missions Cron] CRON_SECRET não configurado nas variáveis de ambiente.');
    return send(500, { ok: false, error: { code: 'server_misconfigured', message: 'Serviço indisponível: configuração pendente.' } });
  }

  const header = req.headers?.authorization ?? req.get?.('authorization');
  const supplied = Buffer.from(typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return send(401, { ok: false, error: { code: 'unauthorized', message: 'Credencial ausente ou inválida.' } });
  }

  try {
    const result = await (deps.run ?? (() => runMissionsSync(getAdminFirestore())))();
    return send(200, { ok: true, ...(result as object) });
  } catch (error) {
    logger.error('[Missions Cron] Falha na rotina de missões:', error instanceof Error ? error.message : String(error));
    return send(500, { ok: false, error: { code: 'internal_error', message: 'A rotina de missões falhou; consulte os logs.' } });
  }
}

export default handleMissionsCron;
