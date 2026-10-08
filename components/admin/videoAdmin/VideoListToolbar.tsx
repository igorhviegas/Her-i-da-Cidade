import React from 'react';
import { Search, X, LayoutGrid, List } from 'lucide-react';
import { SortOption } from './videoListHelpers';

interface VideoListHeaderProps {
  syncing: boolean;
  onInstagramSync: () => void;
  onCsvImport: () => void;
  onNewVideo: () => void;
}

export const VideoListHeader: React.FC<VideoListHeaderProps> = ({ syncing, onInstagramSync, onCsvImport, onNewVideo }) => (
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
        onClick={onInstagramSync}
        disabled={syncing}
        className="px-4 py-2 bg-sky-600/90 text-white rounded-xl hover:bg-sky-500 font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
      >
        {syncing ? 'Sincronizando...' : 'Importar do Instagram'}
      </button>
      <button
        type="button"
        onClick={onCsvImport}
        className="px-4 py-2 bg-emerald-600/90 text-white rounded-xl hover:bg-emerald-500 font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
      >
        Importar CSV
      </button>
      <button
        type="button"
        onClick={onNewVideo}
        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 font-semibold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
      >
        Novo Vídeo
      </button>
    </div>
  </div>
);

interface VideoSearchBoxProps {
  search: string;
  onSearchChange: (value: string) => void;
}

const VideoSearchBox: React.FC<VideoSearchBoxProps> = ({ search, onSearchChange }) => (
  <div className="relative">
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
    <input
      type="text"
      value={search}
      onChange={(e) => onSearchChange(e.target.value)}
      placeholder="Buscar vídeos por título, categoria, palavras-chave ou selo..."
      className="w-full bg-[#070B14] border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
    />
    {search && (
      <button
        type="button"
        onClick={() => onSearchChange('')}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
        title="Limpar busca"
        aria-label="Limpar busca"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

interface VideoFilterControlsProps {
  videosCount: number;
  existingCategories: string[];
  selectedCategory: string;
  onSelectedCategoryChange: (value: string) => void;
  onlyReview: boolean;
  onToggleOnlyReview: () => void;
  reviewCount: number;
  sortBy: SortOption;
  onSortByChange: (value: SortOption) => void;
}

const VideoFilterControls: React.FC<VideoFilterControlsProps> = ({
  videosCount,
  existingCategories,
  selectedCategory,
  onSelectedCategoryChange,
  onlyReview,
  onToggleOnlyReview,
  reviewCount,
  sortBy,
  onSortByChange,
}) => (
  <div className="flex flex-wrap items-center gap-3">
    {/* Filtro por Categoria */}
    <div className="flex items-center gap-1.5">
      <span className="text-white/50 font-medium">Categoria:</span>
      <select
        value={selectedCategory}
        onChange={(e) => onSelectedCategoryChange(e.target.value)}
        className="bg-[#070B14] border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
      >
        <option value="Todas">Todas ({videosCount})</option>
        {existingCategories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>

    {/* Filtro: importados do Instagram aguardando revisão */}
    <button
      type="button"
      onClick={onToggleOnlyReview}
      aria-pressed={onlyReview}
      className={`px-3 py-1.5 rounded-xl border font-bold transition-colors cursor-pointer ${
        onlyReview ? 'bg-sky-600 text-white border-sky-400' : 'bg-[#070B14] text-white/70 border-white/10 hover:text-white'
      }`}
    >
      Aguardando revisão ({reviewCount})
    </button>

    {/* Ordenação */}
    <div className="flex items-center gap-1.5">
      <span className="text-white/50 font-medium">Ordenar por:</span>
      <select
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as SortOption)}
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
);

interface VideoResultsAndViewToggleProps {
  isFiltered: boolean;
  filteredCount: number;
  videosCount: number;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

const VideoResultsAndViewToggle: React.FC<VideoResultsAndViewToggleProps> = ({
  isFiltered,
  filteredCount,
  videosCount,
  viewMode,
  onViewModeChange,
}) => (
  <div className="flex items-center gap-3 ml-auto">
    {/* Contagem de Resultados */}
    <span className="text-white/60 font-medium text-xs">
      {isFiltered ? (
        <>
          <strong className="text-white">{filteredCount}</strong> de {videosCount} vídeos
        </>
      ) : (
        <>
          <strong className="text-white">{videosCount}</strong> {videosCount === 1 ? 'vídeo' : 'vídeos'}
        </>
      )}
    </span>

    {/* Alternância de Visualização: Quadros (▦) e Lista (☷) */}
    <div className="flex items-center bg-[#070B14] border border-white/10 p-0.5 rounded-xl">
      <button
        type="button"
        onClick={() => onViewModeChange('grid')}
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
        onClick={() => onViewModeChange('list')}
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
);

export interface VideoListToolbarProps extends VideoSearchBoxProps, VideoFilterControlsProps {
  isFiltered: boolean;
  filteredCount: number;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

// Barra de Ferramentas Administrativa (Busca, Categoria, Ordenação e Alternância de Visualização)
export const VideoListToolbar: React.FC<VideoListToolbarProps> = (props) => (
  <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-lg">
    {/* Campo de Busca em Tempo Real */}
    <VideoSearchBox search={props.search} onSearchChange={props.onSearchChange} />

    {/* Linha de Controles: Categoria, Ordenar por, Contagem e Visualização */}
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <VideoFilterControls
        videosCount={props.videosCount}
        existingCategories={props.existingCategories}
        selectedCategory={props.selectedCategory}
        onSelectedCategoryChange={props.onSelectedCategoryChange}
        onlyReview={props.onlyReview}
        onToggleOnlyReview={props.onToggleOnlyReview}
        reviewCount={props.reviewCount}
        sortBy={props.sortBy}
        onSortByChange={props.onSortByChange}
      />
      <VideoResultsAndViewToggle
        isFiltered={props.isFiltered}
        filteredCount={props.filteredCount}
        videosCount={props.videosCount}
        viewMode={props.viewMode}
        onViewModeChange={props.onViewModeChange}
      />
    </div>
  </div>
);
