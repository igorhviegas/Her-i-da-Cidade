import React, { lazy, Suspense, useEffect } from 'react';
import { RouterProvider, useRouter } from './lib/router';
import { AuthProvider } from './context/AuthContext';
import { PublicSite } from './components/PublicSite';
import { VideoCatalog } from './components/VideoCatalog';
import { VideoCallBooking } from './components/VideoCallBooking';
import { useHomeContent } from './services/homeContentService';

const HOME_TITLE = 'Homem-Aranha Personagem Vivo em BH | Herói da Cidade';
const HOME_DESCRIPTION = 'Contrate o Homem-Aranha para festas infantis, aniversários e eventos em Belo Horizonte, Betim, Contagem, Nova Lima e região.';
const VIDEO_TITLE = 'Plataforma de vídeos - O Herói da Cidade';
const VIDEO_DESCRIPTION = 'Assista à plataforma de vídeos do Herói da Cidade e conheça conteúdos e apresentações do personagem Homem-Aranha.';
const HOME_URL = 'https://www.heroidacidade.com/';
const CALL_TITLE = 'Agendar Vídeo Chamada | Herói da Cidade';
const CALL_DESCRIPTION = 'Escolha o dia e o horário da Vídeo Chamada ao Vivo com o Homem-Aranha.';
const CALL_URL = 'https://www.heroidacidade.com/agendar-chamada';
const VIDEO_URL = 'https://www.heroidacidade.com/videos';
const SOCIAL_IMAGE = 'https://www.heroidacidade.com/images/spider.PNG';
const SITE_NAME = 'O Herói da Cidade';

const AgentApp = lazy(() => import('./components/agente/AgentApp').then(({ AgentApp: component }) => ({ default: component })));
const AdminApp = lazy(() => import('./components/admin/AdminApp').then(({ AdminApp: component }) => ({ default: component })));

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = url;
}

const AppContent: React.FC = () => {
  const { path } = useRouter();
  const isAdmin = path.startsWith('/admin');
  const isVideos = path === '/videos' || path.startsWith('/videos/');
  const isAgent = path === '/agente-hdc' || path.startsWith('/agente-hdc/');
  const isCall = path === '/agendar-chamada';
  const homeContent = useHomeContent(!isAdmin && !isVideos && !isAgent && !isCall);

  // Ícone do iOS ("Adicionar à Tela de Início") próprio da plataforma de streaming e da área do agente
  const iosIcon = isVideos ? '/images/modules/streaming.png' : isAgent ? '/images/modules/agente-hdc.png' : null;
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (!link || !iosIcon) return;
    const original = link.getAttribute('href') ?? '';
    link.setAttribute('href', iosIcon);
    return () => link.setAttribute('href', original);
  }, [iosIcon]);

  useEffect(() => {
    const structuredDataId = 'site-seo-structured-data';
    const existingStructuredData = document.getElementById(structuredDataId);

    if (isAdmin || isAgent) {
      if (isAgent) document.title = 'Agente HDC';
      setMeta('name', 'robots', 'noindex, nofollow');
      document.querySelector('link[rel="canonical"]')?.remove();
      document.querySelector('meta[name="description"]')?.remove();
      document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((element) => element.remove());
      existingStructuredData?.remove();
      return;
    }

    const title = isCall ? CALL_TITLE : isVideos ? VIDEO_TITLE : homeContent.seoTitle || HOME_TITLE;
    const description = isCall ? CALL_DESCRIPTION : isVideos ? VIDEO_DESCRIPTION : homeContent.seoDescription || HOME_DESCRIPTION;
    const url = isCall ? CALL_URL : isVideos ? VIDEO_URL : HOME_URL;

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow');
    setCanonical(url);

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', SOCIAL_IMAGE);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:locale', 'pt_BR');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', SOCIAL_IMAGE);

    if (isVideos) {
      existingStructuredData?.remove();
      return;
    }

    const structuredData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${HOME_URL}#organization`,
          name: 'O Herói da Cidade',
          url: HOME_URL,
          logo: SOCIAL_IMAGE,
          sameAs: ['https://www.instagram.com/oheroidacidade/'],
          areaServed: {
            '@type': 'AdministrativeArea',
            name: 'Região Metropolitana de Belo Horizonte, Minas Gerais',
          },
        },
        {
          '@type': 'WebSite',
          '@id': `${HOME_URL}#website`,
          name: 'O Herói da Cidade',
          url: HOME_URL,
          inLanguage: 'pt-BR',
          publisher: { '@id': `${HOME_URL}#organization` },
        },
      ],
    };

    let script = document.getElementById(structuredDataId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = structuredDataId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);
  }, [isAdmin, isAgent, isVideos, isCall, homeContent.seoTitle, homeContent.seoDescription]);

  if (isAdmin) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070B14] text-sm text-white/60">Carregando painel...</div>}>
        <AdminApp />
      </Suspense>
    );
  }

  // Área interna dos agentes de evento (link privado, sem login por enquanto)
  if (isAgent) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#070B14] text-sm text-white/60">Carregando...</div>}>
        <AgentApp />
      </Suspense>
    );
  }

  // Página pública de agendamento de Vídeo Chamada (link compartilhável; substitui o link do Calendly)
  if (isCall) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black to-[#0B1929] px-4 py-10 text-white">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-6 text-center text-3xl font-extrabold uppercase italic tracking-tighter">Agende sua Vídeo Chamada</h1>
          <VideoCallBooking />
        </div>
      </main>
    );
  }

  // Rota dedicada para o catálogo de vídeos estilo Netflix
  if (isVideos) {
    return <VideoCatalog />;
  }

  return <PublicSite homeContent={homeContent} />;
};

export const App: React.FC = () => {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RouterProvider>
  );
};
