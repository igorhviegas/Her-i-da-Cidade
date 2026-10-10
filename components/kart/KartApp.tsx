import React, { useMemo } from 'react';
import { ChevronLeft, Crown, Flag, Trophy, CirclePlay } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { upcomingRace } from '../../services/kartNext.js';
import { useKartNext, useKartPilots, useKartRaces, useKartVideos } from '../../services/kartService';
import { videosByRace } from '../../services/kartVideos.js';
import { KartChampions } from './KartChampions';
import { KartCompare } from './KartCompare';
import { KartPilotPage } from './KartPilotPage';
import { KartRacePage } from './KartRacePage';
import { KartRaces } from './KartRaces';
import { KartRanking } from './KartRanking';
import { KartVideos } from './KartVideos';
import { RaceShareButton } from './RaceShareButton';
import { CheckeredBar, KartLink } from './kartUi';

// Rota pública sem login (como o /agente-hdc): leitura aberta em firestore.rules, escrita só de administradores.

const TABS = [
  { to: '/kart', label: 'Ranking', icon: Trophy },
  { to: '/kart/corridas', label: 'Corridas', icon: Flag },
  { to: '/kart/campeoes', label: 'Campeões', icon: Crown },
  { to: '/kart/videos', label: 'Vídeos', icon: CirclePlay },
] as const;

export const KartApp: React.FC = () => {
  const { path } = useRouter();
  const pilots = useKartPilots();
  const races = useKartRaces();
  const videos = useKartVideos();
  const nextConfig = useKartNext();

  // O nome vem do cadastro de pilotos: renomear um piloto vale também para as corridas já salvas.
  const named = useMemo(() => {
    const names = new Map((pilots ?? []).map((p) => [p.id, p.name]));
    return (races ?? []).map((race) => ({ ...race, results: race.results.map((r) => ({ ...r, name: names.get(r.pilotId) ?? r.name })) }));
  }, [pilots, races]);

  const next = useMemo(() => upcomingRace(nextConfig), [nextConfig]);
  const raceVideos = useMemo(() => videosByRace(videos), [videos]);
  const names = useMemo(() => new Map((pilots ?? []).map((p) => [p.id, p.name])), [pilots]);

  const parts = path.split('/').filter(Boolean); // ['kart', 'piloto', id]
  const section = parts[1] ?? '';
  const pilotId = section === 'piloto' ? decodeURIComponent(parts[2] ?? '') : '';
  const isPilot = section === 'piloto';
  const isRace = section === 'corrida';
  const isCompare = section === 'confronto';
  const raceId = isRace ? decodeURIComponent(parts[2] ?? '') : '';
  const backTo = isRace ? '/kart/corridas' : '/kart';
  const loading = pilots === null || races === null;

  return (
    <div className="min-h-screen bg-[#070B14] pb-28 text-white antialiased" style={{ WebkitTapHighlightColor: 'transparent' }}>
      <header className="sticky top-0 z-40 bg-[#070B14]/95 shadow-lg shadow-black/40 backdrop-blur">
        <CheckeredBar />
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {(isPilot || isRace || isCompare) && <KartLink to={backTo} label={isRace ? 'Voltar às corridas' : 'Voltar ao ranking'} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><ChevronLeft className="h-6 w-6" /></KartLink>}
          <div className="min-w-0">
            <h1 className="text-xl font-black uppercase italic leading-none tracking-tight"><span className="text-red-500">Viegas</span> Kart</h1>
            <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.18em] text-white/45">Campeonato · Kartódromo de Betim</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {loading ? <p className="px-1 text-sm text-white/50">Carregando…</p>
          : isPilot ? <KartPilotPage pilot={pilots.find((p) => p.id === pilotId)} races={named} videos={raceVideos} />
          : isRace ? <KartRacePage races={named} id={raceId} video={raceVideos.get(raceId)} actions={(race) => <RaceShareButton race={race} text="Compartilhar" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500" />} />
          : isCompare ? <KartCompare races={named} pilots={pilots} />
          : section === 'corridas' ? <KartRaces races={named} videos={raceVideos} shareRace={(race) => <RaceShareButton race={race} />} />
          : section === 'campeoes' ? <KartChampions races={named} names={names} />
          : section === 'videos' ? <KartVideos videos={videos} />
          : <KartRanking races={named} pilots={pilots} next={next} />}
      </main>

      <nav aria-label="Seções do campeonato" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#070B14]/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = to === '/kart' ? section === '' || isPilot || isCompare : to === '/kart/corridas' ? section === 'corridas' || isRace : section === to.split('/')[2];
            return (
              <li key={to}>
                <KartLink to={to} className={`flex flex-col items-center gap-1 py-3 text-[11px] font-bold uppercase tracking-wide transition-colors ${active ? 'text-red-400' : 'text-white/45 hover:text-white'}`}>
                  <Icon className="h-6 w-6" />{label}
                </KartLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};
