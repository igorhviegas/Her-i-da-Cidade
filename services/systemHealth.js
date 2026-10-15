// Cartão "Saúde do sistema" (puro): transforma a telemetria das rotinas (systemStatus), o perfil do Instagram e o teste das
// avaliações em linhas com nível ok / warn / error / unknown. As rotinas rodam 1x ao dia, então 36 h sem execução já é atraso.

const HOUR = 3_600_000;
const WARN_AFTER_H = 36;
const ERROR_AFTER_H = 72;
const TOKEN_WARN_DAYS = 15; // mesmo limite do aviso do sino (functions/instagram-alerts.js)
const TOKEN_ERROR_DAYS = 3;

const time = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
const rank = { ok: 0, unknown: 0, warn: 1, error: 2 };

/** "agora há pouco", "há 20 min", "há 5 h", "há 3 dias". */
export function agoLabel(ms) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

/** Nível pela idade da última execução bem-sucedida. */
function ageLevel(ageMs) {
  const hours = ageMs / HOUR;
  return hours <= WARN_AFTER_H ? 'ok' : hours <= ERROR_AFTER_H ? 'warn' : 'error';
}

function jobRow({ id, label, never }, doc, now) {
  if (!doc) return { id, label, level: 'unknown', detail: never };
  const lastRun = time(doc.lastRunAt);
  if (doc.ok === false) return { id, label, level: 'error', detail: `Falhou ${lastRun ? agoLabel(now - lastRun) : ''}${doc.detail ? `: ${doc.detail}` : ''}`.trim() };
  if (lastRun === null) return { id, label, level: 'unknown', detail: never };
  return { id, label, level: ageLevel(now - lastRun), detail: `Rodou ${agoLabel(now - lastRun)}` };
}

function instagramRows(profile, now) {
  if (!profile) return [
    { id: 'instagram', label: 'Instagram', level: 'unknown', detail: 'Ainda não sincronizou' },
    { id: 'token', label: 'Token do Instagram', level: 'unknown', detail: 'Sem informação' },
  ];
  const synced = time(profile.syncedAt);
  const row = { id: 'instagram', label: 'Instagram' };
  if (profile.lastError?.code === 'token_invalid') Object.assign(row, { level: 'error', detail: 'Token inválido: gere um novo' });
  else if (synced === null) Object.assign(row, { level: 'unknown', detail: 'Sem sincronização bem-sucedida' });
  else Object.assign(row, { level: ageLevel(now - synced), detail: `Sincronizou ${agoLabel(now - synced)}${profile.lastError ? ' (última tentativa falhou)' : ''}` });

  const expires = time(profile.tokenExpiresAt);
  const daysLeft = expires === null ? null : Math.floor((expires - now) / (24 * HOUR));
  const token = { id: 'token', label: 'Token do Instagram' };
  if (daysLeft === null) Object.assign(token, { level: 'unknown', detail: 'Validade não registrada' });
  else if (daysLeft < 0) Object.assign(token, { level: 'error', detail: 'Expirado' });
  else Object.assign(token, { level: daysLeft <= TOKEN_ERROR_DAYS ? 'error' : daysLeft <= TOKEN_WARN_DAYS ? 'warn' : 'ok', detail: `Vale por mais ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}` });
  return [row, token];
}

/** Webhook de pagamento do ManyChat: erro enquanto o último pedido enviado foi recusado; some no próximo pedido aceito. */
function manychatRow(doc, now) {
  const base = { id: 'manychat', label: 'Pagamentos do ManyChat' };
  const last = doc ? time(doc.lastRunAt) : null;
  if (!doc || last === null) return { ...base, level: 'unknown', detail: 'Nenhum pedido recebido ainda' };
  if (doc.ok === false) return { ...base, level: 'error', detail: `Pedido recusado ${agoLabel(now - last)}: ${doc.detail ?? 'sem detalhe'}` };
  return { ...base, level: 'ok', detail: `Último pedido recebido ${agoLabel(now - last)}` };
}

function backupRow(doc, now) {
  const base = { id: 'backup', label: 'Backup do banco' };
  if (!doc) return { ...base, level: 'unknown', detail: 'Ainda sem verificação (aparece depois da próxima rotina)' };
  if (doc.ok === false && doc.detail === 'permission') return { ...base, level: 'unknown', detail: 'Não verificado: a conta de serviço não pode listar backups' };
  if (doc.ok === false && doc.detail === 'sem backups') return { ...base, level: 'error', detail: 'Nenhum backup encontrado' };
  if (doc.ok === false) return { ...base, level: 'unknown', detail: 'Não foi possível verificar agora' };
  const latest = time(doc.latestAt);
  if (latest === null) return { ...base, level: 'unknown', detail: 'Sem data do último backup' };
  return { ...base, level: ageLevel(now - latest), detail: `Último backup ${agoLabel(now - latest)}${doc.count ? ` · ${doc.count} guardados` : ''}` };
}

/**
 * status: { missions?, manychat?, backup? } (documentos de systemStatus); instagram: instagramMeta/profile ou null;
 * reviewsOk: true/false do teste de /api/reviews (null = ainda não testado). Devolve { rows, overall } (overall = pior nível conhecido).
 */
export function buildHealth({ status = {}, instagram = null, reviewsOk = null, now = Date.now() }) {
  const rows = [
    jobRow({ id: 'missions', label: 'Rotina diária (missões e avisos)', never: 'Ainda sem registro (aparece depois da próxima rotina, à meia-noite)' }, status.missions, now),
    ...instagramRows(instagram, now),
    manychatRow(status.manychat, now),
    backupRow(status.backup, now),
    reviewsOk === null
      ? { id: 'reviews', label: 'Avaliações do Google', level: 'unknown', detail: 'Verificando…' }
      : { id: 'reviews', label: 'Avaliações do Google', level: reviewsOk ? 'ok' : 'warn', detail: reviewsOk ? 'Respondendo' : 'Fora do ar: o site mostra só o link' },
  ];
  const known = rows.map((r) => r.level).filter((l) => l !== 'unknown');
  const overall = known.length === 0 ? 'unknown' : known.reduce((worst, l) => (rank[l] > rank[worst] ? l : worst), 'ok');
  return { rows, overall };
}
