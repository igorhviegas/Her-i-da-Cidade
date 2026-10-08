import React from 'react';
import { Video } from '../../../types';
import VideoCardAdmin from '../VideoCardAdmin';
import VideoRowAdmin from '../VideoRowAdmin';

interface VideoListResultsProps {
  videos: Video[];
  isFiltered: boolean;
  viewMode: 'grid' | 'list';
  onClearFilters: () => void;
  onEdit: (video: Video) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onToggleFeatured: (id: string, isCurrentlyFeatured: boolean) => void;
  onOrderChange: (id: string, order: number) => void;
}

export const VideoListResults: React.FC<VideoListResultsProps> = ({
  videos,
  isFiltered,
  viewMode,
  onClearFilters,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFeatured,
  onOrderChange,
}) => (
  <>
    {videos.length === 0 ? (
      <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-12 text-center text-white/60">
        <p className="text-base font-medium">Nenhum vídeo encontrado para os filtros atuais.</p>
        {isFiltered && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Limpar busca e filtros
          </button>
        )}
      </div>
    ) : viewMode === 'grid' ? (
      /* Visualização em Quadros (▦) */
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => (
          <VideoCardAdmin
            key={video.id}
            video={video}
            onEdit={() => onEdit(video)}
            onDelete={() => onDelete(video.id)}
            onToggleActive={() => onToggleActive(video.id, video.active)}
            onToggleFeatured={() => onToggleFeatured(video.id, video.featured === true)}
            onOrderChange={(order) => onOrderChange(video.id, order)}
          />
        ))}
      </div>
    ) : (
      /* Visualização em Lista (☷) */
      <div className="flex flex-col gap-2.5">
        {videos.map((video) => (
          <VideoRowAdmin
            key={video.id}
            video={video}
            onEdit={() => onEdit(video)}
            onDelete={() => onDelete(video.id)}
            onToggleActive={() => onToggleActive(video.id, video.active)}
            onToggleFeatured={() => onToggleFeatured(video.id, video.featured === true)}
            onOrderChange={(order) => onOrderChange(video.id, order)}
          />
        ))}
      </div>
    )}
  </>
);
