import { loadFonts } from './orders/inviteArtCanvas';

const W = 1080;
const H = 1920;
const LOGO_URL = '/images/icon-512.png';
const BG_URL = '/images/horarios-fundo.jpg';
export const SLOTS_COUNT = 6;
export interface SlotsArtInput { slots: { date: string; time: string }[]; priceLabel: string; durationMinutes: number }

const WEEKDAY = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)).replace('-feira', '').toUpperCase();
const DAY_MONTH = (key: string) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)).toUpperCase();

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Imagem não encontrada (${url}).`));
  img.src = url;
});

/** Story 1080x1920 com os próximos horários livres da Vídeo Chamada. O espaço vazio abaixo dos horários é do adesivo de link do Instagram. */
export async function renderSlotsArt({ slots, priceLabel, durationMinutes }: SlotsArtInput): Promise<Blob> {
  const [logo, photo] = await Promise.all([loadImage(LOGO_URL), loadImage(BG_URL), loadFonts()]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu gerar a imagem.');
  // Foto da cidade (recorte centralizado, preenchendo o Story) escurecida, com vinheta preta forte no topo e no fim para o texto ler bem.
  const scale = Math.max(W / photo.width, H / photo.height);
  ctx.drawImage(photo, (W - photo.width * scale) / 2, (H - photo.height * scale) / 2, photo.width * scale, photo.height * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, W, H);
  const vignette = ctx.createLinearGradient(0, 0, 0, H);
  vignette.addColorStop(0, 'rgba(0,0,0,0.92)');
  vignette.addColorStop(0.28, 'rgba(0,0,0,0.5)');
  vignette.addColorStop(0.6, 'rgba(0,0,0,0.1)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // Logo discreta no topo: aranha em círculo, como no menu do site.
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(W / 2, 175, 45, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logo, W / 2 - 56, 175 - 56, 112, 112);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '150px "League Gothic Italic"';
  ctx.fillText('VÍDEO CHAMADA', W / 2, 355);
  ctx.font = '70px "Bebas Neue"';
  ctx.fillText('HORÁRIOS DISPONÍVEIS', W / 2, 430);

  const rowH = 165;
  slots.slice(0, SLOTS_COUNT).forEach((slot, i) => {
    const y = 480 + i * (rowH + 14);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(90, y, W - 180, rowH, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '80px "Bebas Neue"';
    ctx.fillText(DAY_MONTH(slot.date), 140, y + 90);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '44px "Bebas Neue"';
    ctx.fillText(WEEKDAY(slot.date), 140, y + 138);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '115px "Bebas Neue"';
    ctx.fillText(slot.time, W - 140, y + 123);
  });

  // Entre y=1560 e y=1690 fica livre: é onde o adesivo de link do Instagram entra.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '52px "Bebas Neue"';
  ctx.fillText('HORÁRIO DE BRASÍLIA', W / 2, 1740);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${durationMinutes} MINUTOS · ${priceLabel}`, W / 2, 1800);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
}
