import { useEffect, useRef, useState } from 'react';
import { Video } from '../../types';
import { getVideos, subscribeToVideos } from '../../services/videosService';

/** Carrega vídeos e assina atualizações do Firestore. */
export function useCatalogVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  useEffect(() => {
    getVideos().then(setVideos).catch(() => setVideos([]));
    return subscribeToVideos(setVideos);
  }, []);
  return videos;
}

/** Medição dinâmica da altura do header e visibilidade dele conforme a rolagem (fixa a barra de categorias sem sobreposição). */
export function useStickyHeader() {
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {

    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);

    const threshold = 12;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const diff = currentScrollY - lastScrollYRef.current;

          // Se estiver no topo da página (<= 50px), sempre manter visível
          if (currentScrollY <= 50) {
            setIsNavbarVisible(true);
          } else if (Math.abs(diff) >= threshold) {
            if (diff > 0) {
              // Rolando para baixo: recolhe a navbar suavemente
              setIsNavbarVisible(false);
            } else {
              // Rolando para cima: reaparece a navbar suavemente
              setIsNavbarVisible(true);
            }
            lastScrollYRef.current = currentScrollY;
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return { headerRef, headerHeight, isNavbarVisible };
}

/** Lê o parâmetro ?search= da URL atual (vazio fora do navegador). */
export function readSearchParam(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
  }
  return '';
}

/** Extrai dinamicamente as categorias que realmente existem nos vídeos cadastrados. */
export function collectCategories(availableVideos: Video[]): string[] {
  const categorySet = new Set<string>();
  availableVideos.forEach((video) => {
    if (Array.isArray(video.categories) && video.categories.length > 0) {
      video.categories.forEach((c) => {
        const trimmed = c?.trim();
        if (trimmed) categorySet.add(trimmed);
      });
    } else if (typeof video.category === 'string' && video.category.trim()) {
      categorySet.add(video.category.trim());
    }
  });
  return Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Filtro combinado com a categoria selecionada (funciona junto com o filtro textual). */
export function filterByCategory(textFilteredVideos: Video[], selectedCategory: string | null): Video[] {
  if (!selectedCategory) return textFilteredVideos;
  const targetCat = selectedCategory.toLowerCase().trim();
  return textFilteredVideos.filter((video) => {
    const cats = video.categories && video.categories.length > 0
      ? video.categories
      : (video.category ? [video.category] : []);
    return cats.some((c) => c.toLowerCase().trim() === targetCat);
  });
}

/** Organiza por categorias para exibição em carrosséis. */
export function groupByCategory(matchingVideos: Video[], selectedCategory: string | null): [string, Video[]][] {
  if (selectedCategory) {
    // Se uma categoria específica está ativa, agrupa sob o nome da categoria selecionada
    return [[selectedCategory, matchingVideos] as [string, Video[]]];
  }

  const categories = new Map<string, Video[]>();
  matchingVideos.forEach((video) => {
    const names = video.categories?.length ? video.categories : (video.category ? [video.category] : ['Outros vídeos']);
    names.forEach((name) => {
      categories.set(name, [...(categories.get(name) || []), video]);
    });
  });
  return Array.from(categories.entries());
}
