import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildResults, formatLap, isOfficial, matchPilot, parseLap, parseLapInput, parseTimingReport, pointsFor } from './kart.js';
import { DEFAULT_KART_PILOTS } from './kartPilots.js';
import { comparePilots } from './kartCompare.js';
import { compareStory, raceStory, rankingStory } from './kartShare.js';
import { lapHistory, lapRanking, officialRaces, pilotProfile, standings, titlesByPilot, trackRecord, yearlyChampions } from './kartRanking.js';
import { videosByRace, youtubeId } from './kartVideos.js';
import { daysUntil, todayInBrazil, upcomingRace } from './kartNext.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const r2025 = parseTimingReport(fixture('kart-timing-2025-07-12.txt'));
const r2024 = parseTimingReport(fixture('kart-timing-2024-10-05.txt'));

test('tempos de volta: leitura e formatação', () => {
  assert.equal(parseLap('01:13.169'), 73169);
  assert.equal(parseLap('lixo'), null);
  assert.equal(formatLap(73169), '1:13.169');
  assert.equal(formatLap(null), '—');
});

test('tempo digitado à mão aceita os formatos comuns e recusa lixo', () => {
  assert.deepEqual(['1:13.169', '1.13.169', '1:13,169', '1:14.20', ' 1:11.3 '].map(parseLapInput), [73169, 73169, 73169, 74200, 71300]);
  assert.deepEqual(['', '1:75.000', 'abc', '73'].map(parseLapInput), [null, null, null, null]);
});

test('pontos: 25, 22, 20, 19… até 0', () => {
  assert.deepEqual([1, 2, 3, 4, 10, 20, 22, 23, 30].map(pointsFor), [25, 22, 20, 19, 13, 3, 1, 0, 0]);
});

test('lê os dois formatos do relatório (TimingOfficialReport e CRD), inclusive NC', () => {
  assert.equal(r2025.date, '2025-07-12');
  assert.equal(r2025.heat, 'Bateria 16:50');
  assert.equal(r2025.rows.length, 34);
  assert.deepEqual(r2025.rows[2], { racePos: 3, kart: '55', name: 'IGOR VIEGAS', bestLapMs: 73169, laps: 16 });
  assert.equal(r2025.rows.at(-1).racePos, null);
  assert.equal(r2024.date, '2024-10-05');
  assert.equal(r2024.rows.length, 30);
  assert.equal(r2024.rows[0].bestLapMs, 74420);
  assert.equal(parseTimingReport('qualquer texto'), null);
});

test('casa o nome do PDF com o piloto inscrito e ignora quem não é', () => {
  const m = (n) => matchPilot(n, DEFAULT_KART_PILOTS)?.name ?? null;
  assert.equal(m('IGOR HENRIQUES VIEGAS'), 'Igor Viegas');
  assert.equal(m('ÁDANY KELLY DE ASSIS'), 'Adany');
  assert.equal(m('VITOR MANCIO FONSECA'), 'Vitor Mancio');
  assert.equal(m('VANDER JUNIOR'), 'Vander Jr');
  assert.equal(m('MATEUS DE REZENDE'), 'Mateus de Rezende');
  assert.equal(m('LARISSA LAURENCE DOS SANTOS'), null);
  assert.equal(m('SALUN MARVIN PIRES BENTO'), null);
});

test('reclassifica só entre inscritos: P3 na bateria pode ser P1 no campeonato', () => {
  const { results, outsiders } = buildResults(r2025.rows, DEFAULT_KART_PILOTS);
  assert.equal(results.length, 10);
  assert.equal(outsiders.length, 24);
  assert.ok(outsiders.includes('SALUN MARVIN PIRES BENTO'));
  assert.deepEqual(results.slice(0, 3).map((r) => [r.name, r.pos, r.racePos]), [['Igor Viegas', 1, 3], ['Lemuel', 2, 6], ['Vitor Mancio', 3, 10]]);
  assert.equal(isOfficial({ results }), true);
  assert.equal(isOfficial({ results: results.slice(0, 2) }), false);
});

const race = (id, date, weather, order, laps = {}) => ({
  id, date, heat: 'Bateria 10:00', weather,
  results: order.map((name, i) => ({ pilotId: name, name, pos: i + 1, racePos: i + 1, bestLapMs: laps[name] ?? 80000 + i, laps: 16 })),
});

