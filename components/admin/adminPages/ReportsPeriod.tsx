import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Client, Service } from '../../../types';
import { expensesForMonth, monthKeyOf, variationPct, type FixedExpense, type RevenueEntry } from '../../../services/financeCalculations.js';
import { GRANULARITIES, dailyBreakdown, periodEntries, periodRange, periodTotals, serviceBreakdown, shiftPeriod, type Granularity, type PeriodRange } from '../../../services/reports.js';
import { cardClass, formatMoney, ghostBtn, monthLabel } from '../financeFormat';
import { Kpi } from './FinanceKpi';
import type { Lookup } from './financePageHooks';

const GRANULARITY_LABEL: Record<Granularity, string> = { day: 'Dia', week: 'Semana', month: 'Mês' };
const KIND_LABEL: Record<string, string> = { entry: 'Entrada', final: '2ª parcela', adjrev: 'Ajuste de receita' };
const fmt = (options: Intl.DateTimeFormatOptions, date: Date) => new Intl.DateTimeFormat('pt-BR', options).format(date);

function periodLabel(granularity: Granularity, range: PeriodRange, anchor: Date): string {
  if (granularity === 'day') return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, anchor);
  if (granularity === 'month') return monthLabel(monthKeyOf(anchor));
  const last = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() - 1);
  return `${fmt({ day: 'numeric', month: 'short' }, range.start)} a ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }, last)}`;
}

const Variation: React.FC<{ current: number; previous: number; label: string }> = ({ current, previous, label }) => {
  const pct = variationPct(current, previous);
  if (pct === null) return <>Sem base de comparação</>;
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-1 ${pct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}><Icon className="h-3 w-3" />{pct > 0 ? '+' : ''}{pct.toFixed(1).replace('.', ',')}% vs. {label}</span>;
};

