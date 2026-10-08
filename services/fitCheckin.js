// Check-ins de academia e funcional e peso manual (puro, sem React/Firebase). Um check-in por tipo e dia: o id é `tipo_AAAA-MM-DD`,
// então registrar de novo no mesmo dia corrige o registro em vez de duplicar (e o XP do dia só pode ser coletado uma vez).

export const CHECKIN_KINDS = { gym: 'Academia', functional: 'Funcional' };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 'AAAA-MM-DD' de um dia que existe no calendário (recusa 2026-02-31). */
export function isDay(value) {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const checkinId = (kind, day) => `${kind}_${day}`;

/** Valida o formulário e devolve { value } com os campos limpos ou { error } com a mensagem. */
export function normalizeCheckin({ kind, day, durationMin, note }) {
  if (!(kind in CHECKIN_KINDS)) return { error: 'Escolha o tipo: academia ou funcional.' };
  if (!isDay(day)) return { error: 'Data inválida.' };
  const minutes = durationMin === '' || durationMin == null ? null : Number(String(durationMin).replace(',', '.'));
  if (minutes !== null && !(Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440)) return { error: 'A duração deve ser de 1 a 1.440 minutos.' };
  const text = String(note ?? '').trim();
  if (text.length > 300) return { error: 'A observação aceita até 300 caracteres.' };
  return { value: { kind, day, ...(minutes !== null ? { durationMin: Math.round(minutes) } : {}), ...(text ? { note: text } : {}) } };
}

/** Peso manual: kg entre 20 e 500 (aceita vírgula). */
export function normalizeWeight({ day, kg }) {
  if (!isDay(day)) return { error: 'Data inválida.' };
  const value = Number(String(kg ?? '').trim().replace(',', '.'));
  if (!(Number.isFinite(value) && value >= 20 && value <= 500)) return { error: 'O peso deve estar entre 20 e 500 kg.' };
  return { value: { day, kg: Math.round(value * 100) / 100 } };
}

const shiftDay = (day, delta) => { const [y, m, d] = day.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10); };
/** Segunda-feira da semana do dia ('AAAA-MM-DD'). */
export function mondayOf(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return shiftDay(day, -((weekday + 6) % 7));
}

/** As últimas `weeks` semanas (segunda a domingo) terminando na semana de `endDay`, da mais antiga à mais recente, com a contagem de cada tipo. */
export function weeklyCounts(checkins, endDay, weeks) {
  const lastMonday = mondayOf(endDay);
  const rows = Array.from({ length: weeks }, (_, i) => ({ weekStart: shiftDay(lastMonday, (i - weeks + 1) * 7), gym: 0, functional: 0, total: 0 }));
  const byWeek = new Map(rows.map((row) => [row.weekStart, row]));
  for (const { kind, day } of checkins) {
    const row = byWeek.get(mondayOf(day));
    if (row && kind in CHECKIN_KINDS) { row[kind] += 1; row.total += 1; }
  }
  return rows;
}
