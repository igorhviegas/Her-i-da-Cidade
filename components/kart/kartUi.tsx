import React from 'react';
import { CloudRain, Sun } from 'lucide-react';
import { useRouter } from '../../lib/router';

/** Faixa quadriculada de largada/chegada. */
export const CheckeredBar: React.FC<{ className?: string }> = ({ className = 'h-2' }) => (
  <div
    aria-hidden
    className={`w-full ${className}`}
    style={{ backgroundImage: 'repeating-conic-gradient(#fff 0% 25%, #0b0f1a 0% 50%)', backgroundSize: '16px 16px', opacity: 0.9 }}
  />
);

/** Link interno sem recarregar a página (clique com Ctrl/⌘ ainda abre em nova aba). */
export const KartLink: React.FC<{ to: string; className?: string; children: React.ReactNode; label?: string }> = ({ to, className, children, label }) => {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      aria-label={label}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
};

export type Medal = 1 | 2 | 3;

/** Visual de cada posição do pódio (também usado no perfil: dourado, prata e bronze). */
export const MEDAL_STYLE: Record<Medal, { label: string; text: string; bar: string; glow: string; gradient: string; chip: string }> = {
  1: { label: 'Ouro', text: 'text-amber-300', bar: 'bg-amber-400', glow: 'shadow-[0_0_60px_-10px_rgba(251,191,36,0.55)]', gradient: 'from-amber-300 via-yellow-500 to-amber-700', chip: 'bg-amber-400 text-amber-950' },
  2: { label: 'Prata', text: 'text-slate-200', bar: 'bg-slate-300', glow: 'shadow-[0_0_60px_-12px_rgba(203,213,225,0.45)]', gradient: 'from-slate-100 via-slate-300 to-slate-500', chip: 'bg-slate-300 text-slate-900' },
  3: { label: 'Bronze', text: 'text-orange-300', bar: 'bg-orange-500', glow: 'shadow-[0_0_60px_-12px_rgba(249,115,22,0.5)]', gradient: 'from-orange-300 via-orange-500 to-amber-800', chip: 'bg-orange-500 text-orange-950' },
};

export const medalOf = (rank: number): Medal | null => (rank >= 1 && rank <= 3 ? (rank as Medal) : null);

export const formatDate = (iso: string, withYear = true) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).replace('.', '');

export const WeatherIcon: React.FC<{ weather: 'dry' | 'rain'; className?: string }> = ({ weather, className = 'h-4 w-4' }) =>
  weather === 'rain'
    ? <CloudRain className={`${className} text-sky-300`} aria-label="Chuva" />
    : <Sun className={`${className} text-amber-300`} aria-label="Seco" />;

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const card = 'rounded-2xl border border-white/10 bg-[#0D1527]';
