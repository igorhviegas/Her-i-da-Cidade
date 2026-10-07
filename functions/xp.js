// Regras de XP e níveis (puro, sem Firebase/React). Compartilhado entre o painel (SDK web) e a sincronização do Instagram (Admin SDK).
//
// Modelo: XP total = xpBaseline/main (retroativo, gravado uma única vez) + eventos do activityLog com occurredAt >= baseline.at.
// O nível não é armazenado: sai do XP total por fórmula (sem limite). Evento sem campo `xp` é valorizado aqui, na leitura
// (ponytail: mudar um peso reescreve o histórico dos eventos; congelar `xp` no evento se isso passar a incomodar).

export const BASELINE_PATH = ['xpBaseline', 'main'];

export const ORDER_XP_PER_REAL = 10;
export const CONTENT_PUBLISHED_XP = 2000;
export const DIFFICULTY_XP = { 1: 100, 2: 250, 3: 500, 4: 750, 5: 1000 };
export const GOAL_XP = { monthly: 5000, weekly: 1000, daily: 100 };
export const INSTAGRAM_XP = { views: 1, likes: 2, comments: 3, followers: 10 };

// ---- Níveis: o nível N custa BASE * GROWTH^(N-1) XP para ser concluído (nível 1 = 500, depois ×1,25 a cada nível) ----
export const LEVEL_BASE = 500;
export const LEVEL_GROWTH = 1.25;

export const levelCost = (level) => LEVEL_BASE * LEVEL_GROWTH ** (level - 1);
/** XP acumulado necessário para ATINGIR o nível (nível 1 = 0). Soma geométrica fechada. */
export const levelStart = (level) => (LEVEL_BASE * (LEVEL_GROWTH ** (level - 1) - 1)) / (LEVEL_GROWTH - 1);

export function levelInfo(totalXp) {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? totalXp : 0;
  let level = Math.floor(Math.log(xp * (LEVEL_GROWTH - 1) / LEVEL_BASE + 1) / Math.log(LEVEL_GROWTH)) + 1;
  while (level > 1 && xp < levelStart(level)) level -= 1; // corrige o arredondamento do logaritmo
  while (xp >= levelStart(level + 1)) level += 1;
  const need = levelCost(level);
  const into = xp - levelStart(level);
  return { level, xp, into, need, left: need - into, percent: (into / need) * 100, nextAt: levelStart(level + 1) };
}

// ---- XP de cada evento do activityLog ----
const finiteOr0 = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Pedido: valor do pedido (totalPaid, o mesmo do Financeiro) × 10. Pedido interno de roteiro vale 0. */
export const orderXp = (value) => Math.round(finiteOr0(value) * ORDER_XP_PER_REAL);

export function xpOfEvent(event) {
  if (Number.isFinite(event?.xp)) return event.xp; // eventos do Instagram já trazem o XP calculado no servidor
  switch (event?.type) {
    case 'order_completed': return orderXp(event.meta?.value);
    case 'mission': case 'task_occurrence': case 'script_ready': return DIFFICULTY_XP[event.difficulty] ?? 0;
    case 'goal_completed': return GOAL_XP[event.meta?.period] ?? 0;
    case 'content_published': return CONTENT_PUBLISHED_XP;
    default: return 0;
  }
}

const millis = (v) => (v instanceof Date ? v.getTime() : typeof v?.toDate === 'function' ? v.toDate().getTime() : v ? new Date(v).getTime() : NaN);

/**
 * XP total = baseline + eventos posteriores à criação dele. Eventos de pedidos/conteúdos que o baseline já contou (baseline.counted)
 * são ignorados: reabrir e concluir de novo um pedido antigo não paga duas vezes.
 */
export function totalXp(baseline, events) {
  if (!baseline) return null; // sem baseline o sistema de XP ainda não foi ativado
  const since = millis(baseline.at);
  const counted = { order_completed: new Set(baseline.counted?.orders ?? []), content_published: new Set(baseline.counted?.scripts ?? []) };
  let fromEvents = 0;
  for (const event of events) {
    if (!(millis(event.occurredAt) >= since)) continue;
    if (counted[event.type]?.has(event.refId)) continue;
    fromEvents += xpOfEvent(event);
  }
  return { baseline: baseline.total ?? 0, events: fromEvents, total: (baseline.total ?? 0) + fromEvents };
}

