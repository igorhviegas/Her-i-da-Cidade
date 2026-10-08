import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../../../lib/logger.js';
import { Video } from '../../../types';
import { createVideo, updateVideo, getVideoByInstagramId } from '../../../services/videosService';
import { extractInstagramId } from '../../../utils/videoHelpers';

interface VideoFormValues {
  title: string;
  url: string;
  keywords: string;
  order: string;
  badgeText: string;
  active: boolean;
  featured: boolean;
}

const buildVideoPayload = (fields: VideoFormValues, instagramId: string, categories: string[]): Partial<Video> => {
  const { title, url, keywords, order, badgeText, active, featured } = fields;
  const cleanedCategories = categories.map(c => c.trim()).filter(Boolean);

  return {
    title: title.trim(),
    instagramUrl: url.trim(),
    instagramId,
    category: cleanedCategories[0] || '',
    categories: cleanedCategories,
    keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
    order: Number(order) || 1,
    badgeText: badgeText.trim(),
    active,
    featured: active ? featured : false,
  };
};

interface PersistVideoArgs {
  video?: Video | null;
  isEditMode: boolean;
  payload: Partial<Video>;
  selectedFile: File | null;
  removeThumbnail: boolean;
}

const persistVideo = async ({ video, isEditMode, payload, selectedFile, removeThumbnail }: PersistVideoArgs) => {
  if (isEditMode && video?.id) {
    await updateVideo(video.id, payload, {
      thumbnailFile: selectedFile,
      removeThumbnail: removeThumbnail && !selectedFile,
    });
  } else {
    await createVideo(payload, selectedFile);
  }
};

interface UseVideoFormSubmitArgs {
  video?: Video | null;
  isEditMode: boolean;
  fields: VideoFormValues;
  categories: string[];
  selectedFile: File | null;
  removeThumbnail: boolean;
  setThumbnailError: (message: string | null) => void;
  onClose: () => void;
}

export const useVideoFormSubmit = ({
  video,
  isEditMode,
  fields,
  categories,
  selectedFile,
  removeThumbnail,
  setThumbnailError,
  onClose,
}: UseVideoFormSubmitArgs) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Referência do scroll interno do modal para garantir reset ao topo
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollBodyToTop = () => {
    if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = 0;
  };

  // Sempre que o modal abrir ou o vídeo mudar, resetar scroll no topo
  useEffect(() => {
    scrollBodyToTop();
    setError(null);
  }, [video]);

  const beginSubmit = () => {
    setError(null);
    setThumbnailError(null);
    setLoading(true);
  };

  const failSubmit = (message: string) => {
    setError(message);
    setLoading(false);
    scrollBodyToTop();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    beginSubmit();

    const instagramId = extractInstagramId(fields.url);
    if (!instagramId) {
      failSubmit('URL do Reel inválida.');
      return;
    }

    if (!isEditMode) {
      const existing = await getVideoByInstagramId(instagramId);
      if (existing) {
        failSubmit('Já existe um vídeo com este Instagram ID.');
        return;
      }
    }

    const payload = buildVideoPayload(fields, instagramId, categories);

    try {
      await persistVideo({ video, isEditMode, payload, selectedFile, removeThumbnail });
      onClose();
    } catch (err) {
      logger.error('[VideoFormModal] Erro ao salvar vídeo:', err);
      setError(err?.message ?? 'Falha ao salvar vídeo');
      scrollBodyToTop();
    } finally {
      setLoading(false);
    }
  };

  return { bodyScrollRef, error, loading, handleSubmit };
};
