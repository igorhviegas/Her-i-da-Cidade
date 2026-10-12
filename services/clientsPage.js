// Página /clientes (QR do certificado): escolha dos vídeos em destaque e leitura do vídeo de agradecimento. Funções puras.

/** Vídeo de agradecimento usado enquanto o admin não escolher outro. */
export const DEFAULT_THANK_YOU_VIDEO_URL = 'https://youtu.be/SzTLExDEMQY';
export const CLIENTS_FEATURED_MAX = 10;

/**
 * Configuração da página (siteConfig/public: clientsVideoUrl, clientsVideoPoster, clientsVideoOrientation,
 * clientsFeaturedVideoIds), com o padrão no lugar de campos ausentes ou inválidos. Aceita qualquer valor vindo do Firestore.
 */
export function resolveClientsConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const ids = Array.isArray(source.clientsFeaturedVideoIds) ? source.clientsFeaturedVideoIds : [];
  return {
    videoUrl: text(source.clientsVideoUrl) || DEFAULT_THANK_YOU_VIDEO_URL,
    poster: text(source.clientsVideoPoster),
    orientation: source.clientsVideoOrientation === 'vertical' ? 'vertical' : 'horizontal',
    featuredIds: [...new Set(ids.filter((id) => typeof id === 'string' && id))].slice(0, CLIENTS_FEATURED_MAX),
  };
}

const isListed = (video) => video && video.active !== false && video.id && video.title;

/**
 * Vídeos do carrossel. Com `ids` (escolhidos no admin), exatamente esses, na ordem escolhida, ignorando os que não existem ou
 * estão inativos. Sem escolha (ou se nenhum valer), o vídeo marcado como destaque no catálogo vem primeiro e depois os demais
 * ativos na ordem do catálogo (`order`, depois os mais recentes). Só dados reais; sem vídeos, lista vazia.
 */
export function pickFeaturedVideos(videos, limit = CLIENTS_FEATURED_MAX, ids = []) {
  const list = (Array.isArray(videos) ? videos : []).filter(isListed);
  if (ids.length) {
    const byId = new Map(list.map((video) => [video.id, video]));
    const chosen = ids.map((id) => byId.get(id)).filter(Boolean).slice(0, limit);
    if (chosen.length) return chosen;
  }
  const time = (video) => (video.publishedAt ? new Date(video.publishedAt).getTime() || 0 : 0);
  return list
    .map((video, index) => ({ video, index }))
    .sort((a, b) => (
      Number(b.video.featured === true) - Number(a.video.featured === true)
      || (a.video.order ?? 0) - (b.video.order ?? 0)
      || time(b.video) - time(a.video)
      || a.index - b.index
    ))
    .slice(0, limit)
    .map(({ video }) => video);
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)$/i;

/**
 * Vídeo de agradecimento (clientsVideoUrl, editável no admin).
 * Aceita YouTube (público ou não listado) e arquivo de vídeo direto (.mp4/.webm/.mov/.m4v em HTTPS, ex.: Vercel Blob).
 * Instagram não serve: reel privado não pode ser incorporado. Qualquer outra coisa devolve null (a página mostra um aviso).
 */
export function parseThankYouVideo(value) {
  if (typeof value !== 'string') return null;
  let url;
  try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== 'https:') return null;

  let id = null;
  if (url.hostname === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (YOUTUBE_HOSTS.has(url.hostname)) {
    const [, first, second] = url.pathname.split('/');
    id = first === 'watch' ? url.searchParams.get('v') : (['shorts', 'embed', 'live'].includes(first) ? second : null);
  }
  if (id !== null) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&autoplay=1`, poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  return VIDEO_FILE.test(url.pathname) ? { kind: 'file', src: url.toString() } : null;
}

/** Capa opcional (siteConfig/public.clientsVideoPoster): só HTTPS. */
export function parsePoster(value) {
  if (typeof value !== 'string') return null;
  try { return new URL(value.trim()).protocol === 'https:' ? value.trim() : null; } catch { return null; }
}
