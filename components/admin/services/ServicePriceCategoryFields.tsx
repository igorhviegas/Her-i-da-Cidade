import React from 'react';
import { DEFAULT_CATEGORIES, type ServiceFormData } from './serviceForm';

interface ServicePriceCategoryFieldsProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  formErrors: Partial<Record<keyof ServiceFormData, string>>;
  isCustomCategory: boolean;
  setIsCustomCategory: (value: boolean) => void;
}

export const ServicePriceCategoryFields: React.FC<ServicePriceCategoryFieldsProps> = ({
  formData,
  setFormData,
  formErrors,
  isCustomCategory,
  setIsCustomCategory,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      
      {/* Preço (String Livre) */}
      <div>
        <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1.5">
          Preço (Formato Textual) <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          placeholder="ex: Apenas R$ 35 ou Sob Consulta"
          className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
            formErrors.price ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-blue-500'
          }`}
        />
        <p className="text-[11px] text-white/40 mt-1">
          Mantenha o texto livre (ex: "Apenas R$ 30", "15 minutos R$ 75").
        </p>
        {formErrors.price && (
          <p className="text-xs text-red-400 mt-1">{formErrors.price}</p>
        )}
      </div>

      {/* Categoria */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-white/80 uppercase tracking-wider">
            Categoria <span className="text-red-400">*</span>
          </label>
          <button
            type="button"
            onClick={() => setIsCustomCategory(!isCustomCategory)}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
          >
            {isCustomCategory ? 'Escolher pré-definida' : '+ Nova categoria'}
          </button>
        </div>

        {isCustomCategory ? (
          <input
            type="text"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Nome da nova categoria..."
            className={`w-full px-3.5 py-2.5 bg-[#070B14] border rounded-xl text-sm text-white placeholder-white/40 focus:outline-none transition-colors ${
              formErrors.category ? 'border-red-500' : 'border-white/10 focus:border-blue-500'
            }`}
          />
        ) : (
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-[#070B14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
        {formErrors.category && (
          <p className="text-xs text-red-400 mt-1">{formErrors.category}</p>
        )}
      </div>

    </div>
  );
};