test('ranking padrão = últimas 10 corridas; "todo período" e ano somam mais; cada linha traz o nº de corridas', () => {
  const races = Array.from({ length: 12 }, (_, i) => race(`r${i}`, `${i < 4 ? 2025 : 2026}-01-${String(i + 1).padStart(2, '0')}`, 'dry', ['ana', 'bia', 'caio']));
  const recent = standings(races);
  assert.equal(recent[0].races, 10);
  assert.equal(recent[0].points, 250);
  assert.equal(standings(races, { type: 'all' })[0].points, 300);
  const y2025 = standings(races, { type: 'year', year: 2025 });
  assert.deepEqual([y2025[0].races, y2025[0].points], [4, 100]);
  assert.equal(officialRaces(races)[0].number, 1);
});

test('melhor volta: ordena por tempo, marca chuva e o recorde da pista só vale no seco', () => {
  const races = [
    race('a', '2025-01-01', 'dry', ['ana', 'bia', 'caio'], { ana: 75000, bia: 74000 }),
    race('b', '2025-02-01', 'rain', ['ana', 'bia', 'caio'], { caio: 70000 }),
  ];
  const laps = lapRanking(races, { type: 'all' });
  assert.deepEqual(laps.map((l) => [l.name, l.bestLapMs, l.rain, l.races]), [['caio', 70000, true, 2], ['bia', 74000, false, 2], ['ana', 75000, false, 2]]);
  assert.equal(trackRecord(races, { type: 'all' }).name, 'bia');
});

test('perfil: medalha vem do ranking padrão; histórico do mais novo para o mais antigo', () => {
  const races = [race('a', '2025-01-01', 'dry', ['ana', 'bia', 'caio', 'dedé']), race('b', '2025-02-01', 'dry', ['bia', 'ana', 'caio', 'dedé'])];
  assert.equal(pilotProfile('ana', races).medal, 1);
  assert.equal(pilotProfile('ana', races).history.map((h) => h.raceId).join(), 'b,a');
  assert.equal(pilotProfile('dedé', races).medal, null);
  assert.equal(pilotProfile('ninguém', races).history.length, 0);
});

test('link do YouTube: vários formatos', () => {
  const id = 'dQw4w9WgXcQ';
  for (const url of [`https://www.youtube.com/watch?v=${id}&t=3s`, `https://youtu.be/${id}?si=x`, `https://www.youtube.com/shorts/${id}`, `youtube.com/embed/${id}`, id]) assert.equal(youtubeId(url), id);
  assert.equal(youtubeId('https://vimeo.com/123'), '');
  assert.equal(youtubeId(''), '');
});

const extra = (id, date, order, laps, weather = 'dry') => ({ ...race(id, date, weather, order, laps), extra: true });

test('sessão avulsa não pontua nem vira corrida oficial, mas entra no ranking de volta e no recorde', () => {
  const races = [race('a', '2025-01-01', 'dry', ['ana', 'bia', 'caio'], { ana: 75000, bia: 74000, caio: 76000 }), extra('x', '2025-03-01', ['ana'], { ana: 72000 })];
  assert.equal(isOfficial(races[1]), false);
  assert.equal(officialRaces(races).length, 1);
  assert.equal(standings(races, { type: 'all' })[0].points, 25); // só a corrida do campeonato
  const laps = lapRanking(races, { type: 'all' });
  assert.deepEqual(laps.slice(0, 2).map((l) => [l.name, l.bestLapMs, l.extra, l.races, l.extras, l.wins, l.podiums]), [['ana', 72000, true, 1, 1, 1, 1], ['bia', 74000, false, 1, 0, 0, 1]]);
  assert.equal(trackRecord(races, { type: 'all' }).name, 'ana');
});

test('ranking padrão de volta só junta avulsas a partir da primeira corrida do período; por ano filtra pela data', () => {
  const races = [
    extra('old', '2024-01-01', ['bia'], { bia: 60000 }),
    race('a', '2025-01-01', 'dry', ['ana', 'bia', 'caio']), extra('new', '2025-06-01', ['caio'], { caio: 70000 }),
  ];
  assert.deepEqual(lapRanking(races).map((l) => l.name), ['caio', 'ana', 'bia']); // a avulsa de 2024 fica fora das "últimas 10"
  assert.equal(lapRanking(races, { type: 'all' })[0].name, 'bia');
  assert.equal(lapRanking(races, { type: 'year', year: 2024 })[0].name, 'bia');
});

