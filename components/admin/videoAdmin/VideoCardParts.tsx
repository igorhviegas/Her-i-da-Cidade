import React, { useState } from 'react';
import { Video } from '../../../types';
import { Eye, Star } from 'lucide-react';

interface VideoCardPartProps {
  video: Video;
  isFeatured: boolean;
}

export const VideoCardThumb: React.FC<VideoCardPartProps> = ({ video, isFeatured }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = !imageError ? (video.thumbnailUrl || video.thumbnail) : null;

  return (
    <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 flex items-center justify-center relative">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={video.title}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/30">
          <Eye className="w-6 h-6" />
        </div>
      )}
      {video.badgeText && (
        <div className="absolute top-1 left-1 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow z-10 uppercase tracking-wider">
          {video.badgeText}
        </div>
      )}
      {isFeatured && (
        <div className="absolute top-1 right-1 bg-amber-500 text-black p-0.5 rounded-full shadow" title="Vídeo em destaque">
          <Star className="w-3 h-3 fill-black text-black" />
        </div>
      )}
    </div>
  );
};

export const VideoCardInfo: React.FC<VideoCardPartProps> = ({ video, isFeatured }) => (
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 mb-1">
      <h3 className="text-lg font-bold text-white truncate">{video.title}</h3>
      {video.needsReview && <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded font-black tracking-wide text-[9px] uppercase flex-shrink-0">Importado - revisar</span>}
    </div>
    <p className="text-sm text-white/60 line-clamp-2">{video.description}</p>
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      {video.badgeText && (
        <span className="px-2 py-0.5 bg-gradient-to-r from-red-600 to-amber-600 text-white rounded font-black tracking-wider text-[10px] shadow-sm uppercase">
          Selo: {video.badgeText}
        </span>
      )}
      {isFeatured && (
        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-black tracking-wide text-[10px] flex items-center gap-1 shadow-sm">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          ★ EM DESTAQUE
        </span>
      )}
      <span className="px-2 py-0.5 bg-white/5 text-white/70 rounded">
        {(video.categories?.length ? video.categories : video.category ? [video.category] : []).join(' • ')}
      </span>
      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded">Ordem: {video.order ?? 0}</span>
    </div>
  </div>
);
