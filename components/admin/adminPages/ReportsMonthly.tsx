import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import type { Client, Order, Service } from '../../../types';
import { expensesForMonth, monthKeyOf, shiftMonth, type FixedExpense, type RevenueEntry } from '../../../services/financeCalculations.js';
import { loadFitDaily } from '../../../services/fitService';
import { loadWeights, loadCheckins } from '../../../services/fitDataService';
import { loadFitRides } from '../../../services/fitRideService';
import { subscribeInstagramDays, subscribeInstagramPosts } from '../../../services/instagramService';
import { clientsInMonth, defaultReportMonth, fitMonth, instagramMonth, monthRange, type FitMonth, type InstagramMonth } from '../../../services/monthlyReport.js';
import { dailyBreakdown, deliveryPerformance, eventProfitability, periodTotals, serviceBreakdown, shiftPeriod } from '../../../services/reports.js';
import type { DailySummary } from '../../../services/instagramDaily.js';
import type { InstagramPost } from '../../../services/instagramMetrics.js';
import { cardClass, ghostBtn, monthLabel, primaryBtn } from '../financeFormat';
import type { Lookup } from './financePageHooks';
import { MonthlyDocument, type Loadable, type MonthlyData } from './MonthlyDocument';

type FitSources = Parameters<typeof fitMonth>[0];

// Impressão: só a cópia do relatório (portal no <body>) aparece; o painel todo (#root) some. Cores exatas para as barras saírem no PDF.
const PRINT_CSS = `
.report-print-only { display: none; }
.report-doc, .report-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  @page { size: A4; margin: 12mm; }
  #root { display: none !important; }
  .report-print-only { display: block !important; }
  html, body { background: #fff !important; }
}`;

/** Instagram do mês: saldos diários e publicações salvas (os mesmos dados da página Instagram). */
function useInstagramSources() {
  const [state, setState] = useState<Loadable<{ posts: InstagramPost[]; days: DailySummary[] }>>({ status: 'loading' });
  useEffect(() => {
    let posts: InstagramPost[] | null = null;
    let days: DailySummary[] | null = null;
    const emit = () => { if (posts && days) setState({ status: 'ready', data: { posts, days } }); };
    const fail = () => setState({ status: 'error' });
    const stopPosts = subscribeInstagramPosts((list) => { posts = list; emit(); }, fail);
    const stopDays = subscribeInstagramDays((list) => { days = list; emit(); }, fail);
    return () => { stopPosts(); stopDays(); };
  }, []);
  return state;
}

/** Fit do dono logado: leitura única (o mês escolhido muda só o filtro). */
function useFitSources() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, setState] = useState<Loadable<FitSources>>({ status: 'loading' });
  useEffect(() => {
    if (!uid) { setState({ status: 'error' }); return; }
    let alive = true;
    Promise.all([loadFitDaily(uid, 400), loadWeights(uid, 400), loadCheckins(uid, 400), loadFitRides(uid, 400)])
      .then(([daily, weights, checkins, rides]) => { if (alive) setState({ status: 'ready', data: { daily, weights, checkins, rides } as FitSources }); })
      .catch(() => { if (alive) setState({ status: 'error' }); });
    return () => { alive = false; };
  }, [uid]);
  return state;
}

interface Props {
  entries: RevenueEntry[]; costs: RevenueEntry[]; orders: Order[]; expenses: FixedExpense[];
  clients: Lookup<Client>; services: Lookup<Service>;
  /** 'AAAA-MM' vindo do aviso do sino; ausente = mês anterior ao de hoje. */
  openMonth?: string | null;
}

export const ReportsMonthly: React.FC<Props> = ({ entries, costs, orders, expenses, services, openMonth }) => {
  const [monthKey, setMonthKey] = useState(() => openMonth ?? defaultReportMonth());
  useEffect(() => { if (openMonth) setMonthKey(openMonth); }, [openMonth]);
  const instagram = useInstagramSources();
  const fit = useFitSources();

  const data = useMemo<MonthlyData>(() => {
    const range = monthRange(monthKey);
    const previousRange = monthRange(shiftMonth(monthKey, -1));
    const serviceName = (id: string) => services.get(id)?.title || (services.has(id) ? 'Serviço removido' : 'Serviço');
    const delivery = deliveryPerformance(orders, range);
    const igMonth: Loadable<InstagramMonth> = instagram.status === 'ready' ? { status: 'ready', data: instagramMonth(instagram.data.posts, instagram.data.days, monthKey) } : instagram;
    const fitState: Loadable<FitMonth> = fit.status === 'ready' ? { status: 'ready', data: fitMonth(fit.data, monthKey) } : fit;
    return {
      monthKey, partial: monthKey >= monthKeyOf(new Date()),
      totals: periodTotals(entries, costs, range), previous: periodTotals(entries, costs, previousRange),
      fixed: expensesForMonth(expenses, monthKey).total,
      days: dailyBreakdown(entries, range),
      services: serviceBreakdown(entries, range).slice(0, 8).map((s) => ({ ...s, name: serviceName(s.serviceId) })),
      events: eventProfitability(entries, costs, range).totals,
      clients: clientsInMonth(entries, range),
      delivery: { delivered: delivery.delivered, onTimeRate: delivery.onTimeRate, avgLateDays: delivery.avgLateDays, avgLeadDays: delivery.avgLeadDays },
      instagram: igMonth, fit: fitState,
    };
  }, [monthKey, entries, costs, orders, expenses, services, instagram, fit]);

  const atCurrent = monthKey >= monthKeyOf(new Date());
  const go = (delta: number) => setMonthKey(monthKeyOf(shiftPeriod('month', new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1), delta)));

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>
      <div className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <button type="button" className={ghostBtn} aria-label="Mês anterior" onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-white">{monthLabel(monthKey)}</span>
          <button type="button" className={ghostBtn} aria-label="Próximo mês" disabled={atCurrent} onClick={() => go(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-white/50 sm:block">No diálogo de impressão, escolha “Salvar como PDF”.</p>
          <button type="button" className={primaryBtn} onClick={() => window.print()}><Printer className="h-4 w-4" />Salvar em PDF</button>
        </div>
      </div>
      <MonthlyDocument data={data} />
      {createPortal(<div className="report-print-only"><MonthlyDocument data={data} /></div>, document.body)}
    </div>
  );
};
