// Confronto direto entre pilotos. Sem I/O: recebe as corridas já carregadas (com os nomes atuais dos pilotos).
import { lapRanking, racesInScope, standings } from './kartRanking.js';

/** Quantos pilotos cabem no confronto (a tela fica legível no celular). */
export const MAX_COMPARE = 5;

const sum = (list) => list.reduce((a, b) => a + b, 0);

/** Ids que lideram cada métrica (empates entram todos); métrica em que todos empatam, ou que ninguém tem, fica vazia. */
function leaders(pilots) {
  const pick = (key, dir) => {
    const values = pilots.map((p) => [p.pilotId, p[key]]).filter(([, v]) => v !== null && v !== undefined);
    if (values.length < 2) return [];
    const best = dir === 'max' ? Math.max(...values.map(([, v]) => v)) : Math.min(...values.map(([, v]) => v));
    const winners = values.filter(([, v]) => v === best).map(([id]) => id);
    return winners.length === values.length ? [] : winners;
  };
  return { points: pick('points', 'max'), races: pick('races', 'max'), wins: pick('wins', 'max'), podiums: pick('podiums', 'max'), pointsPerRace: pick('pointsPerRace', 'max'), avgPos: pick('avgPos', 'min'), bestLapMs: pick('bestLapMs', 'min') };
}

/**
 * Compara pilotos no período (`scope` como em kartRanking.js; padrão: todo o período).
 * `names` = Map pilotId → nome. Retorna:
 *  - pilots: [{ pilotId, name, races, wins, podiums, points, pointsPerRace, avgPos, bestLapMs }]
 *  - duels: [{ a, b, aWins, bWins, together }] para cada par (só corridas do campeonato em que os dois correram)
 *  - common: corridas em que 2 ou mais dos escolhidos correram: [{ raceId, number, date, positions: [pos | null por piloto] }] (mais recentes primeiro)
 *  - together: quantas corridas tiveram TODOS os escolhidos
 *  - best: ids que lideram cada métrica
 */
export function comparePilots(races, pilotIds, names = new Map(), scope = { type: 'all' }) {
  const ids = [...new Set(pilotIds)].slice(0, MAX_COMPARE);
  const scoped = racesInScope(races, scope);
  const table = new Map(standings(races, scope).map((s) => [s.pilotId, s]));
  const laps = new Map(lapRanking(races, scope).map((l) => [l.pilotId, l]));
  const posIn = (race, id) => race.results.find((r) => r.pilotId === id)?.pos ?? null;

  const pilots = ids.map((id) => {
    const s = table.get(id);
    const positions = scoped.map((race) => posIn(race, id)).filter((p) => p !== null);
    return {
      pilotId: id, name: names.get(id) ?? s?.name ?? id,
      races: s?.races ?? 0, wins: s?.wins ?? 0, podiums: s?.podiums ?? 0, points: s?.points ?? 0,
      pointsPerRace: s ? Math.round((s.points / s.races) * 10) / 10 : null,
      avgPos: positions.length ? Math.round((sum(positions) / positions.length) * 10) / 10 : null,
      bestLapMs: laps.get(id)?.bestLapMs ?? null,
    };
  });

  const duels = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const duel = { a: ids[i], b: ids[j], aWins: 0, bWins: 0, together: 0 };
      for (const race of scoped) {
        const [pa, pb] = [posIn(race, ids[i]), posIn(race, ids[j])];
        if (pa === null || pb === null) continue;
        duel.together += 1;
        if (pa < pb) duel.aWins += 1; else duel.bWins += 1;
      }
      duels.push(duel);
    }
  }

  const common = scoped
    .map((race) => ({ raceId: race.id, number: race.number, date: race.date, positions: ids.map((id) => posIn(race, id)) }))
    .filter((row) => row.positions.filter((p) => p !== null).length >= 2)
    .reverse();
  const together = common.filter((row) => row.positions.every((p) => p !== null)).length;

  return { pilots, duels, common, together, best: leaders(pilots) };
}
