import React from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { ServiceFaqItem } from '../../../types';
import type { ServiceFormData } from './serviceForm';

interface ServiceFaqSectionProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  formErrors: Partial<Record<keyof ServiceFormData, string>>;
}

export const ServiceFaqSection: React.FC<ServiceFaqSectionProps> = ({
  formData,
  setFormData,
  formErrors,
}) => {
  return (
    <section className="space-y-3 rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-4 sm:p-5">
      <div>
        <h4 className="text-sm font-bold text-white">Dúvidas (site público)</h4>
        <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-white/45">
          Categorias exibidas em /duvidas para este serviço (ex.: Forma de pagamento, Prazo de entrega). Sem nenhuma categoria, o serviço não aparece na área de Dúvidas. Use **texto** para negrito e linha em branco para novo parágrafo.
        </p>
      </div>
      {formData.faq.map((item, index) => {
        const updateFaq = (patch: Partial<ServiceFaqItem>) =>
          setFormData({ ...formData, faq: formData.faq.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
        const moveFaq = (to: number) => {
          const next = [...formData.faq];
          [next[index], next[to]] = [next[to], next[index]];
          setFormData({ ...formData, faq: next });
        };
        return (
          <div key={item.id} className="space-y-2 rounded-xl border border-white/10 bg-[#070B14] p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={item.title}
                onChange={(event) => updateFaq({ title: event.target.value })}
                placeholder="Título da categoria (ex.: Forma de pagamento)"
                aria-label={`Título da categoria de dúvida ${index + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0D1527] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-500/60"
              />
              <button type="button" disabled={index === 0} onClick={() => moveFaq(index - 1)} aria-label="Mover categoria para cima" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" disabled={index === formData.faq.length - 1} onClick={() => moveFaq(index + 1)} aria-label="Mover categoria para baixo" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-25">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setFormData({ ...formData, faq: formData.faq.filter((_, i) => i !== index) })} aria-label="Excluir categoria" className="rounded-lg p-2 text-red-400 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              rows={4}
              value={item.content}
              onChange={(event) => updateFaq({ content: event.target.value })}
              placeholder="Conteúdo / resposta"
              aria-label={`Conteúdo da categoria de dúvida ${index + 1}`}
              className="w-full resize-y rounded-lg border border-white/10 bg-[#0D1527] px-3 py-2 text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-purple-500/60"
            />
          </div>
        );
      })}
      {formErrors.faq && <p role="alert" className="text-xs text-red-300">{formErrors.faq}</p>}
      <button
        type="button"
        onClick={() => setFormData({ ...formData, faq: [...formData.faq, { id: `faq-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: '', content: '' }] })}
        className="flex items-center gap-2 rounded-xl border border-dashed border-purple-500/40 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-500/10"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar categoria
      </button>
    </section>
  );
};
