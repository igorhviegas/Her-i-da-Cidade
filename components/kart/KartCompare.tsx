import React, { useEffect, useMemo, useState } from 'react';
import { Swords, X } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { formatLap } from '../../services/kart.js';
import { MAX_COMPARE, comparePilots, type ComparePilot, type CompareMetric } from '../../services/kartCompare.js';
import { lapHistory, raceYears, RECENT_RACES, racesInScope } from '../../services/kartRanking.js';
import { compareStory } from '../../services/kartShare.js';
import type { KartPilot, KartRace } from '../../services/kartService';
import { KartLapChart } from './KartLapChart';
import { PeriodPills, periodText, toScope, type ScopeKey } from './KartPeriod';
import { ShareImageButton } from './ShareImageButton';
import { MEDAL_STYLE, card, formatDate, plural, type Medal } from './kartUi';

export const COMPARE_COLORS = ['#ef4444', '#38bdf8', '#fbbf24', '#34d399', '#a78bfa'];

const ROWS: { key: CompareMetric; label: string; format: (p: ComparePilot) => string }[] = [
  { key: 'points', label: 'Pontos', format: (p) => String(p.points) },
  { key: 'races', label: 'Corridas', format: (p) => String(p.races) },
  { key: 'wins', label: 'Vitórias', format: (p) => String(p.wins) },
  { key: 'podiums', label: 'Pódios', format: (p) => String(p.podiums) },
  { key: 'pointsPerRace', label: 'Pontos por corrida', format: (p) => (p.pointsPerRace === null ? '—' : String(p.pointsPerRace).replace('.', ',')) },
  { key: 'avgPos', label: 'Posição média', format: (p) => (p.avgPos === null ? '—' : `P${String(p.avgPos).replace('.', ',')}`) },
  { key: 'bestLapMs', label: 'Melhor volta', format: (p) => formatLap(p.bestLapMs) },
];

