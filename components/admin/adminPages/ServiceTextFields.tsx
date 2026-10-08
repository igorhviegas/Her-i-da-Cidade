import React from 'react';
import type { ServiceFormData } from '../services/serviceForm';

interface ServiceTextFieldProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  formErrors: Partial<Record<keyof ServiceFormData, string>>;
}

/** Nome / Título */
export const ServiceTitleField: React.FC<ServiceTextFieldProps> = ({ formData, setFormData, formErrors }) => (
  <div>
    <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
      Nome do Serviço <span className="text-red-400">*</span>
    </label>
    <input
      type="text"
      value={formData.title}
      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
      placeholder="ex: Vídeo Especial de Aniversário"
      className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
        formErrors.title ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'
      }`}
    />
    {formErrors.title && (
      <p className="text-xs text-red-400 mt-1">{formErrors.title}</p>
    )}
  </div>
);

/** Descrição */
export const ServiceDescriptionField: React.FC<ServiceTextFieldProps> = ({ formData, setFormData, formErrors }) => (
  <div>
    <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
      Descrição do Serviço <span className="text-red-400">*</span>
    </label>
    <textarea
      rows={3}
      value={formData.description}
      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      placeholder="Descreva o que o cliente recebe neste serviço..."
      className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
        formErrors.description ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'
      }`}
    />
    {formErrors.description && (
      <p className="text-xs text-red-400 mt-1">{formErrors.description}</p>
    )}
  </div>
);
