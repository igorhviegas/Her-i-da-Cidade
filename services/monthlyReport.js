// Relatório mensal (puro, sem React/Firebase). O dinheiro vem de services/reports.js; aqui ficam clientes do mês, Instagram e Fit.
// Missões e XP ficam de fora de propósito.
import { monthKeyOf, shiftMonth } from './financeCalculations.js';
import { dayKey, summarize } from './fitDaily.js';
import { summarizeRides } from './fitRide.js';
import { postDay } from './instagramCalendar.js';
import { topPost, totalFor } from './instagramMetrics.js';
import { periodRange } from './reports.js';

const sumPresent = (values) => {
  const list = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  return list.length ? list.reduce((total, v) => total + v, 0) : null;
};

/** 'AAAA-MM' válido (usado no link do aviso do sino: /admin/financeiro?relatorio=AAAA-MM). */
export const isMonthKey = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** O relatório "do mês" é o mês anterior ao de hoje (o corrente ainda está em andamento). */
export const defaultReportMonth = (now = new Date()) => shiftMonth(monthKeyOf(now), -1);

/** Intervalo [start, end) de 'AAAA-MM' (fuso do navegador, como o Financeiro). */
export const monthRange = (monthKey) => periodRange('month', new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1));

// ---------------------------------------------------------------- clientes do mês

/** Clientes atendidos no período, quantos compraram pela 1ª vez nele (novos) e quantos já eram clientes (recorrentes). */
export function clientsInMonth(entries, range) {
  const firstPurchase = new Map();
  for (const e of entries) {
    const id = e.order.clientId;
    if (id && (!firstPurchase.has(id) || e.revenueDate < firstPurchase.get(id))) firstPurchase.set(id, e.revenueDate);
  }
  const served = new Set(entries.filter((e) => e.revenueDate >= range.start && e.revenueDate < range.end && e.order.clientId && e.order.ledgerKind !== 'adjrev').map((e) => e.order.clientId));
  const newClients = [...served].filter((id) => firstPurchase.get(id) >= range.start).length;
  return { served: served.size, newClients, returning: served.size - newClients };
}

// ---------------------------------------------------------------- Instagram do mês

const inMonth = (day, monthKey) => typeof day === 'string' && day.startsWith(monthKey);

/**
 * `days` = saldos diários (seguidores, curtidas e visualizações recebidas em cada dia); `posts` = publicações salvas.
 * Os saldos só existem desde a 1ª sincronização: `daysWithData` diz de quantos dias do mês há dado (null = sem dado nenhum).
 */
export function instagramMonth(posts, days, monthKey) {
  const monthDays = days.filter((d) => inMonth(d.day, monthKey));
  const published = posts.filter((p) => inMonth(postDay(p), monthKey));
  return {
    daysWithData: monthDays.filter((d) => typeof d.followers === 'number').length,
    followersGain: sumPresent(monthDays.map((d) => d.followers)),
    likesGain: sumPresent(monthDays.map((d) => d.likes)),
    viewsGain: sumPresent(monthDays.map((d) => d.views)),
    posts: published.length,
    postLikes: totalFor(published, 'likes').total,
    postComments: totalFor(published, 'comments').total,
    top: topPost(published, 'likes'),
  };
}

// ---------------------------------------------------------------- Fit do mês

/**
 * daily = users/{uid}/fitDaily; weights = pesos manuais (valem mais que o do atalho no mesmo dia); checkins; rides (startedAt = Date).
 * Dia sem registro não entra nas médias (ausente não é zero). Sem nenhum dado no mês, `hasData` é false.
 */
export function fitMonth({ daily = [], weights = [], checkins = [], rides = [] }, monthKey) {
  const rows = new Map(daily.filter((r) => inMonth(r.day, monthKey)).map((r) => [r.day, { ...r }]));
  for (const w of weights.filter((item) => inMonth(item.day, monthKey))) rows.set(w.day, { ...(rows.get(w.day) ?? { day: w.day }), weightKg: w.kg });
  const days = [...rows.values()].sort((a, b) => a.day.localeCompare(b.day)).map((row) => ({ day: row.day, row }));
  const summary = summarize(days);
  const monthCheckins = checkins.filter((c) => inMonth(c.day, monthKey));
  const monthRides = rides.filter((r) => dayKey(r.startedAt).startsWith(monthKey));
  const result = {
    daysWithData: summary.daysWithData,
    avgSteps: summary.avgSteps,
    totalKm: summary.totalKm,
    weight: summary.weight,
    gym: monthCheckins.filter((c) => c.kind === 'gym').length,
    functional: monthCheckins.filter((c) => c.kind === 'functional').length,
    rides: summarizeRides(monthRides),
  };
  return { ...result, hasData: summary.daysWithData > 0 || monthCheckins.length > 0 || monthRides.length > 0 };
}
