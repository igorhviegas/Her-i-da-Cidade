import React, { useEffect, useState } from 'react';
import { Video } from '../../types';
import { getVideos, deleteVideo, toggleVideoActive, updateVideoOrder } from '../../services/videosService';
import VideoCardAdmin from './VideoCardAdmin';
import VideoFormModal from './VideoFormModal';
import CsvImportModal from './CsvImportModal';

export const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editVideo, setEditVideo] = useState<Video | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);

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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este vídeo?')) return;
    await deleteVideo(id);
    fetchVideos();
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await toggleVideoActive(id, !active);
    fetchVideos();
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
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">Lista de Vídeos</h2>
        <div className="space-x-2">
          <button
            onClick={() => setShowCsvImport(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition"
          >
            Importar CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition"
          >
            Novo Vídeo
          </button>
        </div>
      </div>

      {loading && <p className="text-white">Carregando...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <VideoCardAdmin
              key={video.id}
              video={video}
              onEdit={() => handleEdit(video)}
              onDelete={() => handleDelete(video.id)}
              onToggleActive={() => handleToggleActive(video.id, video.active)}
              onOrderChange={(order) => handleOrderChange(video.id, order)}
            />
          ))}
        </div>
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
