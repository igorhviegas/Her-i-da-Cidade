// Próxima corrida do campeonato (kartConfig/next): só data e horário, sem confirmação de presença. Sem I/O.

/** Data de hoje ('YYYY-MM-DD') no fuso de Brasília, que é onde as corridas acontecem. */
export const todayInBrazil = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const toDay = (iso) => Date.UTC(...iso.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));

/** Dias de `today` até `date` (0 = hoje, 1 = amanhã, negativo = já passou). */
export const daysUntil = (date, today) => Math.round((toDay(date) - toDay(today)) / 86_400_000);

/** "hoje", "amanhã" ou "em 9 dias". */
export const countdownLabel = (days) => (days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`);

/**
 * Próxima corrida a mostrar: null se não há data válida ou se ela já passou.
 * `config` = { date: 'YYYY-MM-DD', time?: 'HH:MM', place?, note? }.
 */
export function upcomingRace(config, today = todayInBrazil()) {
  if (!config || !/^\d{4}-\d{2}-\d{2}$/.test(config.date ?? '')) return null;
  const days = daysUntil(config.date, today);
  if (days < 0) return null;
  return { date: config.date, time: config.time ?? '', place: config.place ?? '', note: config.note ?? '', days, countdown: countdownLabel(days) };
}
