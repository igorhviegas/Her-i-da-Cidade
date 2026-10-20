import { addDays } from '../../../functions/missions-core.js';
import {
  compactNumber, fitLines, longDate, shortDate,
  type AdFormat, type ClarimPage, type PhotoRef,
} from '../../../services/clarim.js';
import type { Service } from '../../../types';

/*
 * Página do Clarim Semanal: Story 1080 × 1920 desenhado no canvas. A prévia é este mesmo PNG reduzido, então o que se vê é o
 * que se baixa. Grade: margens de 56 px, área útil de y 240 a 1660 (o Instagram cobre topo e base). Tipos: Anton (manchetes),
 * Big Shoulders Display (masthead), Oswald (rótulos), PT Serif (texto). Medidas aprovadas na prévia de 19/10/2026.
 */
const W = 1080;
const H = 1920;
const M = 56;
const CW = W - M * 2;
const INK = '#111111';
const GRAD = ['#00C5FF', '#0073FF'] as const;
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Anton&family=Big+Shoulders+Display:wght@900&family=Oswald:wght@500;700&family=PT+Serif:ital,wght@0,400;0,700;1,400&display=swap';
const PAPER_URL = '/images/clarim/papel.jpg';
const F = {
  anton: (s: number) => `${s}px Anton`,
  mast: (s: number) => `900 ${s}px "Big Shoulders Display"`,
  label: (s: number, w = 700) => `${w} ${s}px Oswald`,
  serif: (s: number, w = 400) => `${w} ${s}px "PT Serif"`,
  serifItalic: (s: number) => `italic 400 ${s}px "PT Serif"`,
};
const REQUIRED_FONTS = [F.anton(100), F.mast(100), F.label(100), F.label(100, 500), F.serif(100), F.serif(100, 700), F.serifItalic(100)];

type Ctx = CanvasRenderingContext2D;
type Img = CanvasImageSource & { width: number; height: number };
interface Rect { x: number; y: number; w: number; h: number }

export interface RenderData {
  editionNumber: number;
  periodEnd: string;
  pageNumber: number;
  /** Imagens já carregadas: fotos por slot (main ou id do pedido), miniaturas por id da publicação, artes por slot/serviço. */
  photos: Record<string, Img | null>;
  thumbs: Record<string, Img | null>;
  ads: Record<string, Img | null>;
  cover?: { followers: number | null; gain: number | null; topGain: number | null; topPublished: string | null; topPostId: string | null; index: Array<{ label: string; page: number }> };
  events?: Array<{ orderId: string; weekday: string }>;
  performance?: { rows: Array<{ postId: string; title: string; published: string; gain: number; partial: boolean }>; total: number; count: number };
  services?: Service[];
}

// ---------------------------------------------------------------- recursos

let fontsReady: Promise<void> | null = null;
function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('Não foi possível carregar as fontes do jornal.'));
    document.head.appendChild(link);
  }).then(() => Promise.all(REQUIRED_FONTS.map((f) => document.fonts.load(f)))).then(() => {
    if (!REQUIRED_FONTS.every((f) => document.fonts.check(f))) throw new Error('As fontes do jornal não carregaram. Recarregue a página.');
  });
  fontsReady.catch(() => { fontsReady = null; });
  return fontsReady;
}

/** Imagem de uma URL (mesmo domínio ou com CORS) ou de um Blob; null se não carregar (vira pendência, nunca canvas "sujo"). */
export async function loadImage(source: string | Blob): Promise<Img | null> {
  try {
    const blob = typeof source === 'string' ? await fetch(source, { mode: 'cors' }).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status))))) : source;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

let paper: Promise<Img | null> | null = null;
const loadPaper = () => (paper ??= loadImage(PAPER_URL));

// ---------------------------------------------------------------- primitivas

