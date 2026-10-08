import React from 'react';
import type { Checkin } from '../../../services/fitCheckin.js';
import { cardClass } from '../financeFormat';

/** Treinos da semana e do mês (total, academia e funcional). */
export const CheckinStatCards: React.FC<{ week: number; month: Checkin[] }> = ({ week, month }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
      ['Esta semana', String(week), 'treinos (seg a dom)'],
      ['Neste mês', String(month.length), 'treinos'],
      ['Academia no mês', String(month.filter((c) => c.kind === 'gym').length), 'check-ins'],
      ['Funcional no mês', String(month.filter((c) => c.kind === 'functional').length), 'check-ins'],
    ].map(([label, value, hint]) => (
      <div key={label} className={cardClass}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
        <p className="mt-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">{value}</p>
        <p className="mt-1 text-xs text-white/50">{hint}</p>
      </div>
    ))}
  </div>
);
