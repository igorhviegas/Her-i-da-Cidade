// Conteúdo das imagens de compartilhamento (Story do Instagram). Só dados e textos, sem desenho: o canvas fica em components/kart/kartStoryCanvas.ts.
import { formatLap, pointsFor } from './kart.js';

export const SHARE_URL = 'heroidacidade.com/kart';
/** Quantas linhas cabem legíveis no Story. */
export const STORY_MAX_ROWS = 10;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const statsLine = (r) => `${plural(r.races, 'corrida', 'corridas')} · ${plural(r.wins, 'vitória', 'vitórias')} · ${plural(r.podiums, 'pódio', 'pódios')}`;

/**
 * Story do ranking. `lines` = linhas do ranking na tela ({ rank, name, races, wins, podiums, big, sub? });
 * `mode` 'points' | 'laps'; `periodLabel` já em texto (ex.: "Últimas 10 corridas").
 */
export function rankingStory({ mode, periodLabel, lines }) {
  const shown = lines.slice(0, STORY_MAX_ROWS);
  return {
    kind: 'list',
    kicker: 'Ranking',
    title: mode === 'points' ? 'Pontos' : 'Melhor volta',
    subtitle: periodLabel,
    rows: shown.map((l) => ({ rank: l.rank, name: l.name, value: mode === 'points' ? `${l.big} pts` : l.big, sub: statsLine(l), medal: l.rank <= 3 ? l.rank : null })),
    footnote: lines.length > shown.length ? `+${lines.length - shown.length} no ranking completo` : '',
  };
}

/** Story de uma corrida. `subtitle` já em texto (data, bateria, pista). Sessão avulsa não mostra pontos. */
export function raceStory({ race, title, subtitle }) {
  const scored = !race.extra;
  const shown = race.results.slice(0, STORY_MAX_ROWS + 2);
  return {
    kind: 'list',
    kicker: scored ? 'Resultado' : 'Fora do campeonato',
    title,
    subtitle,
    rows: shown.map((r) => ({ rank: r.pos, name: r.name, value: formatLap(r.bestLapMs), sub: scored ? `${pointsFor(r.pos)} pontos` : '', medal: scored && r.pos <= 3 ? r.pos : null })),
    footnote: !scored ? 'Não conta para o campeonato: vale só para o recorde de volta' : race.results.length > shown.length ? `+${race.results.length - shown.length} pilotos no resultado completo` : '',
  };
}

const METRICS = [
  ['points', 'Pontos', (p) => String(p.points)],
  ['races', 'Corridas', (p) => String(p.races)],
  ['wins', 'Vitórias', (p) => String(p.wins)],
  ['podiums', 'Pódios', (p) => String(p.podiums)],
  ['pointsPerRace', 'Pontos/corrida', (p) => (p.pointsPerRace === null ? '—' : String(p.pointsPerRace).replace('.', ','))],
  ['avgPos', 'Posição média', (p) => (p.avgPos === null ? '—' : `P${String(p.avgPos).replace('.', ',')}`)],
  ['bestLapMs', 'Melhor volta', (p) => formatLap(p.bestLapMs)],
];

/** Story do confronto: uma coluna por piloto (`colors` na mesma ordem), a melhor de cada linha em destaque e os duelos embaixo. */
export function compareStory({ comparison, colors, periodLabel }) {
  const { pilots, duels, best, together } = comparison;
  const nameOf = (id) => pilots.find((p) => p.pilotId === id)?.name ?? id;
  return {
    kind: 'table',
    kicker: 'Confronto direto',
    title: pilots.map((p) => p.name.split(' ')[0]).join(' × '),
    subtitle: periodLabel,
    columns: pilots.map((p, i) => ({ name: p.name, color: colors[i % colors.length] })),
    rows: METRICS.map(([key, label, format]) => ({ label, values: pilots.map(format), best: pilots.map((p, i) => (best[key].includes(p.pilotId) ? i : -1)).filter((i) => i >= 0) })),
    lines: [
      ...duels.map((d) => `${nameOf(d.a)} ${d.aWins} × ${d.bWins} ${nameOf(d.b)} · ${plural(d.together, 'corrida junta', 'corridas juntas')}`),
      ...(pilots.length > 2 ? [`${plural(together, 'corrida com todos', 'corridas com todos')}`] : []),
    ],
    footnote: '',
  };
}
