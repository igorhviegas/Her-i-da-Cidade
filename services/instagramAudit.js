// Auditoria das publicações (múltiplo sobre a mediana da própria conta) e lint de legenda. Puro, sem React/Firebase.
// Ideias adaptadas de github.com/Jakeschincariol/instagram-agent-skill (ig-audit e caption.py), em português.

export const CAPTION_LIMIT = 2200;
export const FEED_CUT = 125; // aproximação: o corte real varia com aparelho e fonte
export const HASHTAG_CAP = 5; // limite citado pelo repositório de referência (dez/2025); não verificado na documentação da Meta
export const MIN_POSTS = 10; // abaixo disso a auditoria não afirma padrão
export const MIN_GROUP = 5; // grupo menor que isso é marcado como amostra pequena

const HASHTAG_RE = /(?:^|\s)(#[\p{L}\p{N}_]+)/gu;
const LINK_RE = /https?:\/\/\S+|\bwww\.\S+/gi;
const GENERIC_TAGS = new Set(['#viral', '#fyp', '#explore', '#explorar', '#foryou', '#trending', '#instagood', '#love', '#amor', '#follow', '#seguir', '#like4like', '#reels', '#reelsinstagram', '#instadaily']);
const ASKS = [
  [/\bcoment(e|a|ar)\b/i, 'comentar'], [/\b(dm|direct|inbox)\b/i, 'chamar no direct'], [/\bsalv(e|a|ar)\b/i, 'salvar'],
  [/\b(compartilh(e|a|ar)|marque)\b/i, 'compartilhar'], [/\b(siga|me segue)\b/i, 'seguir'], [/\blink (na|da) bio\b/i, 'link na bio'], [/\barrast(e|a)\b/i, 'arrastar'],
];

// Cada regra recebe a legenda já analisada e devolve [status, detalhe].
const RULES = [
  ['Tamanho', (c) => (c.chars > CAPTION_LIMIT ? ['FAIL', `${c.chars} caracteres, ${c.chars - CAPTION_LIMIT} acima do limite de ${CAPTION_LIMIT}`] : ['PASS', `${c.chars} / ${CAPTION_LIMIT} caracteres`])],
  ['Primeira linha', (c) => {
    if (!c.firstLine) return ['WARN', 'Sem legenda'];
    if (/^[#@]/.test(c.firstLine)) return ['FAIL', 'Abre com hashtag ou menção, a posição que mais vale uma frase'];
    return c.firstLine.length > FEED_CUT ? ['WARN', `${c.firstLine.length} caracteres: o feed corta em ${FEED_CUT}, no meio da ideia`] : ['PASS', 'Aparece inteira no feed'];
  }],
  ['Hashtags', (c) => {
    const generic = c.tags.filter((tag) => GENERIC_TAGS.has(tag.toLowerCase()));
    if (c.tags.length > HASHTAG_CAP) return ['FAIL', `${c.tags.length} hashtags, acima do limite de ${HASHTAG_CAP}`];
    return generic.length ? ['WARN', `Genéricas (${generic.slice(0, 3).join(' ')}): não descrevem o assunto`] : ['PASS', `${c.tags.length} hashtag(s)`];
  }],
  ['Posição das hashtags', (c) => (c.tags.some((tag) => c.visible.includes(tag)) ? ['WARN', 'Há hashtag na parte visível do feed'] : ['PASS', 'Abaixo do corte'])],
  ['Links', (c) => (c.links.length ? ['WARN', 'Link na legenda não é clicável: leve para a bio ou o direct'] : ['PASS', 'Sem link morto'])],
  ['Um pedido só', (c) => {
    if (c.asks.length === 1) return ['PASS', `Pedido: ${c.asks[0]}`];
    return c.asks.length ? ['WARN', `${c.asks.length} pedidos (${c.asks.join(', ')}): dois pedidos equivalem a nenhum`] : ['WARN', 'Sem pedido: defina o que o post quer'];
  }],
];

/** Analisa uma legenda: janela visível no feed, hashtags, pedidos e as verificações com veredito READY | REVIEW | FIX. */
export function lintCaption(text, cut = FEED_CUT) {
  const body = String(text ?? '').trim();
  const letters = [...body];
  const ctx = {
    chars: letters.length,
    visible: letters.slice(0, cut).join(''),
    firstLine: body.split('\n')[0].trim(),
    tags: [...body.matchAll(HASHTAG_RE)].map((m) => m[1]),
    links: body.match(LINK_RE) ?? [],
    asks: ASKS.filter(([re]) => re.test(body)).map(([, name]) => name),
  };
  const checks = RULES.map(([label, rule]) => {
    const [status, detail] = rule(ctx);
    return { label, status, detail };
  });
  const verdict = checks.some((c) => c.status === 'FAIL') ? 'FIX' : checks.some((c) => c.status === 'WARN') ? 'REVIEW' : 'READY';
  return { chars: ctx.chars, visible: ctx.visible, truncated: ctx.chars > cut, tags: ctx.tags, asks: ctx.asks, checks, verdict };
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Agrupa os itens ranqueados por chave; `multiple` é a mediana dos múltiplos do grupo. Melhor grupo primeiro. */
function groupRanked(ranked, keyOf) {
  const groups = new Map();
  for (const item of ranked) {
    const key = keyOf(item.post);
    groups.set(key, [...(groups.get(key) ?? []), item.multiple]);
  }
  return [...groups].map(([key, multiples]) => ({ key, n: multiples.length, multiple: median(multiples), small: multiples.length < MIN_GROUP })).sort((a, b) => b.multiple - a.multiple);
}

/**
 * Cada publicação contra a mediana da própria conta (visualizações; curtidas se há poucas com visualização).
 * Sem `enough` não há padrão a afirmar. Grupos: por tipo e com/sem pedido na legenda.
 */
export function auditPosts(posts) {
  const metric = posts.filter((p) => p.views != null).length >= MIN_POSTS ? 'views' : 'likes';
  const rated = posts.filter((p) => p[metric] != null);
  const base = median(rated.map((p) => p[metric]));
  const empty = { metric, n: rated.length, median: base, enough: false, top: [], bottom: [], groups: { kind: [], ask: [] } };
  if (rated.length < MIN_POSTS || !base) return empty;
  const ranked = rated.map((post) => ({ post, multiple: post[metric] / base })).sort((a, b) => b.multiple - a.multiple);
  return {
    ...empty,
    enough: true,
    top: ranked.slice(0, 5),
    bottom: ranked.slice(-5).reverse(),
    groups: { kind: groupRanked(ranked, (p) => p.kind), ask: groupRanked(ranked, (p) => (lintCaption(p.caption).asks.length ? 'with' : 'without')) },
  };
}
