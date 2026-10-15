// Telemetria das rotinas agendadas (cartão "Saúde do sistema" do painel). Só o servidor grava (Admin SDK); as regras do Firestore
// deixam só o administrador ler. Nada aqui pode derrubar uma rotina: tudo é "melhor esforço".

export const STATUS_COLLECTION = 'systemStatus';
const BACKUPS_URL = (projectId) => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/-/backups`;
const TIMEOUT_MS = 8000;

/** Registra uma execução: { job, ok, lastRunAt, lastOkAt?, detail, ...extra }. `getDb` pode ser o banco ou uma função que o devolve. Nunca lança. */
export async function recordRun(getDb, job, { ok, detail = null, extra = {}, now = new Date() }) {
  try {
    const db = typeof getDb === 'function' ? getDb() : getDb;
    const iso = now.toISOString();
    await db.collection(STATUS_COLLECTION).doc(job).set({ job, ok: Boolean(ok), lastRunAt: iso, detail, ...(ok ? { lastOkAt: iso } : {}), ...extra }, { merge: true });
  } catch {
    // telemetria nunca derruba a rotina
  }
}

export class StatusCheckError extends Error {
  constructor(code) { super(code); this.name = 'StatusCheckError'; this.code = code; }
}

/** Backup mais recente do banco `(default)` entre os prontos: { latestAt (ISO), count } ou null se não houver. */
export function latestBackup(body) {
  const ready = (Array.isArray(body?.backups) ? body.backups : []).filter((b) => String(b?.database ?? '').endsWith('/databases/(default)') && (!b.state || b.state === 'READY'));
  const times = ready.map((b) => Date.parse(b.snapshotTime)).filter((t) => Number.isFinite(t));
  return times.length ? { latestAt: new Date(Math.max(...times)).toISOString(), count: times.length } : null;
}

/**
 * Consulta a Firestore Admin API (lista de backups). `getToken` devolve { token, projectId }.
 * 401/403 vira 'permission' (a conta de serviço não pode listar backups); qualquer outra falha, 'unavailable'.
 */
export async function checkBackups({ getToken, fetchImpl = fetch }) {
  let auth;
  try { auth = await getToken(); } catch { throw new StatusCheckError('unavailable'); }
  let response;
  try {
    response = await fetchImpl(BACKUPS_URL(auth.projectId), { headers: { Authorization: `Bearer ${auth.token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new StatusCheckError('unavailable');
  }
  if (response.status === 401 || response.status === 403) throw new StatusCheckError('permission');
  if (!response.ok) throw new StatusCheckError('unavailable');
  const found = latestBackup(await response.json().catch(() => null));
  return found ?? { latestAt: null, count: 0 };
}
