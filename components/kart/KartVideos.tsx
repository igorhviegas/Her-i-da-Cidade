import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { KART_VIDEO_KINDS, type KartVideo, type KartVideoKind } from '../../services/kartVideos.js';
import { card } from './kartUi';

const sortVideos = (a: KartVideo, b: KartVideo) => a.order - b.order;

export const KartVideos: React.FC<{ videos: KartVideo[] | null }> = ({ videos }) => {
  const [kind, setKind] = useState<KartVideoKind>('tip');
  const [playing, setPlaying] = useState<string | null>(null);
  if (videos === null) return <p className="px-1 text-sm text-white/50">Carregando…</p>;

  const active = videos.filter((v) => v.active !== false && v.youtubeId);
  const list = active.filter((v) => v.kind === kind).sort(sortVideos);
  const current = list.find((v) => v.id === playing) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#0D1527] p-1" role="group" aria-label="Tipo de vídeo">
        {(Object.keys(KART_VIDEO_KINDS) as KartVideoKind[]).map((k) => (
          <button key={k} type="button" onClick={() => { setKind(k); setPlaying(null); }} aria-pressed={kind === k} className={`rounded-xl py-3 text-sm font-black uppercase tracking-wide transition-colors ${kind === k ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'text-white/50 hover:text-white'}`}>
            {KART_VIDEO_KINDS[k]} <span className="text-xs font-semibold opacity-70">({active.filter((v) => v.kind === k).length})</span>
          </button>
        ))}
      </div>

      {current && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="aspect-video">
            <iframe
              key={current.id}
              title={current.title}
              src={`https://www.youtube-nocookie.com/embed/${current.youtubeId}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          <p className="px-4 py-3 text-sm font-bold">{current.title}</p>
        </div>
      )}

      {list.length === 0 ? (
        <p className={`${card} px-5 py-8 text-center text-white/50`}>Ainda não há vídeos desta categoria.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((v) => (
            <li key={v.id}>
              <button type="button" onClick={() => { setPlaying(v.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`${card} group block w-full overflow-hidden text-left transition-colors hover:border-white/30 ${v.id === playing ? 'border-red-500/60' : ''}`}>
                <span className="relative block aspect-video bg-black">
                  <img src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                  <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 shadow-lg"><Play className="h-5 w-5 fill-white text-white" /></span></span>
                </span>
                <span className="block px-4 py-3 text-sm font-bold leading-snug">{v.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
