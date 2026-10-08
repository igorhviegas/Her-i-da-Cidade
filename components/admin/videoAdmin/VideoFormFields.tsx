import React from 'react';
import { RefreshCw } from 'lucide-react';

interface VideoBasicFieldsProps {
  title: string;
  onTitleChange: (value: string) => void;
  url: string;
  onUrlChange: (value: string) => void;
}

// Campos Título e URL do Reel
export const VideoBasicFields: React.FC<VideoBasicFieldsProps> = ({ title, onTitleChange, url, onUrlChange }) => (
  <>
    {/* Campo Título */}
    <div>
      <label className="block text-sm font-medium text-white/80 mb-1">Título *</label>
      <input
        type="text"
        value={title}
        onChange={e => onTitleChange(e.target.value)}
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
        onChange={e => onUrlChange(e.target.value)}
        required
        placeholder="https://www.instagram.com/reel/..."
        className="w-full bg-[#090E1B] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
      />
    </div>
  </>
);

interface VideoExtraFieldsProps {
  badgeText: string;
  onBadgeTextChange: (value: string) => void;
  keywords: string;
  onKeywordsChange: (value: string) => void;
  order: string;
  onOrderChange: (value: string) => void;
  active: boolean;
  onActiveChange: (checked: boolean) => void;
  featured: boolean;
  onFeaturedChange: (checked: boolean) => void;
}

// Campos Selo, Palavras-chave, Ordem, Ativo e Destaque
export const VideoExtraFields: React.FC<VideoExtraFieldsProps> = ({
  badgeText,
  onBadgeTextChange,
  keywords,
  onKeywordsChange,
  order,
  onOrderChange,
  active,
  onActiveChange,
  featured,
  onFeaturedChange,
}) => (
  <>
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
        onChange={e => onBadgeTextChange(e.target.value)}
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
        onChange={e => onKeywordsChange(e.target.value)}
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
          onChange={e => onOrderChange(e.target.value)}
          className="w-20 bg-[#090E1B] border border-white/10 rounded-lg px-2 py-1 text-white text-center transition"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
        <input
          type="checkbox"
          checked={active}
          onChange={e => onActiveChange(e.target.checked)}
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
          onChange={e => onFeaturedChange(e.target.checked)}
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
  </>
);

interface VideoFormFooterProps {
  loading: boolean;
  hasSelectedFile: boolean;
  onClose: () => void;
}

// FOOTER FIXO DO MODAL (Sempre acessível no rodapé)
export const VideoFormFooter: React.FC<VideoFormFooterProps> = ({ loading, hasSelectedFile, onClose }) => (
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
          <span>{hasSelectedFile ? 'Enviando imagem…' : 'Salvando…'}</span>
        </>
      ) : (
        'Salvar'
      )}
    </button>
  </div>
);
