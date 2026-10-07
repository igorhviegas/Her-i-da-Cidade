// Apple Saúde → Fit (puro, sem Firebase). Normaliza o JSON do Health Auto Export (versão 2, "Summarize Data" ligado)
// em um documento por dia. Só entra o que o Fit usa; qualquer outra métrica é descartada (guardar o mínimo necessário).

const DATE_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) [+-]\d{4}$/; // "2026-10-07 00:00:00 -0300": o dia é o LOCAL, nunca converta para UTC
const KM = { km: 1, m: 0.001, mi: 1.609344 };
const KCAL = { kcal: 1, kj: 0.239005736 };

// daily: valor somado pelo iOS no dia (só aceito às 00:00:00, ou seja, já resumido por dia). Peso não é somado: vale a última pesagem do dia.
const METRICS = {
  step_count: { field: 'steps', daily: true, units: { count: 1 }, decimals: 0, max: 200000 },
  walking_running_distance: { field: 'walkRunKm', daily: true, units: KM, decimals: 3, max: 500 },
  cycling_distance: { field: 'cyclingKm', daily: true, units: KM, decimals: 3, max: 1000 },
  active_energy: { field: 'activeKcal', daily: true, units: KCAL, decimals: 1, max: 20000 },
  basal_energy_burned: { field: 'basalKcal', daily: true, units: KCAL, decimals: 1, max: 20000 },
  apple_exercise_time: { field: 'exerciseMin', daily: true, units: { min: 1 }, decimals: 1, max: 1440 },
  weight_body_mass: { field: 'weightKg', daily: false, units: { kg: 1, lb: 0.45359237 }, decimals: 2, min: 20, max: 500 },
};

const round = (value, decimals) => Number(value.toFixed(decimals));

const FIELD_SPECS = Object.fromEntries(Object.values(METRICS).map((spec) => [spec.field, spec]));
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Envio simples de um dia, para o Atalho do iPhone (sem o Health Auto Export): { day: 'AAAA-MM-DD', steps, walkRunKm, weightKg, ... }.
 * Mesmos campos, unidades (km, kcal, kg, min) e limites do export do app. Aceita número ou texto numérico ("1,8" ou "1.8", como o
 * Atalhos às vezes formata). Campo desconhecido é descartado e contado; o que estiver fora do plausível, também (invalid).
 */
function parseDailyPush(body) {
  const day = typeof body.day === 'string' ? body.day : '';
  const real = DAY_RE.test(day) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day; // rejeita 2026-02-31
  if (!real) return null;
  const stats = { accepted: 0, ignoredMetrics: 0, invalid: 0 };
  const doc = {};
  for (const [field, raw] of Object.entries(body)) {
    if (field === 'day') continue;
    const spec = FIELD_SPECS[field];
    if (!spec) { stats.ignoredMetrics += 1; continue; }
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(',', '.')) : NaN;
    if (!Number.isFinite(value) || value < (spec.min ?? 0) || value > spec.max) { stats.invalid += 1; continue; }
    doc[spec.field] = round(value, spec.decimals);
    stats.accepted += 1;
  }
  return { days: Object.keys(doc).length ? { [day]: doc } : {}, stats, workouts: 0 };
}

/**
 * Retorna { days: { 'AAAA-MM-DD': { steps, walkRunKm, ... } }, stats, workouts } ou null se o corpo não for um export do app
 * (nem o envio simples de um dia do Atalho, tratado em parseDailyPush).
 * Dia sem dado fica sem o campo (ausente é diferente de zero). Registro inválido (data, unidade, valor fora do plausível ou
 * métrica diária não resumida) é descartado e contado em stats.invalid; nada é adivinhado.
 * ponytail: duas entradas somáveis no mesmo dia (ex.: iPhone e Watch separados) ficam com a maior, para não contar passos duas vezes.
 */
export function parseHealthExport(body) {
  const metrics = body?.data?.metrics;
  if (!Array.isArray(metrics)) return body && typeof body === 'object' && !Array.isArray(body) ? parseDailyPush(body) : null;
  const days = {};
  const weightDate = {};
  const stats = { accepted: 0, ignoredMetrics: 0, invalid: 0 };

  for (const metric of metrics) {
    const spec = METRICS[metric?.name];
    if (!spec) { stats.ignoredMetrics += 1; continue; }
    const factor = spec.units[String(metric.units).toLowerCase()];
    if (!factor || !Array.isArray(metric.data)) { stats.invalid += 1; continue; }

    for (const entry of metric.data) {
      const match = DATE_RE.exec(entry?.date);
      const value = typeof entry?.qty === 'number' ? entry.qty * factor : NaN;
      if (!match || !Number.isFinite(value) || value < (spec.min ?? 0) || value > spec.max || (spec.daily && match[2] !== '00:00:00')) { stats.invalid += 1; continue; }
      const [, day] = match;
      const doc = (days[day] ??= {});
      if (spec.daily) doc[spec.field] = round(Math.max(doc[spec.field] ?? 0, value), spec.decimals);
      else if (!(weightDate[day] >= entry.date)) { doc[spec.field] = round(value, spec.decimals); weightDate[day] = entry.date; }
      stats.accepted += 1;
    }
  }
  return { days, stats, workouts: Array.isArray(body.data.workouts) ? body.data.workouts.length : 0 };
}

export const FIT_DAILY_SOURCE = 'health-auto-export';
const BATCH_LIMIT = 400; // o Firestore aceita 500 escritas por lote

/**
 * Grava um documento por dia em users/{uid}/fitDaily/{dia} (merge: campos que não vieram neste envio são preservados;
 * os que vieram sobrescrevem, nunca somam: o dia de hoje chega parcial e depois completo). O uid vem do servidor, nunca do payload.
 */
export async function writeFitDaily(database, uid, days, now = new Date()) {
  const entries = Object.entries(days);
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = database.batch();
    for (const [day, fields] of entries.slice(i, i + BATCH_LIMIT)) {
      batch.set(database.collection('users').doc(uid).collection('fitDaily').doc(day), { ...fields, day, source: FIT_DAILY_SOURCE, updatedAt: now }, { merge: true });
    }
    await batch.commit();
  }
  return entries.length;
}

const typeName = (v) => (v === null ? 'nulo' : Array.isArray(v) ? 'lista' : { number: 'número', string: 'texto', boolean: 'booleano', object: 'objeto' }[typeof v] ?? typeof v);

/**
 * Explica por que um corpo não foi aceito, dizendo só o NOME e o TIPO de cada campo recebido, nunca o valor (é dado de saúde
 * e o token vai no cabeçalho). Serve para depurar o Atalho do iPhone, onde um campo no tipo errado é o erro mais comum.
 */
export function describeInvalidPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { message: 'O corpo precisa ser um JSON (objeto).', received: typeName(body) };
  const received = Object.fromEntries(Object.entries(body).slice(0, 20).map(([name, value]) => [name.slice(0, 40), typeName(value)]));
  const message = 'day' in body
    ? `O campo "day" precisa ser texto no formato AAAA-MM-DD (recebido: ${typeName(body.day)}${typeof body.day === 'string' ? ' fora do formato ou data inexistente' : ''}). No Atalhos, crie o campo como Texto.`
    : body.data ? 'Esperado o JSON do Health Auto Export (data.metrics).'
      : 'Faltou o campo "day" (texto AAAA-MM-DD) do envio simples ou o JSON do Health Auto Export (data.metrics).';
  return { message, received };
}
