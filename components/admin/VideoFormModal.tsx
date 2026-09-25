import React, { useState, useEffect, useRef } from 'react';
import { Video } from '../../types';
import { createVideo, updateVideo, getVideoByInstagramId } from '../../services/videosService';
import { Image, Upload, Trash2, RefreshCw, Undo2, X } from 'lucide-react';
import { createCategory } from '../../services/categoriesService';

interface Props {
  video?: Video | null;
  existingCategories?: string[];
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

const VideoFormModal: React.FC<Props> = ({ video, existingCategories = [], onClose }) => {
  const isEditMode = Boolean(video);
  const [title, setTitle] = useState(video?.title ?? '');
  const [url, setUrl] = useState(video?.instagramUrl ?? '');

  const initialCategories = Array.isArray(video?.categories)
    ? video.categories
    : (video?.category ? [video.category] : []);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [newCategory, setNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState(video?.keywords?.join(', ') ?? '');
  const [order, setOrder] = useState(video?.order?.toString() ?? '1');
  const [badgeText, setBadgeText] = useState(video?.badgeText ?? '');
  const [active, setActive] = useState(video?.active ?? true);
  const [featured, setFeatured] = useState(video?.featured === true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Referência do scroll interno do modal para garantir reset ao topo
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  // Thumbnail state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const existingThumbnail = video?.thumbnailUrl || (video?.thumbnail && video.thumbnail.startsWith('http') ? video.thumbnail : null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  // Sempre que o modal abrir ou o vídeo mudar, atualizar estados e resetar scroll no topo
  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0;
    }
    if (video) {
      setTitle(video.title ?? '');
      setUrl(video.instagramUrl ?? '');
      const cats = Array.isArray(video.categories)
        ? video.categories
        : (video.category ? [video.category] : []);
      setCategories(cats);
      setKeywords(video.keywords?.join(', ') ?? '');
      setOrder(video.order?.toString() ?? '1');
      setBadgeText(video.badgeText ?? '');
      setActive(video.active ?? true);
      setFeatured(video.featured === true);
    } else {
      setTitle('');
      setUrl('');
      setCategories([]);
      setKeywords('');
      setOrder('1');
      setBadgeText('');
      setActive(true);
      setFeatured(false);
    }
    setError(null);
    setCategoryError(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemoveThumbnail(false);
  }, [video]);

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

  const allCategories = Array.from(
    new Set([...existingCategories, ...categories].map(c => c.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Alterna uma categoria (marca/desmarca) sem duplicar
  const toggleCategory = (cat: string) => {
    setCategoryError(null);
    const target = cat.trim();
    setCategories(prev =>
      prev.some(c => c.trim().toLowerCase() === target.toLowerCase())
        ? prev.filter(c => c.trim().toLowerCase() !== target.toLowerCase())
        : [...prev, target]
    );
  };

  // Remove explicitamente uma categoria selecionada
  const removeCategory = (catToRemove: string) => {
    setCategoryError(null);
    const target = catToRemove.trim().toLowerCase();
    setCategories(prev => prev.filter(c => c.trim().toLowerCase() !== target));
  };

  // Adiciona nova categoria sem duplicar
  const handleAddNewCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.some(c => c.trim().toLowerCase() === trimmed.toLowerCase())) {
      setNewCategory('');
      return;
    }
    try {
      const category = await createCategory(trimmed);
      setCategories(prev => [...prev, category.name]);
      setNewCategory('');
      setCategoryError(null);
    } catch (err: any) {
      setCategoryError(err?.message || 'Não foi possível criar a categoria.');
    }
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
      if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = 0;
      return;
    }

    if (!isEditMode) {
      const existing = await getVideoByInstagramId(instagramId);
      if (existing) {
        setError('Já existe um vídeo com este Instagram ID.');
        setLoading(false);
        if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = 0;
        return;
      }
    }

    const cleanedCategories = categories.map(c => c.trim()).filter(Boolean);

    const payload: Partial<Video> = {
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
      console.error('[VideoFormModal] Erro ao salvar vídeo:', err);
      setError(err?.message ?? 'Falha ao salvar vídeo');
      if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = 0;
    } finally {
      setLoading(false);
    }
  };

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

            {/* Campo Título */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Título *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="Ex: Escovar os dentes"
                className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Campo URL do Reel */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">URL do Reel (Instagram) *</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
                placeholder="https://www.instagram.com/reel/..."
                className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Campo Múltiplas Categorias */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-white/80">Categorias</label>
                {categories.length > 0 && (
                  <span className="text-[11px] text-white/40">{categories.length} selecionada(s)</span>
                )}
              </div>

              {/* Badges de Categorias Selecionadas com remoção instantânea */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {categories.map(cat => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-medium"
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeCategory(cat);
                        }}
                        className="text-emerald-300/70 hover:text-white transition flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-emerald-500/30"
                        aria-label={`Remover categoria ${cat}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Lista de Checkboxes de Categorias Existentes */}
              <div className="max-h-36 overflow-y-auto border border-white/10 bg-[#090E1B] rounded-lg p-2 space-y-1">
                {allCategories.length === 0 ? (
                  <p className="text-xs text-white/40 px-1 py-1">Nenhuma categoria cadastrada ainda.</p>
                ) : (
                  allCategories.map(cat => {
                    const isChecked = categories.some(c => c.trim().toLowerCase() === cat.trim().toLowerCase());
                    return (
                      <label
                        key={cat}
                        className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer transition ${
                          isChecked ? 'bg-emerald-500/10 text-emerald-300 font-medium' : 'text-white/80 hover:bg-white/5'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategory(cat)}
                          className="rounded accent-emerald-500 cursor-pointer"
                        />
                        <span>{cat}</span>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Adicionar nova categoria */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewCategory();
                    }
                  }}
                  placeholder="Nova categoria (ex: Hábitos)"
                  className="flex-1 bg-[#090E1B] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition"
                >
                  Adicionar
                </button>
              </div>

              {categoryError && <p className="text-xs text-red-400 mt-1">{categoryError}</p>}
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

            {/* Campo Selo */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-white/80">Selo</label>
                <span className="text-[11px] text-white/40">{badgeText.length}/20</span>
              </div>
              <input
                type="text"
                maxLength={20}
                value={badgeText}
                onChange={e => setBadgeText(e.target.value)}
                placeholder="Ex: TOP 1, NOVO, ESPECIAL, MAIS VISTO"
                className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 uppercase font-bold text-xs tracking-wider transition"
              />
              <p className="text-[11px] text-white/45 mt-1">
                Opcional — aparece sobre a thumbnail
              </p>
            </div>

            {/* Campo Palavras-chave */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Palavras‑chave (separadas por vírgula)</label>
              <input
                type="text"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="ex: amizade, escola, respeito"
                className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Ordem de Exibição e Ativo */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-white/80">Ordem de exibição</label>
                <input
                  type="number"
                  min={1}
                  value={order}
                  onChange={e => setOrder(e.target.value)}
                  className="w-20 bg-[#090E1B] border border-white/10 rounded-lg px-2 py-1 text-white text-center transition"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
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

            {/* Destaque */}
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
          </div>

          {/* ========================================================= */}
          {/* FOOTER FIXO DO MODAL (Sempre acessível no rodapé)         */}
          {/* ========================================================= */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0 bg-[#0D1527]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition disabled:opacity-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition disabled:opacity-50 flex items-center gap-2 text-sm shadow-lg shadow-emerald-950/40"
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
