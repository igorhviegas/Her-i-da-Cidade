import React from 'react';
import { Video } from '../../types';
import { ActiveToggle, FeaturedToggle, OrderControl, EditDeleteButtons } from './videoAdmin/VideoControls';
import { VideoCardThumb, VideoCardInfo } from './videoAdmin/VideoCardParts';

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
  const isActive = video.active !== false;
  const isFeatured = video.featured === true;

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
        <VideoCardThumb video={video} isFeatured={isFeatured} />
        <VideoCardInfo video={video} isFeatured={isFeatured} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 gap-2 flex-wrap">
        {/* Toggles (Active + Featured Star) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ActiveToggle isActive={isActive} onToggleActive={onToggleActive} />
          <FeaturedToggle isActive={isActive} isFeatured={isFeatured} onToggleFeatured={onToggleFeatured} />
        </div>

        {/* Order input + Actions */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap ml-auto">
          <OrderControl video={video} onOrderChange={onOrderChange} />
          <EditDeleteButtons onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
};
export default VideoCardAdmin;