test('perfil: sessões avulsas aparecem à parte e o recorde considera todas', () => {
  const races = [race('a', '2025-01-01', 'dry', ['ana', 'bia', 'caio'], { ana: 75000 }), extra('x', '2025-03-01', ['ana'], { ana: 72000 })];
  const p = pilotProfile('ana', races);
  assert.equal(p.history.length, 1);
  assert.deepEqual(p.extras.map((e) => [e.raceId, e.bestLapMs]), [['x', 72000]]);
  assert.deepEqual([p.record.bestLapMs, p.record.extra], [72000, true]);
});

test('campeões por ano: só ano encerrado dá título; o ano corrente mostra o líder', () => {
  const races = [
    race('a', '2024-01-01', 'dry', ['ana', 'bia', 'caio']), race('b', '2024-02-01', 'dry', ['ana', 'caio', 'bia']),
    race('c', '2025-01-01', 'dry', ['bia', 'ana', 'caio']), race('d', '2026-01-01', 'dry', ['caio', 'bia', 'ana']),
  ];
  const champs = yearlyChampions(races, 2026);
  assert.deepEqual(champs.map((c) => [c.year, c.races, c.done, c.top[0].pilotId]), [[2026, 1, false, 'caio'], [2025, 1, true, 'bia'], [2024, 2, true, 'ana']]);
  assert.deepEqual([...titlesByPilot(champs)], [['bia', [2025]], ['ana', [2024]]]);
  assert.deepEqual(pilotProfile('ana', races, 2026).titles, [2024]);
  assert.deepEqual(pilotProfile('caio', races, 2026).titles, []);
});

test('vídeo da corrida: só ativo, com link, o primeiro pela ordem', () => {
  const v = (id, raceId, order, active = true, youtubeId = 'abcdefghijk') => ({ id, raceId, order, active, youtubeId, title: id, kind: 'race' });
  const map = videosByRace([v('b', 'r1', 2), v('a', 'r1', 1), v('off', 'r2', 1, false), v('none', '', 1), v('nolink', 'r3', 1, true, '')]);
  assert.deepEqual([...map.keys()], ['r1']);
  assert.equal(map.get('r1').id, 'a');
});

test('próxima corrida: contagem regressiva em dias e some depois da data', () => {
  assert.deepEqual([daysUntil('2026-12-12', '2026-12-03'), daysUntil('2026-12-12', '2026-12-12'), daysUntil('2027-01-01', '2026-12-31'), daysUntil('2026-12-01', '2026-12-02')], [9, 0, 1, -1]);
  assert.deepEqual(['2026-12-12', '2026-12-11', '2026-12-10'].map((t) => upcomingRace({ date: '2026-12-12' }, t).countdown), ['hoje', 'amanhã', 'em 2 dias']);
  assert.deepEqual(upcomingRace({ date: '2026-12-12', time: '15:30', place: 'Betim' }, '2026-12-03'), { date: '2026-12-12', time: '15:30', place: 'Betim', note: '', days: 9, countdown: 'em 9 dias' });
  assert.equal(upcomingRace({ date: '2026-12-12' }, '2026-12-13'), null);
  assert.equal(upcomingRace({ date: 'lixo' }, '2026-12-01'), null);
  assert.equal(upcomingRace(null), null);
  assert.match(todayInBrazil(new Date('2026-10-10T01:00:00Z')), /^2026-10-09$/); // 22h de Brasília ainda é dia 9
});

test('evolução da volta: marca recorde pessoal só em pista seca e inclui avulsas', () => {
  const races = [
    race('a', '2025-01-01', 'dry', ['ana', 'bia', 'caio'], { ana: 80000 }),
    race('b', '2025-02-01', 'rain', ['ana', 'bia', 'caio'], { ana: 70000 }), // chuva nunca é recorde
    race('c', '2025-03-01', 'dry', ['ana', 'bia', 'caio'], { ana: 82000 }),
    extra('x', '2025-04-01', ['ana'], { ana: 78000 }),
  ];
  assert.deepEqual(lapHistory(races, 'ana').map((l) => [l.raceId, l.ms, l.rain, l.extra, l.pb]), [['a', 80000, false, false, true], ['b', 70000, true, false, false], ['c', 82000, false, false, false], ['x', 78000, false, true, true]]);
  assert.deepEqual(lapHistory(races, 'ninguém'), []);
});

