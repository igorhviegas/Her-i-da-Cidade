// Cálculos financeiros puros (sem Firebase/React): faturamento, despesas fixas e patrimônio.
// Faturamento = valor registrado nos pedidos concluídos (totalPaid, com fallback servicePrice + rushFee),
// agrupado pela data do evento (eventDate) no fuso local. Não representa dinheiro recebido.

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const pad = (n) => String(n).padStart(2, '0');
export const monthKeyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const dayKeyOf = (date) => `${monthKeyOf(date)}-${pad(date.getDate())}`;
export const daysInMonth = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}

/** Valor do pedido: o registrado no pedido, independentemente de pagamento. */
export function orderValue(order) {
  if (typeof order.totalPaid === 'number' && Number.isFinite(order.totalPaid)) return order.totalPaid;
  return (Number(order.servicePrice) || 0) + (Number(order.rushFee) || 0);
}

/**
 * Entradas de faturamento: pedidos concluídos com data do evento, sem duplicidade por id.
 * Pedidos internos de Conteúdo (scriptId, valor 0) não são serviços vendidos e ficam de fora.
 * `withoutEventDate` conta concluídos que não puderam ser datados.
 */
export function buildRevenueEntries(orders) {
  const seen = new Set();
  const entries = [];
  let withoutEventDate = 0;
  for (const order of orders) {
    if (!order || order.status !== 'completed' || order.scriptId || seen.has(order.id)) continue;
    seen.add(order.id);
    const eventDate = toDate(order.eventDate);
    if (!eventDate) { withoutEventDate += 1; continue; }
    entries.push({
      orderId: order.id, order, eventDate, value: orderValue(order),
      monthKey: monthKeyOf(eventDate), dayKey: dayKeyOf(eventDate),
    });
  }
  return { entries, withoutEventDate };
}

export function monthTotals(entries, monthKey) {
  let total = 0; let count = 0;
  for (const e of entries) if (e.monthKey === monthKey) { total += e.value; count += 1; }
  return { total, count };
}

/** Últimos `n` meses terminando em endMonthKey (inclusive), inclusive meses sem faturamento. */
export function revenueSeries(entries, endMonthKey, n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const monthKey = shiftMonth(endMonthKey, i - (n - 1));
    return { monthKey, ...monthTotals(entries, monthKey) };
  });
}

/** Um item por dia do mês (1..N), com total, quantidade e entradas. */
export function dailyRevenue(entries, monthKey) {
  const days = Array.from({ length: daysInMonth(monthKey) }, (_, i) => ({ day: i + 1, total: 0, count: 0, entries: [] }));
  for (const e of entries) {
    if (e.monthKey !== monthKey) continue;
    const slot = days[e.eventDate.getDate() - 1];
    slot.total += e.value; slot.count += 1; slot.entries.push(e);
  }
  return days;
}

export function topDay(days) {
  let best = null;
  for (const d of days) if (d.total > 0 && (!best || d.total > best.total)) best = d;
  return best;
}

/** Variação percentual; null quando não há base de comparação (mês anterior zerado). */
export function variationPct(current, previous) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

// ---- Despesas fixas ----
// Documento: { startMonth, active, deactivatedFrom?, amountHistory: {'YYYY-MM': valor}, adjustments?: {'YYYY-MM': valor} }
// amountHistory = valor padrão vigente a partir de cada mês (mudança nunca altera meses anteriores);
// adjustments = valor pontual de um único mês.

export function isExpenseInMonth(expense, monthKey) {
  if (!expense.startMonth || monthKey < expense.startMonth) return false;
  const end = expense.active === false ? (expense.deactivatedFrom || expense.startMonth) : expense.deactivatedFrom;
  return !end || monthKey < end;
}

export function expenseAmountForMonth(expense, monthKey) {
  if (!isExpenseInMonth(expense, monthKey)) return 0;
  const adjusted = expense.adjustments?.[monthKey];
  if (typeof adjusted === 'number') return adjusted;
  const from = Object.keys(expense.amountHistory || {}).filter((k) => k <= monthKey).sort().pop();
  return from ? expense.amountHistory[from] : 0;
}

export function expensesForMonth(expenses, monthKey) {
  const items = expenses
    .filter((expense) => isExpenseInMonth(expense, monthKey))
    .map((expense) => ({ expense, amount: expenseAmountForMonth(expense, monthKey), adjusted: typeof expense.adjustments?.[monthKey] === 'number' }));
  return { items, total: items.reduce((sum, item) => sum + item.amount, 0) };
}

/** Valor padrão atual (último da história) para exibir em listas. */
export function currentDefaultAmount(expense) {
  const last = Object.keys(expense.amountHistory || {}).sort().pop();
  return last ? expense.amountHistory[last] : 0;
}

// ---- Patrimônio ----
export function patrimonySummary(assets) {
  const active = assets.filter((a) => a.status === 'active');
  return {
    activeCount: active.length,
    currentTotal: active.reduce((s, a) => s + (Number(a.currentValue) || 0), 0),
    acquisitionTotal: active.reduce((s, a) => s + (Number(a.acquisitionValue) || 0), 0),
  };
}

// ---- Indicadores prontos para uma futura gamificação (sem metas/pontos aqui) ----
export function financeMetrics(entries, expenses, monthKey, monthlyGoal = null) {
  const byMonth = new Map();
  for (const e of entries) byMonth.set(e.monthKey, (byMonth.get(e.monthKey) || 0) + e.value);
  const current = byMonth.get(monthKey) || 0;
  const previous = byMonth.get(shiftMonth(monthKey, -1)) || 0;
  const expenseTotal = expensesForMonth(expenses, monthKey).total;
  let recordMonth = null;
  for (const [key, total] of byMonth) if (!recordMonth || total > recordMonth.total) recordMonth = { monthKey: key, total };
  let streak = 0;
  if (monthlyGoal > 0) {
    for (let k = monthKey; (byMonth.get(k) || 0) >= monthlyGoal; k = shiftMonth(k, -1)) streak += 1;
  }
  return {
    recordMonth,
    cumulative: [...byMonth].reduce((s, [, t]) => s + t, 0),
    evolutionPct: variationPct(current, previous),
    goalStreak: streak,
    operatingMarginPct: current > 0 ? ((current - expenseTotal) / current) * 100 : null,
    servicesCount: monthTotals(entries, monthKey).count,
  };
}
