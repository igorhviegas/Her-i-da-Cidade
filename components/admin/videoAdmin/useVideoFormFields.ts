import { useState, useEffect } from 'react';
import { Video } from '../../../types';
import { extractInstagramId } from '../../../utils/videoHelpers';

const useVideoTextFields = (video: Video | null | undefined, isEditMode: boolean) => {
  const [title, setTitle] = useState(video?.title ?? '');
  const [url, setUrl] = useState(video?.instagramUrl ?? '');
  const [keywords, setKeywords] = useState(video?.keywords?.join(', ') ?? '');

  // Sempre que o modal abrir ou o vídeo mudar, atualizar estados
  useEffect(() => {
    if (video) {
      setTitle(video.title ?? '');
      setUrl(video.instagramUrl ?? '');
      setKeywords(video.keywords?.join(', ') ?? '');
    } else {
      setTitle('');
      setUrl('');
      setKeywords('');
    }
  }, [video]);

  useEffect(() => {
    if (!isEditMode && url) {
      const id = extractInstagramId(url);
      if (id && !title) setTitle(id);
    }
  }, [url, isEditMode, title]);

  return { title, setTitle, url, setUrl, keywords, setKeywords };
};

const useVideoFlagFields = (video: Video | null | undefined) => {
  const [order, setOrder] = useState(video?.order?.toString() ?? '1');
  const [badgeText, setBadgeText] = useState(video?.badgeText ?? '');
  const [active, setActive] = useState(video?.active ?? true);
  const [featured, setFeatured] = useState(video?.featured === true);

  // Sempre que o modal abrir ou o vídeo mudar, atualizar estados
  useEffect(() => {
    if (video) {
      setOrder(video.order?.toString() ?? '1');
      setBadgeText(video.badgeText ?? '');
      setActive(video.active ?? true);
      setFeatured(video.featured === true);
    } else {
      setOrder('1');
      setBadgeText('');
      setActive(true);
      setFeatured(false);
    }
  }, [video]);

  const handleActiveChange = (newActive: boolean) => {
    setActive(newActive);
    if (!newActive) setFeatured(false);
  };

  return { order, setOrder, badgeText, setBadgeText, active, handleActiveChange, featured, setFeatured };
};

export const useVideoFormFields = (video?: Video | null) => {
  const isEditMode = Boolean(video);
  const text = useVideoTextFields(video, isEditMode);
  const flags = useVideoFlagFields(video);

  return { isEditMode, ...text, ...flags };
};
