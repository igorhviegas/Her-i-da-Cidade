// Classificações do Campeonato Viegas Kart. Sem I/O: recebe as corridas e os pilotos já carregados.
// corrida = { id, date: 'YYYY-MM-DD', heat, weather: 'dry' | 'rain', results: [{ pilotId, name, pos, racePos, bestLapMs, laps }] }
import { isOfficial, pointsFor } from './kart.js';

/** Quantas corridas oficiais mais recentes formam o ranking padrão. */
export const RECENT_RACES = 10;

/** Sessões fora do campeonato (não pontuam), da mais recente para a mais antiga. */
export const extraRaces = (races) => races.filter((r) => r.extra && r.results?.length).sort((a, b) => b.date.localeCompare(a.date) || String(b.heat).localeCompare(String(a.heat)));

/** Corridas oficiais em ordem cronológica, já numeradas ("Corrida 1" = a mais antiga). */
export function officialRaces(races) {
  return [...races]
    .filter(isOfficial)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.heat).localeCompare(String(b.heat)))
    .map((race, i) => ({ ...race, number: i + 1 }));
}

export const raceYears = (races) => [...new Set(officialRaces(races).map((r) => Number(r.date.slice(0, 4))))].sort((a, b) => b - a);

/**
 * Campeões por ano, do mais recente para o mais antigo: [{ year, races, done, top: [3 primeiros] }].
 * `done` = ano encerrado (anterior a `currentYear`): só nele o 1º lugar é campeão; o ano corrente mostra o líder.
 */
export function yearlyChampions(races, currentYear = new Date().getFullYear()) {
  return raceYears(races).map((year) => ({
    year, races: racesInScope(races, { type: 'year', year }).length, done: year < currentYear, top: standings(races, { type: 'year', year }).slice(0, 3),
  }));
}

/** Anos em que cada piloto foi campeão (só anos encerrados): Map pilotId → [anos, do mais recente]. */
export function titlesByPilot(champions) {
  const map = new Map();
  for (const c of champions) if (c.done && c.top[0]) map.set(c.top[0].pilotId, [...(map.get(c.top[0].pilotId) ?? []), c.year]);
  return map;
}

/** scope: { type: 'recent' } (últimas 10) | { type: 'all' } | { type: 'year', year }. */
export function racesInScope(races, scope = { type: 'recent' }) {
  const all = officialRaces(races);
  if (scope.type === 'all') return all;
  if (scope.type === 'year') return all.filter((r) => r.date.startsWith(String(scope.year)));
  return all.slice(-RECENT_RACES);
}

const byLap = (a, b) => (a.bestLapMs ?? Infinity) - (b.bestLapMs ?? Infinity);

/**
 * Classificação por pontos: [{ rank, pilotId, name, points, races, wins, podiums, bestLapMs }], só de quem correu no período.
 * Desempate: mais vitórias, depois melhor volta.
 */