test('confronto: estatísticas, duelos só onde os dois correram, líderes por métrica', () => {
  const races = [
    race('a', '2025-01-01', 'dry', ['ana', 'bia', 'caio'], { ana: 74000, bia: 75000, caio: 76000 }),
    race('b', '2025-02-01', 'dry', ['bia', 'ana', 'dedé'], { ana: 73000, bia: 75500 }),
    race('c', '2025-03-01', 'dry', ['ana', 'caio', 'dedé']),
    race('d', '2025-04-01', 'dry', ['bia', 'caio', 'dedé']),
  ];
  const names = new Map([['ana', 'Ana'], ['bia', 'Bia']]);
  const c = comparePilots(races, ['ana', 'bia', 'ana'], names); // duplicado é ignorado
  assert.deepEqual(c.pilots.map((p) => [p.name, p.races, p.wins, p.podiums, p.points, p.avgPos, p.bestLapMs]), [['Ana', 3, 2, 3, 25 + 22 + 25, 1.3, 73000], ['Bia', 3, 2, 3, 22 + 25 + 25, 1.3, 75000]]);
  assert.deepEqual(c.duels, [{ a: 'ana', b: 'bia', aWins: 1, bWins: 1, together: 2 }]);
  assert.equal(c.together, 2);
  assert.deepEqual(c.common.map((r) => [r.number, r.positions]), [[2, [2, 1]], [1, [1, 2]]]);
  assert.deepEqual([c.best.points, c.best.avgPos, c.best.races, c.best.bestLapMs], [[], [], [], ['ana']]); // empate total = ninguém destacado; só a volta decide
});

test('Story: ranking limita a 10 linhas, texto de pontos/volta e avisa quantos ficaram de fora', () => {
  const lines = Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, name: `P${i + 1}`, races: 1, wins: i === 0 ? 1 : 0, podiums: i < 3 ? 1 : 0, big: i === 0 ? '25' : '1' }));
  const story = rankingStory({ mode: 'points', periodLabel: 'Últimas 10 corridas', lines });
  assert.equal(story.rows.length, 10);
  assert.deepEqual([story.rows[0].value, story.rows[0].sub, story.rows[0].medal, story.rows[3].medal], ['25 pts', '1 corrida · 1 vitória · 1 pódio', 1, null]);
  assert.equal(story.footnote, '+2 no ranking completo');
  assert.equal(rankingStory({ mode: 'laps', periodLabel: 'x', lines: [{ ...lines[0], big: '1:10.358' }] }).rows[0].value, '1:10.358');
});

test('Story: corrida mostra pontos e a avulsa avisa que não conta', () => {
  const r = race('a', '2026-01-01', 'dry', ['ana', 'bia', 'caio'], { ana: 74000 });
  const scored = raceStory({ race: r, title: 'Corrida 3', subtitle: 'x' });
  assert.deepEqual([scored.kicker, scored.rows[0].value, scored.rows[0].sub, scored.rows[1].sub, scored.footnote], ['Resultado', '1:14.000', '25 pontos', '22 pontos', '']);
  const avulsa = raceStory({ race: { ...r, extra: true }, title: 'Sessão avulsa', subtitle: 'x' });
  assert.deepEqual([avulsa.kicker, avulsa.rows[0].sub, avulsa.rows[0].medal], ['Fora do campeonato', '', null]);
  assert.match(avulsa.footnote, /não conta/i);
});

test('Story: confronto destaca a melhor célula e resume os duelos', () => {
  const races = [race('a', '2025-01-01', 'dry', ['ana', 'bia', 'caio'], { ana: 74000, bia: 75000 }), race('b', '2025-02-01', 'dry', ['bia', 'ana', 'caio'], { ana: 73000, bia: 75500 })];
  const story = compareStory({ comparison: comparePilots(races, ['ana', 'bia'], new Map([['ana', 'Ana Silva'], ['bia', 'Bia']])), colors: ['#f00', '#00f'], periodLabel: 'Todo o período' });
  assert.equal(story.title, 'Ana × Bia');
  assert.deepEqual(story.rows.find((r) => r.label === 'Melhor volta'), { label: 'Melhor volta', values: ['1:13.000', '1:15.000'], best: [0] });
  assert.deepEqual(story.lines, ['Ana Silva 1 × 1 Bia · 2 corridas juntas']);
});
