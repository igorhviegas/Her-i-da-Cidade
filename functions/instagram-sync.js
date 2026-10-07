// Sincronização com a Instagram API (Instagram Login, graph.instagram.com). Só roda no servidor: o token nunca vai ao navegador.
import { randomUUID } from 'node:crypto';
import { applyDaily } from '../services/instagramDaily.js';
import { importReelsAsVideos } from './instagram-video-import.js';
import { metricOrNull, normalizeMedia } from '../services/instagramMetrics.js';
import { BASELINE_PATH, igXpDelta } from './xp.js';

const PAGE_SIZE = 50;
const MAX_PAGES = 2; // ponytail: só as 100 publicações mais recentes (cabe nos limites de tempo/requisições); aumentar com paginação em lotes.
const INSIGHT_BATCH = 10;
const REFRESH_AFTER_MS = 30 * 24 * 3600 * 1000; // token de longa duração vale 60 dias
export const MANUAL_COOLDOWN_MS = 60 * 1000;
export const LOCK_TTL_MS = 120 * 1000; // maior que o maxDuration (60 s) da função: uma execução interrompida libera sozinha

export const PROFILE_PATH = 'instagramMeta/profile';
export const TOKEN_PATH = 'instagramPrivate/token'; // regras do Firestore: nenhum acesso pelo cliente
export const LOCK_PATH = 'instagramPrivate/lock';
export const DAILY_PATH = 'instagramPrivate/daily'; // referências do balanço diário (estado interno; o saldo exibido vai em profile.daily)
export const POSTS_COLLECTION = 'instagramPosts';
export const DAY_PREFIX = 'instagramMeta/day-'; // saldo diário (calendário); coberto pela regra de instagramMeta (leitura admin, escrita negada)
export const XP_CURSOR_PATH = 'instagramPrivate/xp'; // maior nº de seguidores já premiado (estado interno do XP)
export const ACTIVITY_LOG_COLLECTION = 'activityLog';
export const STATS_COLLECTION = 'instagramStats'; // retrato diário de seguidores (metas de ganho de seguidores); id = dia em Brasília

const MESSAGES = {
  not_configured: 'Integração não configurada: defina INSTAGRAM_ACCESS_TOKEN no servidor.',
  token_invalid: 'O token do Instagram expirou ou foi revogado. Gere um novo e atualize INSTAGRAM_ACCESS_TOKEN.',
  permission: 'A Meta negou a permissão necessária. Confira as permissões do app e do token (instagram_business_basic).',
  rate_limited: 'Limite de requisições da Meta atingido. Tente novamente mais tarde.',
  unavailable: 'A API do Instagram está indisponível no momento.',
  api_error: 'A API do Instagram recusou a requisição. Verifique as permissões do app.',
};

export class InstagramSyncError extends Error {
  constructor(code, meta = {}) { super(MESSAGES[code] ?? MESSAGES.api_error); this.code = code; this.meta = meta; }
}

function classify(status, body) {
  const code = body?.error?.code;
  if (code === 190 || status === 401) return 'token_invalid';
  if ([4, 17, 32, 613].includes(code) || status === 429) return 'rate_limited';
  if (code === 10 || (code >= 200 && code <= 299)) return 'permission';
  if (status >= 500) return 'unavailable';
  return 'api_error';
}

async function graph(fetchImpl, url) {
  let response;
  try { response = await fetchImpl(url); } catch { throw new InstagramSyncError('unavailable'); }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.error) throw new InstagramSyncError(classify(response.status, body), { status: response.status, metaCode: body?.error?.code });
  return body;
}

/**
 * Token salvo (renovado) ou o do ambiente; renova a cada 30 dias. Um token novo no ambiente sempre prevalece.
 * Uma renovação falha ou incompleta nunca descarta o token atual.
 */
