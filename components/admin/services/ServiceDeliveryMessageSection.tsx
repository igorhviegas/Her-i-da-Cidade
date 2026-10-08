import React from 'react';
import { buildDeliveryMessage } from '../../../services/digitalDelivery.js';
import type { ServiceFormData } from './serviceForm';

interface ServiceDeliveryMessageSectionProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  editingServiceId: string | null;
}

export const ServiceDeliveryMessageSection: React.FC<ServiceDeliveryMessageSectionProps> = ({
  formData,
  setFormData,
  editingServiceId,
}) => {
  return (
    <section className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 sm:p-5">
      <div>
        <h4 className="text-sm font-bold text-white">Mensagem do WhatsApp (Kanban)</h4>
        <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-white/45">
          Texto pré-preenchido no botão de envio dos cards deste serviço. Deixe vazio para usar a mensagem padrão (exibida abaixo como sugestão). O número e o destino do link não mudam.
        </p>
      </div>
      <textarea
        rows={7}
        value={formData.deliveryMessage}
        onChange={(event) => setFormData({ ...formData, deliveryMessage: event.target.value })}
        placeholder={buildDeliveryMessage({}, { id: editingServiceId ?? undefined, title: formData.title })}
        aria-label="Mensagem do WhatsApp do Kanban"
        className="w-full resize-y rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-emerald-500/60"
      />
    </section>
  );
};
