import React from 'react';
import { Video } from '../../../types';
import { Pencil, Trash2, ChevronUp, ChevronDown, Star } from 'lucide-react';

interface ActiveToggleProps {
  isActive: boolean;
  onToggleActive: () => void;
}

export const ActiveToggle: React.FC<ActiveToggleProps> = ({ isActive, onToggleActive }) => (
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
);

interface FeaturedToggleProps {
  isActive: boolean;
  isFeatured: boolean;
  onToggleFeatured: () => void;
}

export const FeaturedToggle: React.FC<FeaturedToggleProps> = ({ isActive, isFeatured, onToggleFeatured }) => (
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
);

interface OrderControlProps {
  video: Video;
  onOrderChange: (order: number) => void;
}

export const OrderControl: React.FC<OrderControlProps> = ({ video, onOrderChange }) => {
  const handleOrderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      onOrderChange(val);
    }
  };

  return (
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
  );
};

interface EditDeleteButtonsProps {
  onEdit: () => void;
  onDelete: () => void;
}

export const EditDeleteButtons: React.FC<EditDeleteButtonsProps> = ({ onEdit, onDelete }) => (
  <>
    <button
      type="button"
      onClick={onEdit}
      className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white bg-white/5 hover:bg-blue-600 rounded-xl transition-colors border border-white/10 cursor-pointer flex-shrink-0"
      title="Editar vídeo"
      aria-label="Editar vídeo"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
    <button
      type="button"
      onClick={onDelete}
      className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 rounded-xl transition-colors border border-red-500/20 cursor-pointer flex-shrink-0"
      title="Excluir vídeo"
      aria-label="Excluir vídeo"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </>
);
