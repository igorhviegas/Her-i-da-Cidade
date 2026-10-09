import React, { useMemo } from 'react';
import { FileDown, Flag, Timer, TriangleAlert } from 'lucide-react';
import { formatLap } from '../../services/kart.js';
import { extraRaces, officialRaces } from '../../services/kartRanking.js';
import type { KartRace, KartVideo } from '../../services/kartService';
import { RaceResults } from './KartRaceResults';
import { KartLink, MEDAL_STYLE, WeatherIcon, card, formatDateLong, plural } from './kartUi';

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-xl bg-black/25 px-3 py-3">
    <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">{label}</p>
    <p className="mt-0.5 break-words text-lg font-black italic leading-tight">{value}</p>
    {hint && <p className="text-[11px] text-white/45">{hint}</p>}
  </div>
);

/** Página de uma corrida: resultado completo, vídeo e o PDF original do kartódromo. */
export const KartRacePage: React.FC<{ races: KartRace[]; id: string; video?: KartVideo; actions?: (race: KartRace) => React.ReactNode }> = ({ races, id, video, actions }) => {
  const race = useMemo(() => officialRaces(races).find((r) => r.id === id) ?? extraRaces(races).find((r) => r.id === id), [races, id]);
  if (!race) return <p className={`${card} px-5 py-8 text-center text-white/60`}>Corrida não encontrada. <KartLink to="/kart/corridas" className="font-bold text-white underline">Ver todas as corridas</KartLink></p>;

  const scored = !race.extra;
  const number = 'number' in race ? race.number : 0;
  const fastest = race.results.filter((r) => r.bestLapMs).sort((a, b) => (a.bestLapMs ?? 0) - (b.bestLapMs ?? 0))[0];

  return (
    <div className="space-y-4">
      <section className={`${card} p-5`}>
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-red-300">
          <Flag className="h-3.5 w-3.5" />{scored ? 'Corrida do campeonato' : 'Fora do campeonato'}
        </p>
        <h2 className="mt-1 text-3xl font-black italic leading-tight">{scored ? `Corrida ${number}` : 'Sessão avulsa'}</h2>
        <p className="mt-1 text-sm text-white/70 first-letter:uppercase">{formatDateLong(race.date)}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/50"><WeatherIcon weather={race.weather} className="h-4 w-4" />{race.weather === 'rain' ? 'Chuva' : 'Pista seca'} · {race.heat}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Pilotos" value={race.results.length} hint={scored ? 'inscritos no campeonato' : 'na sessão'} />
          <Stat label={scored ? 'Vencedor' : 'Mais rápido'} value={<span className={scored ? MEDAL_STYLE[1].text : ''}>{(scored ? race.results[0] : fastest)?.name ?? '—'}</span>} />
          <Stat label="Melhor volta" value={<span className="inline-flex items-center gap-1.5"><Timer className="h-4 w-4 text-red-300" />{formatLap(fastest?.bestLapMs)}</span>} hint={fastest?.name} />
          {scored && <Stat label="Pontuaram" value={plural(race.results.length, 'piloto', 'pilotos')} hint="25 pontos ao vencedor" />}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {race.pdfUrl && (
            <a href={race.pdfUrl} target="_blank" rel="noopener noreferrer" download className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20">
              <FileDown className="h-4 w-4" />Baixar PDF original
            </a>
          )}
          {actions?.(race)}
        </div>
      </section>

      {!scored && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-100">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <p><b className="text-white">Esta corrida NÃO conta para o campeonato</b>: não dá pontos, vitórias nem pódios. Vale apenas para o recorde de melhor volta da pista.</p>
        </div>
      )}

      {video && (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="aspect-video">
            <iframe title={video.title} src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0`} allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" className="h-full w-full" />
          </div>
          <p className="px-4 py-3 text-sm font-bold">{video.title}</p>
        </section>
      )}

      <section className={`${card} overflow-hidden`}>
        <h3 className="px-4 py-3 text-sm font-bold uppercase tracking-widest text-white/60">Resultado</h3>
        <RaceResults race={race} scored={scored} />
      </section>
    </div>
  );
};
