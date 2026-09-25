import React, { useState, useEffect, useRef } from 'react';
import { Video } from '../../types';
import { createVideo, updateVideo, getVideoByInstagramId } from '../../services/videosService';
import { Image, Upload, Trash2, RefreshCw, Undo2 } from 'lucide-react';

interface Props {
  video?: Video | null;
  onClose: () => void;
  categoryOptions: string[];
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

const getVideoCategories = (video?: Video | null): string[] => {
  if (!video) return [];
  if (video.categories?.length) return video.categories.filter(Boolean).map((cat) => cat.trim()).filter(Boolean);
  const legacy = video.category?.trim();
  return legacy ? [legacy] : [];
};

const VideoFormModal: React.FC<Props> = ({ video, onClose, categoryOptions }) => {
  const isEditMode = Boolean(video);
  const [title, setTitle] = useState(video?.title ?? '');
  const [url, setUrl] = useState(video?.instagramUrl ?? '');
  const [categories, setCategories] = useState<string[]>(getVideoCategories(video));
  const [keywords, setKeywords] = useState(video?.keywords?.join(', ') ?? '');
  const [order, setOrder] = useState(video?.order?.toString() ?? '1');
  const [badgeText, setBadgeText] = useState(video?.badgeText ?? '');
  const [active, setActive] = useState(video?.active ?? true);
  const [featured, setFeatured] = useState(video?.featured === true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Thumbnail state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const existingThumbnail = video?.thumbnailUrl || (video?.thumbnail && video.thumbnail.startsWith('http') ? video.thumbnail : null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const availableCategories = React.useMemo(() => {
    const merged = new Set<string>([
      ...categoryOptions.map((cat) => cat.trim()).filter(Boolean),
      ...categories.map((cat) => cat.trim()).filter(Boolean),
    ]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [categoryOptions, categories]);

  useEffect(() => {
    if (!isEditMode && url) {
      const id = extractInstagramId(url);
      if (id && !title) setTitle(id);
    }
  }, [url, isEditMode, title]);

  // Limpeza de URL de blob em caso de desmontagem
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Formatos permitidos: JPG, JPEG, PNG, WEBP
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedMime.includes(file.type) && !allowedExts.includes(extension)) {
      setThumbnailError('Formato não permitido. Utilize arquivos JPG, JPEG, PNG ou WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Limite máximo de tamanho: 4 MB (compatível com limites serverless da Vercel)
    const MAX_SIZE = 4 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setThumbnailError('O arquivo selecionado excede o limite máximo permitido de 4 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Sucesso na seleção
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveThumbnail(false);
  };

  const handleClearSelectedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setThumbnailError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setThumbnailError(null);
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

    const normalizedCategories = Array.from(new Set(categories.map((cat) => cat.trim()).filter(Boolean)));

    const payload: Partial<Video> = {
      title,
      instagramUrl: url,
      instagramId,
      category: normalizedCategories[0] || '',
      categories: normalizedCategories,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      order: Number(order) || 1,
      badgeText: badgeText.trim(),
      active,
      featured: active ? featured : false,
    };

    const toggleCategory = (categoryName: string) => {
      setCategories((previous) => (
        previous.includes(categoryName)
          ? previous.filter((cat) => cat !== categoryName)
          : [...previous, categoryName]
      ));
    };

    try {
      if (isEditMode && video?.id) {
        await updateVideo(video.id, payload, {
          thumbnailFile: selectedFile,
          removeThumbnail: removeThumbnail && !selectedFile,
        });
      } else {
        await createVideo(payload, selectedFile);
      }
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Falha ao salvar vídeo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 overflow-y-auto">
      <div className="bg-[#0D1527] rounded-xl p-6 w-full max-w-lg border border-white/10 shadow-2xl my-8">
        <h2 className="text-xl font-bold text-white mb-4">
          {isEditMode ? 'Editar Vídeo' : 'Novo Vídeo'}
        </h2>
        {error && (
          <div className="p-3 mb-4 bg-red-500/15 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">URL do Reel (Instagram) *</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              placeholder="https://www.instagram.com/reel/..."
              className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">Categoria *</label>
            <div className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white">
              {availableCategories.length === 0 ? (
                <p className="text-xs text-white/50">Nenhuma categoria disponível para seleção.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {availableCategories.map((cat) => {
                    const isSelected = categories.includes(cat);
                    return (
                      <label key={cat} className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCategory(cat)}
                          className="rounded accent-emerald-500 cursor-pointer"
                        />
                        <span className={isSelected ? 'text-emerald-300 font-semibold' : ''}>{cat}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <span key={cat} className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[11px]">
                      {cat}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-white/45">Nenhuma categoria selecionada.</span>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* ÁREA DE THUMBNAIL (Upload Manual + Storage + Preview)    */}
          {/* ========================================================= */}
          <div className="border border-white/10 bg-[#090E1B] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                <Image className="w-4 h-4 text-emerald-400" />
                Thumbnail
              </label>
              <span className="text-[11px] text-white/40">Opcional — JPG, PNG ou WEBP (máx. 4 MB)</span>
            </div>

            {thumbnailError && (
              <p className="text-xs text-red-400 mb-2">{thumbnailError}</p>
            )}

            {/* Input de arquivo oculto */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Caso 1: Nova imagem selecionada (Preview local) */}
            {previewUrl ? (
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden border border-emerald-500/40 bg-black/50 flex-shrink-0">
                  <img src={previewUrl} alt="Prévia da thumbnail" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-xs text-emerald-300 font-medium truncate">
                    {selectedFile?.name}
                  </p>
                  <p className="text-[11px] text-white/50">
                    {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : ''} — Prévia antes de salvar
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Alterar imagem
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelectedFile}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/25 text-red-400 rounded transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : isEditMode && existingThumbnail && !removeThumbnail ? (
              /* Caso 2: Em edição e já possui thumbnail existente */
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden border border-white/20 bg-black/50 flex-shrink-0">
                  <img src={existingThumbnail} alt="Thumbnail atual" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-300 rounded">
                    Thumbnail atual
                  </span>
                  <p className="text-[11px] text-white/50">Você pode manter, substituir ou remover esta imagem.</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Substituir imagem
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveThumbnail(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/25 text-red-400 rounded transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remover thumbnail
                    </button>
                  </div>
                </div>
              </div>
            ) : isEditMode && existingThumbnail && removeThumbnail ? (
              /* Caso 3: Thumbnail existente marcado para remoção */
              <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="text-xs text-red-300">
                  Thumbnail será removido ao salvar este vídeo.
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveThumbnail(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition"
                >
                  <Undo2 className="w-3 h-3" />
                  Desfazer
                </button>
              </div>
            ) : (
              /* Caso 4: Nenhum thumbnail selecionado */
              <div className="flex items-center justify-between py-2">
                <p className="text-xs text-white/50">
                  Opcional — nenhum thumbnail selecionado
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Escolher imagem
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm text-white/70">Selo</label>
              <span className="text-[11px] text-white/40">{badgeText.length}/20</span>
            </div>
            <input
              type="text"
              maxLength={20}
              value={badgeText}
              onChange={e => setBadgeText(e.target.value)}
              placeholder="Ex: TOP 1, NOVO, ESPECIAL, MAIS VISTO"
              className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 uppercase font-bold text-xs tracking-wider"
            />
            <p className="text-[11px] text-white/45 mt-1">
              Opcional — aparece sobre a thumbnail
            </p>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">Palavras‑chave (separadas por vírgula)</label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="ex: amizade, escola, respeito"
              className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <label className="text-sm text-white/70">Ordem de exibição</label>
              <input
                type="number"
                min={1}
                value={order}
                onChange={e => setOrder(e.target.value)}
                className="w-20 bg-[#090E1B] border border-white/10 rounded-lg px-2 py-1 text-white text-center"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={e => {
                  const newActive = e.target.checked;
                  setActive(newActive);
                  if (!newActive) setFeatured(false);
                }}
                className="rounded accent-emerald-500 cursor-pointer"
              />
              Ativo no catálogo
            </label>
          </div>

          <div className="pt-2 pb-1 border-t border-white/5">
            <label className={`flex items-start gap-2.5 text-sm cursor-pointer ${!active ? 'opacity-40 pointer-events-none' : 'text-white'}`}>
              <input
                type="checkbox"
                checked={active && featured}
                onChange={e => setFeatured(e.target.checked)}
                disabled={!active}
                className="mt-1 rounded accent-amber-500 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  ★ Vídeo em destaque
                </span>
                <p className="text-xs text-white/50 mt-0.5">
                  Apenas 1 vídeo pode ser o destaque principal do catálogo. Marcar esta opção desmarcará automaticamente qualquer destaque anterior.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-500 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{selectedFile ? 'Enviando imagem…' : 'Salvando…'}</span>
                </>
              ) : (
                'Salvar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VideoFormModal;
