import { SHARE_URL, type StoryList, type StorySpec, type StoryTable } from '../../services/kartShare.js';

// Story do Instagram: 1080 x 1920, mesmo fundo escuro da página, faixa quadriculada e a marca "Viegas Kart".
const W = 1080;
const H = 1920;
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const MEDAL_COLOR = { 1: '#fcd34d', 2: '#e2e8f0', 3: '#fdba74' } as const;
const CONTENT_TOP = 600;
const CONTENT_BOTTOM = 1690;

type Ctx = CanvasRenderingContext2D;

const font = (weight: number, size: number, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Corta o texto com "…" para caber em `maxWidth` (no tamanho de fonte atual do contexto). */
function fit(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

function checkered(ctx: Ctx, y: number, size = 40) {
  for (let i = 0; i * size < W; i += 1) {
    for (let j = 0; j < 1; j += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#0b0f1a';
      ctx.fillRect(i * size, y, size, size);
    }
  }
}

function background(ctx: Ctx) {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#0e1a3a');
  base.addColorStop(0.45, '#070B14');
  base.addColorStop(1, '#070B14');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const red = ctx.createRadialGradient(W, 260, 0, W, 260, 620);
  red.addColorStop(0, 'rgba(239,68,68,0.35)');
  red.addColorStop(1, 'rgba(239,68,68,0)');
  ctx.fillStyle = red;
  ctx.fillRect(0, 0, W, H);
  const blue = ctx.createRadialGradient(0, H - 200, 0, 0, H - 200, 700);
  blue.addColorStop(0, 'rgba(14,165,233,0.22)');
  blue.addColorStop(1, 'rgba(14,165,233,0)');
  ctx.fillStyle = blue;
  ctx.fillRect(0, 0, W, H);
  checkered(ctx, 0);
  checkered(ctx, H - 40);
}

function header(ctx: Ctx, spec: StorySpec) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = font(900, 104, true);
  ctx.fillStyle = '#ef4444';
  ctx.fillText('VIEGAS', 70, 190);
  const viegas = ctx.measureText('VIEGAS ').width;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('KART', 70 + viegas, 190);
  ctx.font = font(600, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('CAMPEONATO · KARTÓDROMO DE BETIM', 72, 245);

  ctx.font = font(800, 34);
  ctx.fillStyle = '#fca5a5';
  ctx.fillText(spec.kicker.toUpperCase(), 72, 395);
  let titleSize = 92; // títulos longos (confronto) encolhem até caber, no mínimo 54px
  ctx.font = font(900, titleSize, true);
  while (titleSize > 54 && ctx.measureText(spec.title).width > W - 144) { titleSize -= 4; ctx.font = font(900, titleSize, true); }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(fit(ctx, spec.title, W - 144), 70, 490);
  if (spec.subtitle) {
    ctx.font = font(600, 38);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(fit(ctx, spec.subtitle, W - 144), 72, 548);
  }
}

function footer(ctx: Ctx, footnote: string) {
  ctx.textAlign = 'center';
  if (footnote) {
    ctx.font = font(600, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(fit(ctx, footnote, W - 140), W / 2, 1760);
  }
  ctx.font = font(800, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(SHARE_URL, W / 2, 1840);
  ctx.textAlign = 'left';
}

function drawList(ctx: Ctx, spec: StoryList) {
  const n = Math.max(spec.rows.length, 1);
  const gap = 14;
  const rowH = Math.min(124, Math.floor((CONTENT_BOTTOM - CONTENT_TOP - gap * (n - 1)) / n));
  spec.rows.forEach((row, i) => {
    const y = CONTENT_TOP + i * (rowH + gap);
    const medal = row.medal ? MEDAL_COLOR[row.medal] : null;
    roundRect(ctx, 60, y, W - 120, rowH, 28);
    ctx.fillStyle = medal ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)';
    ctx.fill();
    if (medal) { ctx.lineWidth = 3; ctx.strokeStyle = medal; ctx.stroke(); }

    const mid = y + rowH / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = font(900, Math.min(60, rowH * 0.5), true);
    ctx.fillStyle = medal ?? 'rgba(255,255,255,0.45)';
    ctx.fillText(String(row.rank), 130, mid);

    ctx.textAlign = 'right';
    ctx.font = font(900, Math.min(54, rowH * 0.44), true);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(row.value, W - 100, row.sub ? mid - rowH * 0.12 : mid);
    const valueW = ctx.measureText(row.value).width;

    ctx.textAlign = 'left';
    const textW = W - 100 - valueW - 230;
    ctx.font = font(800, Math.min(42, rowH * 0.36));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fit(ctx, row.name, textW), 190, row.sub ? mid - rowH * 0.15 : mid);
    if (row.sub) {
      ctx.font = font(500, Math.min(27, rowH * 0.23));
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(fit(ctx, row.sub, W - 190 - 100), 190, mid + rowH * 0.24);
    }
  });
  ctx.textBaseline = 'alphabetic';
}

function drawTable(ctx: Ctx, spec: StoryTable) {
  const labelW = 290;
  const cols = spec.columns.length;
  const colW = (W - 120 - labelW) / cols;
  const headH = 130;
  let y = CONTENT_TOP;

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  spec.columns.forEach((col, i) => {
    const cx = 60 + labelW + colW * i + colW / 2;
    ctx.fillStyle = col.color;
    ctx.fillRect(cx - colW / 2 + 8, y + headH - 10, colW - 16, 8);
    ctx.font = font(800, cols > 3 ? 28 : 34);
    ctx.fillStyle = '#ffffff';
    const [first, ...rest] = col.name.split(' ');
    ctx.fillText(fit(ctx, first, colW - 12), cx, y + 42);
    if (rest.length) {
      ctx.font = font(500, cols > 3 ? 22 : 26);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(fit(ctx, rest.join(' '), colW - 12), cx, y + 82);
    }
  });
  y += headH + 12;

  const rowH = Math.min(104, Math.floor((CONTENT_BOTTOM - 170 - y) / spec.rows.length));
  spec.rows.forEach((row, ri) => {
    const top = y + ri * rowH;
    roundRect(ctx, 60, top + 4, W - 120, rowH - 8, 20);
    ctx.fillStyle = ri % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = font(700, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(fit(ctx, row.label, labelW - 30), 84, top + rowH / 2);
    ctx.textAlign = 'center';
    row.values.forEach((value, ci) => {
      const cx = 60 + labelW + colW * ci + colW / 2;
      const isBest = row.best.includes(ci);
      if (isBest) {
        roundRect(ctx, cx - colW / 2 + 10, top + 12, colW - 20, rowH - 24, 16);
        ctx.fillStyle = `${spec.columns[ci].color}55`;
        ctx.fill();
      }
      ctx.font = font(isBest ? 900 : 700, cols > 3 ? 34 : 40, true);
      ctx.fillStyle = isBest ? '#ffffff' : 'rgba(255,255,255,0.85)';
      ctx.fillText(fit(ctx, value, colW - 16), cx, top + rowH / 2);
    });
  });

  let ly = y + spec.rows.length * rowH + 50;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(700, 32);
  for (const line of spec.lines) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(fit(ctx, line, W - 140), 72, ly);
    ly += 52;
  }
}

/** Desenha o Story e devolve o PNG. */
export async function renderStory(spec: StorySpec): Promise<Blob> {
  try {
    await Promise.all([800, 900, 600, 500].map((w) => document.fonts.load(`${w} 40px Inter`)));
  } catch { /* sem a fonte da página, o canvas usa a fonte do sistema */ }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu gerar a imagem.');
  background(ctx);
  header(ctx, spec);
  if (spec.kind === 'list') drawList(ctx, spec); else drawTable(ctx, spec);
  footer(ctx, spec.footnote);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
}
