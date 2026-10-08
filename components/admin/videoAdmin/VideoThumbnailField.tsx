import React from 'react';
import { Image, Upload, Trash2, RefreshCw, Undo2 } from 'lucide-react';

interface ThumbnailPreviewCaseProps {
  previewUrl: string;
  selectedFile: File | null;
  onPickFile: () => void;
  onClearSelectedFile: () => void;
}

// Caso 1: Nova imagem selecionada (Preview local)
const ThumbnailPreviewCase: React.FC<ThumbnailPreviewCaseProps> = ({ previewUrl, selectedFile, onPickFile, onClearSelectedFile }) => (
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
          onClick={onPickFile}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition"
        >
          <RefreshCw className="w-3 h-3" />
          Alterar imagem
        </button>
        <button
          type="button"
          onClick={onClearSelectedFile}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/25 text-red-400 rounded transition"
        >
          <Trash2 className="w-3 h-3" />
          Cancelar
        </button>
      </div>
    </div>
  </div>
);

interface ThumbnailExistingCaseProps {
  existingThumbnail: string;
  onPickFile: () => void;
  onRemove: () => void;
}

// Caso 2: Em edição e já possui thumbnail existente
const ThumbnailExistingCase: React.FC<ThumbnailExistingCaseProps> = ({ existingThumbnail, onPickFile, onRemove }) => (
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
          onClick={onPickFile}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition"
        >
          <RefreshCw className="w-3 h-3" />
          Substituir imagem
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/25 text-red-400 rounded transition"
        >
          <Trash2 className="w-3 h-3" />
          Remover thumbnail
        </button>
      </div>
    </div>
  </div>
);

interface ThumbnailRemovedCaseProps {
  onUndo: () => void;
}

// Caso 3: Thumbnail existente marcado para remoção
const ThumbnailRemovedCase: React.FC<ThumbnailRemovedCaseProps> = ({ onUndo }) => (
  <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
    <div className="text-xs text-red-300">
      Thumbnail será removido ao salvar este vídeo.
    </div>
    <button
      type="button"
      onClick={onUndo}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded transition"
    >
      <Undo2 className="w-3 h-3" />
      Desfazer
    </button>
  </div>
);

interface ThumbnailEmptyCaseProps {
  onPickFile: () => void;
}

// Caso 4: Nenhum thumbnail selecionado
const ThumbnailEmptyCase: React.FC<ThumbnailEmptyCaseProps> = ({ onPickFile }) => (
  <div className="flex items-center justify-between py-2">
    <p className="text-xs text-white/50">
      Opcional — nenhum thumbnail selecionado
    </p>
    <button
      type="button"
      onClick={onPickFile}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
    >
      <Upload className="w-3.5 h-3.5" />
      Escolher imagem
    </button>
  </div>
);

interface VideoThumbnailFieldProps {
  isEditMode: boolean;
  thumbnailError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  previewUrl: string | null;
  selectedFile: File | null;
  existingThumbnail: string | null;
  removeThumbnail: boolean;
  setRemoveThumbnail: (value: boolean) => void;
  onClearSelectedFile: () => void;
}

// ÁREA DE THUMBNAIL (Upload Manual + Storage + Preview)
export const VideoThumbnailField: React.FC<VideoThumbnailFieldProps> = ({
  isEditMode,
  thumbnailError,
  fileInputRef,
  onFileChange,
  previewUrl,
  selectedFile,
  existingThumbnail,
  removeThumbnail,
  setRemoveThumbnail,
  onClearSelectedFile,
}) => {
  const onPickFile = () => fileInputRef.current?.click();

  return (
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
        onChange={onFileChange}
        className="hidden"
      />

      {previewUrl ? (
        <ThumbnailPreviewCase
          previewUrl={previewUrl}
          selectedFile={selectedFile}
          onPickFile={onPickFile}
          onClearSelectedFile={onClearSelectedFile}
        />
      ) : isEditMode && existingThumbnail && !removeThumbnail ? (
        <ThumbnailExistingCase
          existingThumbnail={existingThumbnail}
          onPickFile={onPickFile}
          onRemove={() => setRemoveThumbnail(true)}
        />
      ) : isEditMode && existingThumbnail && removeThumbnail ? (
        <ThumbnailRemovedCase onUndo={() => setRemoveThumbnail(false)} />
      ) : (
        <ThumbnailEmptyCase onPickFile={onPickFile} />
      )}
    </div>
  );
};
