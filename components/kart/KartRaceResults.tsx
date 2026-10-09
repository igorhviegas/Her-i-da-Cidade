import React from 'react';
import { formatLap, pointsFor } from '../../services/kart.js';
import { CirclePlay } from 'lucide-react';
import type { KartRace, KartVideo } from '../../services/kartService';
import { KartLink, MEDAL_STYLE } from './kartUi';

/** Resultado de uma corrida (lista de pilotos). `scored` = corrida do campeonato (mostra pontos); sessão avulsa mostra só a volta. */
export const RaceResults: React.FC<{ race: KartRace; scored: boolean; highlight?: string; video?: KartVideo }> = ({ race, scored, highlight, video }) => (
  <div className="border-t border-white/10 bg-black/20">
    {video && (
      <KartLink to={`/kart/videos?v=${video.id}`} className="m-3 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-red-500">
        <CirclePlay className="h-5 w-5" />Assistir à corrida
      </KartLink>
    )}
  <ol className="divide-y divide-white/5">
    {race.results.map((r) => (
      <li key={r.pilotId}>
        <KartLink to={`/kart/piloto/${r.pilotId}`} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 ${r.pilotId === highlight ? 'bg-white/10' : ''}`}>
          <span className={`w-8 text-center font-black italic tabular-nums ${scored && r.pos <= 3 ? MEDAL_STYLE[r.pos as 1 | 2 | 3].text : 'text-white/40'}`}>{r.pos}</span>
          <span className={`min-w-0 flex-1 truncate text-sm ${r.pilotId === highlight ? 'font-black' : 'font-semibold'}`}>{r.name}</span>
          <span className="text-xs tabular-nums text-white/55">{formatLap(r.bestLapMs)}</span>
          {scored && <span className="w-12 text-right text-sm font-bold tabular-nums">{pointsFor(r.pos)}<span className="text-[10px] font-normal text-white/40"> pts</span></span>}
        </KartLink>
      </li>
    ))}
  </ol>
  </div>
);