async function resolveToken({ db, fetchImpl, env, now }) {
  const envToken = env.INSTAGRAM_ACCESS_TOKEN;
  if (!envToken) throw new InstagramSyncError('not_configured');
  const snap = await db.doc(TOKEN_PATH).get();
  const saved = snap.exists ? snap.data() : null;
  let state = saved && saved.envToken === envToken ? saved : { accessToken: envToken, envToken, refreshedAt: 0, expiresAt: null };
  if (now - state.refreshedAt > REFRESH_AFTER_MS) {
    try {
      const out = await graph(fetchImpl, `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(state.accessToken)}`);
      if (typeof out?.access_token !== 'string' || !out.access_token) throw new InstagramSyncError('api_error');
      state = { ...state, accessToken: out.access_token, refreshedAt: now, expiresAt: Number.isFinite(out.expires_in) ? now + out.expires_in * 1000 : state.expiresAt ?? null };
      await db.doc(TOKEN_PATH).set(state);
    } catch (error) {
      // Renovação falhou (ex.: token com menos de 24h, resposta incompleta): segue com o token atual; se estiver inválido, a chamada seguinte acusa.
      console.warn('[Instagram Sync] renovação do token falhou:', error.code ?? 'erro');
    }
  }
  return { token: state.accessToken, expiresAt: state.expiresAt ?? null };
}

/** Reserva atômica da execução (transação): bloqueia execuções simultâneas e, no modo manual, aplica o intervalo mínimo. */
function acquire(db, { now, manual, owner }) {
  return db.runTransaction(async (tx) => {
    const lock = await tx.get(db.doc(LOCK_PATH));
    if (lock.exists && lock.data().until > now) return { status: 'running' };
    const profile = await tx.get(db.doc(PROFILE_PATH));
    const last = profile.exists ? profile.data() : {};
    if (manual && last.lastAttemptAt && now - Date.parse(last.lastAttemptAt) < MANUAL_COOLDOWN_MS) {
      return { status: 'cooldown', afterFailure: Boolean(last.lastError) };
    }
    tx.set(db.doc(LOCK_PATH), { until: now + LOCK_TTL_MS, by: owner });
    return null;
  });
}

/** Só libera a reserva que ainda é nossa; se falhar, o prazo (LOCK_TTL_MS) libera. */
async function release(db, owner) {
  try {
    await db.runTransaction(async (tx) => {
      const lock = await tx.get(db.doc(LOCK_PATH));
      if (lock.exists && lock.data().by === owner) tx.set(db.doc(LOCK_PATH), { until: 0, by: owner });
    });
  } catch { /* expira pelo prazo */ }
}

/**
 * Views de uma publicação. ok = valor lido; unsupported = a Meta disse que não existe (resposta vazia ou 400/código 100);
 * permission = autorização negada; transient = qualquer outra falha (rede, 5xx, desconhecida). Limite e token inválido abortam a sincronização.
 */
async function fetchViews(fetchImpl, url) {
  try {
    const value = metricOrNull((await graph(fetchImpl, url)).data?.[0]?.values?.[0]?.value);
    return value === null ? { state: 'unsupported', views: null } : { state: 'ok', views: value };
  } catch (error) {
    if (error.code === 'rate_limited' || error.code === 'token_invalid') throw error;
    if (error.code === 'permission') return { state: 'permission', views: null };
    if (error.meta?.status === 400 && error.meta?.metaCode === 100) return { state: 'unsupported', views: null };
    return { state: 'transient', views: null };
  }
}

function insightsWarning(s) {
  if (!s.total) return null;
  if (s.permission) return { code: 'insights_permission', message: 'Sem permissão para consultar visualizações (instagram_business_manage_insights). Valores anteriores foram mantidos e marcados como desatualizados.' };
  if (s.transient) {
    return s.ok === 0 && s.unsupported === 0
      ? { code: 'insights_unavailable', message: 'A consulta de visualizações está indisponível no momento. Valores anteriores foram mantidos e marcados como desatualizados.' }
      : { code: 'insights_partial', message: `${s.transient} de ${s.total} consultas de visualizações falharam. Valores anteriores foram mantidos e marcados como desatualizados.` };
  }
  if (s.unsupported === s.total) return { code: 'insights_unsupported', message: 'A Meta informou que as visualizações não estão disponíveis para estas publicações. Confirme a métrica e as permissões.' };
  return null;
}

