import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../lib/router';
import { searchVideos } from '../utils/videoSearch';
import { VideoPlayerFullscreen } from './VideoPlayerFullscreen';
import { BackToTop } from './BackToTop';
import { ActiveFilters, CategoryBar, CatalogHeader, FeaturedHero, VideoRows } from './publicSite/VideoCatalogParts';
import { collectCategories, filterByCategory, groupByCategory, readSearchParam, useCatalogVideos, useStickyHeader } from './publicSite/videoCatalogHooks';

export const VideoCatalog: React.FC = () => {
  const { navigate, search: routerSearch } = useRouter();
  const videos = useCatalogVideos();

  // Inicializa a busca a partir dos query parameters da URL (ex: /videos?search=escovar%20os%20dentes)
  const [search, setSearch] = useState<string>(readSearchParam);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Referência e medição dinâmica da altura do header para fixar a barra de categorias sem sobreposição
  const { headerRef, headerHeight, isNavbarVisible } = useStickyHeader();

  // Mantém sincronizada a busca se a rota mudar externamente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSearch(readSearchParam());
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
  const existingCategories = useMemo(() => collectCategories(availableVideos), [availableVideos]);

  // 1. Filtro textual via algoritmo de busca existente
  const textFilteredVideos = useMemo(() => searchVideos(availableVideos, search), [availableVideos, search]);

  // 2. Filtro combinado com a categoria selecionada (funcionam juntos)
  const matchingVideos = useMemo(() => filterByCategory(textFilteredVideos, selectedCategory), [textFilteredVideos, selectedCategory]);

  const isFiltering = Boolean(search.trim() || selectedCategory);

  // Busca o vídeo ativo marcado explicitamente pelo administrador como destaque (featured === true)
  const featuredVideo = useMemo(() => {
    if (isFiltering) return null;
    return availableVideos.find((video) => video.featured === true && video.active !== false) || null;
  }, [availableVideos, isFiltering]);

  const selectedIndex = matchingVideos.findIndex((video) => video.id === selectedId);
  const selectedVideo = selectedIndex >= 0 ? matchingVideos[selectedIndex] : null;

  // Organiza por categorias para exibição em carrosséis
  const categorizedVideos = useMemo(() => groupByCategory(matchingVideos, selectedCategory), [matchingVideos, selectedCategory]);

  return (
    <main className="min-h-screen bg-[#070B14] text-white">
      {/* Header com botão Voltar evidente e campo de busca */}
      <CatalogHeader headerRef={headerRef} isNavbarVisible={isNavbarVisible} search={search} onNavigateHome={() => navigate('/')} onSearchChange={handleSearchChange} />

      {/* Barra de Categorias estilo Plataforma de Streaming (Fixa abaixo da navbar durante rolagem) */}
      <CategoryBar isNavbarVisible={isNavbarVisible} headerHeight={headerHeight} selectedCategory={selectedCategory} existingCategories={existingCategories} onSelectCategory={setSelectedCategory} />

      {/* Destaque Hero (Apenas visível quando não há filtros ativos) */}
      {featuredVideo && <FeaturedHero featuredVideo={featuredVideo} onWatch={setSelectedId} />}

      {/* Indicador de Filtro Ativo */}
      {isFiltering && <ActiveFilters selectedCategory={selectedCategory} search={search} count={matchingVideos.length} onClear={handleClearFilters} />}

      {/* Listagem de Vídeos Organizada em Carrosséis por Categoria */}
      <VideoRows matchingCount={matchingVideos.length} categorizedVideos={categorizedVideos} onClear={handleClearFilters} onSelect={setSelectedId} />

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
