// Séries do Fit a partir de users/{uid}/fitDaily (puro, sem React/Firebase). Dia sem registro vira null: ausente é diferente de zero.

const pad = (n) => String(n).padStart(2, '0');
/** 'AAAA-MM-DD' no fuso do navegador (o mesmo dia local que o Atalho do iPhone envia). */
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shiftDay = (day, delta) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

/** Os `count` dias terminando em `endDay`, em ordem cronológica: { day, row } com row = registro do dia ou null. */
export function lastDays(rows, endDay, count) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: count }, (_, i) => { const day = shiftDay(endDay, i - count + 1); return { day, row: byDay.get(day) ?? null }; });
}

const present = (value) => typeof value === 'number' && Number.isFinite(value);
/** Valor do campo em cada dia (null onde não há). */
export const series = (days, field) => days.map(({ row }) => (present(row?.[field]) ? row[field] : null));

/** Média dos valores presentes (null se não houver nenhum): dia sem dado não puxa a média para baixo. */
export function average(values) {
  const list = values.filter(present);
  return list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null;
}

/** Média móvel só com os pontos existentes nas últimas `window` posições; null onde a janela não tem ponto. */
export const movingAverage = (values, window = 7) => values.map((_, i) => average(values.slice(Math.max(0, i - window + 1), i + 1)));

/**
 * Resumo do período: último dia com passos, média diária de passos e total de km (só dias com registro), peso mais recente
 * e a variação dentro do período (null com menos de duas pesagens).
 */
export function summarize(days) {
  const steps = series(days, 'steps');
  const km = series(days, 'walkRunKm');
  const weights = days.map(({ day, row }) => ({ day, value: present(row?.weightKg) ? row.weightKg : null })).filter((w) => w.value !== null);
  const lastStepsIndex = steps.findLastIndex(present);
  const last = weights.at(-1) ?? null;
  return {
    latestSteps: lastStepsIndex < 0 ? null : { day: days[lastStepsIndex].day, value: steps[lastStepsIndex] },
    avgSteps: average(steps),
    totalKm: km.some(present) ? km.filter(present).reduce((sum, v) => sum + v, 0) : null,
    daysWithData: days.filter(({ row }) => row).length,
    weight: last && { day: last.day, value: last.value, change: weights.length > 1 ? last.value - weights[0].value : null },
  };
}
