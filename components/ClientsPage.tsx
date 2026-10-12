import React, { useEffect, useMemo, useState } from 'react';
import { Mic } from 'lucide-react';
import { Link } from '../lib/router';
import { useSiteConfig } from '../services/siteConfigService';
import { subscribeToVideos } from '../services/videosService';
import { pickFeaturedVideos, resolveClientsConfig } from '../services/clientsPage.js';
import type { Video } from '../types';
import type { HomeSection } from '../types/homeContent';
import { VideoSection } from './VideoSection';
import { VideoRow } from './VideoRow';
import { VideoPlayerFullscreen } from './VideoPlayerFullscreen';
import { ThankYouVideo } from './publicSite/ThankYouVideo';
import { AudioRequestModal } from './publicSite/AudioRequestModal';

const INSTAGRAM_URL = 'https://www.instagram.com/oheroidacidade/';

// Reaproveita a seção de busca da home (mesmo formulário, mesmo destino /videos?search=): só os textos mudam.
const SEARCH_SECTION: HomeSection = {
  id: 'clients-search',
  internalName: 'clients-search',
  sectionType: 'video-teaser',
  title: 'Encontre o vídeo perfeito',
  subtitle: '',
  description: 'Pesquise um tema e veja como o Herói da Cidade pode falar com a criança sobre o que importa para a sua família.',
  buttonText: 'Ver todos os vídeos',
  active: true,
  order: 0,
};

const InstagramLink: React.FC<{ className?: string; alwaysShowHandle?: boolean }> = ({ className = '', alwaysShowHandle = false }) => (
  <a
    href={INSTAGRAM_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Instagram do Herói da Cidade, @oheroidacidade (abre em nova aba)"
    className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${className}`}
  >
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
    <span className={alwaysShowHandle ? '' : 'hidden sm:inline'}>@oheroidacidade</span>
  </a>
);

/**
 * Página exclusiva (/clientes) de quem recebeu o Herói da Cidade na festa; o QR do certificado leva para cá.
 * Pública e fora do Google (noindex em App.tsx). Vídeo de agradecimento e destaques vêm do admin (Streaming → Página dos clientes).
 */
export const ClientsPage: React.FC = () => {
  const { config } = useSiteConfig();
  const { videoUrl, poster, orientation, featuredIds } = useMemo(() => resolveClientsConfig(config), [config]);

  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audioOpen, setAudioOpen] = useState(false);

  // Um único listener (a leitura inicial já vem nele); erro de carregamento deixa o resto da página funcionando.
  useEffect(() => subscribeToVideos(setVideos), []);
  const featured = useMemo(() => pickFeaturedVideos(videos, undefined, featuredIds), [videos, featuredIds]);
  const selectedIndex = featured.findIndex((video) => video.id === selectedId);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-[#0B1929] to-[#070B14] text-white">
      <header className="px-4 pt-4">
        <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center">
          <span aria-hidden />
          <Link href="/" aria-label="Herói da Cidade: ir para o site" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0072d2] shadow-lg shadow-blue-600/30">
              <img src="/images/spider.PNG" alt="" className="h-full w-full scale-125 object-cover" />
            </span>
            <span className="text-base font-bold tracking-tight">Herói da Cidade</span>
          </Link>
          <div className="flex justify-end"><InstagramLink /></div>
        </div>
      </header>

      <section className="px-4 pb-10 pt-8 text-center sm:pt-12" aria-labelledby="clients-title">
        <p className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-200">
          Acesso exclusivo
        </p>
        <h1 id="clients-title" className="mx-auto max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
          Obrigado por receber o Herói da Cidade!
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
          Preparamos uma mensagem especial para a criança e um cantinho só para quem viveu essa festa com a gente.
        </p>
        <div className="mt-7">
          <ThankYouVideo url={videoUrl} poster={poster} orientation={orientation} />
        </div>
      </section>

      <VideoSection section={SEARCH_SECTION} showBadges={false} />

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 md:px-8">
          <VideoRow title="Vídeos em destaque" videos={featured} onSelect={(video) => setSelectedId(video.id)} />
        </section>
      )}

      <section className="px-4 py-12" aria-labelledby="audio-title">
        <div className="mx-auto max-w-2xl rounded-3xl border border-purple-400/25 bg-gradient-to-br from-purple-600/25 via-blue-600/15 to-transparent p-6 text-center shadow-xl shadow-purple-950/30 sm:p-9">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-purple-200">
            <Mic className="h-7 w-7" aria-hidden />
          </span>
          <h2 id="audio-title" className="text-2xl font-black leading-tight sm:text-3xl">Peça um áudio do Herói da Cidade</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
            Clientes dos serviços presenciais podem solicitar um áudio sobre algum assunto para o Herói da Cidade gravar!
          </p>
          <button
            type="button"
            onClick={() => setAudioOpen(true)}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-white/90 active:scale-[0.98] sm:w-auto"
          >
            Solicitar áudio do Herói da Cidade
          </button>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-1 px-4 pb-8 pt-4 text-xs text-white/40">
        <InstagramLink className="text-white/55" alwaysShowHandle />
        <Link href="/" className="font-semibold text-white/55 hover:text-white">O Herói da Cidade</Link>
      </footer>

      {audioOpen && <AudioRequestModal onClose={() => setAudioOpen(false)} />}

      {selectedIndex >= 0 && (
        <VideoPlayerFullscreen
          video={featured[selectedIndex]}
          onClose={() => setSelectedId(null)}
          onPrevious={selectedIndex > 0 ? () => setSelectedId(featured[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex < featured.length - 1 ? () => setSelectedId(featured[selectedIndex + 1].id) : undefined}
        />
      )}
    </main>
  );
};
