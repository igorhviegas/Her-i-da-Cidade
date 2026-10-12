import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { parsePoster, parseThankYouVideo } from '../../services/clientsPage.js';

/**
 * Vídeo de agradecimento. A origem vem de siteConfig/public (clientsVideoUrl, clientsVideoPoster, clientsVideoOrientation):
 * YouTube (público ou não listado) ou arquivo de vídeo direto. Nada toca sozinho: o YouTube só carrega depois do toque na capa
 * e o arquivo usa os controles nativos. Sem configuração válida, mostra um aviso em vez de um player quebrado.
 */
export const ThankYouVideo: React.FC<{ url: unknown; poster: unknown; orientation: unknown }> = ({ url, poster, orientation }) => {
  const [playing, setPlaying] = useState(false);
  const video = parseThankYouVideo(url);
  const cover = parsePoster(poster) ?? (video?.kind === 'youtube' ? video.poster : null);
  const frame = `relative mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-purple-950/40 ${
    orientation === 'horizontal' ? 'aspect-video max-w-2xl' : 'aspect-[9/16] max-h-[72vh] max-w-[340px]'
  }`;

  if (!video) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-purple-900/40 to-[#0B1424] px-6 py-10 text-center">
        <p className="text-sm leading-relaxed text-white/70">O vídeo de agradecimento do Herói da Cidade estará aqui em breve.</p>
      </div>
    );
  }

  if (video.kind === 'file') {
    return (
      <div className={frame}>
        <video
          src={video.src}
          poster={cover ?? undefined}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          className="h-full w-full bg-black object-cover"
          aria-label="Vídeo de agradecimento do Herói da Cidade"
        />
      </div>
    );
  }

  return (
    <div className={frame}>
      {playing ? (
        <iframe
          src={video.embedUrl}
          title="Vídeo de agradecimento do Herói da Cidade"
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Assistir ao vídeo de agradecimento do Herói da Cidade"
          className="group absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-b from-purple-900/60 to-[#0B1424] focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-400/60"
        >
          {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white text-slate-950 shadow-2xl transition group-hover:scale-105 group-active:scale-95">
            <Play className="ml-1 h-9 w-9" fill="currentColor" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
};
