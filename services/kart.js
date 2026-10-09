// Campeonato Viegas Kart: leitura do relatório de cronometragem (LapTime, Kartódromo de Betim) e regras de pontuação.
// Sem I/O: recebe o texto já extraído do PDF (services/pdfExtract.js). Só pilotos inscritos entram no campeonato.

/** Corrida oficial = 3 ou mais pilotos inscritos. O Notion diz "mais de 3", mas conta como válidas as corridas com exatamente 3 (ver docs/kart.md). */
export const MIN_OFFICIAL_PILOTS = 3;

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** '01:13.169' → 73169 (ms); null se não for um tempo de volta. */
export function parseLap(text) {
  const m = /^(\d{1,2}):(\d{2})\.(\d{3})$/.exec(String(text ?? '').trim());
  return m ? Number(m[1]) * 60000 + Number(m[2]) * 1000 + Number(m[3]) : null;
}

/** 73169 → '1:13.169'; '—' sem tempo. */
export function formatLap(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const min = Math.floor(ms / 60000);
  return `${min}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

const ROW = /^(\d+|NC)\s+(\d+)\s+(.+?)\s+(\d+)\s+(\d{2}:\d{2}\.\d{3})\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+.*?(\d+)\s+\d+,\d+(?:\s+[A-Z]{2})?$/;

/**
 * Lê o relatório de cronometragem. null = o texto não parece um relatório de corrida.
 * Retorna { date: 'YYYY-MM-DD', heat: 'Bateria 16:50', time: '16:50', rows: [{ racePos, kart, name, bestLapMs, laps }] }.
 * `racePos` null = NC (não classificado); esses pilotos ficam depois dos classificados.
 */
export function parseTimingReport(text) {
  const lines = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const dateLine = lines.find((l) => /^baterias?\s+\d{2}\/\d{2}\/\d{4}/i.test(l));
  const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dateLine ?? '');
  const rows = lines.map((l) => ROW.exec(l)).filter(Boolean).map((m) => ({
    racePos: m[1] === 'NC' ? null : Number(m[1]), kart: m[2], name: m[3].trim(), bestLapMs: parseLap(m[5]), laps: Number(m[6]),
  }));
  if (!d || rows.length === 0) return null;
  const heatLine = lines[lines.indexOf(dateLine) + 1] ?? '';
  const time = /\d{1,2}:\d{2}/.exec(heatLine)?.[0] ?? '';
  const heat = heatLine.replace(/\b\d{1,2}:\d{2}\b/, '').trim();
  const label = heat ? heat.charAt(0).toUpperCase() + heat.slice(1).toLowerCase() : 'Bateria';
  return { date: `${d[3]}-${d[2]}-${d[1]}`, heat: time ? `${label} ${time}` : label, time, rows };
}

const STOP = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
const tokens = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t && !STOP.has(t));

/**
 * Pilotos inscritos ({ id, name, aliases? }) que o nome do PDF representa: todos os termos do nome (ou de um apelido
 * cadastrado) precisam estar no nome completo. Vence quem casa mais termos; empate entre pilotos diferentes = null.
 */
export function matchPilot(pdfName, pilots) {
  const have = new Set(tokens(pdfName));
  const scored = pilots.map((pilot) => {
    const best = [pilot.name, ...(pilot.aliases ?? [])].map(tokens).filter((t) => t.length && t.every((x) => have.has(x)));
    return { pilot, score: Math.max(0, ...best.map((t) => t.length)) };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null;
  return scored[0].pilot;
}

/** Pontos pela posição entre os inscritos: 25, 22, 20, 19… (23 − posição a partir do 3º), mínimo 0. */
export const pointsFor = (pos) => (pos === 1 ? 25 : pos === 2 ? 22 : Math.max(0, 23 - pos));

/**
 * Separa quem é inscrito e reclassifica só entre eles (P9 na bateria e 1º entre os inscritos = P1).
 * Retorna { results: [{ pilotId, name, pos, racePos, bestLapMs, laps }], outsiders: string[] } (nomes do PDF que ficaram de fora).
 */
export function buildResults(rows, pilots) {
  const seen = new Set();
  const enrolled = [];
  const outsiders = [];
  for (const row of rows) {
    const pilot = matchPilot(row.name, pilots);
    if (pilot && !seen.has(pilot.id)) { seen.add(pilot.id); enrolled.push({ ...row, pilot }); } else outsiders.push(row.name);
  }
  enrolled.sort((a, b) => (a.racePos ?? Infinity) - (b.racePos ?? Infinity));
  const results = enrolled.map((r, i) => ({ pilotId: r.pilot.id, name: r.pilot.name, pos: i + 1, racePos: r.racePos, bestLapMs: r.bestLapMs, laps: r.laps }));
  return { results, outsiders };
}

export const isOfficial = (race) => (race.results?.length ?? 0) >= MIN_OFFICIAL_PILOTS;
