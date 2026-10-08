import React, { useState } from 'react';
import { Video } from '../../types';
import VideoFormModal from './VideoFormModal';
import CsvImportModal from './CsvImportModal';
import { useVideoListData } from './videoAdmin/useVideoListData';
import { useVideoListFilters } from './videoAdmin/useVideoListFilters';
import { VideoListHeader, VideoListToolbar } from './videoAdmin/VideoListToolbar';
import { VideoListResults } from './videoAdmin/VideoListResults';

export const VideoList: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editVideo, setEditVideo] = useState<Video | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);

  const {
    videos, loading, error, syncing, syncMessage, existingCategories,
    fetchVideos, handleInstagramSync, handleDelete, handleToggleActive, handleToggleFeatured, handleOrderChange,
  } = useVideoListData();

  const {
    search, setSearch,
    selectedCategory, setSelectedCategory,
    sortBy, setSortBy,
    viewMode, setViewMode,
    onlyReview, setOnlyReview,
    filteredAndSortedVideos, isFiltered, reviewCount,
  } = useVideoListFilters(videos);

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
      <VideoListHeader
        syncing={syncing}
        onInstagramSync={handleInstagramSync}
        onCsvImport={() => setShowCsvImport(true)}
        onNewVideo={() => setShowForm(true)}
      />

      {syncMessage && <p className="text-xs text-white/70" role="status">{syncMessage}</p>}

      <VideoListToolbar
        search={search}
        onSearchChange={setSearch}
        videosCount={videos.length}
        existingCategories={existingCategories}
        selectedCategory={selectedCategory}
        onSelectedCategoryChange={setSelectedCategory}
        onlyReview={onlyReview}
        onToggleOnlyReview={() => setOnlyReview((v) => !v)}
        reviewCount={reviewCount}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        isFiltered={isFiltered}
        filteredCount={filteredAndSortedVideos.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {loading && <p className="text-white py-8 text-center">Carregando vídeos...</p>}
      {error && <p className="text-red-400 py-4 text-center">{error}</p>}

      {!loading && !error && (
        <VideoListResults
          videos={filteredAndSortedVideos}
          isFiltered={isFiltered}
          viewMode={viewMode}
          onClearFilters={() => {
            setSearch('');
            setSelectedCategory('Todas');
            setOnlyReview(false);
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onToggleFeatured={handleToggleFeatured}
          onOrderChange={handleOrderChange}
        />
      )}

      {showForm && (
        <VideoFormModal video={editVideo} existingCategories={existingCategories} onClose={handleFormClose} />
      )}

      {showCsvImport && (
        <CsvImportModal onClose={handleCsvImportClose} />
      )}
    </div>
  );
};
export default VideoList;
