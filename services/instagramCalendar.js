// Calendário de publicações do Instagram (puro): monta o mês com os dias de publicação (feed e Reels) e o saldo diário de seguidores/visualizações.
import { dateKey, weekdayOf } from '../functions/missions-core.js';
import { campaignsOnDay } from './instagramPlanning.js';

/** Dias em Brasília. "Feed" = tudo que não é Reel (imagem, carrossel e vídeo de feed); o dia fica marcado com feed ou Reel (total). */
const isFeed = (post) => post.kind !== 'reel';

export const monthKeyOf = (dayKey) => dayKey.slice(0, 7);

/** Mês anterior/seguinte de 'YYYY-MM'. */
export function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const postDay = (post) => {
  const time = post.publishedAt ? Date.parse(post.publishedAt) : NaN;
  return Number.isNaN(time) ? null : dateKey(new Date(time));
};

/**
 * monthKey: 'YYYY-MM'; posts: publicações salvas (histórico, não só as da última sincronização); days: saldos diários
 * ({ day, followers, views, ... }); today: dia de hoje em Brasília. Semanas começam no domingo.
 * planning: saída de calendarEntries (planejamentos e etapas de campanha); só é anexada às células, nada é copiado/duplicado.
 * coverageStart: dia da publicação mais antiga conhecida; antes dele não dá para afirmar que não houve publicação.
 */
export function buildMonth({ monthKey, posts, days, today, planning }) {
  const byDay = new Map();
  let coverageStart = null;
  for (const post of posts) {
    const day = postDay(post);
    if (!day) continue;
    if (!coverageStart || day < coverageStart) coverageStart = day;
    const entry = byDay.get(day) ?? { feed: 0, reels: 0 };
    if (isFeed(post)) entry.feed += 1; else entry.reels += 1;
    byDay.set(day, entry);
  }
  const balances = new Map(days.map((d) => [d.day, d]));

  const [year, month] = monthKey.split('-').map(Number);
  const first = `${monthKey}-01`;
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array(weekdayOf(first)).fill(null);
  for (let n = 1; n <= length; n += 1) {
    const key = `${monthKey}-${String(n).padStart(2, '0')}`;
    const posted = byDay.get(key) ?? { feed: 0, reels: 0 };
    const balance = balances.get(key);
    cells.push({
      key, day: n, feed: posted.feed, reels: posted.reels, total: posted.feed + posted.reels,
      plans: planning?.byDay.get(key)?.plans ?? [], steps: planning?.byDay.get(key)?.steps ?? [], campaigns: planning ? campaignsOnDay(planning.spans, key) : [],
      followers: balance && typeof balance.followers === 'number' ? balance.followers : null,
      views: balance && typeof balance.views === 'number' ? balance.views : null,
      isToday: key === today, future: key > today, beforeCoverage: Boolean(coverageStart) && key < coverageStart,
    });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, coverageStart };
}

const full = new Intl.NumberFormat('pt-BR', { signDisplay: 'exceptZero' });
const trim = (n) => (n < 10 ? n.toFixed(1).replace('.', ',').replace(',0', '') : String(Math.round(n)));
/** Saldo curto para caber no quadradinho (+12k, +1,5M) e completo para a dica (+12.345). */
export function formatBalance(value, style = 'compact') {
  if (style !== 'compact') return full.format(value);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)}k`;
  return full.format(value);
}

/** Texto da dica (title) de um dia. */
export function describeDay(cell) {
  const [year, month, day] = cell.key.split('-');
  const parts = [`${day}/${month}/${year}`];
  if (!cell.total) parts.push('sem publicação');
  else {
    const detail = [cell.feed && `${cell.feed} no feed`, cell.reels && `${cell.reels} ${cell.reels === 1 ? 'Reel' : 'Reels'}`].filter(Boolean).join(' + ');
    parts.push(`${cell.total} ${cell.total === 1 ? 'publicação' : 'publicações'} (${detail})`);
  }
  if (cell.followers !== null) parts.push(`${formatBalance(cell.followers, 'full')} ${Math.abs(cell.followers) === 1 ? 'seguidor' : 'seguidores'}`);
  if (cell.views !== null) parts.push(`${formatBalance(cell.views, 'full')} visualizações`);
  return parts.join(' · ');
}
