import React, { useState } from 'react';
import type { DayRevenue } from '../../services/financeCalculations';
import { formatMoney, shortMonthLabel } from './financeFormat';

/** Evolução do faturamento mensal (barras SVG; sem dependência de gráficos). */
export const MonthlyBars: React.FC<{ series: { monthKey: string; total: number }[]; selected: string }> = ({ series, selected }) => {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...series.map((s) => s.total), 0);
  if (max === 0) return <p className="py-10 text-center text-sm text-white/45">Sem faturamento no período para exibir a evolução.</p>;
  const shown = series.find((s) => s.monthKey === (hover ?? selected));
  return (
    <div>
      <p className="mb-3 text-xs text-white/50">{shown && <><span className="font-semibold text-white/80">{shortMonthLabel(shown.monthKey)}</span> · {formatMoney(shown.total)}</>}</p>
      <div className="flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label="Evolução do faturamento mensal">
        {series.map((s) => (
          <button
            key={s.monthKey} type="button" onMouseEnter={() => setHover(s.monthKey)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s.monthKey)} onBlur={() => setHover(null)}
            onClick={() => setHover(s.monthKey)} aria-label={`${shortMonthLabel(s.monthKey)}: ${formatMoney(s.total)}`}
            className="group flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <span
              className={`block w-full rounded-t-md transition-colors ${s.monthKey === selected ? 'bg-blue-500' : 'bg-blue-500/35 group-hover:bg-blue-500/60'}`}
              style={{ height: `${Math.max((s.total / max) * 100, s.total > 0 ? 3 : 1)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {series.map((s) => <span key={s.monthKey} className="min-w-0 flex-1 truncate text-center text-[9px] text-white/40 sm:text-[10px]">{shortMonthLabel(s.monthKey).slice(0, 3)}</span>)}
      </div>
    </div>
  );
};

const SIZE = 320; const C = SIZE / 2; const R0 = 58; const MAX_LEN = 72;

/** Faturamento diário em círculo (um raio por dia do mês); o maior dia é destacado. */
export const DailyCompass: React.FC<{ days: DayRevenue[]; topDay: number | null; selectedDay: number | null; onSelect: (day: number | null) => void; monthTotal: number }> = ({ days, topDay, selectedDay, onSelect, monthTotal }) => {
  const max = Math.max(...days.map((d) => d.total), 0);
  const point = (i: number, r: number) => {
    const a = (i / days.length) * 2 * Math.PI - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const focus = days.find((d) => d.day === selectedDay) ?? days.find((d) => d.day === topDay) ?? null;
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[340px]" role="img" aria-label="Faturamento diário">
      <circle cx={C} cy={C} r={R0 - 6} fill="none" stroke="rgba(255,255,255,0.08)" />
      {days.map((d, i) => {
        const len = max > 0 && d.total > 0 ? Math.max(6, (d.total / max) * MAX_LEN) : 3;
        const [x1, y1] = point(i, R0); const [x2, y2] = point(i, R0 + len); const [x3, y3] = point(i, R0 + MAX_LEN + 6);
        const color = d.day === selectedDay ? '#ffffff' : d.day === topDay ? '#fbbf24' : d.total > 0 ? '#3b82f6' : 'rgba(255,255,255,0.15)';
        const [lx, ly] = point(i, R0 + MAX_LEN + 20);
        return (
          <g key={d.day} className="cursor-pointer" onClick={() => onSelect(d.day === selectedDay ? null : d.day)} role="button" tabIndex={0} aria-label={`Dia ${d.day}: ${formatMoney(d.total)}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.day === selectedDay ? null : d.day); } }}>
            <line x1={x1} y1={y1} x2={x3} y2={y3} stroke="transparent" strokeWidth={Math.max(8, 300 / days.length)} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={5} strokeLinecap="round" />
            {(d.day === 1 || d.day % 5 === 0 || d.day === topDay || d.day === selectedDay) && (
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={d.day === topDay ? '#fbbf24' : 'rgba(255,255,255,0.45)'}>{d.day}</text>
            )}
          </g>
        );
      })}
      <text x={C} y={C - 14} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">{focus ? `Dia ${focus.day}${focus.day === topDay && focus.day !== selectedDay ? ' · maior dia' : ''}` : 'Mês'}</text>
      <text x={C} y={C + 6} textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">{formatMoney(focus ? focus.total : monthTotal)}</text>
      <text x={C} y={C + 22} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">{focus ? `${focus.count} serviço${focus.count === 1 ? '' : 's'}` : 'toque em um dia'}</text>
    </svg>
  );
};
