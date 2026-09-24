import React from 'react';
import { Video as VideoType } from '../types';

interface VideoCardProps {
  video: VideoType;
  onClick: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
  return (
    <div
      className="bg-[#0D1527] rounded-xl overflow-hidden shadow-lg cursor-pointer hover:shadow-2xl transition-shadow"
      onClick={onClick}
    >
      <img
        src={video.thumbnail || '/placeholder.png'}
        alt={video.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white mb-1 line-clamp-2">{video.title}</h3>
        {video.categories && video.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {video.categories.map((cat) => (
              <span
                key={cat}
                className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded"
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
