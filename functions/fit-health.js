// Atalho do iPhone → Fit (puro, sem Firebase). O Atalhos manda um dia por requisição: { day, steps, walkRunKm, weightKg, ... }.
// Só entra o que o Fit usa; qualquer outro campo é descartado (guardar o mínimo necessário).

// Campos aceitos, com unidade fixa (km, kcal, kg, min) e limites plausíveis.
const FIELD_SPECS = {
  steps: { decimals: 0, max: 200000 },
  walkRunKm: { decimals: 3, max: 500 },
  cyclingKm: { decimals: 3, max: 1000 },
  activeKcal: { decimals: 1, max: 20000 },
  basalKcal: { decimals: 1, max: 20000 },
  exerciseMin: { decimals: 1, max: 1440 },
  weightKg: { decimals: 2, min: 20, max: 500 },
};

const round = (value, decimals) => Number(value.toFixed(decimals));
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Extrai AAAA-MM-DD do texto que o Atalhos manda: ignora marcas invisíveis do iOS (U+200E, U+2066…), espaços e quebras de linha em volta,
 * aceita data seguida de hora ("2026-10-07 19:06", "2026-10-07T19:06:00-03:00") e DD/MM/AAAA (o padrão do iPhone no Brasil).
 * Qualquer outra coisa volta limpa e segue para a validação, que a recusa.
 */
function normalizeDay(raw) {
  const text = raw.normalize('NFKC').replace(/\p{Cf}/gu, '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})(?:$|[\s,])/.exec(text);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return text;
}

/**
 * Retorna { days: { 'AAAA-MM-DD': { steps, walkRunKm, ... } }, stats } ou null se o corpo não for um envio válido (sem `day`).
 * Aceita número ou texto numérico ("1,8" ou "1.8", como o Atalhos às vezes formata). Dia sem dado fica sem o campo (ausente é
 * diferente de zero). Campo desconhecido é descartado e contado (ignoredFields); valor fora do plausível também (invalid).
 */
export function parseDailyPush(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const day = typeof body.day === 'string' ? normalizeDay(body.day) : '';
  const parsed = new Date(`${day}T00:00:00Z`);
  const real = DAY_RE.test(day) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day; // rejeita 2026-02-31 e 2026-13-01 (esta lança em toISOString)
  if (!real) return null;
  const stats = { accepted: 0, ignoredFields: 0, invalid: 0 };
  const doc = {};
  for (const [field, raw] of Object.entries(body)) {
    if (field === 'day') continue;
    const spec = FIELD_SPECS[field];
    if (!spec) { stats.ignoredFields += 1; continue; }
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim().replace(',', '.')) : NaN;
    if (!Number.isFinite(value) || value < (spec.min ?? 0) || value > spec.max) { stats.invalid += 1; continue; }
    doc[field] = round(value, spec.decimals);
    stats.accepted += 1;
  }
  return { days: Object.keys(doc).length ? { [day]: doc } : {}, stats };
}

export const FIT_DAILY_SOURCE = 'atalho-ios';
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

/** "2026-10-07" -> "9999-99-99"; caractere invisível ou fora do ASCII aparece como <U+200E>. Mostra a forma do texto, não o valor. */
const shapeOf = (text) => [...text].slice(0, 40).map((ch) => (/[0-9]/.test(ch) ? '9' : /[A-Za-z]/.test(ch) ? 'a' : ch.charCodeAt(0) > 32 && ch.charCodeAt(0) < 127 ? ch : `<U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}>`)).join('');

/**
 * Explica por que um corpo não foi aceito, dizendo só o NOME e o TIPO de cada campo recebido, nunca o valor (é dado de saúde
 * e o token vai no cabeçalho). Serve para depurar o Atalho do iPhone, onde um campo no tipo errado é o erro mais comum.
 */
export function describeInvalidPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { message: 'O corpo precisa ser um JSON (objeto).', received: typeName(body) };
  const received = Object.fromEntries(Object.entries(body).slice(0, 20).map(([name, value]) => [name.slice(0, 40), typeName(value)]));
  const message = 'day' in body
    ? `O campo "day" precisa ser texto no formato AAAA-MM-DD (recebido: ${typeName(body.day)}${typeof body.day === 'string' ? ' fora do formato ou data inexistente' : ''}). Aceito: 2026-10-07, 2026-10-07 com hora ou 07/10/2026. No Atalhos, crie o campo como Texto.`
    : 'Faltou o campo "day" (texto AAAA-MM-DD).';
  return { message, received, ...(typeof body.day === 'string' ? { dayShape: shapeOf(body.day) } : {}) };
}
