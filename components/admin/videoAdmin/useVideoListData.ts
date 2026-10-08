import { useEffect, useMemo, useState } from 'react';
import { Video } from '../../../types';
import { getVideos, deleteVideo, toggleVideoActive, updateVideoOrder, setFeaturedVideo, migrateLegacyVideoCategories } from '../../../services/videosService';
import { syncInstagramNow } from '../../../services/instagramService';
import { getCategories, syncCategoriesFromVideos } from '../../../services/categoriesService';

export const useVideoListData = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [centralCategories, setCentralCategories] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      await migrateLegacyVideoCategories();
      await syncCategoriesFromVideos();
      const data = await getVideos(false); // include inactive videos
      const categoryData = await getCategories();
      setVideos(data);
      setCentralCategories(categoryData.map((category) => category.name));
      setError(null);
    } catch (e) {
      setError(e.message ?? 'Erro ao carregar vídeos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Fonte central, com fallback temporário para vídeos legados enquanto a
  // sincronização inicial está em andamento.
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => {
      if (v.categories?.length) {
        v.categories.forEach((c) => c && set.add(c.trim()));
      } else if (v.category) {
        set.add(v.category.trim());
      }
    });
    return Array.from(new Set([...centralCategories, ...set])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [videos, centralCategories]);

  const handleInstagramSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncInstagramNow();
      setSyncMessage(
        result.status === 'completed' ? 'Sincronização concluída.'
          : result.status === 'running' ? 'Já há uma sincronização em andamento.'
          : 'Aguarde um instante antes de sincronizar de novo.',
      );
      await fetchVideos();
    } catch (e) {
      setSyncMessage(e.message ?? 'Não foi possível sincronizar agora.');
    } finally {
      setSyncing(false);
    }
  };

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
    } catch (e) {
      alert(e.message ?? 'Erro ao alterar destaque');
    }
  };

  const handleOrderChange = async (id: string, order: number) => {
    await updateVideoOrder(id, order);
    fetchVideos();
  };

  return {
    videos, loading, error, syncing, syncMessage, existingCategories,
    fetchVideos, handleInstagramSync, handleDelete, handleToggleActive, handleToggleFeatured, handleOrderChange,
  };
};
