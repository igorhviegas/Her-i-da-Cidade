import { inviteLines, type InviteArtFields } from '../../../services/inviteArt.js';

// Story 1080 x 1920 sobre a arte base (sem textos). Medidas tiradas das artes feitas no Adobe Express (675 x 1200, x1,6).
const W = 1080;
const H = 1920;
export const INVITE_ART_URL = '/images/convite-arte.jpg';
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap';
const ITALIC_URL = '/fonts/league-gothic-italic.otf';
const ITALIC = '"League Gothic Italic"';
const UPRIGHT = '"Bebas Neue"';

type Ctx = CanvasRenderingContext2D;

const fontError = () => new Error('Não foi possível carregar as fontes da arte.');
let fontsReady: Promise<void> | null = null;
function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  const italic = new FontFace('League Gothic Italic', `url(${ITALIC_URL})`).load().then((face) => { document.fonts.add(face); });
  const upright = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    link.onload = () => resolve();
    link.onerror = () => reject(fontError());
    document.head.appendChild(link);
  }).then(() => document.fonts.load(`100px ${UPRIGHT}`));
  fontsReady = Promise.all([italic, upright]).then(() => {
    if (!document.fonts.check(`100px ${ITALIC}`) || !document.fonts.check(`100px ${UPRIGHT}`)) throw fontError();
  }, () => { throw fontError(); });
  fontsReady.catch(() => { fontsReady = null; });
  return fontsReady;
}

let artImage: Promise<HTMLImageElement> | null = null;
function loadArt(): Promise<HTMLImageElement> {
  artImage ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Arte base não encontrada (${INVITE_ART_URL}).`));
    img.src = INVITE_ART_URL;
  });
  artImage.catch(() => { artImage = null; });
  return artImage;
}

/** Tamanho de fonte em que a letra maiúscula tem `cap` px de altura, sem passar de `maxWidth`. */
function sizeFor(ctx: Ctx, family: string, text: string, cap: number, maxWidth: number): number {
  ctx.font = `100px ${family}`;
  const m = ctx.measureText(text || 'H');
  const capRatio = ctx.measureText('H').actualBoundingBoxAscent / 100;
  return Math.min(cap / capRatio, (maxWidth / Math.max(m.width, 1)) * 100);
}

/** Escreve com a base da letra em `baseline`, centralizando o desenho das letras (no itálico ele fica à direita do ponto de alinhamento). */
function draw(ctx: Ctx, text: string, family: string, size: number, baseline: number) {
  ctx.font = `${size}px ${family}`;
  const m = ctx.measureText(text);
  ctx.fillText(text, W / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, baseline);
}

const capOf = (ctx: Ctx, family: string, size: number) => { ctx.font = `${size}px ${family}`; return ctx.measureText('H').actualBoundingBoxAscent; };

/** Local: uma linha; se não couber, duas linhas (quebra no espaço mais perto do meio), subindo a partir da mesma base. */
function drawPlace(ctx: Ctx, place: string) {
  const maxWidth = 860;
  const cap = 67;
  const bottom = 1587;
  let lines = [place];
  if (sizeFor(ctx, UPRIGHT, place, cap, maxWidth) < 60 && place.includes(' ')) {
    const words = place.split(' ');
    let best = 1;
    for (let i = 1; i < words.length; i += 1) {
      if (Math.abs(words.slice(0, i).join(' ').length - place.length / 2) < Math.abs(words.slice(0, best).join(' ').length - place.length / 2)) best = i;
    }
    lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  const size = Math.min(...lines.map((line) => sizeFor(ctx, UPRIGHT, line, cap, maxWidth)));
  const step = capOf(ctx, UPRIGHT, size) * 1.4;
  lines.forEach((line, i) => draw(ctx, line, UPRIGHT, size, bottom - (lines.length - 1 - i) * step));
}

/** Nome + idade: bloco centralizado em y=520; o nome cresce até 283 px de altura ou 848 px de largura. */
function drawNameAndAge(ctx: Ctx, name: string, age: string) {
  const nameSize = sizeFor(ctx, ITALIC, name, 283, 848);
  const nameCap = name ? capOf(ctx, ITALIC, nameSize) : 0;
  const ageSize = sizeFor(ctx, ITALIC, age, 81, 848);
  const ageCap = age ? capOf(ctx, ITALIC, ageSize) : 0;
  const gap = name && age ? 88 : 0;
  const top = 520 - (nameCap + gap + ageCap) / 2;
  if (name) draw(ctx, name, ITALIC, nameSize, top + nameCap);
  if (age) draw(ctx, age, ITALIC, ageSize, top + nameCap + gap + ageCap);
}

/** Desenha a arte do convite e devolve o PNG. */
export async function renderInviteArt(fields: InviteArtFields): Promise<Blob> {
  const [img] = await Promise.all([loadArt(), loadFonts()]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu gerar a imagem.');
  ctx.drawImage(img, 0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const t = inviteLines(fields);

  ctx.letterSpacing = '2px'; // o título da arte original tem um leve espaçamento entre letras
  draw(ctx, 'CONVITE ESPETACULAR', ITALIC, sizeFor(ctx, ITALIC, 'CONVITE ESPETACULAR', 46, 860), 248);
  ctx.letterSpacing = '0px';
  drawNameAndAge(ctx, t.name, t.age);
  if (t.date) draw(ctx, t.date, UPRIGHT, sizeFor(ctx, UPRIGHT, t.date, 64, 860), 1003);
  if (t.time) draw(ctx, t.time, UPRIGHT, sizeFor(ctx, UPRIGHT, t.time, 64, 860), 1110);
  if (t.place) drawPlace(ctx, t.place);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
}
