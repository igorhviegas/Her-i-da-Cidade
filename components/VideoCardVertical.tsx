import React from 'react';
import { Video } from '../types';

interface VideoCardVerticalProps {
  video: Video;
  onSelect: () => void;
}

export const VideoCardVertical: React.FC<VideoCardVerticalProps> = ({ video, onSelect }) => {
  const cover = video.thumbnailUrl || `https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=720&q=80`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Assistir ${video.title}`}
      className="group relative flex-none w-[152px] sm:w-[176px] md:w-[198px] aspect-[9/16] overflow-hidden rounded-2xl bg-slate-900 text-left shadow-lg shadow-black/30 transition duration-300 hover:z-10 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400"
    >
      <img
        src={cover}
        alt={video.title}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-950 shadow-xl">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{video.title}</p>
        <p className="mt-1 truncate text-[11px] text-white/70">{(video.tags || []).slice(0, 2).join(' • ')}</p>
      </div>
    </button>
  );
};