export function standings(races, scope) {
  const byPilot = new Map();
  for (const race of racesInScope(races, scope)) {
    for (const r of race.results) {
      const row = byPilot.get(r.pilotId) ?? { pilotId: r.pilotId, name: r.name, points: 0, races: 0, wins: 0, podiums: 0, bestLapMs: null };
      row.name = r.name;
      row.points += pointsFor(r.pos);
      row.races += 1;
      row.wins += r.pos === 1 ? 1 : 0;
      row.podiums += r.pos <= 3 ? 1 : 0;
      if (r.bestLapMs && (row.bestLapMs === null || r.bestLapMs < row.bestLapMs)) row.bestLapMs = r.bestLapMs;
      byPilot.set(r.pilotId, row);
    }
  }
  return [...byPilot.values()]
    .sort((a, b) => b.points - a.points || b.wins - a.wins || byLap(a, b))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Corridas do período + sessões avulsas dentro do mesmo intervalo de datas (as avulsas valem só para a volta, nunca para pontos). */
function lapRaces(races, scope = { type: 'recent' }) {
  const champ = racesInScope(races, scope);
  const extras = extraRaces(races);
  if (scope.type === 'all') return [...champ, ...extras];
  if (scope.type === 'year') return [...champ, ...extras.filter((r) => r.date.startsWith(String(scope.year)))];
  return [...champ, ...extras.filter((r) => r.date >= (champ[0]?.date ?? ''))];
}

/**
 * Ranking de melhor volta: [{ rank, pilotId, name, bestLapMs, races, extras, wins, podiums, raceId, date, rain, extra }].
 * Inclui sessões avulsas; `races` conta só corridas do campeonato, `extras` as avulsas. Volta na chuva é sinalizada (`rain`).
 */
export function lapRanking(races, scope) {
  const table = new Map(standings(races, scope).map((s) => [s.pilotId, s]));
  const byPilot = new Map();
  for (const race of lapRaces(races, scope)) {
    for (const r of race.results) {
      const row = byPilot.get(r.pilotId) ?? { pilotId: r.pilotId, name: r.name, bestLapMs: null, races: 0, extras: 0, wins: 0, podiums: 0, raceId: '', date: '', rain: false, extra: false };
      if (race.extra) row.extras += 1; else row.races += 1;
      if (r.bestLapMs && (row.bestLapMs === null || r.bestLapMs < row.bestLapMs)) {
        Object.assign(row, { bestLapMs: r.bestLapMs, raceId: race.id, date: race.date, rain: race.weather === 'rain', extra: !!race.extra });
      }
      byPilot.set(r.pilotId, row);
    }
  }
  return [...byPilot.values()]
    .filter((r) => r.bestLapMs !== null)
    .map((r) => ({ ...r, wins: table.get(r.pilotId)?.wins ?? 0, podiums: table.get(r.pilotId)?.podiums ?? 0 }))
    .sort(byLap)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Recorde da pista no período (inclui sessões avulsas): a melhor volta em piso seco (na chuva o tempo não é comparável); null se não houver. */
export function trackRecord(races, scope) {
  return lapRanking(races, scope).filter((r) => !r.rain)[0] ?? null;
}

/**
 * Perfil do piloto. `medal` = 1, 2 ou 3 conforme a posição no ranking padrão (últimas 10 corridas), senão null.
 * `history` = todas as corridas oficiais dele, da mais recente para a mais antiga; `extras` = sessões fora do campeonato.
 * `record` = melhor volta dele em qualquer uma (campeonato ou avulsa).
 */
export function pilotProfile(pilotId, races, currentYear = new Date().getFullYear()) {
  const recent = standings(races, { type: 'recent' }).find((r) => r.pilotId === pilotId) ?? null;
  const overall = standings(races, { type: 'all' }).find((r) => r.pilotId === pilotId) ?? null;
  const history = officialRaces(races).flatMap((race) => {
    const r = race.results.find((x) => x.pilotId === pilotId);
    return r ? [{ raceId: race.id, number: race.number, date: race.date, heat: race.heat, weather: race.weather, pos: r.pos, points: pointsFor(r.pos), bestLapMs: r.bestLapMs, field: race.results.length }] : [];
  }).reverse();
  const extras = extraRaces(races).flatMap((race) => {
    const r = race.results.find((x) => x.pilotId === pilotId);
    return r ? [{ raceId: race.id, date: race.date, heat: race.heat, weather: race.weather, bestLapMs: r.bestLapMs, field: race.results.length }] : [];
  });
  const laps = [...history.map((h) => ({ raceId: h.raceId, date: h.date, bestLapMs: h.bestLapMs, extra: false })), ...extras.map((e) => ({ raceId: e.raceId, date: e.date, bestLapMs: e.bestLapMs, extra: true }))];
  const record = laps.filter((l) => l.bestLapMs).sort(byLap)[0] ?? null;
  return {
    medal: recent && recent.rank <= 3 ? recent.rank : null,
    recent, overall, history, extras, record,
    titles: titlesByPilot(yearlyChampions(races, currentYear)).get(pilotId) ?? [],
    recentPoints: recent?.points ?? 0, recentRaces: recent?.races ?? 0,
  };
}

/** Pontos que cada corrida do histórico rendeu, das últimas `RECENT_RACES` corridas do campeonato (para o gráfico do perfil). */
export function recentForm(pilotId, races) {
  return officialRaces(races).slice(-RECENT_RACES).map((race) => {
    const r = race.results.find((x) => x.pilotId === pilotId);
    return { raceId: race.id, number: race.number, points: r ? pointsFor(r.pos) : null, pos: r?.pos ?? null };
  });
}
