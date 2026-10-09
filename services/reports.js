// Relatórios do Financeiro (puros, sem React/Firebase). Parte dos mesmos itens do módulo Financeiro (buildRevenueEntries):
// `entries` = faturamento, `costs` = despesas de evento do livro. Datas no fuso do navegador, como o resto do Financeiro.
// Missões e XP ficam de fora de propósito.
import { monthKeyOf, shiftMonth } from './financeCalculations.js';

const DAY_MS = 86_400_000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const realOrderId = (entry) => entry.order.orderId || entry.order.id; // o item de livro aponta para o pedido em order.orderId
const isRealOrder = (entry) => entry.order.ledgerKind !== 'adjrev'; // ajuste de receita não é serviço a mais
const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// ---------------------------------------------------------------- período (dia, semana, mês)

export const GRANULARITIES = ['day', 'week', 'month'];

/** Intervalo [start, end) que contém `anchor`. Semana = segunda a domingo (como a aba WhatsApp API). */
export function periodRange(granularity, anchor) {
  const day = startOfDay(anchor);
  if (granularity === 'day') return { start: day, end: addDays(day, 1) };
  if (granularity === 'week') {
    const start = addDays(day, -((day.getDay() + 6) % 7));
    return { start, end: addDays(start, 7) };
  }
  if (granularity === 'month') return { start: new Date(day.getFullYear(), day.getMonth(), 1), end: new Date(day.getFullYear(), day.getMonth() + 1, 1) };
  throw new Error(`Período inválido: ${granularity}`);
}

/** Novo `anchor` `delta` períodos adiante (negativo = atrás). Mês sempre cai no dia 1 (sem estouro de 31 → 30). */
export function shiftPeriod(granularity, anchor, delta) {
  const day = startOfDay(anchor);
  if (granularity === 'day') return addDays(day, delta);
  if (granularity === 'week') return addDays(day, 7 * delta);
  if (granularity === 'month') return new Date(day.getFullYear(), day.getMonth() + delta, 1);
  throw new Error(`Período inválido: ${granularity}`);
}

const inRange = (entry, range) => entry.revenueDate >= range.start && entry.revenueDate < range.end;

/** Totais do período: faturamento, serviços, ticket e custos variáveis (edição + despesa de evento). Fixas ficam com quem chama (mensais). */
export function periodTotals(entries, costs, range) {
  const rows = entries.filter((e) => inRange(e, range));
  const revenue = sum(rows, (e) => e.value);
  const count = new Set(rows.filter(isRealOrder).map(realOrderId)).size;
  const editingCost = sum(rows.filter((e) => typeof e.order.editingCost === 'number'), (e) => e.order.editingCost);
  const eventCost = sum(costs.filter((c) => inRange(c, range)), (c) => c.value);
  const variableCost = editingCost + eventCost;
  return { revenue, count, ticket: count ? revenue / count : null, editingCost, eventCost, variableCost, result: revenue - variableCost };
}

/** Um item por dia do período: faturamento e nº de serviços. */
export function dailyBreakdown(entries, range) {
  const days = [];
  for (let date = range.start; date < range.end; date = addDays(date, 1)) {
    const next = addDays(date, 1);
    const rows = entries.filter((e) => e.revenueDate >= date && e.revenueDate < next);
    days.push({ date, revenue: sum(rows, (e) => e.value), count: new Set(rows.filter(isRealOrder).map(realOrderId)).size });
  }
  return days;
}

