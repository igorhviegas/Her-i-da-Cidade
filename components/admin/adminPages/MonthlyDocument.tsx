import React from 'react';
import { variationPct } from '../../../services/financeCalculations.js';
import type { FitMonth, InstagramMonth } from '../../../services/monthlyReport.js';
import type { PeriodTotals } from '../../../services/reports.js';
import { formatMoney, monthLabel } from '../financeFormat';

export type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

export interface MonthlyData {
  monthKey: string;
  partial: boolean;
  totals: PeriodTotals;
  previous: PeriodTotals;
  fixed: number;
  days: { date: Date; revenue: number; count: number }[];
  services: { serviceId: string; name: string; count: number; revenue: number; share: number }[];
  events: { count: number; revenue: number; cost: number; margin: number; marginPct: number | null };
  clients: { served: number; newClients: number; returning: number };
  delivery: { delivered: number; onTimeRate: number | null; avgLateDays: number | null; avgLeadDays: number | null };
  instagram: Loadable<InstagramMonth>;
  fit: Loadable<FitMonth>;
}

const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);
const num = (value: number | null, digits = 0) => (value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: digits }));
const signed = (value: number | null) => (value === null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`);
const dayCount = (value: number | null) => (value === null ? '—' : `${value.toFixed(1).replace('.', ',')} dias`);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="break-inside-avoid border-t border-slate-200 pt-4">
    <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h2>
    {children}
  </section>
);
const Stat: React.FC<{ label: string; value: string; hint?: string; tone?: string }> = ({ label, value, hint, tone = 'text-slate-900' }) => (
  <div className="rounded-lg border border-slate-200 p-3">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className={`mt-0.5 text-lg font-extrabold tabular-nums ${tone}`}>{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
  </div>
);
const Row: React.FC<{ label: string; value: string; strong?: boolean; tone?: string }> = ({ label, value, strong, tone = 'text-slate-900' }) => (
  <div className={`flex justify-between gap-3 py-1 text-sm ${strong ? 'border-t border-slate-300 pt-2 font-bold' : ''}`}><dt className="text-slate-600">{label}</dt><dd className={`tabular-nums ${tone}`}>{value}</dd></div>
);
const Pending: React.FC<{ state: Loadable<unknown>; what: string }> = ({ state, what }) => <p className="text-sm text-slate-500">{state.status === 'loading' ? `Carregando ${what}…` : `${what} indisponível no momento.`}</p>;

const Instagram: React.FC<{ state: Loadable<InstagramMonth> }> = ({ state }) => {
  if (state.status !== 'ready') return <Pending state={state} what="Instagram" />;
  const ig = state.data;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Seguidores" value={signed(ig.followersGain)} hint="Saldo do mês" tone={ig.followersGain !== null && ig.followersGain < 0 ? 'text-red-600' : 'text-slate-900'} />
        <Stat label="Curtidas" value={num(ig.likesGain)} hint="Recebidas no mês" />
        <Stat label="Visualizações" value={num(ig.viewsGain)} hint="Recebidas no mês" />
        <Stat label="Publicações" value={String(ig.posts)} hint={`${num(ig.postLikes)} curtidas, ${num(ig.postComments)} comentários`} />
      </div>
      {ig.top && <p className="text-sm text-slate-700"><b>Mais curtida do mês:</b> {ig.top.caption ? `“${ig.top.caption.replace(/\s+/g, ' ').slice(0, 90)}${ig.top.caption.length > 90 ? '…' : ''}”` : 'sem legenda'} ({num(ig.top.likes)} curtidas)</p>}
      {ig.daysWithData === 0 ? <p className="text-xs text-slate-500">Sem saldo diário neste mês: o acompanhamento diário só existe desde a primeira sincronização.</p> : <p className="text-xs text-slate-500">Saldos de {ig.daysWithData} dia(s) com sincronização.</p>}
    </div>
  );
};

const Fit: React.FC<{ state: Loadable<FitMonth> }> = ({ state }) => {
  if (state.status !== 'ready') return <Pending state={state} what="Fit" />;
  const fit = state.data;
  if (!fit.hasData) return <p className="text-sm text-slate-500">Sem registros de Fit neste mês.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Passos por dia" value={num(fit.avgSteps)} hint={`Média de ${fit.daysWithData} dia(s) com registro`} />
      <Stat label="Caminhada e corrida" value={fit.totalKm === null ? '—' : `${num(fit.totalKm, 1)} km`} />
      <Stat label="Peso" value={fit.weight ? `${num(fit.weight.value, 1)} kg` : '—'} hint={fit.weight?.change != null ? `${signed(fit.weight.change)} kg no mês` : undefined} />
      <Stat label="Treinos" value={String(fit.gym + fit.functional)} hint={`${fit.gym} academia, ${fit.functional} funcional`} />
      <Stat label="Pedaladas" value={String(fit.rides.count)} hint={fit.rides.count ? `${num(fit.rides.km, 1)} km${fit.rides.avgSpeedKmh ? `, ${num(fit.rides.avgSpeedKmh, 1)} km/h` : ''}` : undefined} />
    </div>
  );
};

/** Folha do relatório mensal: fundo branco, também usada na impressão (Salvar como PDF). Só dinheiro, clientes, Instagram e Fit. */
export const MonthlyDocument: React.FC<{ data: MonthlyData }> = ({ data }) => {
  const { totals, previous, fixed, events, clients, delivery } = data;
  const result = totals.result - fixed;
  const variation = variationPct(totals.revenue, previous.revenue);
  const max = Math.max(...data.days.map((d) => d.revenue), 1);
  const tone = (value: number) => (value < 0 ? 'text-red-600' : 'text-emerald-700');
  return (
    <article className="report-doc space-y-5 rounded-xl bg-white p-6 text-slate-900 sm:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">O Herói da Cidade</p>
        <h1 className="text-2xl font-extrabold">Relatório de {monthLabel(data.monthKey)}</h1>
        {data.partial && <p className="mt-1 text-xs font-semibold text-amber-700">Mês em andamento: os números são parciais.</p>}
      </header>

      <Section title="Resumo financeiro">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Faturamento" value={formatMoney(totals.revenue)} hint={variation === null ? 'Sem mês anterior para comparar' : `${variation > 0 ? '+' : ''}${variation.toFixed(1).replace('.', ',')}% vs. mês anterior`} />
          <Stat label="Serviços" value={String(totals.count)} hint={`${previous.count} no mês anterior`} />
          <Stat label="Ticket médio" value={totals.ticket === null ? '—' : formatMoney(totals.ticket)} />
          <Stat label="Custos" value={formatMoney(totals.variableCost + fixed)} tone="text-red-600" />
          <Stat label="Resultado" value={formatMoney(result)} tone={tone(result)} />
        </div>
        <dl className="mt-3 max-w-md">
          <Row label="Faturamento" value={formatMoney(totals.revenue)} />
          <Row label="Custo de edição" value={formatMoney(0 - totals.editingCost)} tone="text-red-600" />
          <Row label="Despesas de eventos" value={formatMoney(0 - totals.eventCost)} tone="text-red-600" />
          <Row label="Despesas fixas" value={formatMoney(0 - fixed)} tone="text-red-600" />
          <Row label="Resultado do mês" value={formatMoney(result)} strong tone={tone(result)} />
        </dl>
      </Section>

      <Section title="Faturamento por dia">
        <div className="flex h-28 items-end gap-0.5">
          {data.days.map((d) => (
            <div key={d.date.getTime()} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5">
              <div className={`w-full rounded-t-sm ${d.revenue > 0 ? 'bg-blue-600' : 'bg-slate-200'}`} style={{ height: `${d.revenue > 0 ? Math.max(4, (d.revenue / max) * 100) : 2}%` }} />
              <span className="text-[9px] text-slate-500">{d.date.getDate() % 5 === 1 || d.date.getDate() === 1 ? d.date.getDate() : ''}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Serviços">
        {data.services.length === 0 ? <p className="text-sm text-slate-500">Sem faturamento no mês.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500"><th className="pb-1 font-semibold">Serviço</th><th className="pb-1 text-right font-semibold">Qtd</th><th className="pb-1 text-right font-semibold">Faturamento</th><th className="pb-1 text-right font-semibold">%</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.services.map((s) => <tr key={s.serviceId}><td className="py-1">{s.name}</td><td className="py-1 text-right tabular-nums">{s.count}</td><td className="py-1 text-right tabular-nums">{formatMoney(s.revenue)}</td><td className="py-1 text-right tabular-nums text-slate-500">{pct(s.share)}</td></tr>)}
            </tbody>
          </table>
        )}
        {events.count > 0
          ? <p className="mt-3 text-sm text-slate-700"><b>Eventos concluídos:</b> {events.count}. Receita {formatMoney(events.revenue)}, custo {formatMoney(events.cost)}, margem <span className={tone(events.margin)}>{formatMoney(events.margin)} ({pct(events.marginPct)})</span>.</p>
          : <p className="mt-3 text-sm text-slate-500">Nenhum evento concluído no mês.</p>}
      </Section>

      <Section title="Clientes e entregas">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Clientes atendidos" value={String(clients.served)} hint={`${clients.newClients} novos, ${clients.returning} que já eram clientes`} />
          <Stat label="Entregas" value={String(delivery.delivered)} hint="Com prazo ao cliente" />
          <Stat label="No prazo" value={pct(delivery.onTimeRate)} hint={delivery.avgLateDays === null ? undefined : `Atraso médio: ${dayCount(delivery.avgLateDays)}`} tone={delivery.onTimeRate !== null && delivery.onTimeRate < 0.9 ? 'text-amber-700' : 'text-slate-900'} />
          <Stat label="Tempo até entregar" value={dayCount(delivery.avgLeadDays)} hint="Do pagamento à conclusão" />
        </div>
      </Section>

      <Section title="Instagram"><Instagram state={data.instagram} /></Section>
      <Section title="Fit"><Fit state={data.fit} /></Section>

      <footer className="border-t border-slate-200 pt-3 text-[11px] text-slate-400">Gerado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}</footer>
    </article>
  );
};