const Bars: React.FC<{ days: { date: Date; revenue: number; count: number }[] }> = ({ days }) => {
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const labelEvery = days.length > 10 ? 5 : 1;
  return (
    <div className="flex h-40 items-end gap-1" role="img" aria-label="Faturamento por dia">
      {days.map((d, i) => (
        <div key={d.date.getTime()} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${fmt({ day: 'numeric', month: 'long' }, d.date)}: ${formatMoney(d.revenue)} · ${d.count} serviço(s)`}>
          <div className={`w-full rounded-t ${d.revenue > 0 ? 'bg-blue-500' : 'bg-white/10'}`} style={{ height: `${d.revenue > 0 ? Math.max(4, (d.revenue / max) * 100) : 2}%` }} />
          <span className="text-[10px] text-white/45">{i % labelEvery === 0 ? d.date.getDate() : ''}</span>
        </div>
      ))}
    </div>
  );
};

interface Props { entries: RevenueEntry[]; costs: RevenueEntry[]; expenses: FixedExpense[]; clients: Lookup<Client>; services: Lookup<Service> }

export const ReportsPeriod: React.FC<Props> = ({ entries, costs, expenses, clients, services }) => {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const range = useMemo(() => periodRange(granularity, anchor), [granularity, anchor]);
  const previousRange = useMemo(() => periodRange(granularity, shiftPeriod(granularity, anchor, -1)), [granularity, anchor]);
  const totals = useMemo(() => periodTotals(entries, costs, range), [entries, costs, range]);
  const previous = useMemo(() => periodTotals(entries, costs, previousRange), [entries, costs, previousRange]);
  const days = useMemo(() => dailyBreakdown(entries, range), [entries, range]);
  const rows = useMemo(() => serviceBreakdown(entries, range), [entries, range]);
  const dayEntries = useMemo(() => (granularity === 'day' ? periodEntries(entries, range) : []), [granularity, entries, range]);

  const isMonth = granularity === 'month';
  const fixed = isMonth ? expensesForMonth(expenses, monthKeyOf(anchor)).total : 0;
  const result = totals.result - fixed;
  const previousLabel = { day: 'dia anterior', week: 'semana anterior', month: 'mês anterior' }[granularity];
  const serviceName = (id: string) => services.get(id)?.title || (services.has(id) ? 'Serviço removido' : 'Carregando…');
  const clientName = (id?: string) => (id ? clients.get(id)?.name || (clients.has(id) ? 'Cliente removido' : 'Carregando…') : '—');
  const atCurrent = range.end.getTime() > Date.now(); // o período já contém hoje: não há "próximo"

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Período">
          {GRANULARITIES.map((g) => (
            <button key={g} type="button" onClick={() => setGranularity(g)} aria-pressed={granularity === g}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${granularity === g ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{GRANULARITY_LABEL[g]}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={ghostBtn} aria-label="Período anterior" onClick={() => setAnchor(shiftPeriod(granularity, anchor, -1))}><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-white first-letter:uppercase">{periodLabel(granularity, range, anchor)}</span>
          <button type="button" className={ghostBtn} aria-label="Próximo período" disabled={atCurrent} onClick={() => setAnchor(shiftPeriod(granularity, anchor, 1))}><ChevronRight className="h-4 w-4" /></button>
          <button type="button" className={ghostBtn} disabled={atCurrent} onClick={() => setAnchor(new Date())}>Hoje</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Faturamento" value={formatMoney(totals.revenue)} hint={<Variation current={totals.revenue} previous={previous.revenue} label={previousLabel} />} />
        <Kpi label="Serviços" value={String(totals.count)} hint={<Variation current={totals.count} previous={previous.count} label={previousLabel} />} />
        <Kpi label="Ticket médio" value={totals.ticket === null ? '—' : formatMoney(totals.ticket)} hint="Faturamento ÷ serviços" />
        <Kpi label="Custos" value={formatMoney(totals.variableCost + fixed)} tone="text-red-300" hint={isMonth ? 'Edição, eventos e despesas fixas' : 'Edição e eventos (fixas são mensais)'} />
        <Kpi label="Resultado" value={formatMoney(result)} tone={result >= 0 ? 'text-emerald-300' : 'text-red-300'} hint={isMonth ? 'Faturamento − todos os custos' : 'Faturamento − custos do período'} />
      </div>

      {isMonth && (
        <div className={cardClass}>
          <h3 className="mb-3 text-sm font-bold text-white">Resultado do mês</h3>
          <dl className="space-y-1.5 text-sm">
            {([['Faturamento', totals.revenue, 'text-white'], ['Custo de edição (Vídeo Personalizado)', 0 - totals.editingCost, 'text-red-300'], ['Despesas de eventos', 0 - totals.eventCost, 'text-red-300'], ['Despesas fixas', 0 - fixed, 'text-red-300']] as const).map(([label, value, tone]) => (
              <div key={label} className="flex justify-between gap-3"><dt className="text-white/65">{label}</dt><dd className={`tabular-nums ${tone}`}>{formatMoney(value)}</dd></div>
            ))}
            <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-bold"><dt className="text-white">Resultado</dt><dd className={`tabular-nums ${result >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatMoney(result)}</dd></div>
          </dl>
        </div>
      )}

      {granularity !== 'day' && (
        <div className={cardClass}>
          <h3 className="mb-4 text-sm font-bold text-white">Faturamento por dia</h3>
          <Bars days={days} />
        </div>
      )}

      {granularity === 'day' && (
        <div className={cardClass}>
          <h3 className="mb-3 text-sm font-bold text-white">Lançamentos do dia</h3>
          {dayEntries.length === 0 ? <p className="text-sm text-white/45">Nenhum serviço concluído neste dia.</p> : (
            <ul className="divide-y divide-white/5 text-sm">
              {dayEntries.map((e) => (
                <li key={e.order.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="block truncate font-semibold text-white">{serviceName(e.order.serviceId)}</span><span className="block truncate text-xs text-white/50">{clientName(e.order.clientId)}{KIND_LABEL[e.order.ledgerKind] ? ` · ${KIND_LABEL[e.order.ledgerKind]}` : ''}</span></span>
                  <span className="tabular-nums text-white">{formatMoney(e.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-white">Serviços do período</h3>
        {rows.length === 0 ? <p className="text-sm text-white/45">Sem faturamento no período.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-white/45"><th className="pb-2 font-semibold">Serviço</th><th className="pb-2 text-right font-semibold">Qtd</th><th className="pb-2 text-right font-semibold">Faturamento</th><th className="pb-2 text-right font-semibold">%</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.serviceId}><td className="py-2 pr-3 text-white">{serviceName(r.serviceId)}</td><td className="py-2 text-right tabular-nums text-white/70">{r.count}</td><td className="py-2 text-right tabular-nums text-white">{formatMoney(r.revenue)}</td><td className="py-2 text-right tabular-nums text-white/55">{Math.round(r.share * 100)}%</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