/** Serviços do período por faturamento: [{ serviceId, count, revenue, share }] (share = fração do faturamento total do período). */
export function serviceBreakdown(entries, range) {
  const groups = new Map();
  for (const e of entries.filter((item) => inRange(item, range))) {
    const id = e.order.serviceId || 'sem-servico';
    const group = groups.get(id) ?? { serviceId: id, orders: new Set(), revenue: 0 };
    group.revenue += e.value;
    if (isRealOrder(e)) group.orders.add(realOrderId(e));
    groups.set(id, group);
  }
  const total = sum([...groups.values()], (g) => g.revenue);
  return [...groups.values()]
    .map((g) => ({ serviceId: g.serviceId, count: g.orders.size, revenue: g.revenue, share: total > 0 ? g.revenue / total : 0 }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.serviceId.localeCompare(b.serviceId));
}

/** Itens de faturamento do período em ordem cronológica (para a lista do dia). */
export const periodEntries = (entries, range) => entries.filter((e) => inRange(e, range)).sort((a, b) => a.revenueDate - b.revenueDate);

// ---------------------------------------------------------------- sazonalidade

const STRONG = 1.15; // média do mês ≥ 115% do mês típico = forte
const WEAK = 0.85; // ≤ 85% = fraco

/** monthKey -> { revenue, orders: Set de pedidos reais }. */
function groupByMonth(entries) {
  const byMonth = new Map();
  for (const e of entries) {
    const slot = byMonth.get(e.monthKey) ?? { revenue: 0, orders: new Set() };
    slot.revenue += e.value;
    if (isRealOrder(e)) slot.orders.add(realOrderId(e));
    byMonth.set(e.monthKey, slot);
  }
  return byMonth;
}

/**
 * Faturamento por mês do ano. A média de cada mês usa só meses COMPLETOS (até o mês anterior ao atual) a partir do primeiro mês com
 * faturamento, contando zero quando o mês não faturou. `matrix` traz também o mês corrente (parcial), por ano, para a tabela.
 * `samples` = quantos anos entram na média daquele mês (1 = pouco dado).
 */
export function seasonality(entries, now = new Date()) {
  const byMonth = groupByMonth(entries);
  if (byMonth.size === 0) return { months: [], matrix: [], monthsAnalyzed: 0 };

  const keys = [...byMonth.keys()].sort();
  const lastComplete = shiftMonth(monthKeyOf(now), -1);
  const totals = Array.from({ length: 12 }, () => ({ revenue: 0, orders: 0, samples: 0 }));
  for (let key = keys[0]; key <= lastComplete; key = shiftMonth(key, 1)) {
    const slot = byMonth.get(key);
    const total = totals[Number(key.slice(5)) - 1];
    total.revenue += slot?.revenue ?? 0;
    total.orders += slot?.orders.size ?? 0;
    total.samples += 1;
  }

  const averages = totals.map((t) => (t.samples ? t.revenue / t.samples : null));
  const known = averages.filter((a) => a !== null);
  // Referência = mês típico (mediana): a média seria puxada para cima por poucos meses muito fortes e faria o resto parecer fraco.
  // Mediana zero (mais da metade dos meses sem faturar): cai para a média.
  const overall = known.length ? median(known) || sum(known, (a) => a) / known.length : 0;
  const months = totals.map((t, i) => {
    const avgRevenue = averages[i];
    const index = avgRevenue !== null && overall > 0 ? avgRevenue / overall : null;
    const level = index === null ? null : index >= STRONG ? 'strong' : index <= WEAK ? 'weak' : 'medium';
    return { month: i + 1, avgRevenue, avgOrders: t.samples ? t.orders / t.samples : null, samples: t.samples, index, level };
  });

  const years = [...new Set(keys.map((k) => Number(k.slice(0, 4))))].sort((a, b) => a - b);
  const matrix = years.map((year) => ({ year, months: Array.from({ length: 12 }, (_, i) => byMonth.get(`${year}-${String(i + 1).padStart(2, '0')}`)?.revenue ?? null) }));
  return { months, matrix, monthsAnalyzed: sum(totals, (t) => t.samples) };
}

// ---------------------------------------------------------------- clientes: retenção e LTV

const WINBACK_FROM_DAYS = 300; // ~10 meses
const WINBACK_TO_DAYS = 430; // ~14 meses: janela do aniversário seguinte

/**
 * Por cliente (pedidos reais, sem os internos de roteiro): nº de pedidos, faturamento (LTV), primeira e última compra.
 * Resumo: clientes, quantos voltaram (2+ pedidos), taxa de retorno, LTV e pedidos médios por cliente, mediana de dias entre pedidos,
 * e `winback` = clientes cuja última compra foi entre 10 e 14 meses atrás (hora de o aniversário voltar).
 */
export function clientRetention(entries, now = new Date()) {
  const clients = new Map();
  for (const e of entries) {
    const clientId = e.order.clientId;
    if (!clientId) continue;
    const client = clients.get(clientId) ?? { clientId, revenue: 0, orders: new Map() };
    client.revenue += e.value;
    if (isRealOrder(e)) {
      const id = realOrderId(e);
      const first = client.orders.get(id);
      if (!first || e.revenueDate < first) client.orders.set(id, e.revenueDate);
    }
    clients.set(clientId, client);
  }

  const rows = [...clients.values()].filter((c) => c.orders.size > 0).map((c) => {
    const dates = [...c.orders.values()].sort((a, b) => a - b);
    return { clientId: c.clientId, orders: dates.length, revenue: c.revenue, firstDate: dates[0], lastDate: dates[dates.length - 1], dates };
  });
  const gaps = rows.flatMap((r) => r.dates.slice(1).map((date, i) => (date - r.dates[i]) / DAY_MS));
  const returning = rows.filter((r) => r.orders >= 2).length;
  const daysSince = (row) => (now - row.lastDate) / DAY_MS;

  return {
    clients: rows.length,
    returning,
    returnRate: rows.length ? returning / rows.length : null,
    avgLtv: rows.length ? sum(rows, (r) => r.revenue) / rows.length : null,
    avgOrders: rows.length ? sum(rows, (r) => r.orders) / rows.length : null,
    medianGapDays: median(gaps),
    top: [...rows].sort((a, b) => b.revenue - a.revenue || b.orders - a.orders).slice(0, 10),
    winback: rows.filter((r) => daysSince(r) >= WINBACK_FROM_DAYS && daysSince(r) <= WINBACK_TO_DAYS).sort((a, b) => b.revenue - a.revenue).slice(0, 20),
  };
}
