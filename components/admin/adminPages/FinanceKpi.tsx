import React from 'react';
import { cardClass } from '../financeFormat';

interface KpiProps { label: string; value: string; hint?: React.ReactNode; tone?: string }

export const Kpi: React.FC<KpiProps> = ({ label, value, hint, tone = 'text-white' }) => (
  <div className={cardClass}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
    <p className={`mt-1 text-xl font-extrabold tabular-nums sm:text-2xl ${tone}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
  </div>
);