/**
 * XP do Instagram (functions/xp.js): só depois que o baseline existe (xpBaseline/main), e só pelo que subiu desde a sincronização anterior.
 * Lê o estado ANTES de o batch sobrescrever as publicações. Devolve as escritas a juntar ao batch ({ ref, data }), ou [] sem baseline.
 * Evento diário activityLog/instagram_AAAA-MM-DD acumula o XP do dia (as sincronizações do dia são serializadas pela reserva).
 * ponytail: falha aqui é registrada e o XP daquela rodada se perde (não derruba a sincronização do painel).
 */
async function planInstagramXp({ db, posts, followers, now, day }) {
  try {
    const baseline = await db.doc(BASELINE_PATH.join('/')).get();
    if (!baseline.exists) return [];
    const [cursor, ...before] = await Promise.all([db.doc(XP_CURSOR_PATH).get(), ...posts.map((p) => db.doc(`${POSTS_COLLECTION}/${p.id}`).get())]);
    const prev = {};
    before.forEach((snap, i) => { if (snap.exists) prev[posts[i].id] = snap.data(); });
    const followersHigh = cursor.exists ? cursor.data().followersHigh : baseline.data().ig?.followers ?? null;
    const { xp, followersHigh: high } = igXpDelta({ prev, posts, followers, followersHigh });
    const writes = [];
    if (high !== null && high !== followersHigh) writes.push({ ref: db.doc(XP_CURSOR_PATH), data: { followersHigh: high, updatedAt: new Date(now).toISOString() } });
    if (xp > 0) {
      const eventRef = db.doc(`${ACTIVITY_LOG_COLLECTION}/instagram_${day}`);
      const existing = await eventRef.get();
      const old = existing.exists ? existing.data() : null;
      writes.push({ ref: eventRef, data: { type: 'instagram', refId: day, difficulty: null, difficultyKey: null, occurredAt: old?.occurredAt ?? new Date(now), xp: (old?.xp ?? 0) + xp } });
    }
    return writes;
  } catch (error) {
    console.error('[Instagram Sync] XP não calculado nesta rodada:', error instanceof Error ? error.name : 'erro');
    return [];
  }
}

