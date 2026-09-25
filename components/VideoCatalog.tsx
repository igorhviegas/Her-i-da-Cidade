import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from '../lib/router';
import { Video } from '../types';
import { getVideos, subscribeToVideos } from '../services/videosService';
import { searchVideos } from '../utils/videoSearch';
import { isValidInstagramUrl } from '../utils/videoHelpers';
import { VideoPlayerFullscreen } from './VideoPlayerFullscreen';
import { VideoRow } from './VideoRow';
import { BackToTop } from './BackToTop';

export const VideoCatalog: React.FC = () => {
  const { navigate, search: routerSearch } = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);

  // Inicializa a busca a partir dos query parameters da URL (ex: /videos?search=escovar%20os%20dentes)
  const initialSearch = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('search') || '';
    }
    return '';
  }, []);

  const [search, setSearch] = useState<string>(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Referência e medição dinâmica da altura do header para fixar a barra de categorias sem sobreposição
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    document.title = "Plataforma de vídeos - O Herói da Cidade";

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

  // Carrega vídeos e assina atualizações do Firestore
  useEffect(() => {
    getVideos().then(setVideos).catch(() => setVideos([]));
    return subscribeToVideos(setVideos);
  }, []);

  // Mantém sincronizada a busca se a rota mudar externamente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryParam = params.get('search') || '';
      setSearch(queryParam);
    }
  }, [routerSearch]);

  // Atualiza campo de busca e sincroniza a URL
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (typeof window !== 'undefined') {
      const trimmed = value.trim();
      const newUrl = trimmed ? `/videos?search=${encodeURIComponent(trimmed)}` : '/videos';
      window.history.replaceState({}, '', newUrl);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategory(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/videos');
    }
  };

  const availableVideos = useMemo(() => videos.filter((video) => video.active !== false), [videos]);

  // Extrai dinamicamente as categorias que realmente existem nos vídeos cadastrados
  const existingCategories = useMemo(() => {
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
  }, [availableVideos]);

  // 1. Filtro textual via algoritmo de busca existente
  const textFilteredVideos = useMemo(() => searchVideos(availableVideos, search), [availableVideos, search]);

  // 2. Filtro combinado com a categoria selecionada (funcionam juntos)
  const matchingVideos = useMemo(() => {
    if (!selectedCategory) return textFilteredVideos;
    const targetCat = selectedCategory.toLowerCase().trim();
    return textFilteredVideos.filter((video) => {
      const cats = video.categories && video.categories.length > 0
        ? video.categories
        : (video.category ? [video.category] : []);
      return cats.some((c) => c.toLowerCase().trim() === targetCat);
    });
  }, [textFilteredVideos, selectedCategory]);

  const isFiltering = Boolean(search.trim() || selectedCategory);

  // Busca o vídeo ativo marcado explicitamente pelo administrador como destaque (featured === true)
  const featuredVideo = useMemo(() => {
    if (isFiltering) return null;
    return availableVideos.find((video) => video.featured === true && video.active !== false) || null;
  }, [availableVideos, isFiltering]);

  const selectedIndex = matchingVideos.findIndex((video) => video.id === selectedId);
  const selectedVideo = selectedIndex >= 0 ? matchingVideos[selectedIndex] : null;

  // Organiza por categorias para exibição em carrosséis
  const categorizedVideos = useMemo(() => {
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
  }, [matchingVideos, selectedCategory]);

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      {/* Header com botão Voltar evidente e campo de busca */}
      <header
        ref={headerRef}
        className={`sticky top-0 z-30 border-b border-white/10 bg-[#07070b]/95 backdrop-blur-xl shadow-lg transition-transform duration-300 ease-in-out ${
          isNavbarVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-xs sm:text-sm px-4 py-2 border border-white/20 shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 group cursor-pointer flex-shrink-0"
              aria-label="Voltar para a página principal"
            >
              <svg
                className="w-4 h-4 transition-transform group-hover:-translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Voltar</span>
            </button>
            <h1 className="text-xl font-black tracking-tight text-white md:text-2xl whitespace-nowrap">
              Plataforma de vídeos
            </h1>
          </div>

          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Buscar vídeos</span>
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Buscar título, categoria ou tag..."
              className="w-full rounded-full border border-white/15 bg-white/10 py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                aria-label="Limpar busca"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </label>
        </div>
      </header>

      {/* Barra de Categorias estilo Plataforma de Streaming (Fixa abaixo da navbar durante rolagem) */}
      <section
        style={{ top: isNavbarVisible ? `${headerHeight}px` : '0px' }}
        className="sticky z-20 border-b border-white/10 bg-[#07070b]/95 backdrop-blur-xl shadow-md transition-[top] duration-300 ease-in-out"
      >
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
          <div className="flex items-center gap-2.5 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Botão Todos */}
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`group relative flex-none px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-200 border cursor-pointer ${
                selectedCategory === null
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-blue-400/80 shadow-lg shadow-blue-600/30 scale-[1.02]'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/75 hover:text-white border-white/10 hover:border-white/25'
              }`}
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
                </svg>
                Todos
              </span>
            </button>

            {/* Botões individuais para cada categoria existente */}
            {existingCategories.map((category) => {
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : category)}
                  className={`group relative flex-none px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-200 border cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-blue-400/80 shadow-lg shadow-blue-600/30 scale-[1.02]'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/75 hover:text-white border-white/10 hover:border-white/25'
                  }`}
                >
                  <span className="relative z-10">{category}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Destaque Hero (Apenas visível quando não há filtros ativos) */}
      {featuredVideo && (
        <section className="relative isolate flex min-h-[55vh] sm:min-h-[58vh] items-end overflow-hidden">
          <img
            src={featuredVideo.thumbnailUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=85'}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#07070b] via-[#07070b]/55 to-black/20" />
          <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:pb-12 md:px-8 md:pb-16">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {featuredVideo.badgeText && (
                <span className="inline-block px-3 py-1 rounded-md bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white font-black text-xs tracking-wider uppercase shadow-md shadow-black/50 border border-white/20">
                  {featuredVideo.badgeText}
                </span>
              )}
              <span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-md">
                Em destaque
              </span>
            </div>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-4xl md:text-6xl text-white">
              {featuredVideo.title}
            </h2>
            {featuredVideo.caption && (
              <p className="mt-2.5 max-w-xl text-sm text-white/80 line-clamp-3 md:text-base">
                {featuredVideo.caption}
              </p>
            )}
            <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedId(featuredVideo.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-slate-950 transition hover:bg-white/85 shadow-lg active:scale-95 cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Assistir agora
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Indicador de Filtro Ativo */}
      {isFiltering && (
        <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span>Filtrando por:</span>
            {selectedCategory && (
              <span className="rounded-md bg-purple-600/30 border border-purple-400/40 px-2 py-0.5 text-xs font-bold text-purple-300">
                Categoria: {selectedCategory}
              </span>
            )}
            {search && (
              <span className="rounded-md bg-blue-600/30 border border-blue-400/40 px-2 py-0.5 text-xs font-bold text-blue-300">
                Busca: “{search}”
              </span>
            )}
            <span className="text-xs text-white/40">({matchingVideos.length} {matchingVideos.length === 1 ? 'vídeo' : 'vídeos'})</span>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-purple-400 hover:text-purple-300 underline cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Listagem de Vídeos Organizada em Carrosséis por Categoria */}
      <section className="mx-auto max-w-7xl space-y-10 px-4 py-8 md:px-8 md:py-12">
        {matchingVideos.length === 0 ? (
          <div className="py-20 text-center text-white/60">
            <p className="text-lg font-medium">Nenhum vídeo encontrado para os filtros atuais.</p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-all cursor-pointer"
            >
              Limpar busca e filtros
            </button>
          </div>
        ) : (
          categorizedVideos.map(([category, list]) => (
            <VideoRow
              key={category}
              title={category}
              videos={list}
              onSelect={(video) => setSelectedId(video.id)}
            />
          ))
        )}
      </section>

      {/* Modal Player Fullscreen */}
      {selectedVideo && (
        <VideoPlayerFullscreen
          video={selectedVideo}
          onClose={() => setSelectedId(null)}
          onPrevious={
            selectedIndex > 0
              ? () => setSelectedId(matchingVideos[selectedIndex - 1].id)
              : undefined
          }
          onNext={
            selectedIndex < matchingVideos.length - 1
              ? () => setSelectedId(matchingVideos[selectedIndex + 1].id)
              : undefined
          }
        />
      )}

      {/* Botão Subir ao Topo com a Teia do Herói da Cidade */}
      <BackToTop />
    </main>
  );
};
