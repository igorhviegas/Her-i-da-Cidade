import React, { useEffect, useMemo, useState } from 'react';
import { Video } from '../types';
import { extractInstagramId } from '../utils/videoHelpers';

interface VideoPlayerFullscreenProps {
  video: Video;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export const VideoPlayerFullscreen: React.FC<VideoPlayerFullscreenProps> = ({
  video,
  onClose,
  onPrevious,
  onNext,
}) => {
  const [showDetails, setShowDetails] = useState(true);
  const embedUrl = useMemo(() => {
    const reelId = extractInstagramId(video.instagramUrl);
    return reelId ? `https://www.instagram.com/reel/${reelId}/embed` : video.instagramUrl;
  }, [video.instagramUrl]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onPrevious?.();
      if (event.key === 'ArrowRight') onNext?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onNext, onPrevious]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <button type="button" onClick={onClose} aria-label="Fechar vídeo" className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 md:right-7 md:top-7">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
      </button>
      {onPrevious && <button type="button" onClick={onPrevious} aria-label="Vídeo anterior" className="absolute left-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 md:flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
      {onNext && <button type="button" onClick={onNext} aria-label="Próximo vídeo" className="absolute right-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 md:flex"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
      <article className="relative h-full w-full max-w-[520px] overflow-hidden bg-zinc-950 sm:h-[94vh] sm:rounded-3xl sm:shadow-2xl sm:shadow-purple-950/30">
        <iframe src={embedUrl} title={video.title} className="h-full w-full border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
        {showDetails && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-5 pb-7 pt-24"><h1 className="text-xl font-bold text-white">{video.title}</h1>{video.caption && <p className="mt-2 line-clamp-2 text-sm text-white/75">{video.caption}</p>}<div className="mt-3 flex flex-wrap gap-2">{(video.tags || []).map((tag) => <span key={tag} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white">{tag}</span>)}</div></div>}
        <button type="button" onClick={() => setShowDetails((value) => !value)} className="absolute bottom-3 right-3 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/70">{showDetails ? 'Ocultar info' : 'Mostrar info'}</button>
      </article>
    </div>
  );
};
