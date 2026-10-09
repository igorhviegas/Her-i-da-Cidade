import React, { useMemo } from 'react';
import { formatLap } from '../../services/kart.js';
import type { LapPoint } from '../../services/kartRanking.js';

export interface LapSeries { id: string; name: string; color: string; points: LapPoint[] }

const W = 360;
const H = 230;
const M = { l: 46, r: 16, t: 18, b: 36 };

const shortLap = (ms: number) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(1).padStart(4, '0')}`;
const monthYear = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '').replace(' de ', '/');

/**
 * Evolução da melhor volta ao longo das corridas (uma ou mais linhas). Mais rápido = mais alto.
 * Só pista seca entra no gráfico (na chuva o tempo não é comparável); ◆ = corrida fora do campeonato;
 * linha forte = recorde pessoal (cada ponto grande com anel é uma volta que baixou o recorde).
 */
export const KartLapChart: React.FC<{ series: LapSeries[] }> = ({ series }) => {
  const chart = useMemo(() => {
    const dry = series.map((s) => ({ ...s, points: s.points.filter((p) => !p.rain) }));
    const races = new Map<string, string>(); // raceId → data
    for (const s of dry) for (const p of s.points) races.set(p.raceId, p.date);
    const order = [...races].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
    const index = new Map(order.map(([id], i) => [id, i]));
    const all = dry.flatMap((s) => s.points.map((p) => p.ms));
    if (all.length === 0) return null;
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = Math.max((hi - lo) * 0.15, 400);
    const [yMin, yMax] = [lo - pad, hi + pad];
    const x = (raceId: string) => M.l + (order.length <= 1 ? (W - M.l - M.r) / 2 : ((index.get(raceId) ?? 0) / (order.length - 1)) * (W - M.l - M.r));
    const y = (ms: number) => M.t + ((ms - yMin) / (yMax - yMin)) * (H - M.t - M.b);
    const ticks = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * i) / 3);
    // até 4 datas, bem espaçadas (primeira e última sempre aparecem)
    const wanted = new Set(Array.from({ length: Math.min(4, order.length) }, (_, k) => (order.length === 1 ? 0 : Math.round((k * (order.length - 1)) / (Math.min(4, order.length) - 1)))));
    const xLabels = order.map(([id, date], i) => ({ id, date, i })).filter(({ i }) => wanted.has(i));
    const hidden = series.reduce((n, s) => n + s.points.filter((p) => p.rain).length, 0);
    return { dry, x, y, ticks, xLabels, hidden, count: order.length };
  }, [series]);

  if (!chart) return <p className="py-8 text-center text-sm text-white/50">Ainda não há voltas em pista seca para mostrar.</p>;
  const { dry, x, y, ticks, xLabels, hidden, count } = chart;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Evolução da melhor volta: ${dry.map((s) => `${s.name}, recorde ${formatLap(Math.min(...s.points.map((p) => p.ms)))}`).join('; ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
            <text x={M.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.5)">{shortLap(t)}</text>
          </g>
        ))}
        {xLabels.map(({ id, date, i }) => <text key={id} x={x(id)} y={H - M.b + 16} textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'} fontSize="9" fill="rgba(255,255,255,0.5)">{monthYear(date)}</text>)}

        {dry.map((s) => {
          const pbs = s.points.filter((p) => p.pb);
          const last = pbs[pbs.length - 1];
          return (
            <g key={s.id}>
              {s.points.length > 1 && <polyline points={s.points.map((p) => `${x(p.raceId)},${y(p.ms)}`).join(' ')} fill="none" stroke={s.color} strokeOpacity="0.35" strokeWidth="1.5" strokeLinejoin="round" />}
              {pbs.length > 0 && <polyline points={[...pbs.map((p) => `${x(p.raceId)},${y(p.ms)}`), `${W - M.r},${y(last.ms)}`].join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
              {s.points.map((p) => (p.extra
                ? <rect key={p.raceId} x={x(p.raceId) - 3.5} y={y(p.ms) - 3.5} width="7" height="7" transform={`rotate(45 ${x(p.raceId)} ${y(p.ms)})`} fill={s.color} opacity={p.pb ? 1 : 0.7} stroke={p.pb ? '#fff' : 'none'} strokeWidth="1.5" />
                : <circle key={p.raceId} cx={x(p.raceId)} cy={y(p.ms)} r={p.pb ? 5 : 3} fill={s.color} opacity={p.pb ? 1 : 0.7} stroke={p.pb ? '#fff' : 'none'} strokeWidth="1.5" />))}
              {last && <text x={Math.min(Math.max(x(last.raceId), M.l + 22), W - M.r - 22)} y={y(last.ms) - 9} textAnchor="middle" fontSize="10" fontWeight="800" fill={s.color} stroke="#0D1527" strokeWidth="3" paintOrder="stroke">{formatLap(last.ms)}</text>}
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/55">
        {dry.length > 1 && dry.map((s) => <li key={s.id} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</li>)}
        <li>● corrida</li>
        <li>◆ fora do campeonato</li>
        <li>linha forte = recorde pessoal</li>
        {hidden > 0 && <li>{hidden} volta(s) na chuva fora do gráfico</li>}
      </ul>
    </div>
  );
};
