import { backgroundKey, priceNumber, splitTitle, wrapRich, type ArtFormat } from '../../../services/serviceArt.js';
import type { ServiceArt } from '../../../types';

// Medidas tiradas das artes feitas no Adobe Express (quadrado 1200, story 675x1200 x1,6, horizontal 2560x1440 x0,75).
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@800&family=Raleway:wght@400;700;900&display=swap';
const TITLE = '{s}px "League Gothic Italic"';
const PRICE = '900 {s}px Raleway'; // Raleway Black com números "antigos" (o 6 sobe, o 5 desce), como nas artes
const BADGE = '800 {s}px Montserrat';
const DESC = '400 {s}px Raleway';
const DESC_BOLD = '700 {s}px Raleway';

type Align = 'center' | 'right';
interface Layout {
  w: number;
  h: number;
  /**
   * oneLine: o título diminui em vez de quebrar (quadrado). equalWidth: em duas linhas, as duas têm a mesma largura
   * (story/site); senão, o mesmo tamanho (horizontal). lineGap: espaço entre as linhas, em alturas de letra.
   */
  title: { x: number; align: Align; top: number; cap: number; maxWidth: number; oneLine?: boolean; equalWidth?: boolean; lineGap: number };
  badge?: { where: 'above' | 'below'; cap: number };
  /** "R$": rs = altura em relação ao número; rsTop = topo acima da base (em alturas do número); rsGap = espaço até o número. */
  price: { x: number; align: Align; cap: number; baseline: number; color: string; gapToDesc: number; rs: number; rsTop: number; rsGap: number };
  desc?: { size: number; pitch: number; lastBaseline: number; maxWidth: number };
}

const STORY_TITLE = { x: 540, align: 'center' as const, top: 135, cap: 126, maxWidth: 944, equalWidth: true, lineGap: 0.28 };
export const LAYOUTS: Record<ArtFormat, Layout> = {
  square: {
    w: 1200, h: 1200,
    title: { x: 600, align: 'center', top: 105, cap: 143, maxWidth: 1015, oneLine: true, lineGap: 0 },
    badge: { where: 'below', cap: 26 },
    price: { x: 563, align: 'center', cap: 184, baseline: 1060, color: '#88EC24', gapToDesc: 86, rs: 0.25, rsTop: 1, rsGap: 0 },
    desc: { size: 52, pitch: 52, lastBaseline: 1111, maxWidth: 1080 },
  },
  story: {
    w: 1080, h: 1920,
    title: STORY_TITLE,
    badge: { where: 'above', cap: 30 },
    price: { x: 540, align: 'center', cap: 250, baseline: 1680, color: '#88EC24', gapToDesc: 87, rs: 0.15, rsTop: 0.75, rsGap: 0.05 },
    desc: { size: 56, pitch: 55, lastBaseline: 1773, maxWidth: 800 },
  },
  site: {
    w: 1080, h: 1920,
    title: { ...STORY_TITLE, top: 287 }, // sem selo: na arte do site ele empurraria o título para o rosto
    price: { x: 556, align: 'center', cap: 332, baseline: 1546, color: '#88EC24', gapToDesc: 0, rs: 0.15, rsTop: 0.75, rsGap: 0.05 },
  },
  wide: {
    w: 1920, h: 1080,
    title: { x: 1845, align: 'right', top: 128, cap: 182, maxWidth: 1090, lineGap: 0.6 },
    price: { x: 1736, align: 'right', cap: 232, baseline: 876, color: '#49DE0D', gapToDesc: 0, rs: 0.3, rsTop: 0.78, rsGap: 0.05 },
  },
};

export const ART_SIZES: Record<ArtFormat, { w: number; h: number }> = Object.fromEntries(
  Object.entries(LAYOUTS).map(([f, l]) => [f, { w: l.w, h: l.h }]),
) as Record<ArtFormat, { w: number; h: number }>;

export interface ArtInput {
  title: string;
  badge: string;
  description: string;
  price: string;
  backgrounds: NonNullable<ServiceArt['backgrounds']>;
}

type Ctx = CanvasRenderingContext2D;

