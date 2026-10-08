import React from 'react';
import type { ServiceFormData } from './serviceForm';
import type { ServiceImageUpload } from './useServiceImageUpload';
import { ServiceImageActions, ServiceImagePreview } from '../adminPages/ServiceImageParts';

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
          <ServiceImageActions image={image} imageUrl={formData.imageUrl} isSubmitting={isSubmitting} />
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
        <ServiceImagePreview previewUrl={serviceImagePreviewUrl} imageUrl={formData.imageUrl} />
      </div>
      {formErrors.imageUrl && (
        <p className="text-xs text-red-400 mt-1">{formErrors.imageUrl}</p>
      )}
    </div>
  );
};
