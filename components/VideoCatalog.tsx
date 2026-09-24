import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../lib/router';
import { Video } from '../types';
import { getVideos, subscribeToVideos } from '../services/videosService';
import { searchVideos } from '../utils/videoSearch';
import { VideoPlayerFullscreen } from './VideoPlayerFullscreen';
import { VideoRow } from './VideoRow';

export const VideoCatalog: React.FC = () => {
  const { navigate } = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getVideos().then(setVideos).catch(() => setVideos([]));
    return subscribeToVideos(setVideos);
  }, []);

  const availableVideos = useMemo(() => videos.filter((video) => video.active !== false), [videos]);
  const matchingVideos = useMemo(() => searchVideos(availableVideos, search), [availableVideos, search]);
  const featuredVideo = matchingVideos[0];
  const selectedIndex = matchingVideos.findIndex((video) => video.id === selectedId);
  const selectedVideo = selectedIndex >= 0 ? matchingVideos[selectedIndex] : null;

  const categorizedVideos = useMemo(() => {
    const categories = new Map<string, Video[]>();
    matchingVideos.forEach((video) => {
      const names = video.categories?.length ? video.categories : ['Outros vídeos'];
      names.forEach((name) => categories.set(name, [...(categories.get(name) || []), video]));
    });
    return Array.from(categories.entries());
  }, [matchingVideos]);

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070b]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex items-center gap-3"><button type="button" onClick={() => navigate('/')} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10">Voltar</button><h1 className="text-xl font-black tracking-tight md:text-2xl">Catálogo de Vídeos</h1></div>
          <label className="relative block w-full sm:max-w-sm"><span className="sr-only">Buscar vídeos</span><svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /></svg><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, categoria ou tag..." className="w-full rounded-full border border-white/10 bg-white/10 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30" /></label>
        </div>
      </header>
      {featuredVideo && !search && <section className="relative isolate flex min-h-[58vh] items-end overflow-hidden"><img src={featuredVideo.thumbnailUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=85'} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-65" /><div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#07070b] via-[#07070b]/45 to-black/10" /><div className="mx-auto w-full max-w-7xl px-4 pb-12 md:px-8 md:pb-16"><span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-bold uppercase tracking-wider">Em destaque</span><h2 className="mt-4 max-w-2xl text-4xl font-black leading-tight md:text-6xl">{featuredVideo.title}</h2>{featuredVideo.caption && <p className="mt-3 max-w-xl text-sm text-white/80 md:text-base">{featuredVideo.caption}</p>}<button type="button" onClick={() => setSelectedId(featuredVideo.id)} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-slate-950 transition hover:bg-white/85"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>Assistir agora</button></div></section>}
      <section className="mx-auto max-w-7xl space-y-10 px-4 py-8 md:px-8 md:py-12">{matchingVideos.length === 0 ? <div className="py-20 text-center text-white/60">Nenhum vídeo encontrado para “{search}”.</div> : categorizedVideos.map(([category, list]) => <VideoRow key={category} title={category} videos={list} onSelect={(video) => setSelectedId(video.id)} />)}</section>
      {selectedVideo && <VideoPlayerFullscreen video={selectedVideo} onClose={() => setSelectedId(null)} onPrevious={selectedIndex > 0 ? () => setSelectedId(matchingVideos[selectedIndex - 1].id) : undefined} onNext={selectedIndex < matchingVideos.length - 1 ? () => setSelectedId(matchingVideos[selectedIndex + 1].id) : undefined} />}
    </main>
  );
};