let fontsReady: Promise<void> | null = null;
function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  const italic = new FontFace('League Gothic Italic', 'url(/fonts/league-gothic-italic.otf)').load().then((face) => { document.fonts.add(face); });
  const google = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    link.onload = () => resolve();
    link.onerror = () => reject();
    document.head.appendChild(link);
  }).then(() => Promise.all([PRICE, BADGE, DESC, DESC_BOLD].map((f) => document.fonts.load(f.replace('{s}', '100'))))).then(() => undefined);
  fontsReady = Promise.all([italic, google]).then(() => undefined, () => { throw new Error('Não foi possível carregar as fontes da arte.'); });
  fontsReady.catch(() => { fontsReady = null; });
  return fontsReady;
}

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível abrir o fundo da arte.'));
      img.src = url;
    });
    images.set(url, p);
    p.catch(() => images.delete(url));
  }
  return p;
}

const font = (spec: string, size: number) => spec.replace('{s}', String(size));
const capRatio = (ctx: Ctx, spec: string) => { ctx.font = font(spec, 100); return ctx.measureText('H').actualBoundingBoxAscent / 100; };

/** Tamanho de fonte para a maiúscula ter `cap` px, sem passar de `maxWidth`. */
function fit(ctx: Ctx, spec: string, text: string, cap: number, maxWidth: number) {
  const ratio = capRatio(ctx, spec);
  const m = ctx.measureText(text);
  const width = Math.max(m.actualBoundingBoxLeft + m.actualBoundingBoxRight, 1);
  const size = Math.min(cap / ratio, (maxWidth / width) * 100);
  return { size, cap: size * ratio };
}

/** Escreve alinhando o desenho das letras (não o ponto de ancoragem; no itálico ele fica deslocado). Devolve esquerda e direita. */
function drawAligned(ctx: Ctx, text: string, x: number, align: Align, baseline: number) {
  const m = ctx.measureText(text);
  const width = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const left = align === 'center' ? x - width / 2 : x - width;
  ctx.fillText(text, left + m.actualBoundingBoxLeft, baseline);
  return { left, right: left + width };
}

/**
 * Título com sombra; em duas linhas segue `equalWidth` e `lineGap` do formato, como nas artes.
 * `shift` empurra o título para baixo (espaço do selo acima dele).
 */
function drawTitle(ctx: Ctx, title: string, L: Layout['title'], shift: number) {
  const text = title.trim().toUpperCase();
  let lines = [text];
  if (!L.oneLine && fit(ctx, TITLE, text, L.cap, L.maxWidth).cap < L.cap * 0.7 && text.includes(' ')) lines = splitTitle(text);
  const ratio = capRatio(ctx, TITLE); // deixa a fonte em 100px
  const widths = lines.map((line) => { const m = ctx.measureText(line); return Math.max(m.actualBoundingBoxLeft + m.actualBoundingBoxRight, 1); });
  const fits = widths.map((w) => Math.min(L.maxWidth, (w * L.cap) / (ratio * 100)) / w * 100); // tamanho de cada linha sozinha
  const target = Math.min(...widths.map((w, i) => (w * fits[i]) / 100));
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  let left = Infinity;
  let right = -Infinity;
  let baseline = L.top + shift;
  lines.forEach((line, i) => {
    const size = L.equalWidth ? (target / widths[i]) * 100 : Math.min(...fits);
    const cap = size * ratio;
    baseline += (i ? cap * L.lineGap : 0) + cap;
    ctx.font = font(TITLE, size);
    ctx.shadowOffsetX = ctx.shadowOffsetY = Math.round(cap * 0.05);
    const box = drawAligned(ctx, line, L.x, L.align, baseline);
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
  });
  ctx.shadowColor = 'transparent';
  return { left, right, top: L.top + shift, bottom: baseline };
}

/** Selo branco com texto escuro, alinhado à direita do título (acima no story/site, abaixo no quadrado). */
function drawBadge(ctx: Ctx, text: string, title: { right: number; top: number; bottom: number }, B: NonNullable<Layout['badge']>, w: number) {
  const size = B.cap / capRatio(ctx, BADGE);
  ctx.font = font(BADGE, size);
  const padX = B.cap * 0.45;
  const padY = B.cap * 0.45;
  const boxW = ctx.measureText(text).width + padX * 2;
  const boxH = B.cap + padY * 2;
  const right = Math.min(title.right, w - 20);
  const top = B.where === 'below' ? title.bottom + B.cap * 0.8 : title.top - B.cap * 0.2 - boxH;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(right - boxW, top, boxW, boxH);
  ctx.fillStyle = '#111111';
  ctx.fillText(text, right - boxW + padX, top + padY + B.cap);
}

