import React from 'react';
import type { FitDailyRow } from '../../../services/fitService';
import { stepsXp } from '../../../functions/xp.js';
import { summarize } from '../../../services/fitDaily.js';
import { shortDay } from '../FitCharts';
import { ClaimButton, type useFitClaims } from '../FitXp';
import { cardClass } from '../financeFormat';

const number = (n: number, decimals = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

type Summary = ReturnType<typeof summarize>;

const Kpi: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className={cardClass}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
    <p className="mt-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">{value}</p>
    {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
  </div>
);

interface FitKpiGridProps {
  summary: Summary;
  dates: string[];
  kmAverage: number | null;
}

export const FitKpiGrid: React.FC<FitKpiGridProps> = ({ summary, dates, kmAverage }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Kpi label="Passos" value={summary.latestSteps ? number(summary.latestSteps.value) : '—'} hint={summary.latestSteps ? `${shortDay(summary.latestSteps.day)}${summary.latestSteps.day === dates[dates.length - 1] ? ' · hoje, parcial' : ''}` : 'sem registro'} />
    <Kpi label="Média de passos" value={summary.avgSteps === null ? '—' : number(summary.avgSteps)} hint={`por dia, ${summary.daysWithData} ${summary.daysWithData === 1 ? 'dia' : 'dias'} com dados`} />
    <Kpi label="Distância" value={summary.totalKm === null ? '—' : `${number(summary.totalKm, 1)} km`} hint={kmAverage === null ? 'caminhada/corrida' : `${number(kmAverage, 1)} km/dia em média`} />
    <Kpi label="Peso" value={summary.weight ? `${number(summary.weight.value, 1)} kg` : '—'}
      hint={summary.weight ? `${shortDay(summary.weight.day)}${summary.weight.change === null ? '' : ` · ${summary.weight.change > 0 ? '+' : ''}${number(summary.weight.change, 1)} kg no período`}` : 'sem pesagem no período'} />
  </div>
);

interface FitStepsXpProps {
  pendingSteps: FitDailyRow[];
  pendingTotal: number;
  claims: ReturnType<typeof useFitClaims>;
  onClaimAll: () => void;
}

export const FitStepsXp: React.FC<FitStepsXpProps> = ({ pendingSteps, pendingTotal, claims, onClaimAll }) => (
  <section className={cardClass}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold text-white">XP dos passos</h3>
        <p className="text-xs text-white/50">1 XP a cada 10 passos de um dia já fechado (teto de 20.000 passos por dia). O de hoje fica disponível amanhã.</p>
      </div>
      {pendingSteps.length > 1 && <ClaimButton xp={pendingTotal} claimed={false} busy={claims.busy !== null} onClick={onClaimAll} />}
    </div>
    {claims.error && <p role="alert" className="mb-2 text-xs text-red-300">{claims.error}</p>}
    {pendingSteps.length === 0 ? <p className="text-sm text-white/50">Nenhum XP de passos pendente.</p> : (
      <ul className="divide-y divide-white/5">
        {pendingSteps.map((r) => (
          <li key={r.day} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="tabular-nums text-white/85">{shortDay(r.day)} · {number(r.steps ?? 0)} passos</span>
            <ClaimButton xp={stepsXp(r.steps)} claimed={false} busy={claims.busy !== null} onClick={() => void claims.claim('fit_steps', r.day, stepsXp(r.steps), { steps: r.steps })} />
          </li>
        ))}
      </ul>
    )}
  </section>
);
