import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { getAdminFirestore } from '../functions/firebase-admin.js';
import { parseHealthExport, writeFitDaily } from '../functions/fit-health.js';

const OWNER_UID = /^[A-Za-z0-9_-]{6,128}$/; // vira parte do caminho no Firestore: nada de "/" nem espaços

/**
 * Recebe o POST da automação REST do Health Auto Export (`Authorization: Bearer $FIT_INGEST_TOKEN`) e grava os totais diários em
 * users/{FIT_OWNER_UID}/fitDaily/{dia}. O dono é fixado no servidor: o payload nunca escolhe o uid, e o token só escreve (não lê nada).
 * É um upsert por dia, então reenvios (período "Hoje", "Padrão", "7 dias") são seguros.
 */
export async function handleFitIngest(
  req: Request | any,
  res: Response | any,
  deps: { token?: string; ownerUid?: string; database?: unknown } = {},
) {
  const send = (status: number, body: unknown) => {
    res.setHeader?.('Cache-Control', 'no-store');
    if (typeof res.status === 'function') return res.status(status).json(body);
    res.statusCode = status;
    res.setHeader?.('Content-Type', 'application/json');
    return res.end?.(JSON.stringify(body));
  };

  if (req.method !== 'POST') return send(405, { ok: false, error: { code: 'method_not_allowed', message: 'Use POST.' } });

  const token = deps.token ?? process.env.FIT_INGEST_TOKEN;
  const ownerUid = deps.ownerUid ?? process.env.FIT_OWNER_UID;
  if (!token || !ownerUid || !OWNER_UID.test(ownerUid)) {
    console.error('[Fit Ingest] FIT_INGEST_TOKEN ou FIT_OWNER_UID ausente/inválido nas variáveis de ambiente.');
    return send(500, { ok: false, error: { code: 'server_misconfigured', message: 'Serviço indisponível: configuração pendente.' } });
  }

  const header = req.headers?.authorization ?? req.get?.('authorization');
  const supplied = Buffer.from(typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return send(401, { ok: false, error: { code: 'unauthorized', message: 'Credencial ausente ou inválida.' } });
  }

  let payload = req.body;
  if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
    try { payload = JSON.parse(payload.toString()); } catch { payload = null; }
  }
  const parsed = parseHealthExport(payload);
  if (!parsed) return send(400, { ok: false, error: { code: 'invalid_payload', message: 'Esperado o JSON do Health Auto Export (data.metrics).' } });

  try {
    const days = await writeFitDaily(deps.database ?? getAdminFirestore(), ownerUid, parsed.days);
    // Só contagens na resposta e nos logs: nunca o conteúdo (dado de saúde).
    return send(200, { ok: true, days, ...parsed.stats, workoutsIgnored: parsed.workouts });
  } catch (error) {
    console.error('[Fit Ingest] Falha ao gravar:', error instanceof Error ? error.message : String(error));
    return send(500, { ok: false, error: { code: 'internal_error', message: 'Não foi possível gravar; consulte os logs.' } });
  }
}

export default handleFitIngest;