/** Descrição centralizada, crescendo para cima a partir da última linha. Devolve o topo da primeira linha. */
function drawDescription(ctx: Ctx, text: string, D: NonNullable<Layout['desc']>, cx: number) {
  const spec = (bold: boolean) => font(bold ? DESC_BOLD : DESC, D.size);
  const measure = (t: string, bold: boolean) => { ctx.font = spec(bold); return ctx.measureText(t).width; };
  const lines = wrapRich(text, D.maxWidth, measure);
  if (!lines.length) return null;
  ctx.fillStyle = '#ffffff';
  const first = D.lastBaseline - (lines.length - 1) * D.pitch;
  lines.forEach((runs, i) => {
    let x = cx - runs.reduce((sum, r) => sum + measure(r.text, r.bold), 0) / 2;
    for (const r of runs) {
      ctx.font = spec(r.bold);
      ctx.fillText(r.text, x, first + i * D.pitch);
      x += ctx.measureText(r.text).width;
    }
  });
  return first - D.size * capRatio(ctx, DESC);
}

/** Valor com "R$" no canto de cima à esquerda; no centro, o conjunto "R$ + número" fica centralizado. */
function drawPrice(ctx: Ctx, num: string, P: Layout['price'], baseline: number) {
  const ratio = capRatio(ctx, PRICE);
  const numSize = P.cap / ratio;
  const rsSize = numSize * P.rs;
  const box = (text: string, size: number) => { ctx.font = font(PRICE, size); const m = ctx.measureText(text); return { lead: m.actualBoundingBoxLeft, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight }; };
  const n = box(num, numSize);
  const rs = box('R$', rsSize);
  const gap = P.cap * P.rsGap;
  const numLeft = P.align === 'center' ? P.x - (rs.w + gap + n.w) / 2 + rs.w + gap : P.x - n.w;
  ctx.fillStyle = P.color;
  // Sombra escura e difusa atrás do valor, como nas artes originais.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = P.cap * 0.3;
  ctx.shadowOffsetX = ctx.shadowOffsetY = P.cap * 0.03;
  ctx.font = font(PRICE, numSize);
  ctx.fillText(num, numLeft + n.lead, baseline);
  ctx.fillText(num, numLeft + n.lead, baseline); // duas passadas: a sombra fica mais densa
  ctx.font = font(PRICE, rsSize);
  ctx.fillText('R$', numLeft - gap - rs.w + rs.lead, baseline - P.cap * P.rsTop + rsSize * ratio);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/** Desenha a arte de um formato; null quando o serviço não tem fundo para ele. */
export async function renderServiceArt(format: ArtFormat, input: ArtInput): Promise<Blob | null> {
  const url = input.backgrounds[backgroundKey(format)];
  if (!url) return null;
  const L = LAYOUTS[format];
  const [img] = await Promise.all([loadImage(url), loadFonts()]);
  const canvas = document.createElement('canvas');
  canvas.width = L.w;
  canvas.height = L.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu gerar a imagem.');
  const scale = Math.max(L.w / img.naturalWidth, L.h / img.naturalHeight);
  ctx.drawImage(img, (L.w - img.naturalWidth * scale) / 2, (L.h - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const badge = L.badge && input.badge.trim();
  if (input.title.trim()) {
    const shift = badge && L.badge?.where === 'above' ? L.badge.cap * 2.1 : 0; // altura da caixa do selo + respiro
    const title = drawTitle(ctx, input.title, L.title, shift);
    if (badge && L.badge) drawBadge(ctx, badge, title, L.badge, L.w);
  }
  const descTop = L.desc && input.description.trim() ? drawDescription(ctx, input.description, L.desc, L.w / 2) : null;
  const num = priceNumber(input.price);
  if (num) drawPrice(ctx, num, L.price, descTop === null ? L.price.baseline : descTop - L.price.gapToDesc);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/jpeg', 0.92));
}
