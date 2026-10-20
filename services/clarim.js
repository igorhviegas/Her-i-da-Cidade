// Clarim Semanal: regras puras (período, templates, elegibilidade, métricas, anúncios, aprovação). Sem React/Firebase; testado em Node.
import { addDays, dateKey, followersGain, startOfDay, weekdayOf } from '../functions/missions-core.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const EVENT_SERVICE_ID = '6';

/** Semana de referência: segunda a domingo anteriores à semana de `todayKey` (Brasília). */
export function previousWeek(todayKey) {
  const monday = addDays(todayKey, -((weekdayOf(todayKey) + 6) % 7));
  return { start: addDays(monday, -7), end: addDays(monday, -1) };
}

const dayMonth = (key) => { const [, m, d] = key.split('-').map(Number); return { d, m }; };

/** "12 a 18 de outubro" ou "28 de setembro a 4 de outubro". */
export function periodLabel({ start, end }) {
  const a = dayMonth(start);
  const b = dayMonth(end);
  return a.m === b.m ? `${a.d} a ${b.d} de ${MONTHS[b.m - 1]}` : `${a.d} de ${MONTHS[a.m - 1]} a ${b.d} de ${MONTHS[b.m - 1]}`;
}

export const editionTitle = (period) => `Clarim Semanal — ${periodLabel(period)}`;

/** "19 de outubro de 2026" */
export function longDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export const weekdayName = (key) => WEEKDAYS[weekdayOf(key)];

/** Aceita Timestamp do Firestore, Date, string ISO ou { seconds }. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'string') { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  return null;
}

const keyOf = (value) => { const d = toDate(value); return d ? dateKey(d) : null; };
export const inPeriod = (key, { start, end }) => Boolean(key) && key >= start && key <= end;

// ---------------------------------------------------------------- templates

/** Limites de texto (caracteres); a medida real (linhas que cabem) é conferida no desenho. */
export const TEXT_LIMITS = { kicker: 32, headline: 60, deck: 90, body: 260, caption: 60, teaser: 44, quote: 40 };

export const TEMPLATES = [
  { id: 'cover', label: 'Capa', description: 'Vídeo mais visto, seguidores e chamadas para as outras páginas.' },
  { id: 'events', label: 'Eventos presenciais', description: 'Festas da semana com autorização de imagem, até 3 fotos.' },
  { id: 'performance', label: 'Desempenho dos vídeos', description: 'Os 3 vídeos que mais ganharam visualizações na semana.' },
  { id: 'news', label: 'Notícia livre', description: 'Novidades, bastidores ou um aviso, com ou sem foto.' },
  { id: 'classifieds', label: 'Classificados', description: '4 a 6 serviços, com arte ou só texto.' },
];
const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);
export const templateLabel = (id) => TEMPLATES.find((t) => t.id === id)?.label ?? id;

/** Espaços de anúncio por template (medidas na página 1080 × 1920). */
export const AD_SLOTS = {
  cover: { w: 456, h: 257, accepts: ['wide', 'square'] },
  events: { w: 360, h: 320, accepts: ['square', 'wide'] },
  news: { w: 320, h: 280, accepts: ['square', 'wide'] },
  newsNotice: { w: 456, h: 257, accepts: ['wide', 'square'] },
};

export const CLASSIFIEDS_MIN = 4;
export const CLASSIFIEDS_MAX = 6;
export const EVENTS_MAX_PHOTOS = 3;

/** Página nova com os textos padrão do template. */
export function newPage(template, order) {
  if (!TEMPLATE_IDS.includes(template)) throw new Error('Template desconhecido.');
  const base = { template, order, fields: {}, photos: {}, ads: {}, sources: [], services: [], approval: null };
  if (template === 'cover') base.fields = { variant: 'video', headline: '', caption: '', teaser1: '', teaser1Page: '', teaser2: '', teaser2Page: '' };
  if (template === 'events') base.fields = { kicker: 'Aconteceu na cidade', headline: '', body: '', credit: 'Fotos: equipe Herói da Cidade' };
  if (template === 'performance') base.fields = { kicker: 'Bolsa de visualizações', headline: 'A teia em alta na semana' };
  if (template === 'news') base.fields = { variant: 'photo', kicker: 'Notícias do QG', headline: '', deck: '', body: '', credit: '' };
  if (template === 'classifieds') base.fields = { kicker: 'Classificados do Clarim' };
  return base;
}

// ---------------------------------------------------------------- eventos (consentimento)

/**
 * Festas presenciais do período. Só são elegíveis as que têm autorização de imagem registrada no pedido;
 * as demais aparecem com o motivo, sem poder entrar na página. Nenhum dado pessoal sai daqui além do id do pedido.
 */
