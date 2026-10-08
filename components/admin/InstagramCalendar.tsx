import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, Loader2, Users } from 'lucide-react';
import { buildMonth, describeDay, formatBalance, monthKeyOf, shiftMonth, type CalendarCell } from '../../services/instagramCalendar.js';
import { calendarEntries, formatLabel, type Campaign, type Plan } from '../../services/instagramPlanning.js';
import type { InstagramPost } from '../../services/instagramMetrics.js';
import type { DailySummary } from '../../services/instagramDaily.js';
import { cardClass } from './financeFormat';
import { DayPanel } from './instagramPlanning/DayPanel';
import { PLAN_TONE, STEP_TONE } from './instagramPlanning/planningUi';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const monthTitle = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
};
const tone = (value: number) => (value > 0 ? 'text-emerald-300' : value < 0 ? 'text-red-300' : 'text-white/50');

/** Itens planejados do dia: texto compacto no desktop (até 2 + "+N") e pontinhos coloridos no celular. */
const PlannedItems: React.FC<{ cell: CalendarCell }> = ({ cell }) => {
  const items = [
    ...cell.steps.map((step) => ({ key: `s${step.campaignId}${step.stepId}`, text: `${step.launch ? '🚀 ' : ''}${step.title}`, className: STEP_TONE })),
    ...cell.plans.map((plan) => ({ key: `p${plan.id}`, text: `${formatLabel(plan.format)} · ${plan.title}`, className: PLAN_TONE })),
  ];
  if (!items.length) return null;
  return (
    <>
      <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
        {items.slice(0, 2).map((item) => <span key={item.key} className={`truncate rounded px-1 text-[9px] leading-4 ${item.className}`}>{item.text}</span>)}
        {items.length > 2 && <span className="text-[9px] text-white/50">+{items.length - 2}</span>}
      </span>
      <span className="flex gap-0.5 sm:hidden" aria-hidden>
        {cell.steps.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
        {cell.plans.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />}
        {items.length > 1 && <span className="text-[8px] leading-none text-white/60">{items.length}</span>}
      </span>
    </>
  );
};

/**
 * Calendário do mês: dia roxo = publicou (feed ou Reel); saldo diário de seguidores/visualizações; planejamentos avulsos (azul) e etapas de
 * campanha (âmbar, com faixa no período da campanha). Clicar no dia abre o painel para ver/criar/editar os planejamentos.
 */
export const InstagramCalendar: React.FC<{
  posts: InstagramPost[]; days: DailySummary[] | undefined; daysError: boolean; today: string;
  plans: Plan[] | undefined; campaigns: Campaign[] | undefined; planningError: boolean; onOpenCampaign: (campaignId: string) => void;
}> = ({ posts, days, daysError, today, plans, campaigns, planningError, onOpenCampaign }) => {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(today));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const planning = useMemo(() => calendarEntries({ plans, campaigns }), [plans, campaigns]);
  const { weeks, coverageStart } = useMemo(() => buildMonth({ monthKey, posts, days: days ?? [], today, planning }), [monthKey, posts, days, today, planning]);
  const firstBalance = useMemo(() => (days?.length ? days.map((d) => d.day).sort()[0] : null), [days]);
  const lastMonth = shiftMonth(monthKeyOf(today), 12); // dá para planejar até 12 meses à frente
  const br = (key: string) => key.split('-').reverse().join('/');
  const openCell = openDay ? weeks.flat().find((cell) => cell?.key === openDay) : null;

  return (
    <section className={cardClass} aria-label="Calendário de publicações">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white">Calendário de publicações</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonthKey(shiftMonth(monthKey, -1))} aria-label="Mês anterior" className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold text-white first-letter:uppercase">{monthTitle(monthKey)}</span>
          <button type="button" onClick={() => setMonthKey(shiftMonth(monthKey, 1))} disabled={monthKey >= lastMonth} aria-label="Próximo mês" className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {daysError && <p role="alert" className="mb-2 flex items-center gap-2 text-xs text-red-300"><AlertCircle className="h-4 w-4" aria-hidden />Não foi possível carregar os saldos diários (as publicações aparecem normalmente).</p>}
      {planningError && <p role="alert" className="mb-2 flex items-center gap-2 text-xs text-red-300"><AlertCircle className="h-4 w-4" aria-hidden />Não foi possível carregar planejamentos e campanhas (confira se as regras do Firestore foram publicadas).</p>}
      {days === undefined && !daysError && <p className="mb-2 flex items-center gap-2 text-xs text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Carregando saldos…</p>}

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-white/40">
        {WEEKDAYS.map((label, index) => <span key={index}>{label}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((cell, index) => cell === null ? <span key={`blank-${index}`} /> : (
          <button
            key={cell.key}
            type="button"
            onClick={() => setOpenDay(cell.key)}
            title={describeDay(cell)}
            aria-label={describeDay(cell)}
            className={`relative flex min-h-[3.75rem] min-w-0 flex-col justify-between gap-0.5 overflow-hidden rounded-lg border p-1 text-left transition hover:border-white/40 sm:min-h-[6rem] sm:p-1.5 ${cell.total ? 'border-purple-400/60 bg-purple-500/30' : 'border-white/10 bg-white/[0.03]'} ${cell.future || (cell.beforeCoverage && !cell.total) ? 'opacity-60' : ''} ${cell.isToday ? 'ring-1 ring-blue-400' : ''} ${cell.campaigns.length ? 'border-b-2 border-b-amber-400/80' : ''}`}
          >
            <span className="flex items-start justify-between text-[10px] font-semibold text-white/80">
              {cell.day}
              {cell.total > 1 && <span className="rounded bg-purple-400/40 px-1 text-[9px] text-white">×{cell.total}</span>}
            </span>
            <PlannedItems cell={cell} />
            <span className="min-w-0 space-y-0.5 text-[8px] font-semibold leading-tight tabular-nums sm:text-[10px]">
              {cell.followers !== null && <span className={`flex min-w-0 items-center gap-0.5 ${tone(cell.followers)}`}><Users className="h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5" aria-hidden /><span className="sr-only">Seguidores: </span><span className="truncate">{cell.followers === 0 ? '0' : formatBalance(cell.followers)}</span></span>}
              {cell.views !== null && <span className={`flex min-w-0 items-center gap-0.5 ${tone(cell.views)}`}><Eye className="h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5" aria-hidden /><span className="sr-only">Visualizações: </span><span className="truncate">{cell.views === 0 ? '0' : formatBalance(cell.views)}</span></span>}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-purple-400/60 bg-purple-500/30" aria-hidden />Publicou (feed ou Reel)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-sky-400/40 bg-sky-500/30" aria-hidden />Planejamento avulso</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-amber-400/40 bg-amber-500/30" aria-hidden />Etapa de campanha (faixa = período)</span>
        <span className="flex items-center gap-1.5"><Users className="h-3 w-3" aria-hidden />Saldo de seguidores</span>
        <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" aria-hidden />Saldo de visualizações</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-white/40">
        Clique em um dia para ver ou planejar conteúdo. Saldos são registrados a cada sincronização, desde {firstBalance ? br(firstBalance) : 'a primeira sincronização com esta versão'}; dia sem número = sem registro.
        {coverageStart && <> Publicações conhecidas desde {br(coverageStart)} (a API entrega só as 100 mais recentes).</>}
      </p>

      {openDay && openCell && (
        <DayPanel dayKey={openDay} summary={describeDay(openCell)} entries={planning.byDay.get(openDay)} onClose={() => setOpenDay(null)} onOpenCampaign={(id) => { setOpenDay(null); onOpenCampaign(id); }} />
      )}
    </section>
  );
};