/**
 * XP retroativo a partir dos dados existentes (todos os campos vêm das fontes reais; nada é inventado).
 * orders: pedidos concluídos; scripts: roteiros; ig: { followers, posts[] } (todos os posts já sincronizados, também os fora das últimas 100);
 * missions/occurrences: concluídas; goalCycles: ciclos arquivados; goals: metas (completedAt = atingida no ciclo atual);
 * scriptDifficulty: dificuldade configurada para "Criação de roteiro" (1–5 ou null).
 */
export function buildBaseline({ orders = [], scripts = [], ig = {}, missions = [], occurrences = [], goalCycles = [], goals = [], scriptDifficulty = null }) {
  const sum = (list, key) => list.reduce((s, p) => s + finiteOr0(p[key]), 0);
  const posts = ig.posts ?? [];
  const revenueOrders = orders.filter((o) => o.status === 'completed' && !o.scriptId);
  const publishedScripts = scripts.filter((s) => s.publicationStatus === 'published');
  const byDifficulty = (list) => list.reduce((s, i) => s + (DIFFICULTY_XP[i.difficulty] ?? 0), 0);
  const reached = [...goalCycles.filter((c) => c.reached), ...goals.filter((g) => g.completedAt)];
  const categories = {
    orders: { count: revenueOrders.length, xp: revenueOrders.reduce((s, o) => s + orderXp(o.totalPaid ?? (Number(o.servicePrice) || 0) + (Number(o.rushFee) || 0)), 0) },
    content: { count: publishedScripts.length, xp: publishedScripts.length * CONTENT_PUBLISHED_XP },
    views: { count: sum(posts, 'views'), xp: sum(posts, 'views') * INSTAGRAM_XP.views },
    likes: { count: sum(posts, 'likes'), xp: sum(posts, 'likes') * INSTAGRAM_XP.likes },
    comments: { count: sum(posts, 'comments'), xp: sum(posts, 'comments') * INSTAGRAM_XP.comments },
    followers: { count: finiteOr0(ig.followers), xp: finiteOr0(ig.followers) * INSTAGRAM_XP.followers },
    missions: { count: missions.length + occurrences.length, xp: byDifficulty(missions) + byDifficulty(occurrences) },
    scripts: { count: scripts.filter((s) => s.readyAt).length, xp: scripts.filter((s) => s.readyAt).length * (DIFFICULTY_XP[scriptDifficulty] ?? 0) },
    goals: { count: reached.length, xp: reached.reduce((s, g) => s + (GOAL_XP[g.period] ?? 0), 0) },
  };
  return {
    categories,
    total: Object.values(categories).reduce((s, c) => s + c.xp, 0),
    counted: { orders: revenueOrders.map((o) => o.id), scripts: publishedScripts.map((s) => s.id) },
    ig: { followers: finiteOr0(ig.followers) },
  };
}

/**
 * XP do Instagram de uma sincronização, só pelo que SUBIU desde a sincronização anterior (nunca re-conta o acumulado).
 * prev: { [postId]: { likes, comments, views } } lido do banco antes de sobrescrever; posts: conjunto desta sincronização;
 * followersHigh: maior nº de seguidores já premiado (quem cai e volta a subir não paga duas vezes).
 * Post sem registro anterior é novo (nasceu depois do baseline): vale tudo. Métrica ausente (null) nunca vira 0 nem gera XP;
 * queda de curtidas/views não tira XP. Retorna { xp, followersHigh }.
 */
export function igXpDelta({ prev, posts, followers, followersHigh }) {
  let xp = 0;
  for (const post of posts) {
    const before = prev[post.id];
    for (const key of ['views', 'likes', 'comments']) {
      const now = post[key];
      if (!Number.isFinite(now)) continue;
      const base = before && Number.isFinite(before[key]) ? before[key] : 0;
      if (now > base) xp += (now - base) * INSTAGRAM_XP[key];
    }
  }
  let high = Number.isFinite(followersHigh) ? followersHigh : null;
  if (Number.isFinite(followers)) {
    if (high !== null && followers > high) xp += (followers - high) * INSTAGRAM_XP.followers;
    high = high === null ? followers : Math.max(high, followers);
  }
  return { xp, followersHigh: high };
}
