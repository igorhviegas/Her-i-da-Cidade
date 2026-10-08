import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ServiceFormData } from './serviceForm';

interface ServicePublishFieldsProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  formErrors: Partial<Record<keyof ServiceFormData, string>>;
}

export const ServicePublishFields: React.FC<ServicePublishFieldsProps> = ({ formData, setFormData, formErrors }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
      
      {/* Ordem */}
      <div>
        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
          Ordem de Exibição <span className="text-red-400">*</span>
        </label>
        <input
          type="number"
          min={1}
          value={formData.order}
          onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value, 10) || 1 })}
          className="w-full px-3.5 py-2.5 bg-[#070B14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
        />
        <p className="text-[11px] text-white/40 mt-1">
          1 = primeiro card do carrossel no site.
        </p>
        {formErrors.order && (
          <p className="text-xs text-red-400 mt-1">{formErrors.order}</p>
        )}
      </div>

      {/* Status Ativo/Inativo */}
      <div>
        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
          Status de Publicação
        </label>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, active: !formData.active })}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            formData.active
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-white/5 border-white/15 text-white/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${formData.active ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
            <span>{formData.active ? 'Ativo (Publicado no site)' : 'Inativo (Oculto do site)'}</span>
          </div>
          {formData.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <p className="text-[11px] text-white/40 mt-1">
          Serviços inativos não são mostrados ao público.
        </p>
      </div>

    </div>
  );
};
