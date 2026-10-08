import React from 'react';
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';
import type { Client, Service } from '../../../types';
import { DailyCompass, MonthlyBars, ServiceBars } from '../FinanceCharts';
import { cardClass, formatMoney, MONTH_NAMES, monthLabel } from '../financeFormat';
import { monthKeyOf, shiftMonth, type DayRevenue } from '../../../services/financeCalculations.js';
import { Kpi } from './FinanceKpi';
import type { Lookup } from './financePageHooks';

/** Mesmo formato do `view` calculado em AdminFinancePage. */
export interface FinanceView {
  current: { total: number; count: number };
  previous: { total: number; count: number };
  fixedTotal: number;
  editing: { total: number };
  eventCost: { total: number };
  expenseTotal: number;
  days: DayRevenue[];
  top: { day: number; total: number } | null;
  variation: number | null;
  series: React.ComponentProps<typeof MonthlyBars>['series'];
  patrimony: { currentTotal: number; activeCount: number };
}

const VariationKpi: React.FC<{ variation: number | null }> = ({ variation }) => (
  <Kpi label="Variação" value={variation === null ? '—' : `${variation > 0 ? '+' : ''}${variation.toFixed(1).replace('.', ',')}%`}
    tone={variation === null ? 'text-white/60' : variation >= 0 ? 'text-emerald-300' : 'text-red-300'}
    hint={variation === null ? 'Sem base de comparação' : variation >= 0 ? <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />vs. mês anterior</span> : <span className="inline-flex items-center gap-1"><ArrowDownRight className="h-3 w-3" />vs. mês anterior</span>} />
);

const SummaryKpis: React.FC<{ view: FinanceView; monthKey: string }> = ({ view, monthKey }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
    <Kpi label={`Faturamento · ${MONTH_NAMES[Number(monthKey.slice(5)) - 1]}`} value={formatMoney(view.current.total)} hint={`${view.current.count} serviço${view.current.count === 1 ? '' : 's'} concluído${view.current.count === 1 ? '' : 's'}`} tone="text-emerald-300" />
    <Kpi label="Mês anterior" value={formatMoney(view.previous.total)} hint={monthLabel(shiftMonth(monthKey, -1))} />
    <VariationKpi variation={view.variation} />
    <Kpi label="Despesas do mês" value={formatMoney(view.expenseTotal)} tone="text-red-300"
      hint={`Fixas ${formatMoney(view.fixedTotal)} · Edição de vídeos ${formatMoney(view.editing.total)} · Eventos ${formatMoney(view.eventCost.total)}`} />
    <Kpi label="Resultado operacional estimado" value={formatMoney(view.current.total - view.expenseTotal)} tone={view.current.total - view.expenseTotal >= 0 ? 'text-white' : 'text-red-300'} hint="Faturamento − despesas" />
    <Kpi label="Patrimônio ativo" value={formatMoney(view.patrimony.currentTotal)} hint={`${view.patrimony.activeCount} iten${view.patrimony.activeCount === 1 ? '' : 's'}`} />
  </div>
);

interface DayEntriesProps {
  view: FinanceView;
  selectedDay: number | null;
  clients: Lookup<Client>;
  services: Lookup<Service>;
}

const DayEntries: React.FC<DayEntriesProps> = ({ view, selectedDay, clients, services }) => {
  const selectedEntries = selectedDay ? view?.days[selectedDay - 1]?.entries ?? [] : [];
  return (
    <>
      {selectedDay && (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-black/20 p-3 text-xs text-white/70">
          {selectedEntries.length === 0 ? <li>Nenhum serviço no dia {selectedDay}.</li> : selectedEntries.map((e) => (
            <li key={e.orderId} className="flex justify-between gap-3"><span className="truncate">{clients.get(e.order.clientId)?.name || 'Cliente'} · {services.get(e.order.serviceId)?.title || 'Serviço'}</span><span className="shrink-0 font-semibold">{formatMoney(e.value)}</span></li>
          ))}
        </ul>
      )}
    </>
  );
};

interface DailySectionProps extends DayEntriesProps {
  monthKey: string;
  onSelectDay: (day: number | null) => void;
}

const DailySection: React.FC<DailySectionProps> = ({ view, monthKey, selectedDay, onSelectDay, clients, services }) => (
  <section className={cardClass}>
    <h3 className="mb-1 text-sm font-bold text-white">Faturamento diário · {monthLabel(monthKey)}</h3>
    {view.current.total === 0 ? <p className="py-10 text-center text-sm text-white/45">Nenhum serviço concluído neste mês.</p> : (
      <>
        <p className="mb-2 text-xs text-white/50">Maior dia: <span className="font-semibold text-amber-300">dia {view.top?.day} · {formatMoney(view.top?.total ?? 0)}</span></p>
        <DailyCompass days={view.days} topDay={view.top?.day ?? null} selectedDay={selectedDay} onSelect={onSelectDay} monthTotal={view.current.total} />
        <DayEntries view={view} selectedDay={selectedDay} clients={clients} services={services} />
      </>
    )}
  </section>
);

interface FinanceSummaryTabProps {
  view: FinanceView;
  monthKey: string;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
  clients: Lookup<Client>;
  services: Lookup<Service>;
  topServices: React.ComponentProps<typeof ServiceBars>['rows'];
}

export const FinanceSummaryTab: React.FC<FinanceSummaryTabProps> = ({ view, monthKey, selectedDay, onSelectDay, clients, services, topServices }) => (
  <div className="space-y-6">
    <SummaryKpis view={view} monthKey={monthKey} />

    <div className="grid gap-6 lg:grid-cols-2">
      <section className={cardClass}>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><TrendingUp className="h-4 w-4 text-blue-400" />Evolução mensal (12 meses)</h3>
        <MonthlyBars series={view.series} selected={monthKey} />
      </section>
      <DailySection view={view} monthKey={monthKey} selectedDay={selectedDay} onSelectDay={onSelectDay} clients={clients} services={services} />
    </div>

    <section className={cardClass}>
      <h3 className="mb-4 text-sm font-bold text-white">Serviços mais pedidos · {monthLabel(monthKeyOf(new Date()))}</h3>
      <ServiceBars rows={topServices} />
    </section>
  </div>
);
