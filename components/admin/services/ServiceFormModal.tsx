import React from 'react';
import { Sparkles, X, RefreshCw } from 'lucide-react';
import type { ServiceFormData } from './serviceForm';
import { ServicePriceCategoryFields } from './ServicePriceCategoryFields';
import { ServicePublishFields } from './ServicePublishFields';
import type { ServiceImageUpload } from './useServiceImageUpload';
import { ServiceImageField } from './ServiceImageField';
import { ServiceOrderConfigSection } from './ServiceOrderConfigSection';
import { ServiceDeliveryMessageSection } from './ServiceDeliveryMessageSection';
import { ServiceFaqSection } from './ServiceFaqSection';
import { ServiceDescriptionField, ServiceTitleField } from '../adminPages/ServiceTextFields';

interface ServiceFormModalProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  formErrors: Partial<Record<keyof ServiceFormData, string>>;
  editingServiceId: string | null;
  isCustomCategory: boolean;
  setIsCustomCategory: (value: boolean) => void;
  isSubmitting: boolean;
  image: ServiceImageUpload;
  orderConfigError: string;
  handleOrderConfigChange: (patch: Partial<ServiceFormData>) => void;
  setIsFormModalOpen: (open: boolean) => void;
  handleSubmitService: (e: React.FormEvent) => void;
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  formData,
  setFormData,
  formErrors,
  editingServiceId,
  isCustomCategory,
  setIsCustomCategory,
  isSubmitting,
  image,
  orderConfigError,
  handleOrderConfigChange,
  setIsFormModalOpen,
  handleSubmitService,
}) => {
  const { isUploading: isServiceImageUploading, selectedImage: selectedServiceImage } = image;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => !isSubmitting && !isServiceImageUploading && setIsFormModalOpen(false)}
      />

      {/* Dialog Container */}
      <div className="relative w-full max-w-2xl bg-[#0D1527] border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-10 my-8 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>
              <p className="text-xs text-white/50 font-light">
                {editingServiceId ? 'Atualize as informações do serviço existente' : 'Preencha os dados para adicionar ao Firestore'}
              </p>
            </div>
          </div>

          <button
            onClick={() => !isSubmitting && !isServiceImageUploading && setIsFormModalOpen(false)}
            disabled={isSubmitting || isServiceImageUploading}
            className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmitService} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Nome / Título */}
          <ServiceTitleField formData={formData} setFormData={setFormData} formErrors={formErrors} />

          <ServicePriceCategoryFields formData={formData} setFormData={setFormData} formErrors={formErrors} isCustomCategory={isCustomCategory} setIsCustomCategory={setIsCustomCategory} />

          {/* Selo opcional */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
              Selo
            </label>
            <input
              type="text"
              value={formData.badgeText}
              onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
              placeholder="Ex: Mais pedido, Novidade, Exclusivo"
              className="w-full px-3.5 py-2.5 bg-[#070B14] border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Descrição */}
          <ServiceDescriptionField formData={formData} setFormData={setFormData} formErrors={formErrors} />

          <ServiceImageField
            formData={formData}
            setFormData={setFormData}
            formErrors={formErrors}
            isSubmitting={isSubmitting}
            image={image}
          />

          <ServicePublishFields formData={formData} setFormData={setFormData} formErrors={formErrors} />

          <ServiceOrderConfigSection formData={formData} orderConfigError={orderConfigError} onChange={handleOrderConfigChange} />

          <ServiceDeliveryMessageSection formData={formData} setFormData={setFormData} editingServiceId={editingServiceId} />

          <ServiceFaqSection formData={formData} setFormData={setFormData} formErrors={formErrors} />

          {/* Botões do Modal */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting || isServiceImageUploading}
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isServiceImageUploading || Boolean(selectedServiceImage)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingServiceId ? 'Salvar Alterações' : 'Criar Serviço'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
