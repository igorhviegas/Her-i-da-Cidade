import { useMemo, useState } from 'react';
import { Video } from '../../../types';
import { SortOption, normalize, matchesVideoFilters, compareVideos } from './videoListHelpers';

export const useVideoListFilters = (videos: Video[]) => {
  // Estados dos controles da Barra de Ferramentas
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [sortBy, setSortBy] = useState<SortOption>('order');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [onlyReview, setOnlyReview] = useState(false);

  // Filtragem e ordenação em tempo real no cliente
  const filteredAndSortedVideos = useMemo(() => {
    const q = normalize(search);

    // 1. Filtros (Busca + Categoria)
    const filtered = videos.filter((video) => matchesVideoFilters(video, q, selectedCategory, onlyReview));

    // 2. Ordenação visual
    return [...filtered].sort((a, b) => compareVideos(a, b, sortBy));
  }, [videos, search, selectedCategory, sortBy, onlyReview]);

  const isFiltered = Boolean(search.trim() || selectedCategory !== 'Todas' || onlyReview);
  const reviewCount = useMemo(() => videos.filter((v) => v.needsReview).length, [videos]);

  return {
    search, setSearch,
    selectedCategory, setSelectedCategory,
    sortBy, setSortBy,
    viewMode, setViewMode,
    onlyReview, setOnlyReview,
    filteredAndSortedVideos, isFiltered, reviewCount,
  };
};
