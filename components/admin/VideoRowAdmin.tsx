import React from 'react';
import { Video } from '../../types';
import { ActiveToggle, FeaturedToggle, OrderControl, EditDeleteButtons } from './videoAdmin/VideoControls';
import { VideoRowThumb, VideoRowInfo } from './videoAdmin/VideoRowParts';

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
  const isActive = video.active !== false;
  const isFeatured = video.featured === true;

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
        <VideoRowThumb video={video} isFeatured={isFeatured} />
        <VideoRowInfo video={video} isFeatured={isFeatured} />
      </div>

      {/* Controles de Ação na Linha */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-white/5">
        <ActiveToggle isActive={isActive} onToggleActive={onToggleActive} />
        <FeaturedToggle isActive={isActive} isFeatured={isFeatured} onToggleFeatured={onToggleFeatured} />
        <OrderControl video={video} onOrderChange={onOrderChange} />
        <EditDeleteButtons onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
};
export default VideoRowAdmin;
