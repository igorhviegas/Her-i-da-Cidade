// Artes dos serviços (quadrado, story, site e horizontal): número do preço lido do texto do serviço,
// descrição com **negrito**, quebra de linhas e fundos prontos. Sem DOM; testado em Node.

export const ART_FORMATS = ['square', 'story', 'site', 'wide'];

/** O formato "site" usa o mesmo fundo do story. */
export const backgroundKey = (format) => (format === 'site' ? 'story' : format);

const SETS = {
  aniversario: { label: 'Aniversário', formats: ['square', 'story', 'wide'] },
  chamada: { label: 'Vídeo Chamada', formats: ['square', 'story', 'wide'] },
  convite: { label: 'Vídeo Convite', formats: ['square', 'story', 'wide'] },
  tematico: { label: 'Temático', formats: ['square', 'story', 'wide'] },
  personalizado: { label: 'Personalizado', formats: ['story', 'wide'] },
  natal: { label: 'Natal', formats: ['square', 'story'] },
  missao: { label: 'Missão', formats: ['square', 'story'] },
  'dia-criancas': { label: 'Dia das Crianças', formats: ['square'] },
  evento: { label: 'Evento presencial', formats: ['square'] },
};

/** Fundos que já vêm no site (public/images/service-art), um conjunto por serviço. */
export const ART_BACKGROUND_SETS = Object.entries(SETS).map(([id, { label }]) => ({ id, label }));

export function backgroundSetUrls(id) {
  const set = SETS[id];
  return set ? Object.fromEntries(set.formats.map((f) => [f, `/images/service-art/${id}-${f}.jpg`])) : {};
}

/** "A partir de R$ 65" → "65"; "R$ 59,90" → "59,90"; "Sob Consulta" → "" (a arte sai sem preço). */
export function priceNumber(price) {
  const m = String(price ?? '').match(/R\$\s*(\d+(?:[.,]\d{1,2})?)/i);
  return m ? m[1].replace(/[.,]00$/, '') : '';
}

/** Palavras com marcação de negrito; "\n" força quebra de linha. */
function words(text) {
  const out = [];
  String(text ?? '').split('**').forEach((part, i) => {
    part.split('\n').forEach((line, j) => {
      if (j > 0) out.push({ br: true });
      line.split(/\s+/).filter(Boolean).forEach((w) => out.push({ text: w, bold: i % 2 === 1 }));
    });
  });
  return out;
}

/**
 * Quebra a descrição em linhas de até `maxWidth`, usando `measure(texto, negrito)` para a largura.
 * Cada linha é uma lista de trechos { text, bold } (o espaço entre palavras fica no trecho).
 */
export function wrapRich(text, maxWidth, measure) {
  const lines = [];
  let line = [];
  let width = 0;
  const push = () => { if (line.length) lines.push(line); line = []; width = 0; };
  for (const w of words(text)) {
    if (w.br) { push(); continue; }
    const add = measure(w.text, w.bold);
    if (line.length && width + measure(' ', false) + add > maxWidth) push();
    const gap = line.length ? measure(' ', false) : 0;
    const piece = line.length ? ` ${w.text}` : w.text;
    const last = line[line.length - 1];
    if (last && last.bold === w.bold) last.text += piece;
    else line.push({ text: piece, bold: w.bold });
    width += gap + add;
  }
  push();
  return lines;
}

/** Título em duas linhas equilibradas ("VÍDEO ESPECIAL DE / ANIVERSÁRIO"). */
export function splitTitle(title) {
  const ws = String(title ?? '').trim().split(/\s+/);
  if (ws.length < 2) return [ws.join(' ')];
  let best = 1;
  const longest = (i) => Math.max(ws.slice(0, i).join(' ').length, ws.slice(i).join(' ').length);
  for (let i = 2; i < ws.length; i += 1) if (longest(i) < longest(best)) best = i;
  return [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
}

/** Limpa a arte para gravar/ler: só textos preenchidos e fundos http(s) ou /images; nada preenchido → undefined. */
export function normalizeArt(art) {
  if (!art || typeof art !== 'object') return undefined;
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const url = (v) => (typeof v === 'string' && /^(https?:\/\/|\/images\/)/.test(v.trim()) ? v.trim() : undefined);
  const backgrounds = Object.fromEntries(['square', 'story', 'wide'].map((f) => [f, url(art.backgrounds?.[f])]).filter(([, v]) => v));
  const out = Object.fromEntries([['title', text(art.title)], ['badge', text(art.badge)], ['description', text(art.description)]].filter(([, v]) => v));
  if (Object.keys(backgrounds).length) out.backgrounds = backgrounds;
  return Object.keys(out).length ? out : undefined;
}
