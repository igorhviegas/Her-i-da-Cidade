import React, { useState } from 'react';
import { Video } from '../../types';
import { Pencil, Trash2, Eye, ChevronUp, ChevronDown, Star } from 'lucide-react';

interface VideoRowAdminProps {
  video: Video;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onToggleFeatured: () => void;
  onOrderChange: (order: number) => void;
}

export const VideoRowAdmin: React.FC<VideoRowAdminProps> = ({
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
      className={`border rounded-xl p-3 sm:p-4 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isFeatured
          ? 'bg-[#101A33] border-amber-500/40 ring-1 ring-amber-500/30'
          : 'bg-[#0D1527] border-white/10'
      } ${!isActive ? 'opacity-70 bg-[#090E1B]' : ''}`}
    >
      {/* Informações: Thumb + Título + Categoria + Selo */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
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

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md md:max-w-xs lg:max-w-md">
              {video.title}
            </h3>
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
      </div>

      {/* Controles de Ação na Linha */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-white/5">
        {/* Toggle Ativo */}
        <button
          type="button"
          onClick={onToggleActive}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
            isActive
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
              : 'bg-white/5 border-white/15 text-white/40 hover:bg-white/10'
          }`}
          title={isActive ? 'Desativar vídeo' : 'Ativar vídeo'}
          aria-label={isActive ? 'Desativar vídeo' : 'Ativar vídeo'}
        >
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
          <span>{isActive ? 'Ativo' : 'Inativo'}</span>
        </button>

        {/* Estrela de Destaque */}
        <button
          type="button"
          onClick={onToggleFeatured}
          disabled={!isActive && !isFeatured}
          className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
            isFeatured
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 hover:bg-amber-500/30 shadow-sm shadow-amber-500/20'
              : 'bg-white/5 border-white/10 text-white/40 hover:text-amber-400 hover:border-amber-400/40 hover:bg-white/10'
          } ${!isActive && !isFeatured ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
          title={isFeatured ? 'Remover destaque' : 'Definir como destaque'}
          aria-label={isFeatured ? 'Remover destaque' : 'Definir como destaque'}
        >
          <Star className={`w-4 h-4 ${isFeatured ? 'fill-amber-400 text-amber-400' : 'text-current'}`} />
        </button>

        {/* Ordem */}
        <div className="flex items-center gap-1 bg-[#070B14] border border-white/10 px-2 py-1 rounded-xl">
          <span className="text-[11px] text-white/40 font-medium">Ordem:</span>
          <input
            type="number"
            min={1}
            defaultValue={video.order ?? 0}
            onBlur={handleOrderInput}
            className="w-8 text-xs text-center bg-transparent border-none text-white focus:outline-none"
          />
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => onOrderChange((video.order ?? 0) + 1)}
              className="p-0.5 text-white/50 hover:text-white transition-colors"
              title="Aumentar ordem"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onOrderChange(Math.max(1, (video.order ?? 0) - 1))}
              className="p-0.5 text-white/50 hover:text-white transition-colors"
              title="Diminuir ordem"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Editar */}
        <button
          type="button"
          onClick={onEdit}
          className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white bg-white/5 hover:bg-blue-600 rounded-xl transition-colors border border-white/10 cursor-pointer flex-shrink-0"
          title="Editar vídeo"
          aria-label="Editar vídeo"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* Excluir */}
        <button
          type="button"
          onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 rounded-xl transition-colors border border-red-500/20 cursor-pointer flex-shrink-0"
          title="Excluir vídeo"
          aria-label="Excluir vídeo"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
export default VideoRowAdmin;
