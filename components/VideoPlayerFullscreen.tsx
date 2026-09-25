import React, { useEffect, useMemo, useState } from 'react';
import { Video } from '../types';
import { extractInstagramId, isValidInstagramUrl } from '../utils/videoHelpers';

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

  // Validação segura da URL do Instagram (somente HTTPS e domínio instagram.com)
  const safeInstagramUrl = useMemo(() => {
    return isValidInstagramUrl(video.instagramUrl) ? video.instagramUrl.trim() : null;
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
      {/* Botão Assistir no Instagram (topo esquerdo) */}
      {safeInstagramUrl && (
        <a
          href={safeInstagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition-all hover:scale-105 hover:shadow-pink-500/30 active:scale-95 md:left-7 md:top-7 cursor-pointer"
          title="Assistir diretamente no Instagram"
        >
          <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
          <span className="whitespace-nowrap">Assistir no Instagram</span>
        </a>
      )}

      {/* Botão Fechar */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar vídeo"
        className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 md:right-7 md:top-7 cursor-pointer"
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>

      {/* Botões navegação anterior / próximo */}
      {onPrevious && (
        <button
          type="button"
          onClick={onPrevious}
          aria-label="Vídeo anterior"
          className="absolute left-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 md:flex cursor-pointer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          aria-label="Próximo vídeo"
          className="absolute right-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20 md:flex cursor-pointer"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Container do Player */}
      <article className="relative h-full w-full max-w-[520px] overflow-hidden bg-zinc-950 sm:h-[94vh] sm:rounded-3xl sm:shadow-2xl sm:shadow-purple-950/30">
        <iframe
          src={embedUrl}
          title={video.title}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
        />

        {showDetails && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent px-5 pb-8 pt-24">
            <h1 className="text-xl font-bold text-white">{video.title}</h1>
            {video.caption && <p className="mt-2 line-clamp-2 text-sm text-white/75">{video.caption}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {(video.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Ação secundária para assistir no Instagram no rodapé dos detalhes */}
            {safeInstagramUrl && (
              <div className="mt-3.5 pointer-events-auto">
                <a
                  href={safeInstagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-white transition-all active:scale-95 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 fill-current text-pink-400" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span>Abrir Reel no app</span>
                </a>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowDetails((value) => !value)}
          className="absolute bottom-3 right-3 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/70 cursor-pointer"
        >
          {showDetails ? 'Ocultar info' : 'Mostrar info'}
        </button>
      </article>
    </div>
  );
};