export function eventCandidates(orders, period) {
  return orders
    .filter((o) => o.serviceId === EVENT_SERVICE_ID)
    .map((o) => ({ order: o, key: keyOf(o.eventDate) }))
    .filter(({ key }) => inPeriod(key, period))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ order, key }) => {
      let reason = '';
      if (order.eventDraft || !order.eventForm) reason = 'Formulário do evento incompleto';
      else if (order.paymentPending) reason = 'Pagamento não confirmado';
      else if (order.eventForm.imageAuthorization !== true) reason = 'Sem autorização de imagem';
      return { orderId: order.id, day: key, weekday: weekdayName(key), eligible: !reason, reason };
    });
}

/** Revalida as fontes de uma página na hora da aprovação: devolve os ids que perderam a elegibilidade. */
export function revokedSources(sourceIds, orders, period) {
  const ok = new Set(eventCandidates(orders, period).filter((c) => c.eligible).map((c) => c.orderId));
  return sourceIds.filter((id) => !ok.has(id));
}

export const REVOKED_ISSUE = 'Uma festa escolhida perdeu a autorização de imagem ou saiu do período: remova-a.';

/** Pendência de consentimento de uma página de eventos (vale também para página já aprovada). */
export const consentIssues = (page, orders, period) => (page.template === 'events' && revokedSources(page.sources ?? [], orders, period).length ? [REVOKED_ISSUE] : []);

export const eventsHeadline = (n) => (n === 1 ? 'O herói esteve em uma festa' : `O herói esteve em ${n} festas`);

// ---------------------------------------------------------------- Instagram

const isVideo = (p) => p.kind === 'reel' || p.kind === 'video';

/**
 * Visualizações ganhas no período por vídeo, a partir dos retratos diários (instagramStats/{dia}.posts[id][2], tirados
 * na 1ª sincronização do dia): fim = retrato do dia seguinte ao período (ou o valor atual, se o período não acabou ou
 * ainda não há retrato); início = 0 para vídeos publicados no período, senão o retrato do 1º dia do período que tem o vídeo.
 * Vídeo sem uma das pontas fica de fora (nunca vira 0). `partial` = o início veio de um retrato posterior ao 1º dia.
 */
export function viewGains(posts, stats, period, todayKey) {
  const sorted = [...stats].filter((s) => s && s.day && s.posts).sort((a, b) => a.day.localeCompare(b.day));
  const after = addDays(period.end, 1);
  const endSnap = todayKey > period.end ? sorted.find((s) => s.day >= after) : null;
  const inside = sorted.filter((s) => inPeriod(s.day, period));
  const out = [];
  for (const post of posts) {
    if (!isVideo(post)) continue;
    const published = keyOf(post.publishedAt);
    if (!published || published > period.end) continue;
    let base = 0;
    let partial = false;
    if (published < period.start) {
      const snap = inside.find((s) => Array.isArray(s.posts[post.id]) && Number.isFinite(s.posts[post.id][2]));
      if (!snap) continue;
      base = snap.posts[post.id][2];
      partial = snap.day > period.start;
    }
    const endValue = endSnap ? endSnap.posts[post.id]?.[2] : post.views;
    if (!Number.isFinite(endValue)) continue;
    out.push({ post, published, gain: Math.max(0, endValue - base), partial });
  }
  return out.sort((a, b) => b.gain - a.gain);
}

/** Código do post (…/reel/CODE/), igual ao instagramId dos vídeos do catálogo (que guardam a miniatura permanente). */
export const reelCode = (url) => String(url ?? '').match(/\/(?:reels?|p|tv)\/([\w-]+)/)?.[1] ?? '';

