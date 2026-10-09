import React, { useMemo, useState } from 'react';
import { ChevronDown, Timer } from 'lucide-react';
import { formatLap, pointsFor } from '../../services/kart.js';
import { officialRaces } from '../../services/kartRanking.js';
import type { KartRace } from '../../services/kartService';
import { KartLink, MEDAL_STYLE, WeatherIcon, card, formatDate } from './kartUi';

export const KartRaces: React.FC<{ races: KartRace[] }> = ({ races }) => {
  const list = useMemo(() => officialRaces(races).reverse(), [races]);
  const [open, setOpen] = useState<string | null>(null);
  if (list.length === 0) return <p className={`${card} px-5 py-8 text-center text-white/50`}>Nenhuma corrida registrada ainda.</p>;

  return (
    <ol className="space-y-2">
      {list.map((race) => {
        const fastest = race.results.filter((r) => r.bestLapMs).sort((a, b) => (a.bestLapMs ?? 0) - (b.bestLapMs ?? 0))[0];
        const isOpen = open === race.id;
        return (
          <li key={race.id} className={`${card} overflow-hidden`}>
            <button type="button" onClick={() => setOpen(isOpen ? null : race.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold">Corrida {race.number}<WeatherIcon weather={race.weather} className="h-3.5 w-3.5" /></span>
                <span className="block text-xs text-white/50">{formatDate(race.date)} · {race.heat} · {race.results.length} inscritos</span>
                <span className="mt-1 block truncate text-sm"><span className={`font-bold ${MEDAL_STYLE[1].text}`}>🏆 {race.results[0].name}</span></span>
              </span>
              {fastest && <span className="shrink-0 text-right text-xs text-white/50"><Timer className="ml-auto h-3.5 w-3.5" /><span className="font-bold tabular-nums text-white/80">{formatLap(fastest.bestLapMs)}</span></span>}
              <ChevronDown className={`h-5 w-5 shrink-0 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <ol className="divide-y divide-white/5 border-t border-white/10 bg-black/20">
                {race.results.map((r) => (
                  <li key={r.pilotId}>
                    <KartLink to={`/kart/piloto/${r.pilotId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5">
                      <span className={`w-8 text-center font-black italic tabular-nums ${r.pos <= 3 ? MEDAL_STYLE[r.pos as 1 | 2 | 3].text : 'text-white/40'}`}>{r.pos}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                      <span className="text-xs tabular-nums text-white/55">{formatLap(r.bestLapMs)}</span>
                      <span className="w-12 text-right text-sm font-bold tabular-nums">{pointsFor(r.pos)}<span className="text-[10px] font-normal text-white/40"> pts</span></span>
                    </KartLink>
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ol>
  );
};
