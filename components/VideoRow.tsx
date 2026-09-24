import React, { useRef } from 'react';
import { Video } from '../types';
import { VideoCardVertical } from './VideoCardVertical';

interface VideoRowProps {
  title: string;
  videos: Video[];
  onSelect: (video: Video) => void;
}

export const VideoRow: React.FC<VideoRowProps> = ({ title, videos, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: number) => {
    containerRef.current?.scrollBy({ left: direction * 640, behavior: 'smooth' });
  };

  if (!videos.length) return null;

  return (
    <section className="group/row relative">
      <h2 className="mb-3 px-1 text-lg font-bold text-white md:text-xl">{title}</h2>
      <button
        type="button"
        aria-label={`Ver vídeos anteriores de ${title}`}
        onClick={() => scroll(-1)}
        className="absolute left-0 top-12 z-10 hidden h-[calc(100%-3rem)] w-12 items-center justify-center bg-gradient-to-r from-black/80 to-transparent text-white opacity-0 transition group-hover/row:opacity-100 md:flex"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div ref={containerRef} className="flex gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((video) => <VideoCardVertical key={video.id} video={video} onSelect={() => onSelect(video)} />)}
      </div>
      <button
        type="button"
        aria-label={`Ver mais vídeos de ${title}`}
        onClick={() => scroll(1)}
        className="absolute right-0 top-12 z-10 hidden h-[calc(100%-3rem)] w-12 items-center justify-center bg-gradient-to-l from-black/80 to-transparent text-white opacity-0 transition group-hover/row:opacity-100 md:flex"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </section>
  );
};
