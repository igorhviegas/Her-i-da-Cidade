import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, Timer, TriangleAlert } from 'lucide-react';
import { formatLap } from '../../services/kart.js';
import { extraRaces, officialRaces } from '../../services/kartRanking.js';
import type { KartRace, KartVideo } from '../../services/kartService';
import { RaceResults } from './KartRaceResults';
import { KartLink, MEDAL_STYLE, WeatherIcon, card, formatDate, plural } from './kartUi';

const fastestOf = (race: KartRace) => race.results.filter((r) => r.bestLapMs).sort((a, b) => (a.bestLapMs ?? 0) - (b.bestLapMs ?? 0))[0];

/** Cartão de uma corrida que abre e fecha mostrando o resultado; o ícone ↗ abre a página completa da corrida. */
const RaceCard: React.FC<{ race: KartRace; title: string; scored: boolean; open: boolean; onToggle: () => void; video?: KartVideo; actions?: React.ReactNode }> = ({ race, title, scored, open, onToggle, video, actions }) => {
  const fastest = fastestOf(race);
  return (
    <li className={`${card} overflow-hidden`}>
      <div className="flex items-center">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 pr-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-bold">{title}<WeatherIcon weather={race.weather} className="h-3.5 w-3.5" /></span>
            <span className="block text-xs text-white/50">{formatDate(race.date)} · {race.heat} · {plural(race.results.length, 'piloto', 'pilotos')}</span>
            <span className="mt-1 block truncate text-sm">
              {scored ? <span className={`font-bold ${MEDAL_STYLE[1].text}`}>🏆 {race.results[0].name}</span> : <span className="font-bold text-white/80">⏱ {fastest?.name ?? '—'}</span>}
            </span>
          </span>
          {fastest && <span className="shrink-0 text-right text-xs text-white/50"><Timer className="ml-auto h-3.5 w-3.5" /><span className="font-bold tabular-nums text-white/80">{formatLap(fastest.bestLapMs)}</span></span>}
          <ChevronDown className={`h-5 w-5 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex shrink-0 items-center gap-0.5 pr-2">
          {actions}
          <KartLink to={`/kart/corrida/${race.id}`} label="Abrir a página da corrida" className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"><ArrowUpRight className="h-5 w-5" /></KartLink>
        </div>
      </div>
      {open && <RaceResults race={race} scored={scored} video={video} />}
    </li>
  );
};

export const KartRaces: React.FC<{ races: KartRace[]; videos: Map<string, KartVideo>; shareRace?: (race: KartRace) => React.ReactNode }> = ({ races, videos, shareRace }) => {
  const list = useMemo(() => officialRaces(races).reverse(), [races]);
  const extras = useMemo(() => extraRaces(races), [races]);
  const [open, setOpen] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-6">
      {list.length === 0 ? <p className={`${card} px-5 py-8 text-center text-white/50`}>Nenhuma corrida registrada ainda.</p> : (
        <ol className="space-y-2">{list.map((race) => <RaceCard key={race.id} race={race} title={`Corrida ${race.number}`} scored open={open === race.id} onToggle={() => toggle(race.id)} video={videos.get(race.id)} actions={shareRace?.(race)} />)}</ol>
      )}

      <section className="space-y-3">
        <button type="button" onClick={() => setShowExtras((v) => !v)} aria-expanded={showExtras} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-red-600 px-4 py-3.5 text-left text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-600/25 hover:bg-red-500">
          <span>Corridas fora do campeonato ({extras.length})</span>
          <ChevronDown className={`h-5 w-5 transition-transform ${showExtras ? 'rotate-180' : ''}`} />
        </button>
        {showExtras && (
          <>
            <div role="alert" className="flex gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-100">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <p><b className="text-white">Estas corridas NÃO contam para o campeonato</b>: não dão pontos, vitórias nem pódios. Elas valem apenas para o <b className="text-white">recorde de melhor volta da pista</b>.</p>
            </div>
            {extras.length === 0
              ? <p className={`${card} px-5 py-6 text-center text-white/50`}>Nenhuma corrida fora do campeonato registrada.</p>
              : <ol className="space-y-2">{extras.map((race) => <RaceCard key={race.id} race={race} title="Fora do campeonato" scored={false} open={open === race.id} onToggle={() => toggle(race.id)} video={videos.get(race.id)} actions={shareRace?.(race)} />)}</ol>}
          </>
        )}
      </section>
    </div>
  );
};
