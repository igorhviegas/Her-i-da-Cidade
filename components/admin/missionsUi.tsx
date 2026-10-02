import React from 'react';
import { Star } from 'lucide-react';

export const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
export const labelClass = 'block text-xs font-semibold text-white/70';
export const cardClass = 'rounded-2xl border border-white/10 bg-[#0D1527] p-4 shadow-lg';
export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:opacity-50';
export const ghostButton = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50';

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DifficultyStars: React.FC<{ value: number }> = ({ value }) => (
  <span className="inline-flex items-center gap-0.5 text-amber-300" title={`Dificuldade ${value} de 5`}>
    {Array.from({ length: 5 }, (_, i) => <Star key={i} className={`h-3 w-3 ${i < value ? 'fill-current' : 'opacity-25'}`} />)}
  </span>
);

export const DifficultySelect: React.FC<{ value: number; onChange: (value: number) => void; className?: string }> = ({ value, onChange, className = inputClass }) => (
  <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={className}>
    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} — {['muito fácil', 'fácil', 'média', 'difícil', 'muito difícil'][n - 1]}</option>)}
  </select>
);

export const formatDateTime = (date?: Date) => (date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date) : '');

/** Date → valor de <input type="datetime-local"> (hora local do navegador). */
export function toInputValue(date?: Date | null): string {
  if (!date) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export const ProgressBar: React.FC<{ percent: number; done?: boolean }> = ({ percent, done }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
    <div className={`h-full rounded-full transition-all ${done ? 'bg-emerald-400' : 'bg-blue-500'}`} style={{ width: `${percent}%` }} />
  </div>
);

export const WarningNote: React.FC<{ message: string | null }> = ({ message }) => (message ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{message}</p> : null);

export const ErrorNote: React.FC<{ message: string | null }> = ({ message }) => (message ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{message}</p> : null);
