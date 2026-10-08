import React from 'react';
import { AlertCircle, Loader2, Save, X } from 'lucide-react';
import type { Order, Service } from '../../../types';
import { formatMoney as money, inputClass, labelClass } from './createOrderHelpers';
import type { EventAdjustment } from './editOrderSubmit';
import type { useEditOrderFields } from './useEditOrderFields';

type EditFields = ReturnType<typeof useEditOrderFields>;

interface EditOrderHeaderProps {
  saving: boolean;
  onClose: () => void;
}

export const EditOrderHeader: React.FC<EditOrderHeaderProps> = ({ saving, onClose }) => (
  <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
    <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-300">Pedido existente</p><h2 id="edit-order-title" className="mt-1 text-lg font-bold text-white">Editar pedido</h2></div>
    <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar edição" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
  </header>
);

export const EditOrderError: React.FC<{ error: string }> = ({ error }) => (
  <>
    {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
  </>
);

interface EditClientSectionProps {
  fields: EditFields;
  saving: boolean;
}

export const EditClientSection: React.FC<EditClientSectionProps> = ({ fields, saving }) => {
  const { name, setName, whatsapp, setWhatsapp } = fields;
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Cliente</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Nome do cliente *<input required value={name} onChange={(event) => setName(event.target.value)} disabled={saving} className={inputClass} /></label>
        <label className={labelClass}>WhatsApp *<input required type="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} disabled={saving} className={inputClass} placeholder="(31) 99999-9999" /></label>
      </div>
      <p className="text-[11px] text-white/40">O WhatsApp será normalizado e atualizado no cadastro do cliente.</p>
    </section>
  );
};

interface EditOrderNoticesProps {
  order: Order;
  isDraft: boolean;
  isEventOrder: boolean;
  adjustment: EventAdjustment;
  describeAdjustment: () => string;
}

export const EditOrderNotices: React.FC<EditOrderNoticesProps> = ({ order, isDraft, isEventOrder, adjustment, describeAdjustment }) => {
  const booked = order.eventLedger;
  return (
    <>
      {isDraft && (
        <p className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-[11px] text-blue-100">
          Pedido recebido pelo ManyChat: complete os dados do evento. Ao salvar, a entrada é lançada no Financeiro (a 2ª parcela e a despesa são lançadas na conclusão).
        </p>
      )}
      {isEventOrder && booked && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] text-amber-200">
          Lançamentos já efetivados no Financeiro: entrada {money(booked.entry)}{booked.final !== undefined ? ` · 2ª parcela ${money(booked.final)}` : ''}{booked.cost !== undefined ? ` · despesa evento ${money(booked.cost)}` : ''}.
          Alterar valor total, entrada ou custo gera um ajuste no Financeiro (a diferença, na data da alteração); os lançamentos originais não são reescritos. A 2ª parcela e a despesa ainda não lançadas usam os valores vigentes na primeira conclusão.
        </p>
      )}
      {adjustment && (
        <p role="status" className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-[11px] text-blue-100">
          Ao salvar, será lançado no Financeiro: <strong>{describeAdjustment()}</strong>
        </p>
      )}
    </>
  );
};

interface EditOrderSectionProps {
  fields: EditFields;
  services: Service[];
  loadingServices: boolean;
  saving: boolean;
}

export const EditOrderSection: React.FC<EditOrderSectionProps> = ({ fields, services, loadingServices, saving }) => {
  const { serviceId, setServiceId, paidDate, setPaidDate, eventDate, setEventDate, deliveryDays, setDeliveryDays, content, setContent } = fields;
  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Pedido</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Serviço *
          <select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={loadingServices || saving} className={inputClass}>
            <option value="">{loadingServices ? 'Carregando serviços…' : 'Selecione um serviço'}</option>
            {services.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label className={labelClass}>Data do pagamento *<input required type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} disabled={saving} className={inputClass} /></label>
        <label className={labelClass}>Data do evento/entrega<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} disabled={saving} className={inputClass} /></label>
        <label className={labelClass}>Prazo contratado (dias corridos)
          <input type="number" min="0" step="1" value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} disabled={saving} placeholder="Sem prazo" className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>Conteúdo do pedido *<textarea required rows={4} value={content} onChange={(event) => setContent(event.target.value)} disabled={saving} className={`${inputClass} resize-y`} /></label>
    </section>
  );
};

export const EditValuesSection: React.FC<{ fields: EditFields; saving: boolean }> = ({ fields, saving }) => {
  const { servicePrice, setServicePrice, rushFee, setRushFee, totalPaid, setTotalPaid } = fields;
  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Valores registrados no pedido</h3>
      <p className="text-[11px] text-white/40">Estes valores são snapshots do pedido; alterar o serviço não modifica o preço cadastrado nele.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>Valor do serviço *<input required type="number" min="0" step="0.01" value={servicePrice} onChange={(event) => setServicePrice(event.target.value)} disabled={saving} className={inputClass} /></label>
        <label className={labelClass}>Taxa de urgência<input required type="number" min="0" step="0.01" value={rushFee} onChange={(event) => setRushFee(event.target.value)} disabled={saving} className={inputClass} /></label>
        <label className={labelClass}>Total pago *<input required type="number" min="0" step="0.01" value={totalPaid} onChange={(event) => setTotalPaid(event.target.value)} disabled={saving} className={inputClass} /></label>
      </div>
    </section>
  );
};

interface EditOrderFooterProps {
  saving: boolean;
  loadingServices: boolean;
  hasServices: boolean;
  onClose: () => void;
}

export const EditOrderFooter: React.FC<EditOrderFooterProps> = ({ saving, loadingServices, hasServices, onClose }) => (
  <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:justify-end sm:px-6">
    <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/5 disabled:opacity-40">Cancelar</button>
    <button type="submit" disabled={saving || loadingServices || !hasServices} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando…' : 'Salvar pedido'}
    </button>
  </footer>
);
