import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import type { OrderStatus, Service } from '../../../types';
import type { calculateOrderDeadlines } from '../../../services/orderDates';
import { formatMoney, formatShortDate, inputClass, labelClass, productionLabels, statusLabels } from './createOrderHelpers';
import type { CreateOrderInitialValues } from './createOrderHelpers';
import type { useClientFields, useOrderFields } from './useCreateOrderFields';

type ClientFields = ReturnType<typeof useClientFields>;
type OrderFields = ReturnType<typeof useOrderFields>;

interface CreateOrderHeaderProps {
  initialValues: CreateOrderInitialValues | undefined;
  submitting: boolean;
  onClose: () => void;
}

export const CreateOrderHeader: React.FC<CreateOrderHeaderProps> = ({ initialValues, submitting, onClose }) => (
  <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.02] px-5 py-4 sm:px-6">
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/20 text-blue-300"><Plus className="h-5 w-5" /></span>
      <div><h2 id="create-order-title" className="text-lg font-bold text-white">{initialValues ? 'Duplicar pedido' : 'Novo Pedido'}</h2><p className="text-xs text-white/45">{initialValues ? 'Revise os dados antes de criar o novo pedido' : 'Cadastro manual de pedido'}</p></div>
    </div>
    <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Fechar"><X className="h-5 w-5" /></button>
  </header>
);

export const CreateOrderError: React.FC<{ formError: string }> = ({ formError }) => (
  <>
    {formError && <div role="alert" className="flex gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</div>}
  </>
);

export const ClientSection: React.FC<{ client: ClientFields }> = ({ client }) => {
  const { name, setName, whatsapp, setWhatsapp, lookupState, setLookupState, lookupMessage, setLookupMessage, handleWhatsAppBlur } = client;
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Cliente</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Nome *<input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Nome do cliente" /></label>
        <label className={labelClass}>WhatsApp *<input required type="tel" value={whatsapp} onChange={(event) => { if (lookupState === 'found') setName(''); setWhatsapp(event.target.value); if (lookupState !== 'idle') setLookupState('idle'); setLookupMessage(''); }} onBlur={handleWhatsAppBlur} className={inputClass} placeholder="(31) 99999-9999" /></label>
      </div>
      {lookupMessage && <p className={`text-[11px] ${lookupState === 'found' ? 'text-emerald-300' : lookupState === 'error' ? 'text-red-300' : 'text-white/45'}`}>{lookupState === 'found' && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}{lookupMessage}</p>}
    </section>
  );
};

interface ServiceSectionProps {
  services: Service[];
  serviceId: string;
  loadingServices: boolean;
  submitting: boolean;
  servicesError: string;
  selectedService: Service | undefined;
  serviceConfigured: boolean;
  initialStatus: OrderStatus | null;
  onServiceChange: (id: string) => void;
}

export const ServiceSection: React.FC<ServiceSectionProps> = ({ services, serviceId, loadingServices, submitting, servicesError, selectedService, serviceConfigured, initialStatus, onServiceChange }) => (
  <section className="space-y-3 border-t border-white/10 pt-4">
    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Serviço</h3>
    <label className={labelClass}>Serviço *
      <select required value={serviceId} onChange={(event) => onServiceChange(event.target.value)} disabled={loadingServices || submitting} className={inputClass}>
        <option value="">{loadingServices ? 'Carregando serviços…' : 'Selecione um serviço'}</option>
        {services.map((service) => <option key={service.id} value={service.id}>{service.title}{service.generateOrder === false ? ' · Pedidos desativados' : ''}</option>)}
      </select>
    </label>
    {servicesError && <p className="text-xs text-red-300">Não foi possível carregar os serviços. {servicesError}</p>}
    {selectedService && (serviceConfigured && initialStatus ? (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
        <span className="text-white/45">Status inicial:</span><span className="font-semibold text-blue-200">{statusLabels[initialStatus]}</span>
        <span className="ml-auto text-white/35">Produção: {productionLabels[selectedService.productionType]}</span>
      </div>
    ) : <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Este serviço ainda não possui configuração de pedido. É necessário habilitar a geração e definir o tipo de produção e o status inicial.</p>)}
  </section>
);

interface OrderSectionProps {
  fields: OrderFields;
  selectedService: Service | undefined;
  deliveryOptions: number[];
  deadlinePreview: ReturnType<typeof calculateOrderDeadlines> | null;
}

export const OrderSection: React.FC<OrderSectionProps> = ({ fields, selectedService, deliveryOptions, deadlinePreview }) => {
  const { paidDate, setPaidDate, eventDate, setEventDate, deliveryDays, setDeliveryDays, content, setContent } = fields;
  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Pedido</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Data do pagamento *<input required type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Data do evento/entrega<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Prazo contratado
          <select value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} className={inputClass}>
            <option value="">Sem prazo</option>
            {deliveryOptions.concat(deliveryDays && !deliveryOptions.includes(Number(deliveryDays)) ? [Number(deliveryDays)] : []).map((days) => <option key={days} value={days}>{days} dias corridos{days === selectedService?.defaultDeliveryDays ? ' · Padrão do serviço' : ''}</option>)}
          </select>
        </label>
      </div>
      {deadlinePreview && <p className="text-[11px] text-white/50">Previsão: cliente {formatShortDate(deadlinePreview.customerDueDate)} · interno {formatShortDate(deadlinePreview.internalDueDate)}</p>}
      <label className={labelClass}>Conteúdo do pedido *<textarea required rows={4} value={content} onChange={(event) => setContent(event.target.value)} className={`${inputClass} resize-y`} placeholder="Texto para o vídeo e demais informações fornecidas pelo cliente" /></label>
    </section>
  );
};

interface ValuesSectionProps {
  fields: OrderFields;
  initialValues: CreateOrderInitialValues | undefined;
  total: number;
}

export const ValuesSection: React.FC<ValuesSectionProps> = ({ fields, initialValues, total }) => {
  const { servicePrice, setServicePrice, rushFee, setRushFee, totalPaid, setTotalPaid } = fields;
  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Valores</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Valor do serviço *<input required type="number" min="0" step="0.01" value={servicePrice} onChange={(event) => { setServicePrice(event.target.value); setTotalPaid(''); }} className={inputClass} placeholder="0,00" /></label>
        <label className={labelClass}>Taxa de urgência<input type="number" min="0" step="0.01" value={rushFee} onChange={(event) => { setRushFee(event.target.value); setTotalPaid(''); }} className={inputClass} placeholder="0,00" /></label>
      </div>
      {initialValues && <label className={labelClass}>Total pago *<input required type="number" min="0" step="0.01" value={totalPaid || String(total)} onChange={(event) => setTotalPaid(event.target.value)} className={inputClass} /></label>}
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3"><span className="text-xs font-semibold text-white/60">Total pago</span><strong className="text-base text-emerald-300">{formatMoney(total)}</strong></div>
    </section>
  );
};

interface CreateOrderFooterProps {
  initialValues: CreateOrderInitialValues | undefined;
  submitting: boolean;
  loadingServices: boolean;
  hasServices: boolean;
  onClose: () => void;
}

export const CreateOrderFooter: React.FC<CreateOrderFooterProps> = ({ initialValues, submitting, loadingServices, hasServices, onClose }) => (
  <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:justify-end sm:px-6">
    <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/5 disabled:opacity-40">Cancelar</button>
    <button type="submit" disabled={submitting || loadingServices || !hasServices} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? 'Criando pedido…' : initialValues ? 'Criar pedido duplicado' : 'Criar Pedido'}
    </button>
  </footer>
);
