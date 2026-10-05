// Balanço diário do Instagram (puro): referência no 1º sincronismo do dia (America/Sao_Paulo) e saldo desde então.
// Seguidores: atual - referência. Curtidas/visualizações: soma, por publicação, de (atual - referência do dia), só onde as duas
// pontas existem; publicação nova do dia entra com referência 0. Assim, trocar o conjunto sincronizado, métricas ausentes ou
// sincronizações repetidas não geram saldo falso. "Hoje" = desde a referência (baselineAt), e não necessariamente desde 00:00.
import { dateKey } from '../functions/missions-core.js';
import { metricOrNull } from './instagramMetrics.js';

/** Dia (YYYY-MM-DD) em Brasília. Brasília não tem horário de verão desde 2019, então o deslocamento fixo de dateKey é exato. */
export const dayOf = (ms) => dateKey(new Date(ms));

const publishedDay = (post) => {
  const time = post.publishedAt ? Date.parse(post.publishedAt) : NaN;
  return Number.isNaN(time) ? null : dayOf(time);
};

/**
 * prev: estado salvo ({ day, baselineAt, followers0, refs }) ou null; nowMs: início da sincronização (define o dia, mesmo que ela
 * termine depois da meia-noite); posts: conjunto desta sincronização. Retorna { state (privado), summary (exibição) }.
 */
export function applyDaily({ prev, nowMs, followers, posts }) {
  const day = dayOf(nowMs);
  const nowIso = new Date(nowMs).toISOString();
  const sameDay = Boolean(prev && prev.day === day && prev.refs);
  const state = { day, baselineAt: sameDay ? prev.baselineAt : nowIso, followers0: sameDay ? prev.followers0 ?? null : null, refs: {}, updatedAt: nowIso };
  const currentFollowers = metricOrNull(followers);
  if (state.followers0 === null) state.followers0 = currentFollowers;

  const totals = { likes: 0, likesCount: 0, views: 0, viewsCount: 0, viewsPartial: false };
  for (const post of posts) {
    const old = sameDay ? prev.refs[post.id] : undefined;
    const bornToday = sameDay && !old && publishedDay(post) === day; // apareceu depois da referência e nasceu hoje: tudo é de hoje
    const ref = { l: old ? old.l ?? null : bornToday ? 0 : null, v: old ? old.v ?? null : bornToday ? 0 : null };
    if (ref.l === null) ref.l = post.likes; // referência tardia: o saldo dessa publicação começa agora
    if (post.views !== null && post.viewsStale) totals.viewsPartial = true; // valor antigo mantido: não entra no saldo
    const viewsNow = post.viewsStale ? null : post.views;
    if (ref.v === null) ref.v = viewsNow;
    if (ref.l !== null && post.likes !== null) { totals.likes += post.likes - ref.l; totals.likesCount += 1; }
    if (ref.v !== null && viewsNow !== null) { totals.views += viewsNow - ref.v; totals.viewsCount += 1; }
    state.refs[post.id] = ref;
  }
  const summary = {
    day, baselineAt: state.baselineAt, updatedAt: nowIso,
    followers: currentFollowers !== null && state.followers0 !== null ? currentFollowers - state.followers0 : null,
    likes: totals.likesCount ? totals.likes : null,
    views: totals.viewsCount ? totals.views : null,
    viewsPartial: totals.viewsPartial,
  };
  return { state, summary };
}

const signed = new Intl.NumberFormat('pt-BR', { signDisplay: 'exceptZero' });
const brtTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });

/**
 * Texto e tom do saldo de um indicador ('followers' | 'likes' | 'views'). today: dia atual em Brasília (dateKey).
 * kind: up | down | zero | pending (ainda sem sincronização hoje) | unavailable.
 */
export function describeDelta(summary, key, today) {
  if (!summary) return { kind: 'unavailable', text: 'Balanço do dia ainda não disponível', since: null };
  if (summary.day !== today) return { kind: 'pending', text: 'Aguardando a 1ª sincronização de hoje', since: null };
  const value = summary[key];
  if (value === null || value === undefined) return { kind: 'unavailable', text: 'Balanço do dia indisponível', since: null };
  const baseline = summary.baselineAt ? new Date(summary.baselineAt) : null;
  // Referência tardia (depois das 02:00): informa o horário, pois o saldo não cobre a madrugada.
  const since = baseline && Number(brtTime.format(baseline).slice(0, 2)) >= 2 ? brtTime.format(baseline) : null;
  const partial = key === 'views' && summary.viewsPartial ? ' · parcial' : '';
  if (value === 0) return { kind: 'zero', text: `Sem variação hoje${partial}`, since };
  const unit = key === 'followers' ? (Math.abs(value) === 1 ? ' seguidor' : ' seguidores') : '';
  return { kind: value > 0 ? 'up' : 'down', text: `${signed.format(value)}${unit} hoje${partial}`, since };
}
