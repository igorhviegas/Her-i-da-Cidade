// Avisos do sino sobre a saúde da integração com o Instagram (docs/instagram.md). Puro: recebe o documento instagramMeta/profile.
// O cron diário de missões grava os avisos (functions/missions-sync.js); IDs determinísticos, então nunca duplicam.
import { dateKey } from './missions-core.js';

const DAY_MS = 24 * 3600 * 1000;
// Token saudável: a sincronização o renova a cada 30 dias (vale 60), então sempre sobram ~30 dias ou mais.
// Com 15 dias ou menos a renovação está falhando há um bom tempo, mas ainda dá tempo de gerar um token novo.
const TOKEN_WARN_DAYS = 15;
const STALE_DAYS = 3; // a sincronização roda 2x/dia; 3 dias sem sucesso é falha, não oscilação

const time = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
const dayBr = (ms) => dateKey(new Date(ms)).split('-').reverse().join('/').slice(0, 5);
const alert = (id, type, title, body) => ({ id, type, title, body, refType: 'instagram', refId: 'profile' });

function tokenExpiring(profile, nowMs) {
  const expires = time(profile.tokenExpiresAt);
  if (expires === null) return null;
  const daysLeft = Math.floor((expires - nowMs) / DAY_MS);
  if (daysLeft < 0 || daysLeft > TOKEN_WARN_DAYS) return null;
  return alert(`instagram_token_expiring_${dateKey(new Date(expires))}`, 'instagram_token_expiring', 'Token do Instagram perto de expirar',
    `Expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} e a renovação automática não está funcionando. Gere um token novo e atualize INSTAGRAM_ACCESS_TOKEN na Vercel.`);
}

function tokenInvalid(profile, nowMs) {
  if (profile.lastError?.code !== 'token_invalid') return null;
  const attempted = time(profile.lastAttemptAt) ?? nowMs;
  return alert(`instagram_token_invalid_${dateKey(new Date(attempted))}`, 'instagram_token_invalid', 'Token do Instagram inválido', profile.lastError.message);
}

function stale(profile, nowMs) {
  const synced = time(profile.syncedAt);
  if (synced === null || nowMs - synced < STALE_DAYS * DAY_MS) return null;
  return alert(`instagram_stale_${dateKey(new Date(synced))}`, 'instagram_stale', 'Instagram sem sincronizar',
    `Última sincronização com sucesso em ${dayBr(synced)}.${profile.lastError ? ` ${profile.lastError.message}` : ''}`);
}

/** Candidatas a aviso: { id, type, title, body, refType, refId }. Perfil ausente (nunca sincronizou) não gera nada. */
export function buildInstagramAlerts(profile, now = new Date()) {
  if (!profile) return [];
  return [tokenExpiring, tokenInvalid, stale].map((rule) => rule(profile, now.getTime())).filter(Boolean);
}
