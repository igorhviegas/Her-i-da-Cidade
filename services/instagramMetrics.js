// Normalização, totais e ranking das publicações do Instagram (puro, sem React/Firebase).

const KINDS = { REELS: 'reel', CAROUSEL_ALBUM: 'carousel', VIDEO: 'video', IMAGE: 'image' };

/** Número válido ou null: métricas ausentes/ocultas nunca viram 0. */
export const metricOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);

/** Data da Meta ("…+0000" não é ISO estrito) em ISO; inválida ou ausente vira null. */
const toIso = (value) => {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

/** Converte um item de `/me/media` (+ views do endpoint de insights, se houver) no formato salvo. */
export function normalizeMedia(raw, views = null) {
  const kind = raw.media_product_type === 'REELS' ? 'reel' : KINDS[raw.media_type] ?? 'other';
  const isImage = raw.media_type === 'IMAGE' || raw.media_type === 'CAROUSEL_ALBUM';
  return {
    id: String(raw.id),
    caption: typeof raw.caption === 'string' ? raw.caption : '',
    kind,
    thumbnailUrl: raw.thumbnail_url ?? (isImage ? raw.media_url ?? null : null),
    permalink: raw.permalink ?? null,
    publishedAt: toIso(raw.timestamp),
    likes: metricOrNull(raw.like_count),
    comments: metricOrNull(raw.comments_count),
    views: metricOrNull(views),
  };
}

/** Soma só as publicações com a métrica; `counted` diz em quantas ela existe (escopo do total). */
export function totalFor(posts, key) {
  let total = 0;
  let counted = 0;
  for (const post of posts) if (post[key] !== null && post[key] !== undefined) { total += post[key]; counted += 1; }
  return { total, counted };
}

const time = (post) => (post.publishedAt ? Date.parse(post.publishedAt) || 0 : 0);

/** Ordena sem mutar. `key`: likes | views | comments | recent. Publicações sem a métrica vão para o fim. */
export function sortPosts(posts, key) {
  if (key === 'recent') return [...posts].sort((a, b) => time(b) - time(a));
  return [...posts].sort((a, b) => {
    if (a[key] == null || b[key] == null) return (a[key] == null) - (b[key] == null);
    return b[key] - a[key] || time(b) - time(a);
  });
}

/** Publicação líder da métrica, ignorando as sem valor; null se nenhuma tiver. */
export function topPost(posts, key) {
  const [best] = sortPosts(posts, key);
  return best && best[key] != null ? best : null;
}

/** Só as publicações da última sincronização (syncedAt igual ao do perfil); as antigas ficam no banco, fora dos indicadores. */
export const currentPosts = (posts, syncedAt) => (syncedAt ? posts.filter((post) => post.syncedAt === syncedAt) : []);

/** Data/hora legível; valor ausente ou inválido vira "—" (nunca lança, para não derrubar a lista). */
export function formatDateTime(value) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(time);
}
