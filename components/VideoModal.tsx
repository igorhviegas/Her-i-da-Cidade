import React, { useEffect } from 'react';
import { Video } from '../types';

interface VideoModalProps {
  video: Video;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ video, onClose }) => {
  // Attempt to embed Instagram Reel via oEmbed iframe
  const embedUrl = `https://www.instagram.com/reel/${extractReelId(video.instagramUrl)}/embed`;

  // Helper to extract reel ID from full URL
  function extractReelId(url: string): string {
    try {
      const match = url.match(/reel\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  // When ESC is pressed, close the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const fallbackUrl = video.instagramUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0D1527] rounded-lg max-w-3xl w-full mx-4 p-4" onClick={e => e.stopPropagation()}>
        <button
          className="absolute right-4 top-4 text-white text-2xl hover:text-gray-300"
          onClick={onClose}
          aria-label="Close modal"
        >
          &times;
        </button>
        <h2 className="text-xl font-bold text-white mb-2">{video.title}</h2>
        {/* Attempt embed; if src is empty we fall back */}
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={video.title}
            allowFullScreen
            className="w-full h-96 rounded"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : null}
        {/* If embed fails (no iframe or error) show fallback button */}
        <div className="mt-4 text-center">
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#25D366] text-white px-4 py-2 rounded hover:bg-[#1eb75a]"
          >
            Assistir no Instagram
          </a>
        </div>
      </div>
    </div>
  );
};
