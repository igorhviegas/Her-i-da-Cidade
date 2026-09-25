import React, { useEffect } from 'react';
import { RouterProvider, useRouter } from './lib/router';
import { AuthProvider } from './context/AuthContext';
import { PublicSite } from './components/PublicSite';
import { AdminApp } from './components/admin/AdminApp';
import { VideoCatalog } from './components/VideoCatalog';
import { useHomeContent } from './services/homeContentService';

const HOME_TITLE = 'Homem-Aranha Personagem Vivo em BH | Herói da Cidade';
const HOME_DESCRIPTION = 'Contrate o Homem-Aranha para festas infantis, aniversários e eventos em Belo Horizonte, Betim, Contagem, Nova Lima e região.';
const VIDEO_TITLE = 'Plataforma de vídeos - O Herói da Cidade';
const VIDEO_DESCRIPTION = 'Assista à plataforma de vídeos do Herói da Cidade e conheça conteúdos e apresentações do personagem Homem-Aranha.';
const HOME_URL = 'https://www.heroidacidade.com/';
const VIDEO_URL = 'https://www.heroidacidade.com/videos';
const SOCIAL_IMAGE = 'https://www.heroidacidade.com/images/spider.PNG';
const SITE_NAME = 'O Herói da Cidade';

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
  const homeContent = useHomeContent(!isAdmin && !isVideos);

  useEffect(() => {
    const structuredDataId = 'site-seo-structured-data';
    const existingStructuredData = document.getElementById(structuredDataId);

    if (isAdmin) {
      setMeta('name', 'robots', 'noindex, nofollow');
      document.querySelector('link[rel="canonical"]')?.remove();
      document.querySelector('meta[name="description"]')?.remove();
      document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((element) => element.remove());
      existingStructuredData?.remove();
      return;
    }

    const title = isVideos ? VIDEO_TITLE : homeContent.seoTitle || HOME_TITLE;
    const description = isVideos ? VIDEO_DESCRIPTION : homeContent.seoDescription || HOME_DESCRIPTION;
    const url = isVideos ? VIDEO_URL : HOME_URL;

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
  }, [isAdmin, isVideos, homeContent.seoTitle, homeContent.seoDescription]);

  if (isAdmin) {
    return <AdminApp />;
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
