import React from 'react';
import { Video } from '../../types';
import { X } from 'lucide-react';
import { useVideoFormFields } from './videoAdmin/useVideoFormFields';
import { useCategoryField } from './videoAdmin/useCategoryField';
import { useThumbnailField } from './videoAdmin/useThumbnailField';
import { useVideoFormSubmit } from './videoAdmin/useVideoFormSubmit';
import { VideoCategoriesField } from './videoAdmin/VideoCategoriesField';
import { VideoThumbnailField } from './videoAdmin/VideoThumbnailField';
import { VideoBasicFields, VideoExtraFields, VideoFormFooter } from './videoAdmin/VideoFormFields';

interface Props {
  video?: Video | null;
  existingCategories?: string[];
  onClose: () => void;
}

const VideoFormModal: React.FC<Props> = ({ video, existingCategories = [], onClose }) => {
  const fields = useVideoFormFields(video);
  const { isEditMode } = fields;
  const category = useCategoryField(video, existingCategories);
  const thumb = useThumbnailField(video);
  const { bodyScrollRef, error, loading, handleSubmit } = useVideoFormSubmit({
    video,
    isEditMode,
    fields,
    categories: category.categories,
    selectedFile: thumb.selectedFile,
    removeThumbnail: thumb.removeThumbnail,
    setThumbnailError: thumb.setThumbnailError,
    onClose,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm">
      <div className="bg-[#0D1527] rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden my-auto">
        {/* ========================================================= */}
        {/* HEADER FIXO DO MODAL (Nunca sai da visão)                */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0 bg-[#0D1527]">
          <h2 className="text-xl font-bold text-white tracking-wide">
            {isEditMode ? 'Editar Vídeo' : 'Novo Vídeo'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* FORMULÁRIO COM CORPO ROLÁVEL + FOOTER FIXO                */}
        {/* ========================================================= */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* CORPO ROLÁVEL (Sempre inicia no topo, com o Título visível) */}
          <div ref={bodyScrollRef} className="overflow-y-auto flex-1 p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <VideoBasicFields
              title={fields.title}
              onTitleChange={fields.setTitle}
              url={fields.url}
              onUrlChange={fields.setUrl}
            />

            <VideoCategoriesField
              categories={category.categories}
              allCategories={category.allCategories}
              newCategory={category.newCategory}
              onNewCategoryChange={category.setNewCategory}
              categoryError={category.categoryError}
              toggleCategory={category.toggleCategory}
              removeCategory={category.removeCategory}
              handleAddNewCategory={category.handleAddNewCategory}
            />

            <VideoThumbnailField
              isEditMode={isEditMode}
              thumbnailError={thumb.thumbnailError}
              fileInputRef={thumb.fileInputRef}
              onFileChange={thumb.handleFileChange}
              previewUrl={thumb.previewUrl}
              selectedFile={thumb.selectedFile}
              existingThumbnail={thumb.existingThumbnail}
              removeThumbnail={thumb.removeThumbnail}
              setRemoveThumbnail={thumb.setRemoveThumbnail}
              onClearSelectedFile={thumb.handleClearSelectedFile}
            />

            <VideoExtraFields
              badgeText={fields.badgeText}
              onBadgeTextChange={fields.setBadgeText}
              keywords={fields.keywords}
              onKeywordsChange={fields.setKeywords}
              order={fields.order}
              onOrderChange={fields.setOrder}
              active={fields.active}
              onActiveChange={fields.handleActiveChange}
              featured={fields.featured}
              onFeaturedChange={fields.setFeatured}
            />
          </div>

          <VideoFormFooter loading={loading} hasSelectedFile={Boolean(thumb.selectedFile)} onClose={onClose} />
        </form>
      </div>
    </div>
  );
};

export default VideoFormModal;