/** Confronto direto: escolha de 2 a 5 pilotos; o link (?p=a,b,c) pode ser compartilhado. */
export const KartCompare: React.FC<{ races: KartRace[]; pilots: KartPilot[] }> = ({ races, pilots }) => {
  const { search } = useRouter();
  const known = useMemo(() => new Map(pilots.map((p) => [p.id, p.name])), [pilots]);
  const [ids, setIds] = useState<string[]>(() => (new URLSearchParams(search).get('p') ?? '').split(',').filter((id) => known.has(id)).slice(0, MAX_COMPARE));
  const [scopeKey, setScopeKey] = useState<ScopeKey>('all');
  const years = useMemo(() => raceYears(races), [races]);

  useEffect(() => { // mantém os pilotos escolhidos no endereço, para copiar e mandar o confronto
    const url = ids.length ? `/kart/confronto?p=${ids.join(',')}` : '/kart/confronto';
    window.history.replaceState({}, '', url);
  }, [ids]);

  const scope = useMemo(() => toScope(scopeKey), [scopeKey]);
  const comparison = useMemo(() => (ids.length >= 2 ? comparePilots(races, ids, known, scope) : null), [races, ids, known, scope]);
  const colorOf = (id: string) => COMPARE_COLORS[ids.indexOf(id) % COMPARE_COLORS.length];
  const label = periodText(scopeKey, racesInScope(races, toScope('recent')).length || RECENT_RACES);
  const free = pilots.filter((p) => !ids.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const series = ids.map((id) => ({ id, name: known.get(id) ?? id, color: colorOf(id), points: lapHistory(races, id) }));

  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3 p-4`}>
        <h2 className="flex items-center gap-2 text-lg font-black italic"><Swords className="h-5 w-5 text-red-400" />Confronto direto</h2>
        <p className="text-sm text-white/60">Escolha de 2 a {MAX_COMPARE} pilotos para ver quem leva a melhor.</p>
        <ul className="flex flex-wrap gap-2">
          {ids.map((id) => (
            <li key={id} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold" style={{ borderColor: colorOf(id), background: `${colorOf(id)}22` }}>
              {known.get(id) ?? id}
              <button type="button" onClick={() => setIds((cur) => cur.filter((x) => x !== id))} aria-label={`Remover ${known.get(id) ?? id}`} className="rounded-full p-0.5 text-white/70 hover:bg-white/15 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
        <select aria-label="Adicionar piloto ao confronto" value="" disabled={ids.length >= MAX_COMPARE || free.length === 0} onChange={(e) => { const id = e.target.value; if (id) setIds((cur) => [...cur, id].slice(0, MAX_COMPARE)); }} className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-[15px] text-white disabled:opacity-40">
          <option value="">{ids.length >= MAX_COMPARE ? `Máximo de ${MAX_COMPARE} pilotos` : '+ Adicionar piloto…'}</option>
          {free.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </section>

      {!comparison ? (
        <p className={`${card} px-5 py-8 text-center text-white/55`}>{ids.length === 0 ? 'Adicione pelo menos dois pilotos para comparar.' : 'Falta mais um piloto para comparar.'}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1"><PeriodPills value={scopeKey} onChange={setScopeKey} years={years} /></div>
            <ShareImageButton label="Compartilhar o confronto (imagem para o Story)" fileName={`confronto-${ids.join('-')}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" build={() => compareStory({ comparison, colors: COMPARE_COLORS, periodLabel: label })} />
          </div>

          <section className={`${card} overflow-x-auto p-3`}>
            <div className="grid min-w-[300px] items-end gap-1.5" style={{ gridTemplateColumns: `minmax(86px,1.1fr) repeat(${comparison.pilots.length}, minmax(0,1fr))` }}>
              <span />
              {comparison.pilots.map((p) => (
                <span key={p.pilotId} className="min-w-0 border-b-4 pb-1.5 text-center text-xs font-black leading-tight" style={{ borderColor: colorOf(p.pilotId) }}>{p.name}</span>
              ))}
              {ROWS.map((row) => (
                <React.Fragment key={row.key}>
                  <span className="py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/45">{row.label}</span>
                  {comparison.pilots.map((p) => {
                    const best = comparison.best[row.key].includes(p.pilotId);
                    return <span key={p.pilotId} className={`rounded-lg py-2.5 text-center text-sm tabular-nums ${best ? 'font-black text-white' : 'text-white/70'}`} style={best ? { background: `${colorOf(p.pilotId)}33` } : undefined}>{row.format(p)}</span>;
                  })}
                </React.Fragment>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-white/40">Destaque = melhor da linha · {label}{comparison.pilots.length > 2 ? ` · ${plural(comparison.together, 'corrida com todos', 'corridas com todos')}` : ''}</p>
          </section>

          <section className={`${card} space-y-3 p-4`}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/60">Quem chega na frente</h3>
            {comparison.duels.map((d) => {
              const total = d.aWins + d.bWins;
              return (
                <div key={`${d.a}-${d.b}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm font-bold">
                    <span className="min-w-0 truncate">{known.get(d.a)} <span className="text-lg font-black italic" style={{ color: colorOf(d.a) }}>{d.aWins}</span></span>
                    <span className="min-w-0 truncate text-right"><span className="text-lg font-black italic" style={{ color: colorOf(d.b) }}>{d.bWins}</span> {known.get(d.b)}</span>
                  </div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
                    {total > 0 && <><span style={{ width: `${(d.aWins / total) * 100}%`, background: colorOf(d.a) }} /><span style={{ width: `${(d.bWins / total) * 100}%`, background: colorOf(d.b) }} /></>}
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">{d.together === 0 ? 'Nunca correram juntos neste período.' : `${plural(d.together, 'corrida junta', 'corridas juntas')}: vence quem termina na frente do outro.`}</p>
                </div>
              );
            })}
          </section>

          <section className={`${card} p-4`}>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-white/60">Evolução da melhor volta</h3>
            <KartLapChart series={series} />
          </section>

          {comparison.common.length > 0 && (
            <section className={`${card} p-3`}>
              <h3 className="px-1 pb-2 pt-1 text-sm font-bold uppercase tracking-widest text-white/60">Corridas em comum</h3>
              <ul className="space-y-1.5">
                {comparison.common.map((row) => {
                  const bestPos = Math.min(...row.positions.filter((p): p is number => p !== null));
                  return (
                    <li key={row.raceId} className="flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2">
                      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Corrida {row.number}</span><span className="block text-[11px] text-white/45">{formatDate(row.date)}</span></span>
                      {row.positions.map((pos, i) => (
                        <span key={ids[i]} className="w-11 text-center text-sm font-black italic tabular-nums" style={{ color: pos === null ? 'rgba(255,255,255,0.25)' : pos === bestPos ? COMPARE_COLORS[i % COMPARE_COLORS.length] : 'rgba(255,255,255,0.7)' }}>
                          {pos === null ? '—' : <span className={pos <= 3 ? MEDAL_STYLE[pos as Medal].text : ''}>P{pos}</span>}
                        </span>
                      ))}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 px-1 text-[11px] text-white/40">Na ordem dos pilotos escolhidos: {ids.map((id, i) => <span key={id} style={{ color: COMPARE_COLORS[i % COMPARE_COLORS.length] }}>{known.get(id)?.split(' ')[0]}{i < ids.length - 1 ? ' · ' : ''}</span>)}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
};