function cover(ctx: Ctx, img: Img, r: Rect, crop: Pick<PhotoRef, 'x' | 'y' | 'zoom'> = { x: 50, y: 50, zoom: 1 }) {
  const scale = Math.max(r.w / img.width, r.h / img.height) * Math.max(1, crop.zoom);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = r.x - (w - r.w) * (crop.x / 100);
  const y = r.y - (h - r.h) * (crop.y / 100);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

/** Arte inteira dentro do espaço (nunca esticada); sobra vira tarja preta, como anúncio de jornal. */
function contain(ctx: Ctx, img: Img, r: Rect) {
  ctx.fillStyle = INK;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const scale = Math.min(r.w / img.width, r.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

/** Maior retângulo com a proporção da imagem dentro de `r`, centralizado. */
function fitRect(img: Img, r: Rect): Rect {
  const scale = Math.min(r.w / img.width, r.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

function frame(ctx: Ctx, r: Rect, width: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.strokeRect(r.x + width / 2, r.y + width / 2, r.w - width, r.h - width);
}

let dots: CanvasPattern | null = null;
function halftone(ctx: Ctx, r: Rect) {
  if (!dots) {
    const c = document.createElement('canvas');
    c.width = 7;
    c.height = 7;
    const g = c.getContext('2d');
    if (!g) return;
    g.fillStyle = 'rgba(0,0,0,0.26)';
    g.beginPath();
    g.arc(3.5, 3.5, 1.6, 0, Math.PI * 2);
    g.fill();
    dots = ctx.createPattern(c, 'repeat');
  }
  if (!dots) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = dots;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Foto colorida com efeito de impresso (cor levemente lavada + retícula) e moldura preta. */
function photo(ctx: Ctx, img: Img | null | undefined, r: Rect, crop?: PhotoRef, label?: string) {
  if (img) {
    ctx.save();
    ctx.filter = 'saturate(0.85) contrast(1.06) sepia(0.1)'; // ignorado onde o canvas não tem filter: a foto sai sem o ajuste de cor
    cover(ctx, img, r, crop);
    ctx.restore();
    halftone(ctx, r);
  } else {
    ctx.fillStyle = '#9a9a92';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  frame(ctx, r, 6);
  if (label) {
    ctx.font = F.label(28);
    const w = ctx.measureText(label.toUpperCase()).width + 32;
    ctx.fillStyle = INK;
    ctx.fillRect(r.x, r.y + r.h - 50, w, 50);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(label.toUpperCase(), r.x + 16, r.y + r.h - 15);
  }
}

interface TextOpts { x: number; y: number; w: number; maxLines: number; maxSize: number; minSize: number; font: (s: number) => string; lineHeight: number; color?: string; upper?: boolean; align?: CanvasTextAlign; shadow?: boolean; /** só mede, não desenha */ dry?: boolean }

/**
 * Escreve um bloco com quebra de linha, do maior ao menor tamanho que cabe. Devolve a altura usada ou null (não coube:
 * o chamador registra a pendência). `y` é o topo do bloco.
 */
function text(ctx: Ctx, value: string, o: TextOpts): number | null {
  const content = o.upper ? value.toLocaleUpperCase('pt-BR') : value;
  const fit = fitLines(content, { maxWidth: o.w, maxLines: o.maxLines, maxSize: o.maxSize, minSize: o.minSize }, (t, s) => { ctx.font = o.font(s); return ctx.measureText(t).width; });
  if (!fit) return null;
  ctx.font = o.font(fit.size);
  ctx.fillStyle = o.color ?? INK;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  const step = fit.size * o.lineHeight;
  const height = cap + (fit.lines.length - 1) * step + fit.size * 0.25;
  if (o.dry) return height;
  const ax = o.align === 'right' ? o.x + o.w : o.align === 'center' ? o.x + o.w / 2 : o.x;
  fit.lines.forEach((line, i) => {
    const y = o.y + cap + i * step;
    if (o.shadow) {
      ctx.fillStyle = INK;
      ctx.fillText(line, ax, y + 6);
      ctx.fillStyle = o.color ?? INK;
    }
    ctx.fillText(line, ax, y);
  });
  return height;
}

/** Texto de dado (descrição de serviço): reduz e, se ainda não couber, corta com reticências em vez de bloquear. */
function clampText(ctx: Ctx, value: string, o: TextOpts): number {
  let s = value.trim();
  while (s) {
    const h = text(ctx, s, o);
    if (h !== null) return h;
    s = `${s.split(/\s+/).slice(0, -1).join(' ')}…`.replace(/^…$/, '');
  }
  return 0;
}

// ---------------------------------------------------------------- partes comuns

const TRUMPET_BELL = new Path2D('M120 44 C150 42 170 30 190 12 L190 88 C170 70 150 58 120 56 Z M12 46 L30 48 L30 52 L12 54 Z');
const TRUMPET_RECTS: Array<[number, number, number, number]> = [
  [28, 44, 94, 12], [6, 43, 7, 14],
  [60, 24, 9, 20], [57, 17, 15, 7], [62, 56, 5, 10],
  [76, 24, 9, 20], [73, 17, 15, 7], [78, 56, 5, 10],
  [92, 24, 9, 20], [89, 17, 15, 7], [94, 56, 5, 10],
];

/** Trompete branco (desenho de 200 × 100) com largura `w`, centrado em (cx, cy). */
function trumpet(ctx: Ctx, cx: number, cy: number, w: number) {
  const s = w / 200;
  ctx.save();
  ctx.translate(cx - 100 * s, cy - 50 * s);
  ctx.scale(s, s);
  ctx.fillStyle = '#fff';
  ctx.fill(TRUMPET_BELL);
  for (const [x, y, rw, rh] of TRUMPET_RECTS) ctx.fillRect(x, y, rw, rh);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.roundRect(44, 52, 72, 24, 12);
  ctx.stroke();
  ctx.restore();
}

function gradient(ctx: Ctx, x0: number, x1: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, GRAD[0]);
  g.addColorStop(1, GRAD[1]);
  return g;
}

/** Masthead: faixa no gradiente da logo, palavras brancas com contorno e sombra em degraus, selo redondo no centro. */
function masthead(ctx: Ctx, top: number, big: boolean) {
  const bandH = big ? 160 : 120;
  const border = big ? 8 : 6;
  const r = big ? 110 : 80;
  const ring = big ? 8 : 6;
  const size = big ? 106 : 86;
  const depth = big ? 7 : 5;
  const cy = top + bandH / 2;
  ctx.fillStyle = gradient(ctx, 0, W);
  ctx.fillRect(0, top, W, bandH);
  ctx.fillStyle = INK;
  ctx.fillRect(0, top, W, border);
  ctx.fillRect(0, top + bandH - border, W, border);

  ctx.font = F.mast(size);
  ctx.textBaseline = 'alphabetic';
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  const baseline = cy + cap / 2;
  const gap = r + ring * 2 + 26;
  const word = (value: string, x: number, align: CanvasTextAlign) => {
    ctx.save();
    ctx.translate(x, baseline);
    ctx.transform(1, 0, -Math.tan((8 * Math.PI) / 180), 1, 0, 0);
    ctx.textAlign = align;
    ctx.fillStyle = INK;
    for (let i = 1; i <= depth; i += 1) ctx.fillText(value, i, i);
    ctx.lineJoin = 'round';
    ctx.lineWidth = big ? 6 : 4;
    ctx.strokeStyle = INK;
    ctx.strokeText(value, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(value, 0, 0);
    ctx.restore();
  };
  word('CLARIM', W / 2 - gap, 'right');
  word('SEMANAL', W / 2 + gap, 'left');

  const circle = (radius: number, fill: string | CanvasGradient) => { ctx.beginPath(); ctx.arc(W / 2, cy, radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  circle(r + ring * 2, INK);
  circle(r + ring, '#fff');
  circle(r, INK);
  circle(r - (big ? 10 : 7), gradient(ctx, W / 2 - r, W / 2 + r));
  trumpet(ctx, W / 2, cy, (r - (big ? 10 : 7)) * 2 * 0.74);
}

function folio(ctx: Ctx, y: number, left: string, right: string, rightWeight = 700) {
  ctx.textBaseline = 'alphabetic';
  ctx.font = F.label(30);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText(left.toLocaleUpperCase('pt-BR'), M, y + 26);
  ctx.font = F.label(30, rightWeight);
  ctx.textAlign = 'right';
  ctx.fillText(right.toLocaleUpperCase('pt-BR'), M + CW, y + 26);
  ctx.fillRect(M, y + 38, CW, 4);
}

function kicker(ctx: Ctx, y: number, value: string): number {
  const label = value.toLocaleUpperCase('pt-BR');
  ctx.font = F.label(36);
  ctx.letterSpacing = '4px';
  const w = Math.min(CW, ctx.measureText(label).width + 44);
  ctx.fillStyle = INK;
  ctx.fillRect(M, y, w, 66);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, M + 22, y + 47, CW - 44);
  ctx.letterSpacing = '0px';
  return w;
}

function footer(ctx: Ctx) {
  const y = 1676;
  ctx.fillStyle = INK;
  ctx.fillRect(M, y, CW, 4);
  ctx.fillRect(M, y + 8, CW, 2);
  ctx.font = F.label(36);
  ctx.letterSpacing = '1px';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('heroidacidade.com', M, y + 56);
  ctx.textAlign = 'right';
  ctx.fillText('@oheroidacidade', M + CW, y + 56);
  ctx.letterSpacing = '0px';
}

function label(ctx: Ctx, x: number, y: number, value: string, size = 26) {
  ctx.font = F.label(size);
  ctx.letterSpacing = '4px';
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value.toLocaleUpperCase('pt-BR'), x, y);
  ctx.letterSpacing = '0px';
}

function ad(ctx: Ctx, img: Img | null | undefined, r: Rect) {
  if (!img) return;
  label(ctx, r.x, r.y - 12, 'Anúncio');
  contain(ctx, img, r);
  frame(ctx, r, 6);
}

function innerChrome(ctx: Ctx, d: RenderData, page: ClarimPage, period: string) {
  masthead(ctx, 280, false);
  folio(ctx, 448, `Edição nº ${d.editionNumber} · ${period}`, `Página ${d.pageNumber}`);
  kicker(ctx, 506, page.fields.kicker || '');
}

// ---------------------------------------------------------------- templates

type Issues = string[];
const tooLong = (issues: Issues, what: string) => issues.push(`${what} não cabe: encurte o texto.`);

function drawCover(ctx: Ctx, page: ClarimPage, d: RenderData, issues: Issues) {
  const c = d.cover;
  const f = page.fields;
  masthead(ctx, 290, true);
  const followers = c?.followers != null ? `${c.followers.toLocaleString('pt-BR')} seguidores${c.gain ? ` ${c.gain > 0 ? '▲' : '▼'}${Math.abs(c.gain).toLocaleString('pt-BR')}` : ''}` : '';
  folio(ctx, 524, `${longDate(addDays(d.periodEnd, 1))} · Edição nº ${d.editionNumber}`, followers, 500);

  const r = { x: M, y: 590, w: CW, h: 740 };
  const img = f.variant === 'photo' ? d.photos.main : (c?.topPostId ? d.thumbs[c.topPostId] : null);
  photo(ctx, img, r, f.variant === 'photo' ? page.photos.main : undefined);
  if (f.variant === 'photo' && !img) issues.push('A foto da capa não carregou.');
  if (f.variant !== 'photo' && !img) issues.push('A miniatura do vídeo não carregou: envie uma foto (variação Foto escolhida).');
  if (text(ctx, f.headline || '', { x: M + 40, y: r.y + 44, w: CW - 88, maxLines: 3, maxSize: 176, minSize: 110, font: F.anton, lineHeight: 0.94, color: '#fff', upper: true, shadow: true }) === null) tooLong(issues, 'A manchete');
  const caption = f.variant === 'photo' ? f.caption : (f.caption || (c?.topPublished ? `O vídeo mais visto da semana · Reel de ${shortDate(c.topPublished)}` : ''));
  if (caption) {
    ctx.font = F.label(34);
    const value = caption.toLocaleUpperCase('pt-BR');
    const w = Math.min(CW - 80, ctx.measureText(value).width + 32);
    ctx.fillStyle = INK;
    ctx.fillRect(M + 40, r.y + r.h - 90, w, 54);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, M + 56, r.y + r.h - 50, CW - 112);
  }

  const teasers = [[f.teaser1, f.teaser1Page], [f.teaser2, f.teaser2Page]].filter(([t]) => t?.trim());
  teasers.forEach(([t, p], i) => {
    const box = { x: M, y: 1350 + i * 146, w: 480, h: 128 };
    ctx.fillStyle = '#fff';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = INK;
    ctx.fillRect(box.x + box.w - 150, box.y, 150, box.h);
    frame(ctx, box, 6);
    if (text(ctx, t, { x: box.x + 20, y: box.y + 18, w: box.w - 190, maxLines: 3, maxSize: 38, minSize: 26, font: (s) => F.label(s), lineHeight: 1.08, upper: true }) === null) tooLong(issues, `A chamada ${i + 1}`);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = F.label(26);
    ctx.fillText('PÁG.', box.x + box.w - 75, box.y + 44);
    ctx.font = F.anton(70);
    ctx.fillText(String(p || '—'), box.x + box.w - 75, box.y + 112);
  });

  const slot = { x: 568, y: 1386, w: 456, h: 257 };
  if (d.ads.slot) ad(ctx, d.ads.slot, slot);
  else if (c?.index.length) {
    label(ctx, slot.x, slot.y - 12, 'Nesta edição');
    c.index.slice(0, 5).forEach((item, i) => {
      const y = slot.y + 34 + i * 50;
      ctx.font = F.serif(32);
      ctx.textAlign = 'left';
      ctx.fillText(item.label, slot.x, y, slot.w - 70);
      ctx.font = F.label(32);
      ctx.textAlign = 'right';
      ctx.fillText(String(item.page), slot.x + slot.w, y);
    });
  }
}

function drawEvents(ctx: Ctx, page: ClarimPage, d: RenderData, period: string, issues: Issues) {
  innerChrome(ctx, d, page, period);
  if (text(ctx, page.fields.headline || '', { x: M, y: 590, w: CW, maxLines: 2, maxSize: 140, minSize: 96, font: F.anton, lineHeight: 0.94, upper: true }) === null) tooLong(issues, 'A manchete');
  const chosen = (d.events ?? []).filter((e) => page.sources.includes(e.orderId)).slice(0, 3);
  const area = { x: M, y: 858, w: CW, h: 430 };
  const g = 24;
  const rects: Rect[] = chosen.length === 1 ? [area]
    : chosen.length === 2 ? [{ ...area, w: (CW - g) / 2 }, { ...area, x: M + (CW + g) / 2, w: (CW - g) / 2 }]
      : chosen.length === 3 ? [
        { x: M, y: area.y, w: (CW - 20) * 0.6, h: area.h },
        { x: M + (CW - 20) * 0.6 + 20, y: area.y, w: (CW - 20) * 0.4, h: (area.h - 20) / 2 },
        { x: M + (CW - 20) * 0.6 + 20, y: area.y + (area.h + 20) / 2, w: (CW - 20) * 0.4, h: (area.h - 20) / 2 },
      ] : [];
  chosen.forEach((e, i) => {
    const img = d.photos[e.orderId];
    if (page.photos[e.orderId] && !img) issues.push(`A foto de ${e.weekday.toLowerCase()} não carregou.`);
    photo(ctx, img, rects[i], page.photos[e.orderId], e.weekday);
  });
  label(ctx, M, 1326, page.fields.credit || '', 28);
  const hasAd = Boolean(d.ads.slot);
  if (text(ctx, page.fields.body || '', { x: M, y: 1350, w: hasAd ? 560 : CW, maxLines: 6, maxSize: 40, minSize: 32, font: (s) => F.serif(s), lineHeight: 1.36 }) === null) tooLong(issues, 'O texto');
  if (hasAd) ad(ctx, d.ads.slot, { x: 664, y: 1338, w: 360, h: 320 });
}

function drawPerformance(ctx: Ctx, page: ClarimPage, d: RenderData, period: string, issues: Issues) {
  innerChrome(ctx, d, page, period);
  if (text(ctx, page.fields.headline || '', { x: M, y: 590, w: CW, maxLines: 2, maxSize: 110, minSize: 80, font: F.anton, lineHeight: 0.94, upper: true }) === null) tooLong(issues, 'A manchete');
  const perf = d.performance;
  const rows = perf?.rows.slice(0, 3) ?? [];
  if (!rows.length) issues.push('Não há visualizações registradas na semana (confira a sincronização do Instagram).');
  const top = 826;
  const rowH = 244;
  ctx.fillStyle = INK;
  ctx.fillRect(M, top, CW, 8);
  rows.forEach((row, i) => {
    const y = top + 8 + i * rowH;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = F.anton(96);
    ctx.fillText(String(i + 1), M, y + rowH / 2 + 38);
    if (!d.thumbs[row.postId]) issues.push(`A miniatura do ${i + 1}º vídeo não carregou: importe o Reel em Vídeos para ter a miniatura salva.`);
    photo(ctx, d.thumbs[row.postId], { x: M + 100, y: y + 22, w: 128, h: 200 });
    clampText(ctx, row.title, { x: M + 252, y: y + 70, w: 430, maxLines: 2, maxSize: 40, minSize: 30, font: (s) => F.label(s), lineHeight: 1.08, upper: true });
    ctx.font = F.serifItalic(32);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(`Reel de ${shortDate(row.published)}`, M + 252, y + 196);
    ctx.textAlign = 'right';
    ctx.font = F.anton(76);
    ctx.fillText(compactNumber(row.gain), M + CW, y + rowH / 2 + 10);
    ctx.font = F.label(28);
    ctx.fillStyle = '#17722a';
    ctx.fillText(row.partial ? '▲ VIEWS (PARCIAL)' : '▲ VIEWS', M + CW, y + rowH / 2 + 52);
    if (i < rows.length - 1) { ctx.fillStyle = INK; ctx.fillRect(M, y + rowH - 3, CW, 3); }
  });
  ctx.fillStyle = INK;
  ctx.fillRect(M, top + 8 + rows.length * rowH, CW, 8);

  const strip = { x: M, y: 1576, w: CW, h: 90 };
  ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.font = F.label(34);
  ctx.textAlign = 'left';
  ctx.fillText('VIEWS NA SEMANA', strip.x + 26, strip.y + strip.h / 2);
  ctx.textAlign = 'right';
  const count = perf?.count ?? 0;
  ctx.fillText(`${count} ${count === 1 ? 'VÍDEO NOVO' : 'VÍDEOS NOVOS'}`, strip.x + strip.w - 26, strip.y + strip.h / 2);
  ctx.textAlign = 'center';
  ctx.font = F.anton(64);
  ctx.fillText(compactNumber(perf?.total ?? null), strip.x + strip.w / 2, strip.y + strip.h / 2 + 2);
  ctx.textBaseline = 'alphabetic';
}

function drawNews(ctx: Ctx, page: ClarimPage, d: RenderData, period: string, issues: Issues) {
  innerChrome(ctx, d, page, period);
  const f = page.fields;
  if (f.variant === 'notice') {
    // o quadro cresce com o conteúdo: mede primeiro, desenha depois
    const top = 600;
    const head = { x: M + 44, y: top + 120, w: CW - 88, maxLines: 3, maxSize: 130, minSize: 90, font: F.anton, lineHeight: 0.94, upper: true };
    const headH = text(ctx, f.headline || '', { ...head, dry: true });
    const body = { x: M + 44, y: top + 150 + (headH ?? 300), w: CW - 88, maxLines: 5, maxSize: 40, minSize: 32, font: (s: number) => F.serif(s), lineHeight: 1.36 };
    const bodyH = f.body ? text(ctx, f.body, { ...body, dry: true }) : 0;
    const box = { x: M, y: top, w: CW, h: Math.min(body.y - top + (bodyH ?? 0) + 50, 1040) };
    ctx.fillStyle = '#fff';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    frame(ctx, box, 8);
    label(ctx, box.x + 44, box.y + 80, 'Aviso aos leitores', 34);
    if (text(ctx, f.headline || '', head) === null) tooLong(issues, 'A manchete');
    if (f.body && text(ctx, f.body, body) === null) tooLong(issues, 'O texto');
    const adTop = box.y + box.h + 44;
    if (d.ads.slot) {
      if (adTop + 257 > 1660) issues.push('O anúncio não cabe abaixo do aviso: encurte o texto ou tire o anúncio.');
      else ad(ctx, d.ads.slot, { x: M, y: adTop, w: 456, h: 257 });
    }
    return;
  }
  if (text(ctx, f.headline || '', { x: M, y: 590, w: CW, maxLines: 2, maxSize: 130, minSize: 90, font: F.anton, lineHeight: 0.94, upper: true }) === null) tooLong(issues, 'A manchete');
  if (f.deck && text(ctx, f.deck, { x: M, y: 842, w: CW, maxLines: 1, maxSize: 44, minSize: 34, font: F.serifItalic, lineHeight: 1.25 }) === null) tooLong(issues, 'A linha fina');
  if (page.photos.main && !d.photos.main) issues.push('A foto da notícia não carregou.');
  photo(ctx, d.photos.main, { x: M, y: 916, w: CW, h: 400 }, page.photos.main);
  if (f.credit) label(ctx, M, 1354, f.credit, 28);
  const hasAd = Boolean(d.ads.slot);
  if (text(ctx, f.body || '', { x: M, y: 1378, w: hasAd ? 600 : CW, maxLines: 5, maxSize: 40, minSize: 32, font: (s) => F.serif(s), lineHeight: 1.36 }) === null) tooLong(issues, 'O texto');
  if (hasAd) ad(ctx, d.ads.slot, { x: 704, y: 1376, w: 320, h: 280 });
}

interface Cell { service: Service; format: AdFormat | null; span: number }

function drawClassifieds(ctx: Ctx, page: ClarimPage, d: RenderData, period: string, issues: Issues) {
  innerChrome(ctx, d, page, period);
  const services = page.services.map((id) => d.services?.find((s) => s.id === id)).filter((s): s is Service => Boolean(s));
  if (services.length < page.services.length) issues.push('Um serviço escolhido não existe mais: remova-o.');
  const cells: Cell[] = services.map((service) => {
    const format = page.ads[service.id]?.format ?? null;
    return { service, format: format && d.ads[service.id] ? format : null, span: format === 'wide' && d.ads[service.id] ? 2 : 1 };
  });
  // linhas de 3 colunas; a última célula de uma linha incompleta ocupa o que sobra
  const rows: Cell[][] = [];
  for (const cell of cells) {
    const row = rows[rows.length - 1];
    if (row && row.reduce((n, c) => n + c.span, 0) + cell.span <= 3) row.push(cell);
    else rows.push([{ ...cell, span: Math.min(cell.span, 3) }]);
  }
  rows.forEach((row) => { const used = row.reduce((n, c) => n + c.span, 0); row[row.length - 1].span += 3 - used; });
  const top = 600;
  const gap = 20;
  const colW = (CW - gap * 2) / 3;
  // linha com arte fica da altura da arte (sem sobra); linha só de texto divide o espaço; o bloco fica centralizado
  const even = rows.length ? (1650 - top - gap * (rows.length - 1)) / rows.length : 0;
  const cellW = (c: Cell) => colW * c.span + gap * (c.span - 1);
  const heights = rows.map((row) => {
    const arts = row.filter((c) => c.format && d.ads[c.service.id]).map((c) => { const a = d.ads[c.service.id] as Img; return cellW(c) * (a.height / a.width); });
    const hasText = row.some((c) => !(c.format && d.ads[c.service.id]));
    return arts.length ? Math.min(even, Math.max(...arts, hasText ? 400 : 0)) : even;
  });
  let y = top + Math.max(0, (1650 - top - (heights.reduce((a, b) => a + b, 0) + gap * (rows.length - 1))) / 2);
  rows.forEach((row, ri) => {
    let x = M;
    const rowH = heights[ri];
    for (const cell of row) {
      const r = { x, y, w: cellW(cell), h: rowH };
      x += r.w + gap;
      const art = d.ads[cell.service.id];
      if (cell.format && art) { // arte inteira no tamanho natural; a sobra da célula fica no papel
        const a = fitRect(art, r);
        ctx.drawImage(art, a.x, a.y, a.w, a.h);
        frame(ctx, a, 6);
        continue;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      frame(ctx, r, 5);
      const inner = r.w - 40;
      let y2 = r.y + 22;
      const th = clampText(ctx, cell.service.title, { x: r.x + 20, y: y2, w: inner, maxLines: 2, maxSize: 54, minSize: 36, font: F.anton, lineHeight: 1, upper: true });
      y2 += th + 18;
      ctx.font = F.label(34);
      const price = (cell.service.price || '').trim();
      if (price) {
        const pw = Math.min(inner, ctx.measureText(price).width + 24);
        ctx.fillStyle = INK;
        ctx.fillRect(r.x + 20, y2, pw, 50);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(price, r.x + 32, y2 + 38, inner - 24);
        y2 += 68;
      }
      const room = Math.max(1, Math.floor((r.y + r.h - 20 - y2) / (34 * 1.3)));
      clampText(ctx, cell.service.description || '', { x: r.x + 20, y: y2, w: inner, maxLines: Math.min(room, 6), maxSize: 34, minSize: 28, font: (s) => F.serif(s), lineHeight: 1.3 });
    }
    y += rowH + gap;
  });
}

// ---------------------------------------------------------------- entrada

/** Desenha a página inteira. Devolve o canvas e as pendências encontradas no desenho (texto que não coube, imagem que não carregou). */
export async function renderPage(page: ClarimPage, d: RenderData, periodText: string): Promise<{ canvas: HTMLCanvasElement; issues: string[] }> {
  const [paperImg] = await Promise.all([loadPaper(), loadFonts()]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu gerar a imagem.');
  ctx.fillStyle = '#ece9e2';
  ctx.fillRect(0, 0, W, H);
  if (paperImg) cover(ctx, paperImg, { x: 0, y: 0, w: W, h: H });
  const issues: string[] = [];
  if (page.template === 'cover') drawCover(ctx, page, d, issues);
  if (page.template === 'events') drawEvents(ctx, page, d, periodText, issues);
  if (page.template === 'performance') drawPerformance(ctx, page, d, periodText, issues);
  if (page.template === 'news') drawNews(ctx, page, d, periodText, issues);
  if (page.template === 'classifieds') drawClassifieds(ctx, page, d, periodText, issues);
  footer(ctx);
  if (paperImg) { // papel amassado por cima de tudo: o efeito de impresso também nas fotos e anúncios
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.72;
    cover(ctx, paperImg, { x: 0, y: 0, w: W, h: H });
    ctx.restore();
  }
  return { canvas, issues };
}

export const toPng = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'));


