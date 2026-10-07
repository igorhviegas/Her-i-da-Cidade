import React, { lazy, Suspense, useEffect, useState } from 'react';
import { RouterProvider, useRouter } from './lib/router';
import { AuthProvider } from './context/AuthContext';
import { PublicSite } from './components/PublicSite';
import { VideoCatalog } from './components/VideoCatalog';
import { VideoCallPage } from './components/VideoCallPage';
import { ServiceFaqPages } from './components/ServiceFaqPages';
import type { Service } from './types';
import { useHomeContent } from './services/homeContentService';

const HOME_TITLE = 'Homem-Aranha Personagem Vivo em BH | Herói da Cidade';
const HOME_DESCRIPTION = 'Contrate o Homem-Aranha para festas infantis, aniversários e eventos em Belo Horizonte, Betim, Contagem, Nova Lima e região.';
const VIDEO_TITLE = 'Plataforma de vídeos - O Herói da Cidade';
const VIDEO_DESCRIPTION = 'Assista à plataforma de vídeos do Herói da Cidade e conheça conteúdos e apresentações do personagem Homem-Aranha.';
const HOME_URL = 'https://www.heroidacidade.com/';
const CALL_TITLE = 'Agendar Vídeo Chamada | Herói da Cidade';
const CALL_DESCRIPTION = 'Escolha o dia e o horário da Vídeo Chamada ao Vivo com o Homem-Aranha.';
const CALL_URL = 'https://www.heroidacidade.com/agendar-chamada';
const FAQ_TITLE = 'Dúvidas sobre os serviços | Herói da Cidade';
const FAQ_DESCRIPTION = 'Tire suas dúvidas sobre pagamento, prazos e como funcionam os serviços do Herói da Cidade.';
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
  const isFaq = path === '/duvidas' || path.startsWith('/duvidas/');
  const faqSlug = isFaq ? decodeURIComponent(path.split('/').filter(Boolean)[1] ?? '') : '';
  // Serviço aberto em /duvidas/{slug}: undefined = carregando, null = inexistente ou sem dúvidas (não indexar).
  const [faqService, setFaqService] = useState<Service | null | undefined>(undefined);
  const homeContent = useHomeContent(!isAdmin && !isVideos && !isAgent && !isCall && !isFaq);

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

    const faqPageTitle = faqService ? `${faqService.title}: dúvidas frequentes | Herói da Cidade` : FAQ_TITLE;
    const faqPageDescription = faqService?.faq
      ? `Dúvidas sobre ${faqService.title}: ${faqService.faq.map((item) => item.title).join(', ')}.`.slice(0, 300)
      : FAQ_DESCRIPTION;
    const title = isCall ? CALL_TITLE : isVideos ? VIDEO_TITLE : isFaq ? faqPageTitle : homeContent.seoTitle || HOME_TITLE;
    const description = isCall ? CALL_DESCRIPTION : isVideos ? VIDEO_DESCRIPTION : isFaq ? faqPageDescription : homeContent.seoDescription || HOME_DESCRIPTION;
    const url = isCall ? CALL_URL : isVideos ? VIDEO_URL : isFaq ? `${HOME_URL}duvidas${faqSlug ? `/${encodeURIComponent(faqSlug)}` : ''}` : HOME_URL;

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', isFaq && faqSlug && faqService === null ? 'noindex, follow' : 'index, follow');
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

    if (isVideos || isFaq) {
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
  }, [isAdmin, isAgent, isVideos, isCall, isFaq, faqSlug, faqService, homeContent.seoTitle, homeContent.seoDescription]);

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
  if (isCall) return <VideoCallPage />;

  // Dúvidas públicas por serviço: /duvidas e /duvidas/{slug}
  if (isFaq) return <ServiceFaqPages slug={faqSlug || undefined} onResolved={setFaqService} />;

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
