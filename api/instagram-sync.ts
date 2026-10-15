import { logger } from '../lib/logger.js';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { getAdminAccessToken, getAdminFirestore, hasAdminCredentials } from '../functions/firebase-admin.js';
import { authorizeAdminRequest } from '../functions/admin-auth.js';
import { InstagramSyncError, runInstagramSync } from '../functions/instagram-sync.js';
import { runMissionsSync } from '../functions/missions-sync.js';
import { checkBackups, recordRun, type RunInfo } from '../functions/system-status.js';

type Auth = 'unauthenticated' | 'forbidden' | 'authorized';

const STATUS_BY_CODE: Record<string, number> = { not_configured: 503, token_invalid: 502, permission: 502, rate_limited: 429, unavailable: 503, api_error: 502 };

/** Confere o backup mais recente do Firestore e registra o resultado; falha de permissão/rede vira "não verificado", nunca erro. */
async function recordBackupStatus(record: (job: string, info: RunInfo) => Promise<void>, check: typeof checkBackups) {
  try {
    const { latestAt, count } = await check({ getToken: () => getAdminAccessToken() });
    await record('backup', { ok: latestAt !== null, detail: latestAt === null ? 'sem backups' : null, extra: { latestAt, count } });
  } catch (error) {
    await record('backup', { ok: false, detail: (error as { code?: string })?.code ?? 'unavailable' });
  }
}

/**
 * GET  + `Authorization: Bearer $CRON_SECRET` -> sincronização agendada (Vercel Cron, 1x/dia).
 * GET  idem com `?job=missions` -> rotina diária de missões (antiga /api/missions-cron; aqui porque a Vercel limita as funções em api/).
 * POST + ID token do Firebase de um administrador -> sincronização manual (com intervalo mínimo de 60 s).
 */
export async function handleInstagramSync(
  req: Request | any,
  res: Response | any,
  deps: { secret?: string; authorize?: (req: Request) => Promise<Auth>; run?: (manual: boolean) => Promise<unknown>; runMissions?: () => Promise<unknown>; record?: (job: string, info: RunInfo) => Promise<void>; backups?: typeof checkBackups } = {},
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

  if (!manual && req.query?.job === 'missions') {
    // Telemetria do cartão "Saúde do sistema": melhor esforço, nunca muda a resposta nem derruba a rotina.
    const write = deps.record ?? ((job: string, info: RunInfo) => (hasAdminCredentials() ? recordRun(getAdminFirestore, job, info) : Promise.resolve()));
    const record = async (job: string, info: RunInfo) => { try { await write(job, info); } catch { /* telemetria nunca afeta a rotina */ } };
    try {
      const result = await (deps.runMissions ?? (() => runMissionsSync(getAdminFirestore())))() as object;
      await record('missions', { ok: true });
      await recordBackupStatus(record, deps.backups ?? checkBackups);
      return send(200, { ok: true, ...result });
    } catch (error) {
      logger.error('[Missions Cron] Falha na rotina de missões:', error instanceof Error ? error.message : String(error));
      await record('missions', { ok: false, detail: error instanceof Error ? error.message.slice(0, 160) : 'erro' });
      return fail(500, 'internal_error', 'A rotina de missões falhou; consulte os logs.');
    }
  }

  try {
    const result = await (deps.run ?? ((isManual) => runInstagramSync({ db: getAdminFirestore(), manual: isManual })))(manual);
    return send(200, { ok: true, ...(result as object) });
  } catch (error) {
    if (error instanceof InstagramSyncError) return fail(STATUS_BY_CODE[error.code] ?? 502, error.code, error.message);
    logger.error('[Instagram Sync] falha inesperada:', error instanceof Error ? error.name : 'erro');
    return fail(500, 'internal_error', 'A sincronização falhou; consulte os logs.');
  }
}

export default handleInstagramSync;
