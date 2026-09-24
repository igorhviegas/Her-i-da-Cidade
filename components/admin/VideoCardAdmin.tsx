import React, { useState } from 'react';
import { Video } from '../../types';
import { Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';

interface VideoCardAdminProps {
  video: Video;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onOrderChange: (order: number) => void;
}

export const VideoCardAdmin: React.FC<VideoCardAdminProps> = ({ video, onEdit, onDelete, onToggleActive, onOrderChange }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = !imageError ? (video.thumbnailUrl || video.thumbnail) : null;
  const isActive = video.active !== false;
  const handleOrderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      onOrderChange(val);
    }
  };

  return (
    <div className={`bg-[#0D1527] border border-white/10 rounded-2xl p-5 shadow-lg transition-all ${!isActive ? 'opacity-70 bg-[#090E1B]' : ''}`}>
      {/* Header with thumbnail and title */}
      <div className="flex items-start gap-4 mb-3">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 flex items-center justify-center">
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
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white truncate">{video.title}</h3>
          <p className="text-sm text-white/60 line-clamp-2">{video.description}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-white/5 text-white/70 rounded">{video.category}</span>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded">Ordem: {video.order ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-2">
        {/* Active toggle */}
        <button
          onClick={onToggleActive}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
            isActive
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
              : 'bg-white/5 border-white/15 text-white/40 hover:bg-white/10'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
          <span>{isActive ? 'Ativo' : 'Inativo'}</span>
        </button>

        {/* Order input */}
        <div className="flex items-center gap-1 bg-[#070B14] border border-white/10 px-2 py-1 rounded-xl">
          <span className="text-[11px] text-white/40 font-medium">Ordem:</span>
          <input
            type="number"
            min={1}
            defaultValue={video.order ?? 0}
            onBlur={handleOrderInput}
            className="w-12 text-xs text-center bg-transparent border-none text-white focus:outline-none"
          />
          <button onClick={() => onOrderChange((video.order ?? 0) + 1)} className="p-0.5 text-white/60 hover:text-white" title="Aumentar ordem">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onOrderChange(Math.max(1, (video.order ?? 0) - 1))} className="p-0.5 text-white/60 hover:text-white" title="Diminuir ordem">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
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
  );
};
export default VideoCardAdmin;
