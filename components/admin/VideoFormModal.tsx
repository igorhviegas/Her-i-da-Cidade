import React, { useState, useEffect } from 'react';
import { Video } from '../../types';
import { createVideo, updateVideo, getVideoByInstagramId } from '../../services/videosService';

interface Props {
  video?: Video | null;
  onClose: () => void;
}

const extractInstagramId = (url: string): string => {
  try {
    const normalized = url.replace(/\\?\\?/, '/');
    const parts = normalized.split('/');
    const id = parts.filter(Boolean).pop();
    return id || '';
  } catch {
    return '';
  }
};

const VideoFormModal: React.FC<Props> = ({ video, onClose }) => {
  const isEditMode = Boolean(video);
  const [title, setTitle] = useState(video?.title ?? '');
  const [url, setUrl] = useState(video?.instagramUrl ?? '');
  const [category, setCategory] = useState(video?.category ?? '');
  const [keywords, setKeywords] = useState(video?.keywords?.join(', ') ?? '');
  const [order, setOrder] = useState(video?.order?.toString() ?? '1');
  const [active, setActive] = useState(video?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEditMode && url) {
      const id = extractInstagramId(url);
      if (id && !title) setTitle(id);
    }
  }, [url, isEditMode, title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const instagramId = extractInstagramId(url);
    if (!instagramId) {
      setError('URL do Reel inválida.');
      setLoading(false);
      return;
    }
    if (!isEditMode) {
      const existing = await getVideoByInstagramId(instagramId);
      if (existing) {
        setError('Já existe um vídeo com este Instagram ID.');
        setLoading(false);
        return;
      }
    }
    const payload: Partial<Video> = {
      title,
      instagramUrl: url,
      instagramId,
      category,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      order: Number(order) || 1,
      active,
    };
    try {
      if (isEditMode && video?.id) {
        await updateVideo(video.id, payload);
      } else {
        await createVideo(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Falha ao salvar vídeo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-[#0D1527] rounded-lg p-6 w-full max-w-md border border-white/10 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4">
          {isEditMode ? 'Editar Vídeo' : 'Novo Vídeo'}
        </h2>
        {error && <p className="text-red-400 mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-white/70">Título</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full bg-[#090E1B] border border-white/10 rounded px-2 py-1 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70">URL do Reel (Instagram)</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              className="w-full bg-[#090E1B] border border-white/10 rounded px-2 py-1 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70">Categoria</label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              required
              className="w-full bg-[#090E1B] border border-white/10 rounded px-2 py-1 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/70">Palavras‑chave (separadas por vírgula)</label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              className="w-full bg-[#090E1B] border border-white/10 rounded px-2 py-1 text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/70">Ordem</label>
            <input
              type="number"
              min={1}
              value={order}
              onChange={e => setOrder(e.target.value)}
              className="w-16 bg-[#090E1B] border border-white/10 rounded px-1 py-1 text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-white/70">Ativo</label>
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
            />
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition"
            >
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VideoFormModal;
