import React, { useMemo } from 'react';
import { monthKeyOf, type RevenueEntry } from '../../../services/financeCalculations.js';
import { seasonality, type SeasonMonth } from '../../../services/reports.js';
import { cardClass, formatMoney, MONTH_NAMES } from '../financeFormat';

const LEVEL: Record<NonNullable<SeasonMonth['level']>, { label: string; badge: string; bar: string }> = {
  strong: { label: 'Forte', badge: 'bg-emerald-500/15 text-emerald-300', bar: 'bg-emerald-500' },
  medium: { label: 'Médio', badge: 'bg-white/10 text-white/60', bar: 'bg-blue-500' },
  weak: { label: 'Fraco', badge: 'bg-red-500/15 text-red-300', bar: 'bg-red-500' },
};
const monthNames = (months: SeasonMonth[]) => months.map((m) => MONTH_NAMES[m.month - 1].slice(0, 3)).join(', ') || '—';

export const ReportsSeasonality: React.FC<{ entries: RevenueEntry[] }> = ({ entries }) => {
  const { months, matrix, monthsAnalyzed } = useMemo(() => seasonality(entries), [entries]);
  if (months.length === 0) return <p className={`${cardClass} text-sm text-white/50`}>Ainda não há faturamento para analisar.</p>;

  const max = Math.max(...months.map((m) => m.avgRevenue ?? 0), 1);
  const strong = months.filter((m) => m.level === 'strong');
  const weak = months.filter((m) => m.level === 'weak');
  const currentKey = monthKeyOf(new Date());

  return (
    <div className="space-y-5">
      <div className={cardClass}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Faturamento médio por mês do ano</h3>
            <p className="mt-1 text-xs text-white/50">Média dos meses completos ({monthsAnalyzed} analisados), contando zero quando o mês não faturou. O mês em andamento não entra.</p>
          </div>
          <div className="text-xs sm:text-right"><p className="text-emerald-300">Mais fortes: {monthNames(strong)}</p><p className="text-red-300">Mais fracos: {monthNames(weak)}</p></div>
        </div>
        {monthsAnalyzed < 12 && <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">Menos de 12 meses de histórico: um mês isolado pode ser acaso, não sazonalidade. O quadro melhora a cada ano.</p>}
        <ul className="space-y-2">
          {months.map((m) => {
            const level = m.level ? LEVEL[m.level] : null;
            return (
              <li key={m.month} className="grid grid-cols-[2.5rem_1fr_5.5rem_3.5rem] items-center gap-2 text-sm sm:grid-cols-[3rem_1fr_7rem_5rem_4.5rem] sm:gap-3">
                <span className="font-semibold text-white/80">{MONTH_NAMES[m.month - 1].slice(0, 3)}</span>
                <div className="h-3 rounded bg-white/5"><div className={`h-3 rounded ${level?.bar ?? 'bg-white/10'}`} style={{ width: `${m.avgRevenue ? Math.max(2, (m.avgRevenue / max) * 100) : 0}%` }} /></div>
                <span className="text-right text-xs tabular-nums text-white sm:text-sm">{m.avgRevenue === null ? '—' : formatMoney(m.avgRevenue)}</span>
                <span className="hidden text-right tabular-nums text-white/55 sm:block">{m.index === null ? '' : `${m.index >= 1 ? '+' : ''}${Math.round((m.index - 1) * 100)}%`}</span>
                {level ? <span className={`justify-self-end rounded-full px-2 py-0.5 text-[11px] font-semibold ${level.badge}`}>{level.label}</span> : <span className="justify-self-end text-[11px] text-white/35">sem dados</span>}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-white/40">% = diferença do mês em relação ao mês típico (mediana dos meses).</p>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <h3 className="mb-3 text-sm font-bold text-white">Faturamento por mês e ano</h3>
        <table className="w-full min-w-[40rem] text-xs">
          <thead><tr className="text-left text-[10px] uppercase tracking-wider text-white/45"><th className="pb-2 font-semibold">Ano</th>{MONTH_NAMES.map((name) => <th key={name} className="pb-2 text-right font-semibold">{name.slice(0, 3)}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/5">
            {matrix.map((row) => (
              <tr key={row.year}>
                <td className="py-2 font-semibold text-white">{row.year}</td>
                {row.months.map((value, i) => (
                  <td key={i} className={`py-2 text-right tabular-nums ${value === null ? 'text-white/25' : 'text-white/80'}`} title={`${row.year}-${String(i + 1).padStart(2, '0')}` === currentKey ? 'Mês em andamento (parcial)' : undefined}>
                    {value === null ? '—' : Math.round(value).toLocaleString('pt-BR')}{`${row.year}-${String(i + 1).padStart(2, '0')}` === currentKey && '*'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-white/40">Valores em reais. * mês em andamento (parcial).</p>
      </div>
    </div>
  );
};
