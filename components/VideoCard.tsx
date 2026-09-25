import React, { useState } from 'react';
import { Video as VideoType } from '../types';
import { Film } from 'lucide-react';

interface VideoCardProps {
  video: VideoType;
  onClick: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = !imageError ? (video.thumbnailUrl || video.thumbnail) : null;

  return (
    <div
      className="bg-[#0D1527] rounded-xl overflow-hidden shadow-lg cursor-pointer hover:shadow-2xl transition-all duration-300 border border-white/5 flex flex-col group hover:border-emerald-500/30"
      onClick={onClick}
    >
      <div className="w-full h-48 bg-[#090E1B] relative flex items-center justify-center overflow-hidden">
        {video.badgeText && (
          <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white font-black text-[10px] tracking-wider uppercase shadow-md shadow-black/60 border border-white/20">
              {video.badgeText}
            </span>
          </div>
        )}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={video.title}
            onError={() => setImageError(true)}
            className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-white/40 p-4 text-center select-none">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-emerald-500/30 group-hover:text-emerald-400 transition">
              <Film className="w-6 h-6" />
            </div>
            <span className="text-xs text-white/50 font-medium">Herói da Cidade</span>
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between">
        <h3 className="text-base font-semibold text-white mb-2 line-clamp-2 group-hover:text-emerald-300 transition-colors">
          {video.title}
        </h3>
        {video.categories && video.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-2">
            {video.categories.map((cat) => (
              <span
                key={cat}
                className="text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
