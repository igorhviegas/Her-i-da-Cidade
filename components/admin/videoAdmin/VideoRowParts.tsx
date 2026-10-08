import React, { useState } from 'react';
import { Video } from '../../../types';
import { Eye, Star } from 'lucide-react';

interface VideoRowPartProps {
  video: Video;
  isFeatured: boolean;
}

export const VideoRowThumb: React.FC<VideoRowPartProps> = ({ video, isFeatured }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = !imageError ? (video.thumbnailUrl || video.thumbnail) : null;

  return (
    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 flex items-center justify-center relative">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={video.title}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/30">
          <Eye className="w-5 h-5" />
        </div>
      )}
      {video.badgeText && (
        <div className="absolute top-0.5 left-0.5 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[8px] font-black px-1 py-0.2 rounded shadow z-10 uppercase tracking-wider">
          {video.badgeText}
        </div>
      )}
      {isFeatured && (
        <div className="absolute top-0.5 right-0.5 bg-amber-500 text-black p-0.5 rounded-full shadow" title="Vídeo em destaque">
          <Star className="w-2.5 h-2.5 fill-black text-black" />
        </div>
      )}
    </div>
  );
};

export const VideoRowInfo: React.FC<VideoRowPartProps> = ({ video, isFeatured }) => (
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2 flex-wrap">
      <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-xs lg:max-w-md">
        {video.title}
      </h3>
      {video.needsReview && <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded font-black tracking-wide text-[9px] uppercase flex-shrink-0">Importado - revisar</span>}
      {isFeatured && (
        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-black tracking-wide text-[9px] flex items-center gap-1 shadow-sm">
          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
          DESTAQUE
        </span>
      )}
    </div>
    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
      <span className="px-2 py-0.5 bg-white/5 text-white/70 rounded text-[11px]">
        {(video.categories?.length ? video.categories : video.category ? [video.category] : ['Geral']).join(' • ')}
      </span>
      {video.badgeText && (
        <span className="px-2 py-0.5 bg-gradient-to-r from-red-600 to-amber-600 text-white rounded font-black tracking-wider text-[9px] shadow-sm uppercase">
          Selo: {video.badgeText}
        </span>
      )}
    </div>
  </div>
);
