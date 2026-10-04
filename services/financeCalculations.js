// Cálculos financeiros puros (sem Firebase/React): faturamento, despesas fixas e patrimônio.
// Faturamento = valor registrado nos pedidos concluídos (totalPaid, com fallback servicePrice + rushFee),
// agrupado pela data de conclusão (completedAt, gravada automaticamente ao concluir) no fuso local. Não representa dinheiro recebido.

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
 * Data do faturamento: completedAt (automática na conclusão). Pedidos concluídos antes dessa regra, sem completedAt, caem em eventDate e depois paidAt.
 */
export const revenueDateOf = (order) => toDate(order.completedAt) || toDate(order.eventDate) || toDate(order.paidAt);

/**
 * Entradas de faturamento: pedidos concluídos com data de faturamento, sem duplicidade por id.
 * Pedidos internos de Conteúdo (scriptId, valor 0) não são serviços vendidos e ficam de fora.
 * `undated` conta concluídos que não puderam ser datados.
 */
export function buildRevenueEntries(orders) {
  const seen = new Set();
  const entries = [];
  const costs = [];
  let undated = 0;
  for (const order of orders) {
    if (!order || order.status !== 'completed' || order.scriptId || seen.has(order.id)) continue;
    // Pedido de evento com livro de lançamentos (eventLedger): as parcelas vêm do livro (itens `ledger`), não do pedido em si.
    if (order.eventLedger && !order.ledger) continue;
    seen.add(order.id);
    const revenueDate = revenueDateOf(order);
    if (!revenueDate) { undated += 1; continue; }
    if (order.ledgerKind === 'cost') {
      costs.push({ orderId: order.id, order, revenueDate, value: order.eventCost, monthKey: monthKeyOf(revenueDate), dayKey: dayKeyOf(revenueDate) });
      continue;
    }
    entries.push({
      orderId: order.id, order, revenueDate, value: orderValue(order),
      monthKey: monthKeyOf(revenueDate), dayKey: dayKeyOf(revenueDate),
    });
  }
  return { entries, undated, costs };
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
    const slot = days[e.revenueDate.getDate() - 1];
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

// ---- Custo de edição (Vídeo Personalizado) ----
// Custo variável fixo por vídeo concluído, independente do prazo (2/4/7 dias). Gravado como snapshot `editingCost` no pedido
// na PRIMEIRA conclusão (nunca reescrito) e somado ao mês da conclusão: sem coleção nova, sem duplicidade, sem efeito retroativo
// (pedidos concluídos antes não têm o campo). Reabrir tira o pedido (e o custo) do mês; concluir de novo o devolve, sem 2º custo.
export const EDITING_COST = 25;
const CUSTOM_VIDEO_SERVICE_ID = '3'; // id fixo do seed/ManyChat (ver services/teleprompter.js)

/** Campo a gravar no pedido ao concluí-lo pela primeira vez; {} se não for Vídeo Personalizado ou já tiver custo. */
export function editingCostFields(serviceId, existingOrder) {
  if (serviceId !== CUSTOM_VIDEO_SERVICE_ID || typeof existingOrder?.editingCost === 'number') return {};
  return { editingCost: EDITING_COST };
}

/** Custo de edição do mês: pedidos concluídos com `editingCost`, pela mesma data do faturamento. */
export function editingCostForMonth(entries, monthKey) {
  const items = entries.filter((e) => e.monthKey === monthKey && typeof e.order.editingCost === 'number');
  return { items, total: items.reduce((sum, e) => sum + e.order.editingCost, 0) };
}

/** "Despesa evento" do mês: despesas do livro de lançamentos (data = conclusão do pedido), vindas de buildRevenueEntries().costs. */
export function eventCostForMonth(costs, monthKey) {
  const items = (costs ?? []).filter((e) => e.monthKey === monthKey);
  return { items, total: items.reduce((sum, e) => sum + e.value, 0) };
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

// ---- Extrato do mês ----
// Entradas: pedidos concluídos (data de conclusão). Saídas: custo de edição de cada vídeo (data de conclusão) e despesas do mês
// (data = dia 1 do mês, para entrar no balanço do mês). `amount` já vem com sinal: saídas são negativas.
export function buildStatement(entries, expenses, monthKey, costs = []) {
  const [y, m] = monthKey.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const rows = [
    ...entries.filter((e) => e.monthKey === monthKey)
      .map((e) => ({ id: `in-${e.orderId}`, kind: 'in', source: 'order', date: e.revenueDate, amount: e.value, entry: e })),
    ...editingCostForMonth(entries, monthKey).items
      .map((e) => ({ id: `edit-${e.orderId}`, kind: 'out', source: 'editing', date: e.revenueDate, amount: -e.order.editingCost, entry: e })),
    ...eventCostForMonth(costs, monthKey).items
      .map((e) => ({ id: e.orderId, kind: 'out', source: 'eventCost', date: e.revenueDate, amount: -e.value, entry: e })),
    ...expensesForMonth(expenses, monthKey).items
      .map(({ expense, amount }) => ({ id: `exp-${expense.id}`, kind: 'out', source: 'expense', date: firstDay, amount: -amount, expense })),
  ];
  const sum = (kind) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + r.amount, 0);
  return { rows, totalIn: sum('in'), totalOut: -sum('out'), balance: sum('in') + sum('out') };
}
