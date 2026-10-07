// Pedalada a partir de um arquivo FIT (puro, sem React/Firebase). Entrada: a saída do fit-file-parser em mode 'list'.
//
// Regras tiradas de FIT reais do MyWhoosh (iPhone + sensor XOSS via QZ Fitness):
// - o resumo da sessão não é confiável (avg_speed veio 0 num treino de 265 m; max_speed não existe): tudo é recalculado dos registros;
// - zero em FC/potência/calorias significa "sem dado" (sem cinta nem medidor), então esses campos nem são lidos;
// - GPS e altitude são do mundo virtual, não do lugar real: ignorados;
// - o número de série é do aparelho (igual em todos os treinos): a identidade do treino é fabricante + série + time_created.

const MOVING_MS = 0.5; // m/s (1,8 km/h): abaixo disso conta como parado
const MAX_GAP_S = 10;   // intervalo entre registros acima disso não conta como tempo em movimento (pausa)
const round = (value, decimals) => Number(value.toFixed(decimals));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const time = (value) => new Date(value).getTime();

/** Retorna { id, ride } ou { error } (mensagem para o usuário). `id` é determinístico: importar o mesmo arquivo de novo cai no mesmo documento. */
export function summarizeRide(parsed) {
  const file = parsed?.file_ids?.[0];
  const session = parsed?.sessions?.[0];
  const records = (parsed?.records ?? []).filter((r) => Number.isFinite(time(r.timestamp)));
  if (!file || !session) return { error: 'O arquivo não é uma atividade FIT (sem identificação ou sem sessão).' };
  if (session.sport !== 'cycling') return { error: `Só pedaladas por enquanto (o arquivo é de "${session.sport ?? 'esporte desconhecido'}").` };
  const startedAt = new Date(session.start_time);
  const created = new Date(file.time_created);
  if (!finite(startedAt.getTime()) || !finite(created.getTime()) || !file.manufacturer || !finite(file.serial_number)) return { error: 'O arquivo não traz fabricante, série e data de criação para identificar o treino.' };
  if (!records.length) return { error: 'O arquivo não tem registros de velocidade.' };

  let moving = 0;
  records.forEach((r, i) => {
    const next = records[i + 1];
    const dt = next ? Math.min((time(next.timestamp) - time(r.timestamp)) / 1000, MAX_GAP_S) : 0;
    if (r.speed > MOVING_MS && dt > 0) moving += dt;
  });
  const lastDistance = records.map((r) => r.distance).filter(finite).at(-1);
  const distanceM = finite(session.total_distance) && session.total_distance > 0 ? session.total_distance : lastDistance;
  const elapsed = finite(session.total_elapsed_time) && session.total_elapsed_time > 0 ? session.total_elapsed_time : (time(records.at(-1).timestamp) - time(records[0].timestamp)) / 1000;
  if (!finite(distanceM) || distanceM <= 0 || moving <= 0 || !(elapsed > 0)) return { error: 'O treino não tem distância ou movimento.' };

  const speeds = records.map((r) => r.speed).filter(finite);
  const pedaling = records.map((r) => r.cadence).filter((c) => finite(c) && c > 0);
  const stamp = created.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const id = `${file.manufacturer}_${file.serial_number}_${stamp}`.replace(/[^A-Za-z0-9_-]/g, '');
  return {
    id,
    ride: {
      source: String(file.manufacturer),
      sourceKey: id,
      sport: 'cycling',
      virtual: session.sub_sport === 'virtual_activity',
      startedAt,
      durationSec: Math.round(elapsed),
      movingSec: Math.round(moving),
      distanceKm: round(distanceM / 1000, 3),
      avgSpeedKmh: round((distanceM / moving) * 3.6, 2), // média em movimento (como o Strava), não sobre o tempo total
      maxSpeedKmh: round(Math.max(...speeds) * 3.6, 1),
      // cadência máxima fica de fora: tem picos de ruído (153 rpm com p99 de 127). A média só conta o tempo pedalando.
      ...(pedaling.length ? { avgCadenceRpm: Math.round(pedaling.reduce((s, c) => s + c, 0) / pedaling.length) } : {}),
    },
  };
}

/** km por dia, alinhado a `days` ('AAAA-MM-DD' em ordem); dia sem pedalada = null (não é zero). `dayOf` converte a data de início no dia local. */
export function kmByDay(days, rides, dayOf) {
  const totals = new Map();
  for (const ride of rides) { const day = dayOf(ride.startedAt); totals.set(day, (totals.get(day) ?? 0) + ride.distanceKm); }
  return days.map((day) => (totals.has(day) ? totals.get(day) : null));
}

/** Totais de um conjunto de pedaladas; a velocidade média é ponderada pelo tempo em movimento (não a média das médias). */
export function summarizeRides(rides) {
  const km = rides.reduce((s, r) => s + r.distanceKm, 0);
  const movingSec = rides.reduce((s, r) => s + r.movingSec, 0);
  return { count: rides.length, km, movingSec, avgSpeedKmh: movingSec > 0 ? km / (movingSec / 3600) : null };
}

/** 625 -> "10min 25s"; 3725 -> "1h 02min". */
export function formatDuration(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min ${String(s % 60).padStart(2, '0')}s`;
}
