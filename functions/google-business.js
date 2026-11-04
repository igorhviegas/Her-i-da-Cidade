// Sincronização com as APIs do Perfil da Empresa do Google (avaliações + desempenho). Só roda no servidor: o token nunca vai ao navegador.
// Fase 1 (somente leitura). Autenticação: refresh token de OAuth guardado nas variáveis de ambiente (ver docs/google-business.md).
import { logger } from '../lib/logger.js';

export const PROFILE_PATH = 'googleMeta/profile';
export const DAILY_PATH = 'googleMeta/daily';
export const REVIEWS_COLLECTION = 'googleReviews';
export const MANUAL_COOLDOWN_MS = 60 * 1000;
const REVIEW_PAGE_SIZE = 50;
const MAX_REVIEW_PAGES = 12; // até 600 avaliações; ponytail: acima disso, só as 600 mais recentes
const BATCH_LIMIT = 400; // o Firestore aceita 500 escritas por lote
const DAYS = 30;
const DAY_MS = 24 * 3600 * 1000;

const IMPRESSIONS = ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'];
const METRIC_FIELD = { CALL_CLICKS: 'calls', WEBSITE_CLICKS: 'website', BUSINESS_DIRECTION_REQUESTS: 'directions' };
const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

const MESSAGES = {
  not_configured: 'Integração não configurada: defina as variáveis GOOGLE_BUSINESS_* no servidor (docs/google-business.md).',
  token_invalid: 'O Google recusou a autorização (token expirado ou revogado). Gere um novo token de atualização.',
  permission: 'O Google negou o acesso. Confira se a API do Perfil da Empresa foi aprovada para o projeto e se a conta é gerente do perfil.',
  rate_limited: 'Limite de requisições do Google atingido. Tente novamente mais tarde.',
  unavailable: 'As APIs do Google estão indisponíveis no momento.',
  api_error: 'As APIs do Google recusaram a requisição.',
};

export class GoogleSyncError extends Error {
  constructor(code, meta = {}) { super(MESSAGES[code] ?? MESSAGES.api_error); this.code = code; this.meta = meta; }
}

function classify(status, body) {
  if (body?.error === 'invalid_grant' || body?.error === 'invalid_client' || status === 401) return 'token_invalid';
  if (status === 429 || body?.error?.status === 'RESOURCE_EXHAUSTED') return 'rate_limited';
  if (status === 403) return 'permission';
  if (status >= 500) return 'unavailable';
  return 'api_error';
}

async function call(fetchImpl, url, options) {
  let response;
  try { response = await fetchImpl(url, options); } catch { throw new GoogleSyncError('unavailable'); }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new GoogleSyncError(classify(response.status, body), { status: response.status });
  return body;
}

function configFrom(env) {
  const config = {
    clientId: env.GOOGLE_BUSINESS_CLIENT_ID, clientSecret: env.GOOGLE_BUSINESS_CLIENT_SECRET, refreshToken: env.GOOGLE_BUSINESS_REFRESH_TOKEN,
    accountId: env.GOOGLE_BUSINESS_ACCOUNT_ID, locationId: env.GOOGLE_BUSINESS_LOCATION_ID,
  };
  if (Object.values(config).some((value) => !value)) throw new GoogleSyncError('not_configured');
  return config;
}

async function accessToken(fetchImpl, config) {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: 'refresh_token' });
  const out = await call(fetchImpl, 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (typeof out?.access_token !== 'string' || !out.access_token) throw new GoogleSyncError('token_invalid');
  return out.access_token;
}

/** Avaliação da API -> documento do painel. Sem nota válida, devolve null (ignorada). */
export function normalizeReview(raw) {
  const rating = STARS[raw?.starRating];
  if (!raw?.reviewId || !rating) return null;
  const reply = typeof raw.reviewReply?.comment === 'string' && raw.reviewReply.comment.trim() ? raw.reviewReply.comment : null;
  return {
    id: raw.reviewId, reviewer: raw.reviewer?.displayName || 'Anônimo', rating, comment: typeof raw.comment === 'string' ? raw.comment : '',
    createdAt: raw.createTime ?? null, updatedAt: raw.updateTime ?? raw.createTime ?? null,
    replied: reply !== null, reply, repliedAt: reply ? raw.reviewReply.updateTime ?? null : null,
  };
}

