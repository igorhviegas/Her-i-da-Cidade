import React, { useMemo } from 'react';
import { Crown } from 'lucide-react';
import { plural } from './kartUi';
import { titlesByPilot, yearlyChampions, type YearChampions } from '../../services/kartRanking.js';
import type { KartRace } from '../../services/kartService';
import { KartLink, MEDAL_STYLE, card, type Medal } from './kartUi';

const YearCard: React.FC<{ c: YearChampions }> = ({ c }) => {
  const [first] = c.top;
  const gold = c.done && !!first;
  return (
    <section className={`overflow-hidden rounded-2xl ${gold ? `bg-gradient-to-br ${MEDAL_STYLE[1].gradient} p-[2px] ${MEDAL_STYLE[1].glow}` : 'border border-white/10 bg-[#0D1527]'}`}>
      <div className={`rounded-[14px] p-4 ${gold ? 'bg-[#0B1120]' : ''}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-2xl font-black italic">{c.year}</h3>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${gold ? MEDAL_STYLE[1].chip : 'bg-white/10 text-white/60'}`}>{gold ? 'Campeão' : 'Em andamento'}</span>
        </div>
        <ol className="space-y-1.5">
          {c.top.map((row) => (
            <li key={row.pilotId}>
              <KartLink to={`/kart/piloto/${row.pilotId}`} className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2.5 hover:bg-black/40">
                <span className={`w-6 text-center text-xl font-black italic ${MEDAL_STYLE[row.rank as Medal].text}`}>{row.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate font-bold">{row.rank === 1 && gold && <Crown className="h-4 w-4 shrink-0 text-amber-300" />}{row.name}</span>
                  <span className="block text-xs text-white/50">{plural(row.races, 'corrida', 'corridas')} · {plural(row.wins, 'vitória', 'vitórias')}</span>
                </span>
                <span className="text-lg font-black italic tabular-nums">{row.points}<span className="ml-1 text-xs font-semibold not-italic text-white/40">pts</span></span>
              </KartLink>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-white/40">{plural(c.races, 'corrida oficial', 'corridas oficiais')} no ano{gold ? '' : ' · o líder atual ainda pode mudar'}</p>
      </div>
    </section>
  );
};

/** Hall da fama: o campeão de cada ano (1º em pontos no ano) e quem mais venceu o campeonato. */
export const KartChampions: React.FC<{ races: KartRace[]; names: Map<string, string> }> = ({ races, names }) => {
  const champions = useMemo(() => yearlyChampions(races), [races]);
  const titles = useMemo(() => [...titlesByPilot(champions)].sort((a, b) => b[1].length - a[1].length || b[1][0] - a[1][0]), [champions]);
  if (champions.length === 0) return <p className={`${card} px-5 py-8 text-center text-white/50`}>Ainda não há campeonatos registrados.</p>;
  return (
    <div className="space-y-4">
      {titles.length > 0 && (
        <section className={`${card} p-4`}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-300"><Crown className="h-4 w-4" />Maiores campeões</h3>
          <ul className="space-y-1.5">
            {titles.map(([pilotId, years]) => (
              <li key={pilotId}><KartLink to={`/kart/piloto/${pilotId}`} className="flex items-baseline justify-between gap-3 hover:underline"><span className="font-bold">{names.get(pilotId) ?? pilotId}</span><span className="text-sm text-white/60">{plural(years.length, 'título', 'títulos')} · {years.join(', ')}</span></KartLink></li>
            ))}
          </ul>
        </section>
      )}
      {champions.map((c) => <YearCard key={c.year} c={c} />)}
    </div>
  );
};
