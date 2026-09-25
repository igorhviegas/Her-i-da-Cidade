import React, { useState } from 'react';
import { Video } from '../../types';
import { Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Star } from 'lucide-react';

interface VideoCardAdminProps {
  video: Video;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onToggleFeatured: () => void;
  onOrderChange: (order: number) => void;
}

export const VideoCardAdmin: React.FC<VideoCardAdminProps> = ({
  video,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFeatured,
  onOrderChange,
}) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = !imageError ? (video.thumbnailUrl || video.thumbnail) : null;
  const isActive = video.active !== false;
  const isFeatured = video.featured === true;

  const handleOrderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      onOrderChange(val);
    }
  };

  return (
    <div
      className={`border rounded-2xl p-5 shadow-lg transition-all ${
        isFeatured
          ? 'bg-[#101A33] border-amber-500/40 ring-1 ring-amber-500/30'
          : 'bg-[#0D1527] border-white/10'
      } ${!isActive ? 'opacity-70 bg-[#090E1B]' : ''}`}
    >
      {/* Header with thumbnail and title */}
      <div className="flex items-start gap-4 mb-3">
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
          {isFeatured && (
            <div className="absolute top-1 right-1 bg-amber-500 text-black p-0.5 rounded-full shadow" title="Vídeo em destaque">
              <Star className="w-3 h-3 fill-black text-black" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-white truncate">{video.title}</h3>
          </div>
          <p className="text-sm text-white/60 line-clamp-2">{video.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {isFeatured && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-black tracking-wide text-[10px] flex items-center gap-1 shadow-sm">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                ★ EM DESTAQUE
              </span>
            )}
            <span className="px-2 py-0.5 bg-white/5 text-white/70 rounded">{video.category}</span>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded">Ordem: {video.order ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 gap-2 flex-wrap sm:flex-nowrap">
        {/* Toggles (Active + Featured) */}
        <div className="flex items-center gap-2">
          {/* Active toggle */}
          <button
            type="button"
            onClick={onToggleActive}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
              isActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-white/5 border-white/15 text-white/40 hover:bg-white/10'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
            <span>{isActive ? 'Ativo' : 'Inativo'}</span>
          </button>

          {/* Featured toggle */}
          <button
            type="button"
            onClick={onToggleFeatured}
            disabled={!isActive && !isFeatured}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
              isFeatured
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 shadow-sm'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            } ${!isActive && !isFeatured ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
            title={isFeatured ? 'Remover dos destaques' : 'Definir como destaque principal do catálogo'}
          >
            <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>{isFeatured ? 'Destaque' : 'Destacar'}</span>
          </button>
        </div>

        {/* Order input + Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Order input */}
          <div className="flex items-center gap-1 bg-[#070B14] border border-white/10 px-2 py-1 rounded-xl">
            <span className="text-[11px] text-white/40 font-medium">Ordem:</span>
            <input
              type="number"
              min={1}
              defaultValue={video.order ?? 0}
              onBlur={handleOrderInput}
              className="w-10 text-xs text-center bg-transparent border-none text-white focus:outline-none"
            />
            <button onClick={() => onOrderChange((video.order ?? 0) + 1)} className="p-0.5 text-white/60 hover:text-white" title="Aumentar ordem">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onOrderChange(Math.max(1, (video.order ?? 0) - 1))} className="p-0.5 text-white/60 hover:text-white" title="Diminuir ordem">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onEdit}
              className="p-2 text-white/70 hover:text-white bg-white/5 hover:bg-blue-600 rounded-xl transition-colors border border-white/5"
              title="Editar vídeo"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-400 hover:text-red-200 bg-red-500/10 hover:bg-red-600 rounded-xl transition-colors border border-red-500/20"
              title="Excluir vídeo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default VideoCardAdmin;
