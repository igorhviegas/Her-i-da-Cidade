import React, { useState } from 'react';

const number = (n: number, decimals = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export const shortDay = (day: string) => `${day.slice(8)}/${day.slice(5, 7)}`;

/** Barras por dia (SVG/CSS, sem biblioteca). Dia sem registro (null) aparece como um traço apagado, nunca como zero. */
export const DailyBars: React.FC<{ days: string[]; values: (number | null)[]; unit: string; decimals?: number; label: string; color?: string }> = ({ days, values, unit, decimals = 0, label, color = '#3b82f6' }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (values.every((v) => v === null)) return <p className="py-10 text-center text-sm text-white/45">Sem dados neste período.</p>;
  const max = Math.max(...values.map((v) => v ?? 0), 0);
  const lastIndex = values.findLastIndex((v) => v !== null);
  const shown = hover ?? lastIndex;
  const at = (i: number) => (values[i] === null ? 'sem registro' : `${number(values[i], decimals)} ${unit}`);
  return (
    <div>
      <p className="mb-3 text-xs text-white/50"><span className="font-semibold text-white/80">{shortDay(days[shown])}</span> · {at(shown)}</p>
      <div className="flex h-40 items-end gap-px sm:gap-0.5" role="img" aria-label={label}>
        {values.map((v, i) => (
          <button key={days[i]} type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)}
            aria-label={`${shortDay(days[i])}: ${at(i)}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="block w-full rounded-t-sm transition-opacity group-hover:opacity-100"
              style={v === null
                ? { height: '2%', background: 'rgba(255,255,255,0.1)' }
                : { height: `${Math.max(max > 0 ? (v / max) * 100 : 0, 2)}%`, background: color, opacity: i === shown ? 1 : 0.5 }} />
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-white/40"><span>{shortDay(days[0])}</span><span>{shortDay(days[Math.floor((days.length - 1) / 2)])}</span><span>{shortDay(days[days.length - 1])}</span></div>
    </div>
  );
};

const W = 320; const H = 140; const PAD = 10;

/** Peso por dia: pontos reais e a média móvel (linha). A escala acompanha o intervalo dos dados, não começa em zero. */
export const WeightLine: React.FC<{ days: string[]; values: (number | null)[]; average: (number | null)[] }> = ({ days, values, average }) => {
  const real = values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
  if (!real.length) return <p className="py-10 text-center text-sm text-white/45">Nenhuma pesagem neste período.</p>;
  const lo = Math.min(...real.map((p) => p.v)) - 0.5; const hi = Math.max(...real.map((p) => p.v)) + 0.5;
  const x = (i: number) => PAD + (values.length > 1 ? (i / (values.length - 1)) * (W - 2 * PAD) : (W - 2 * PAD) / 2);
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
  const trend = average.flatMap((v, i) => (v === null ? [] : [`${x(i)},${y(v)}`])).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução do peso">
      <text x={PAD} y={12} fontSize="9" fill="rgba(255,255,255,0.4)">{number(hi, 1)} kg</text>
      <text x={PAD} y={H - 2} fontSize="9" fill="rgba(255,255,255,0.4)">{number(lo, 1)} kg</text>
      {real.length > 1 && <polyline points={trend} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" />}
      {real.map(({ i, v }) => <circle key={days[i]} cx={x(i)} cy={y(v)} r="3.5" fill="#3b82f6"><title>{`${shortDay(days[i])}: ${number(v, 1)} kg`}</title></circle>)}
    </svg>
  );
};
