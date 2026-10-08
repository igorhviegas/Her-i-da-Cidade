import React from 'react';
import { Image as ImageIcon, RefreshCw, Upload } from 'lucide-react';
import type { ServiceImageUpload } from '../services/useServiceImageUpload';

interface ServiceImageActionsProps {
  image: ServiceImageUpload;
  imageUrl: string;
  isSubmitting: boolean;
}

/** Escolher / enviar / cancelar a imagem do serviço. */
export const ServiceImageActions: React.FC<ServiceImageActionsProps> = ({ image, imageUrl, isSubmitting }) => {
  const {
    inputRef: serviceImageInputRef,
    selectedImage: selectedServiceImage,
    isUploading: isServiceImageUploading,
    clear: clearSelectedServiceImage,
    upload: handleUploadServiceImage,
  } = image;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => serviceImageInputRef.current?.click()}
        disabled={isSubmitting || isServiceImageUploading}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
      >
        <ImageIcon className="h-3.5 w-3.5" />
        {selectedServiceImage ? 'Escolher outra imagem' : imageUrl ? 'Substituir por upload' : 'Escolher imagem'}
      </button>
      {selectedServiceImage && (
        <>
          <button
            type="button"
            onClick={handleUploadServiceImage}
            disabled={isSubmitting || isServiceImageUploading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {isServiceImageUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {isServiceImageUploading ? 'Enviando imagem...' : 'Enviar imagem'}
          </button>
          <button
            type="button"
            onClick={clearSelectedServiceImage}
            disabled={isSubmitting || isServiceImageUploading}
            className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            Cancelar seleção
          </button>
        </>
      )}
    </div>
  );
};

/** Preview Container */
export const ServiceImagePreview: React.FC<{ previewUrl: string | null | undefined; imageUrl: string }> = ({ previewUrl, imageUrl }) => (
  <div className="w-16 h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
    {previewUrl || imageUrl ? (
      <img
        src={previewUrl || imageUrl}
        alt="Preview"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    ) : (
      <ImageIcon className="w-6 h-6 text-white/20" />
    )}
  </div>
);
