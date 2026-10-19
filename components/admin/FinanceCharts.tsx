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

export interface CompassItem { key: string; tick: string; label: string; value: number; sub: string }

/**
 * "Bússola": um raio por item (dia, mês ou ano) em volta de um círculo; o maior é destacado em âmbar e o
 * escolhido em branco. Sem escolha, o centro mostra o maior item. `tickEvery`: rótulo no 1º e a cada N itens.
 */
export const Compass: React.FC<{
  items: CompassItem[]; selected: string | null; onSelect: (key: string | null) => void;
  total: number; totalLabel: string; hint: string; color?: string; ariaLabel: string; tickEvery?: number; topSuffix?: string;
}> = ({ items, selected, onSelect, total, totalLabel, hint, color = '#3b82f6', ariaLabel, tickEvery = 1, topSuffix = 'maior' }) => {
  const max = Math.max(...items.map((d) => d.value), 0);
  const top = max > 0 ? items.find((d) => d.value === max)?.key ?? null : null;
  const point = (i: number, r: number) => {
    const a = (i / items.length) * 2 * Math.PI - Math.PI / 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const focus = items.find((d) => d.key === selected) ?? items.find((d) => d.key === top) ?? null;
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[340px]" role="img" aria-label={ariaLabel}>
      <circle cx={C} cy={C} r={R0 - 6} fill="none" stroke="rgba(255,255,255,0.08)" />
      {items.map((d, i) => {
        const len = max > 0 && d.value > 0 ? Math.max(6, (d.value / max) * MAX_LEN) : 3;
        const [x1, y1] = point(i, R0); const [x2, y2] = point(i, R0 + len); const [x3, y3] = point(i, R0 + MAX_LEN + 6);
        const stroke = d.key === selected ? '#ffffff' : d.key === top ? '#fbbf24' : d.value > 0 ? color : 'rgba(255,255,255,0.15)';
        const [lx, ly] = point(i, R0 + MAX_LEN + 20);
        const toggle = () => onSelect(d.key === selected ? null : d.key);
        return (
          <g key={d.key} className="cursor-pointer" onClick={toggle} role="button" tabIndex={0} aria-label={`${d.label}: ${formatMoney(d.value)}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>
            <line x1={x1} y1={y1} x2={x3} y2={y3} stroke="transparent" strokeWidth={Math.max(8, 300 / items.length)} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={items.length > 40 ? 3 : 5} strokeLinecap="round" />
            {(i === 0 || (i + 1) % tickEvery === 0 || d.key === top || d.key === selected) && (
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={d.key === top ? '#fbbf24' : 'rgba(255,255,255,0.45)'}>{d.tick}</text>
            )}
          </g>
        );
      })}
      <text x={C} y={C - 14} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">{focus ? `${focus.label}${focus.key === top && focus.key !== selected ? ` · ${topSuffix}` : ''}` : totalLabel}</text>
      <text x={C} y={C + 6} textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">{formatMoney(focus ? focus.value : total)}</text>
      <text x={C} y={C + 22} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">{focus ? focus.sub : hint}</text>
    </svg>
  );
};

/** Faturamento diário em círculo (um raio por dia do mês); o maior dia é destacado. */
export const DailyCompass: React.FC<{ days: DayRevenue[]; topDay: number | null; selectedDay: number | null; onSelect: (day: number | null) => void; monthTotal: number }> = ({ days, selectedDay, onSelect, monthTotal }) => (
  <Compass items={days.map((d) => ({ key: String(d.day), tick: String(d.day), label: `Dia ${d.day}`, value: d.total, sub: `${d.count} serviço${d.count === 1 ? '' : 's'}` }))}
    selected={selectedDay === null ? null : String(selectedDay)} onSelect={(k) => onSelect(k === null ? null : Number(k))}
    total={monthTotal} totalLabel="Mês" hint="toque em um dia" ariaLabel="Faturamento diário" tickEvery={5} topSuffix="maior dia" />
);

/** Barras horizontais: serviços com mais pedidos (já ordenados). */
export const ServiceBars: React.FC<{ rows: { id: string; label: string; count: number }[] }> = ({ rows }) => {
  const max = Math.max(...rows.map((r) => r.count), 0);
  if (max === 0) return <p className="py-10 text-center text-sm text-white/45">Nenhum pedido concluído neste mês.</p>;
  return (
    <ul className="space-y-2.5" aria-label="Serviços mais pedidos no mês">
      {rows.map((r, i) => (
        <li key={r.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-semibold text-white/85">{i + 1}. {r.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-white">{r.count} {r.count === 1 ? 'pedido' : 'pedidos'}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: `${(r.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
};