/** Respostas da Performance API -> um item por dia { date, impressions, calls, website, directions }, em ordem. */
export function mergeDailyMetrics(body) {
  const days = new Map();
  for (const group of body?.multiDailyMetricTimeSeries ?? []) {
    for (const series of group.dailyMetricTimeSeries ?? []) {
      const field = IMPRESSIONS.includes(series.dailyMetric) ? 'impressions' : METRIC_FIELD[series.dailyMetric];
      if (!field) continue;
      for (const point of series.timeSeries?.datedValues ?? []) {
        const { year, month, day } = point.date ?? {};
        if (!year || !month || !day) continue;
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const row = days.get(date) ?? { date, impressions: 0, calls: 0, website: 0, directions: 0 };
        row[field] += Number(point.value ?? 0) || 0; // dia sem valor = 0
        days.set(date, row);
      }
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchReviews(fetchImpl, token, config) {
  const headers = { Authorization: `Bearer ${token}` };
  const reviews = [];
  let pageToken = '';
  let summary = { rating: null, total: null };
  for (let page = 0; page < MAX_REVIEW_PAGES; page += 1) {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${config.accountId}/locations/${config.locationId}/reviews?pageSize=${REVIEW_PAGE_SIZE}&orderBy=${encodeURIComponent('updateTime desc')}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const out = await call(fetchImpl, url, { headers });
    if (page === 0) summary = { rating: Number.isFinite(out?.averageRating) ? out.averageRating : null, total: Number.isFinite(out?.totalReviewCount) ? out.totalReviewCount : null };
    for (const raw of out?.reviews ?? []) { const review = normalizeReview(raw); if (review) reviews.push(review); }
    pageToken = out?.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return { reviews, ...summary };
}

const ymd = (ms) => { const d = new Date(ms); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; };

async function fetchMetrics(fetchImpl, token, config, now) {
  const end = ymd(now - DAY_MS); // o Google fecha o dia com atraso: termina em ontem
  const start = ymd(now - DAYS * DAY_MS);
  const metrics = [...IMPRESSIONS, ...Object.keys(METRIC_FIELD)].map((m) => `dailyMetrics=${m}`).join('&');
  const range = `dailyRange.start_date.year=${start.year}&dailyRange.start_date.month=${start.month}&dailyRange.start_date.day=${start.day}&dailyRange.end_date.year=${end.year}&dailyRange.end_date.month=${end.month}&dailyRange.end_date.day=${end.day}`;
  const url = `https://businessprofileperformance.googleapis.com/v1/locations/${config.locationId}:fetchMultiDailyMetricsTimeSeries?${metrics}&${range}`;
  return mergeDailyMetrics(await call(fetchImpl, url, { headers: { Authorization: `Bearer ${token}` } }));
}

async function writeAll(db, writes) {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const { path, data } of writes.slice(i, i + BATCH_LIMIT)) batch.set(db.doc(path), data);
    await batch.commit();
  }
}

async function sync({ db, fetchImpl, env, now }) {
  const iso = new Date(now).toISOString();
  const profileRef = db.doc(PROFILE_PATH);
  try {
    const config = configFrom(env);
    const token = await accessToken(fetchImpl, config);
    const { reviews, rating, total } = await fetchReviews(fetchImpl, token, config);
    // Métricas têm falha própria: avaliações já lidas não se perdem.
    let days = null;
    let metricsError = null;
    try { days = await fetchMetrics(fetchImpl, token, config, now); } catch (error) { metricsError = error instanceof GoogleSyncError ? error.code : 'api_error'; }

    const writes = reviews.map((review) => ({ path: `${REVIEWS_COLLECTION}/${review.id}`, data: { ...review, syncedAt: iso } }));
    if (days) writes.push({ path: DAILY_PATH, data: { days, updatedAt: iso } });
    writes.push({
      path: PROFILE_PATH,
      data: { rating, total, loaded: reviews.length, unanswered: reviews.filter((r) => !r.replied).length, syncedAt: iso, lastAttemptAt: iso, lastError: null, metricsError },
    });
    await writeAll(db, writes); // o perfil vai por último: só vira "sincronizado" depois das avaliações
    return { status: 'completed', reviews: reviews.length, metrics: days ? days.length : 0, metricsError };
  } catch (error) {
    const code = error instanceof GoogleSyncError ? error.code : 'api_error';
    await profileRef.set({ lastAttemptAt: iso, lastError: { code, message: MESSAGES[code] } }, { merge: true }).catch(() => undefined);
    if (!(error instanceof GoogleSyncError)) logger.error('[Google Business] falha inesperada:', error instanceof Error ? error.name : 'erro');
    throw error instanceof GoogleSyncError ? error : new GoogleSyncError('api_error');
  }
}

/** Retorna { status: 'completed' | 'cooldown' } ou lança GoogleSyncError. ponytail: sem reserva (lock): duas execuções simultâneas gravam o mesmo conteúdo. */
export async function runGoogleSync({ db, fetchImpl = fetch, env = process.env, now = Date.now(), manual = false }) {
  if (manual) {
    const snap = await db.doc(PROFILE_PATH).get();
    const last = snap.exists ? snap.data() : {};
    if (last.lastAttemptAt && now - Date.parse(last.lastAttemptAt) < MANUAL_COOLDOWN_MS) return { status: 'cooldown', afterFailure: Boolean(last.lastError) };
  }
  return sync({ db, fetchImpl, env, now });
}
