import React, { useEffect, useState } from 'react';
import { getVideos, subscribeToVideos, Video as VideoType } from '../services/videosService';
import { VideoCard } from './VideoCard';
import { VideoModal } from './VideoModal';
import { VideoFilters } from './VideoFilters';

export const VideoSection: React.FC = () => {
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [filtered, setFiltered] = useState<VideoType[]>([]);
  const [selected, setSelected] = useState<VideoType | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    // initial load
    getVideos(true).then(setVideos);
    // real‑time updates
    const unsub = subscribeToVideos((v) => setVideos(v));
    return unsub;
  }, []);

  useEffect(() => {
    let result = videos;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(v =>
        v.title.toLowerCase().includes(lower) ||
        v.caption?.toLowerCase().includes(lower) ||
        v.keywords?.some(k => k.toLowerCase().includes(lower))
      );
    }
    if (category) {
      result = result.filter(v => v.categories?.includes(category));
    }
    setFiltered(result);
  }, [videos, search, category]);

  return (
    <section className="py-12 bg-[#0A101D] text-white" id="videos">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-center mb-8">Catálogo de Vídeos</h2>
        <VideoFilters
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          videos={videos}
        />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(v => (
            <VideoCard key={v.id} video={v} onClick={() => setSelected(v)} />
          ))}
        </div>
        {selected && (
          <VideoModal video={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </section>
  );
};
