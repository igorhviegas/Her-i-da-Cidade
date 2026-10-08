import React from 'react';
import { Image as ImageIcon, RefreshCw, Upload } from 'lucide-react';
import type { ServiceFormData } from './serviceForm';
import type { ServiceImageUpload } from './useServiceImageUpload';

interface ServiceImageFieldProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  formErrors: Partial<Record<keyof ServiceFormData, string>>;
  isSubmitting: boolean;
  image: ServiceImageUpload;
}

export const ServiceImageField: React.FC<ServiceImageFieldProps> = ({
  formData,
  setFormData,
  formErrors,
  isSubmitting,
  image,
}) => {
  const {
    inputRef: serviceImageInputRef,
    selectedImage: selectedServiceImage,
    previewUrl: serviceImagePreviewUrl,
    isUploading: isServiceImageUploading,
    error: serviceImageUploadError,
    complete: serviceImageUploadComplete,
    setComplete: setServiceImageUploadComplete,
    clear: clearSelectedServiceImage,
    onFileChange: handleServiceImageFileChange,
    upload: handleUploadServiceImage,
  } = image;

  return (
    <div>
      <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
        Imagem do Serviço <span className="text-red-400">*</span>
      </label>
      <div className="flex gap-3 items-start">
        <div className="flex-1">
          <input
            type="url"
            value={formData.imageUrl}
            onChange={(e) => {
              if (selectedServiceImage) clearSelectedServiceImage();
              setServiceImageUploadComplete(false);
              setFormData({ ...formData, imageUrl: e.target.value });
            }}
            disabled={isServiceImageUploading}
            placeholder="https://exemplo.com/imagem.jpeg"
            className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
              formErrors.imageUrl ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'
            }`}
          />
          <p className="text-[11px] text-white/40 mt-1">
            URL externa existente ou imagem enviada ao Vercel Blob. JPG, PNG ou WEBP (máx. 4 MB).
          </p>
          <input
            ref={serviceImageInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleServiceImageFileChange}
            className="hidden"
            disabled={isSubmitting || isServiceImageUploading}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => serviceImageInputRef.current?.click()}
              disabled={isSubmitting || isServiceImageUploading}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {selectedServiceImage ? 'Escolher outra imagem' : formData.imageUrl ? 'Substituir por upload' : 'Escolher imagem'}
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
          {selectedServiceImage && (
            <p className="mt-2 truncate text-[11px] text-amber-300">
              {selectedServiceImage.name} · {(selectedServiceImage.size / (1024 * 1024)).toFixed(2)} MB — envie antes de salvar.
            </p>
          )}
          {isServiceImageUploading && <p className="mt-2 text-[11px] text-blue-300">Enviando a imagem com segurança para o Vercel Blob…</p>}
          {serviceImageUploadComplete && <p className="mt-2 text-[11px] text-emerald-300">Imagem carregada no Vercel Blob e pronta para salvar o serviço.</p>}
          {serviceImageUploadError && <p className="mt-2 text-xs text-red-400">{serviceImageUploadError}</p>}
        </div>

        {/* Preview Container */}
        <div className="w-16 h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
          {serviceImagePreviewUrl || formData.imageUrl ? (
            <img
              src={serviceImagePreviewUrl || formData.imageUrl}
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
      </div>
      {formErrors.imageUrl && (
        <p className="text-xs text-red-400 mt-1">{formErrors.imageUrl}</p>
      )}
    </div>
  );
};