async function sync({ db, fetchImpl, env, now }) {
  const profileRef = db.doc(PROFILE_PATH);
  const iso = new Date(now).toISOString();
  try {
    const { token, expiresAt } = await resolveToken({ db, fetchImpl, env, now });
    const base = `https://graph.instagram.com/${env.INSTAGRAM_API_VERSION || 'v23.0'}`;
    const auth = `access_token=${encodeURIComponent(token)}`;

    const me = await graph(fetchImpl, `${base}/me?fields=user_id,username,followers_count,media_count&${auth}`);

    const rawMedia = [];
    let url = `${base}/me/media?fields=id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${PAGE_SIZE}&${auth}`;
    for (let page = 0; url && page < MAX_PAGES; page += 1) {
      const out = await graph(fetchImpl, url);
      rawMedia.push(...(out.data ?? []));
      url = out.paging?.next ?? null;
    }

    const insights = { total: rawMedia.length, ok: 0, unsupported: 0, permission: 0, transient: 0 };
    const posts = [];
    for (let i = 0; i < rawMedia.length; i += INSIGHT_BATCH) {
      posts.push(...await Promise.all(rawMedia.slice(i, i + INSIGHT_BATCH).map(async (raw) => {
        const result = await fetchViews(fetchImpl, `${base}/${raw.id}/insights?metric=views&${auth}`);
        insights[result.state] += 1;
        let { views } = result;
        let viewsStale = false;
        if (result.state === 'permission' || result.state === 'transient') {
          // Falha não prova ausência: mantém o valor anterior, sinalizado como desatualizado.
          const previous = await db.doc(`${POSTS_COLLECTION}/${raw.id}`).get();
          const kept = previous.exists ? metricOrNull(previous.data().views) : null;
          if (kept !== null) { views = kept; viewsStale = true; }
        }
        return { ...normalizeMedia(raw, views), viewsStale };
      })));
    }

    // Documentos antigos são preservados; o painel só considera os que têm o syncedAt do perfil (conjunto da última sincronização).
    const batch = db.batch();
    for (const post of posts) batch.set(db.doc(`${POSTS_COLLECTION}/${post.id}`), { ...post, syncedAt: iso });
    const warning = insightsWarning(insights);
    // Balanço diário: calculado aqui, no mesmo batch das publicações e do perfil, então uma sincronização que falha não altera as referências.
    const dailyRef = db.doc(DAILY_PATH);
    const prevDaily = await dailyRef.get();
    const daily = applyDaily({ prev: prevDaily.exists ? prevDaily.data() : null, nowMs: now, followers: me.followers_count, posts });
    batch.set(dailyRef, daily.state);
    for (const { ref, data } of await planInstagramXp({ db, posts, followers: me.followers_count, now, day: daily.state.day })) batch.set(ref, data);
    // Saldo do dia no histórico do calendário (um documento por dia, regravado a cada sincronização; o dia anterior fica como estava).
    batch.set(db.doc(`${DAY_PREFIX}${daily.summary.day}`), daily.summary);
    // Retrato diário: a referência de seguidores do dia (a mesma do balanço, fixada na 1ª sincronização do dia). É regravado a cada
    // sincronização com o mesmo conteúdo (idempotente), assim também nasce quando a referência do dia foi criada antes desta versão.
    // Retrato por publicação ([curtidas, comentários, views]): base das metas de "recebidos no ciclo". Fica o do 1º sync do dia com este
    // recurso (preservado nas sincronizações seguintes), então o "início do dia" não se move; vale o que a Meta devolveu naquele sync.
    const statsRef = db.doc(`${STATS_COLLECTION}/${daily.state.day}`);
    const existingStats = await statsRef.get();
    const kept = existingStats.exists && existingStats.data().posts ? existingStats.data() : null;
    batch.set(statsRef, {
      day: daily.state.day,
      ...(daily.state.followers0 !== null ? { followers: daily.state.followers0 } : {}),
      baselineAt: daily.state.baselineAt,
      posts: kept ? kept.posts : Object.fromEntries(posts.map((p) => [p.id, [p.likes ?? null, p.comments ?? null, p.views ?? null]])),
      postsAt: kept ? kept.postsAt : iso,
    });
    batch.set(profileRef, {
      username: me.username ?? null, followers: me.followers_count ?? null, mediaCount: me.media_count ?? null,
      loadedPosts: posts.length, syncedAt: iso, lastAttemptAt: iso, lastError: null,
      insights, warning, daily: daily.summary, tokenExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    await batch.commit();
    // Importa Reels novos como vídeos inativos; uma falha aqui nunca derruba a sincronização.
    const videos = await importReelsAsVideos({ db, posts, now, fetchImpl }).catch((e) => { console.error('[Instagram Sync] import de vídeos falhou:', e instanceof Error ? e.name : 'erro'); return null; });
    return { status: 'completed', posts: posts.length, warning: warning?.code ?? null, ...(videos && (videos.imported || videos.failed) ? { videos } : {}) };
  } catch (error) {
    const code = error instanceof InstagramSyncError ? error.code : 'api_error';
    await profileRef.set({ lastAttemptAt: iso, lastError: { code, message: MESSAGES[code] } }, { merge: true }).catch(() => undefined);
    throw error instanceof InstagramSyncError ? error : new InstagramSyncError('api_error');
  }
}

/** Retorna { status: 'completed' | 'running' | 'cooldown' } ou lança InstagramSyncError (falha). */
export async function runInstagramSync({ db, fetchImpl = fetch, env = process.env, now = Date.now(), manual = false }) {
  const owner = randomUUID();
  const blocked = await acquire(db, { now, manual, owner });
  if (blocked) return blocked;
  try {
    return await sync({ db, fetchImpl, env, now });
  } finally {
    await release(db, owner);
  }
}
