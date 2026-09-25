import React, { useEffect, useMemo, useState } from 'react';
import { Video } from '../../types';
import { getVideos, deleteVideo, toggleVideoActive, updateVideoOrder, setFeaturedVideo } from '../../services/videosService';
import VideoCardAdmin from './VideoCardAdmin';
import VideoRowAdmin from './VideoRowAdmin';
import VideoFormModal from './VideoFormModal';
import CsvImportModal from './CsvImportModal';
import { Search, X, LayoutGrid, List } from 'lucide-react';

type SortOption = 'order' | 'title-asc' | 'title-desc' | 'recent' | 'oldest';

export const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editVideo, setEditVideo] = useState<Video | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);

  // Estados dos controles da Barra de Ferramentas
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [sortBy, setSortBy] = useState<SortOption>('order');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const data = await getVideos(false); // include inactive videos
      setVideos(data);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar vídeos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Extrai categorias dinâmicas dos vídeos carregados
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => {
      if (v.categories?.length) {
        v.categories.forEach((c) => c && set.add(c.trim()));
      } else if (v.category) {
        set.add(v.category.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [videos]);

  // Função auxiliar de normalização sem acentos e minúsculas
  const normalize = (text: string) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Filtragem e ordenação em tempo real no cliente
  const filteredAndSortedVideos = useMemo(() => {
    const q = normalize(search);

    // 1. Filtros (Busca + Categoria)
    const filtered = videos.filter((video) => {
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
    });

    // 2. Ordenação visual
    return [...filtered].sort((a, b) => {
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
        const dateA = a.createdAt || a.updatedAt || a.publishedAt || '';
        const dateB = b.createdAt || b.updatedAt || b.publishedAt || '';
        return dateB.localeCompare(dateA);
      }
      if (sortBy === 'oldest') {
        const dateA = a.createdAt || a.updatedAt || a.publishedAt || '';
        const dateB = b.createdAt || b.updatedAt || b.publishedAt || '';
        return dateA.localeCompare(dateB);
      }
      return 0;
    });
  }, [videos, search, selectedCategory, sortBy]);

  const isFiltered = Boolean(search.trim() || selectedCategory !== 'Todas');

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este vídeo?')) return;
    await deleteVideo(id);
    fetchVideos();
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await toggleVideoActive(id, !active);
    fetchVideos();
  };

  const handleToggleFeatured = async (id: string, isCurrentlyFeatured: boolean) => {
    try {
      await setFeaturedVideo(id, !isCurrentlyFeatured);
      fetchVideos();
    } catch (e: any) {
      alert(e.message ?? 'Erro ao alterar destaque');
    }
  };

  const handleOrderChange = async (id: string, order: number) => {
    await updateVideoOrder(id, order);
    fetchVideos();
  };

  const handleEdit = (video: Video) => {
    setEditVideo(video);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setEditVideo(null);
    setShowForm(false);
    fetchVideos();
  };

  const handleCsvImportClose = () => {
    setShowCsvImport(false);
    fetchVideos();
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho da página com ações primárias */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Lista de Vídeos</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Gerenciamento, status e ordenação dos conteúdos da plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCsvImport(true)}
            className="px-4 py-2 bg-emerald-600/90 text-white rounded-xl hover:bg-emerald-500 font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Importar CSV
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Novo Vídeo
          </button>
        </div>
      </div>

      {/* Barra de Ferramentas Administrativa (Busca, Categoria, Ordenação e Alternância de Visualização) */}
      <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-lg">
        {/* Campo de Busca em Tempo Real */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vídeos por título, categoria, palavras-chave ou selo..."
            className="w-full bg-[#070B14] border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
              title="Limpar busca"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Linha de Controles: Categoria, Ordenar por, Contagem e Visualização */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro por Categoria */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/50 font-medium">Categoria:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#070B14] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Todas">Todas ({videos.length})</option>
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Ordenação */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/50 font-medium">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-[#070B14] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="order">Ordem de exibição</option>
                <option value="title-asc">Ordem alfabética A–Z</option>
                <option value="title-desc">Ordem alfabética Z–A</option>
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Contagem de Resultados */}
            <span className="text-white/60 font-medium text-xs">
              {isFiltered ? (
                <>
                  <strong className="text-white">{filteredAndSortedVideos.length}</strong> de {videos.length} vídeos
                </>
              ) : (
                <>
                  <strong className="text-white">{videos.length}</strong> {videos.length === 1 ? 'vídeo' : 'vídeos'}
                </>
              )}
            </span>

            {/* Alternância de Visualização: Quadros (▦) e Lista (☷) */}
            <div className="flex items-center bg-[#070B14] border border-white/10 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
                title="Visualização em quadros (▦)"
                aria-label="Visualização em quadros"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Quadros</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
                title="Visualização em lista (☷)"
                aria-label="Visualização em lista"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && <p className="text-white py-8 text-center">Carregando vídeos...</p>}
      {error && <p className="text-red-400 py-4 text-center">{error}</p>}

      {!loading && !error && (
        <>
          {filteredAndSortedVideos.length === 0 ? (
            <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-12 text-center text-white/60">
              <p className="text-base font-medium">Nenhum vídeo encontrado para os filtros atuais.</p>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedCategory('Todas');
                  }}
                  className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Limpar busca e filtros
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* Visualização em Quadros (▦) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedVideos.map((video) => (
                <VideoCardAdmin
                  key={video.id}
                  video={video}
                  onEdit={() => handleEdit(video)}
                  onDelete={() => handleDelete(video.id)}
                  onToggleActive={() => handleToggleActive(video.id, video.active)}
                  onToggleFeatured={() => handleToggleFeatured(video.id, video.featured === true)}
                  onOrderChange={(order) => handleOrderChange(video.id, order)}
                />
              ))}
            </div>
          ) : (
            /* Visualização em Lista (☷) */
            <div className="flex flex-col gap-2.5">
              {filteredAndSortedVideos.map((video) => (
                <VideoRowAdmin
                  key={video.id}
                  video={video}
                  onEdit={() => handleEdit(video)}
                  onDelete={() => handleDelete(video.id)}
                  onToggleActive={() => handleToggleActive(video.id, video.active)}
                  onToggleFeatured={() => handleToggleFeatured(video.id, video.featured === true)}
                  onOrderChange={(order) => handleOrderChange(video.id, order)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showForm && (
        <VideoFormModal video={editVideo} onClose={handleFormClose} />
      )}

      {showCsvImport && (
        <CsvImportModal onClose={handleCsvImportClose} />
      )}
    </div>
  );
};
export default VideoList;