/** Título curto do vídeo: 1ª linha da legenda, sem hashtags. */
export function videoTitle(caption) {
  const line = String(caption ?? '').split('\n').map((l) => l.replace(/#[\p{L}\p{N}_]+/gu, '').trim()).find(Boolean) ?? '';
  return line || 'Vídeo da semana';
}

/** "14/10" */
export const shortDate = (key) => key.split('-').slice(1).reverse().join('/');

/** Vídeos publicados no período (para "N vídeos novos"). */
export const videosPublished = (posts, period) => posts.filter((p) => isVideo(p) && inPeriod(keyOf(p.publishedAt), period)).length;

/** Seguidores atuais e ganho no período (null quando não há retrato diário no período). */
export function followersSummary(profile, stats, period, todayKey) {
  const followers = Number.isFinite(profile?.followers) ? profile.followers : null;
  const bounds = { start: startOfDay(period.start), end: startOfDay(addDays(period.end, 1)) };
  const gain = followersGain(bounds, { followers, stats: stats.map((s) => ({ day: s.day, followers: s.followers })) }, todayKey);
  return { followers, gain: gain.from ? gain.value : null, partial: gain.partial };
}

/** 12400 → "12,4 mil"; 7900 → "7,9 mil"; 950 → "950"; 1250000 → "1,3 mi". */
export function compactNumber(n) {
  if (!Number.isFinite(n)) return '—';
  const fmt = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (n >= 1e6) return `${fmt(Math.round(n / 1e5) / 10)} mi`;
  if (n >= 1e3) return `${fmt(Math.round(n / 100) / 10)} mil`;
  return n.toLocaleString('pt-BR');
}

// ---------------------------------------------------------------- anúncios

const ASPECT = { square: 1, story: 9 / 16, wide: 16 / 9 };
/** Formatos de arte que um serviço tem (pelos fundos cadastrados no gerador de artes). */
export function serviceFormats(service) {
  const bg = service?.art?.backgrounds ?? {};
  return ['square', 'story', 'wide'].filter((f) => typeof bg[f] === 'string' && bg[f]);
}

/**
 * Formato de arte para um espaço: o que o espaço aceita e o serviço tem, de proporção mais próxima. `preferred` (escolha manual)
 * vale se for possível. null = o serviço não tem arte compatível (não aparece na lista daquele espaço).
 */
export function pickAdFormat(slot, available, preferred) {
  const options = slot.accepts.filter((f) => available.includes(f));
  if (!options.length) return null;
  if (preferred && options.includes(preferred)) return preferred;
  const target = slot.w / slot.h;
  return options.sort((a, b) => Math.abs(Math.log(ASPECT[a] / target)) - Math.abs(Math.log(ASPECT[b] / target)))[0];
}

// ---------------------------------------------------------------- texto

/**
 * Quebra `text` em no máximo `maxLines` linhas de largura `maxWidth`, do maior ao menor tamanho (passo 2 px).
 * measure(text, size) devolve a largura. null = não cabe nem no tamanho mínimo.
 */
export function fitLines(text, { maxWidth, maxLines, maxSize, minSize }, measure) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { size: maxSize, lines: [] };
  for (let size = maxSize; size >= minSize; size -= 2) {
    const lines = [];
    let line = '';
    let ok = true;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, size) <= maxWidth) { line = next; continue; }
      if (!line || measure(word, size) > maxWidth) { ok = false; break; }
      lines.push(line);
      line = word;
    }
    if (ok && line) lines.push(line);
    if (ok && lines.length <= maxLines) return { size, lines };
  }
  return null;
}

// ---------------------------------------------------------------- aprovação

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

/** Impressão digital do conteúdo da página (o que aparece na arte). Mudou depois de aprovar = volta para revisão. */
export function pageHash(page) {
  const s = stable({ template: page.template, fields: page.fields, photos: page.photos, ads: page.ads, sources: page.sources, services: page.services });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/**
 * 'approved' (aprovada, sem mudanças e sem pendências), 'pending' (falta algo) ou 'review' (pronta para revisar).
 * Pendência nova depois da aprovação (ex.: autorização de imagem retirada) derruba a aprovação.
 */
export function pageStatus(page, issues) {
  if (issues.length) return 'pending';
  return page.approval && page.approval.hash === pageHash(page) ? 'approved' : 'review';
}

export const PAGE_STATUS_LABEL = { approved: 'Aprovada', pending: 'Faltam itens', review: 'Pronta para revisar' };

/** Pendências que não dependem do desenho (o desenho acrescenta as de texto que não coube e imagem que não carregou). */
export function pageIssues(page) {
  const f = page.fields ?? {};
  const issues = [];
  const need = (key, label) => { if (!String(f[key] ?? '').trim()) issues.push(`Preencha: ${label}.`); };
  if (page.template === 'cover') {
    need('headline', 'manchete');
    if (f.variant === 'photo' && !page.photos?.main) issues.push('Envie a foto da capa.');
  }
  if (page.template === 'events') {
    need('headline', 'manchete');
    if (!page.sources?.length) issues.push('Escolha pelo menos uma festa.');
    for (const id of page.sources ?? []) if (!page.photos?.[id]) issues.push('Envie a foto de cada festa escolhida.');
  }
  if (page.template === 'news') {
    need('headline', 'manchete');
    if (f.variant === 'photo' && !page.photos?.main) issues.push('Envie a foto da notícia ou use a variação Aviso.');
  }
  if (page.template === 'classifieds') {
    const n = page.services?.length ?? 0;
    if (n < CLASSIFIEDS_MIN || n > CLASSIFIEDS_MAX) issues.push(`Escolha de ${CLASSIFIEDS_MIN} a ${CLASSIFIEDS_MAX} serviços.`);
  }
  return [...new Set(issues)];
}

/** Nome do arquivo baixado: clarim-007-p3-eventos.png */
export function pageFileName(editionNumber, pageNumber, template) {
  const slug = { cover: 'capa', events: 'eventos', performance: 'desempenho', news: 'noticia', classifieds: 'classificados' }[template] ?? template;
  return `clarim-${String(editionNumber).padStart(3, '0')}-p${pageNumber}-${slug}.png`;
}
