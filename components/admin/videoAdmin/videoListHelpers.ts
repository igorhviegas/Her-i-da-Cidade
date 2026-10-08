import { Video } from '../../../types';

export type SortOption = 'order' | 'title-asc' | 'title-desc' | 'recent' | 'oldest';

// Função auxiliar de normalização sem acentos e minúsculas
export const normalize = (text: string) =>
  (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Filtros (Busca + Categoria + Aguardando revisão)
export const matchesVideoFilters = (
  video: Video,
  q: string,
  selectedCategory: string,
  onlyReview: boolean,
): boolean => {
  if (onlyReview && !video.needsReview) return false;
  // Filtro de categoria
  if (selectedCategory !== 'Todas') {
    const cats = video.categories?.length
      ? video.categories
      : video.category
      ? [video.category]
      : [];
    const matchesCategory = cats.some(
      (c) => c.toLowerCase().trim() === selectedCategory.toLowerCase().trim()
    );
    if (!matchesCategory) return false;
  }

  // Busca textual
  if (!q) return true;

  const searchable = [
    video.title,
    video.caption,
    video.description,
    video.category,
    ...(video.categories || []),
    ...(video.tags || []),
    ...(video.keywords || []),
    video.badgeText,
    video.searchText,
  ]
    .filter(Boolean)
    .join(' ');

  return normalize(searchable).includes(q);
};

const videoDate = (v: Video) => v.createdAt || v.updatedAt || v.publishedAt || '';

// Ordenação visual
export const compareVideos = (a: Video, b: Video, sortBy: SortOption): number => {
  if (sortBy === 'order') {
    return (a.order ?? 0) - (b.order ?? 0);
  }
  if (sortBy === 'title-asc') {
    return a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
  }
  if (sortBy === 'title-desc') {
    return b.title.localeCompare(a.title, 'pt-BR', { sensitivity: 'base' });
  }
  if (sortBy === 'recent') {
    const dateA = videoDate(a);
    const dateB = videoDate(b);
    return dateB.localeCompare(dateA);
  }
  if (sortBy === 'oldest') {
    const dateA = videoDate(a);
    const dateB = videoDate(b);
    return dateA.localeCompare(dateB);
  }
  return 0;
};
