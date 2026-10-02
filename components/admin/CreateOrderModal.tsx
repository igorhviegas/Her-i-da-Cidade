import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import { createClient, getClientByWhatsApp, normalizeWhatsApp } from '../../services/clientsService';
import { createOrder } from '../../services/ordersService';
import { calculateOrderDeadlines } from '../../services/orderDates';
import { resolveInitialStatus } from '../../services/orderInitialStatus.js';
import { getServices } from '../../services/servicesService';
import type { Order, OrderStatus, ProductionType, Service } from '../../types';

interface CreateOrderModalProps {
  onClose: () => void;
  onCreated: (order: Order) => Promise<void>;
  initialValues?: {
    name: string;
    whatsapp: string;
    serviceId: string;
    eventDate?: Date;
    deliveryDays?: number;
    content: string;
    servicePrice: number;
    rushFee: number;
    totalPaid: number;
  };
}

const statusLabels: Record<OrderStatus, string> = {
  scheduled: 'Agendado', recording: 'Gravar', editing: 'Editar', delivery: 'Entregar', completed: 'Concluído imediatamente',
};
const productionLabels: Record<ProductionType, string> = {
  scheduled: 'Agendado', recording: 'Gravação', editing: 'Edição', immediate: 'Imediato',
};

function dateFromInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatShortDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function dateInput(value?: Date): string {
  if (!value || Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** Obtém o valor anunciado quando existe; serviços "sob consulta" iniciam em branco. */
function priceFromService(value: string): string {
  const currencyAmount = value.match(/R\$\s*([\d.,]+)/i)?.[1];
  const amount = currencyAmount || value.match(/[\d.,]+/)?.[0];
  if (!amount) return '';
  const normalized = amount.includes(',')
    ? amount.replace(/\./g, '').replace(',', '.')
    : amount;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

function inputAmount(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
const labelClass = 'block text-xs font-semibold text-white/70';

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ onClose, onCreated, initialValues }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [serviceId, setServiceId] = useState(initialValues?.serviceId || '');
  const [name, setName] = useState(initialValues?.name || '');
  const [whatsapp, setWhatsapp] = useState(initialValues?.whatsapp || '');
  const [lookupState, setLookupState] = useState<'idle' | 'checking' | 'found' | 'new' | 'error'>('idle');
  const [lookupMessage, setLookupMessage] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [eventDate, setEventDate] = useState(dateInput(initialValues?.eventDate));
  const [deliveryDays, setDeliveryDays] = useState(initialValues?.deliveryDays === undefined ? '' : String(initialValues.deliveryDays));
  const [content, setContent] = useState(initialValues?.content || '');
  const [servicePrice, setServicePrice] = useState(initialValues ? String(initialValues.servicePrice) : '');
  const [rushFee, setRushFee] = useState(initialValues ? String(initialValues.rushFee) : '0');
  const [totalPaid, setTotalPaid] = useState(initialValues ? String(initialValues.totalPaid) : '');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getServices({ onlyActive: !initialValues, fallbackOnError: false })
      .then((items) => { if (!cancelled) setServices(items); })
      .catch((error) => { if (!cancelled) setServicesError(error instanceof Error ? error.message : 'Não foi possível carregar os serviços.'); })
      .finally(() => { if (!cancelled) setLoadingServices(false); });
    return () => { cancelled = true; };
  }, [initialValues]);

  const selectedService = services.find((service) => service.id === serviceId);
  const serviceConfigured = Boolean(
    selectedService && selectedService.generateOrder === true && selectedService.productionType &&
    (selectedService.initialStatus || selectedService.autoComplete),
  );
  const initialStatus: OrderStatus | null = selectedService ? resolveInitialStatus(selectedService) : null;
  const total = totalPaid.trim() ? inputAmount(totalPaid) ?? 0 : (inputAmount(servicePrice) ?? 0) + (inputAmount(rushFee) ?? 0);
  const deadlinePreview = useMemo(() => {
    if (!paidDate || !deliveryDays) return null;
    try {
      return calculateOrderDeadlines(dateFromInput(paidDate), Number(deliveryDays));
    } catch {
      return null;
    }
  }, [paidDate, deliveryDays]);

  const handleServiceChange = (id: string) => {
    const service = services.find((item) => item.id === id);
    setServiceId(id);
    setServicePrice(service ? priceFromService(service.price) : '');
    setRushFee('0');
    setTotalPaid('');
    setDeliveryDays(service?.defaultDeliveryDays !== undefined ? String(service.defaultDeliveryDays) : '');
  };

  const handleWhatsAppBlur = async () => {
    if (!whatsapp.trim()) {
      setLookupState('idle');
      setLookupMessage('');
      return;
    }
    try {
      const normalized = normalizeWhatsApp(whatsapp);
      if (!/^55\d{10,11}$/.test(normalized)) throw new Error('Informe um WhatsApp válido com DDD.');
      setLookupState('checking');
      setLookupMessage('Verificando cliente…');
      const existing = await getClientByWhatsApp(whatsapp);
      if (existing) {
        setName(existing.name);
        setLookupState('found');
        setLookupMessage('Cliente já cadastrado. O pedido usará este cadastro.');
      } else {
        setLookupState('new');
        setLookupMessage(`Novo cliente · WhatsApp normalizado: ${normalized}`);
      }
    } catch (error) {
      setLookupState('error');
      setLookupMessage(error instanceof Error ? error.message : 'Não foi possível verificar este WhatsApp.');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const cleanName = name.trim();
    if (!cleanName) return setFormError('Informe o nome do cliente.');
    let normalizedWhatsApp: string;
    try {
      normalizedWhatsApp = normalizeWhatsApp(whatsapp);
      if (!/^55\d{10,11}$/.test(normalizedWhatsApp)) throw new Error();
    } catch {
      return setFormError('Informe um WhatsApp válido com DDD.');
    }
    if (!selectedService) return setFormError('Selecione um serviço.');
    if (selectedService.generateOrder === false) return setFormError('Este serviço está configurado para não gerar pedidos.');
    if (!serviceConfigured || !initialStatus || !selectedService.productionType) {
      return setFormError('Este serviço ainda não tem configuração de pedido. Configure geração, tipo de produção e status inicial antes de criar pedidos.');
    }
    if (!paidDate) return setFormError('Informe a data do pagamento.');
    const paidAt = dateFromInput(paidDate);
    const serviceAmount = inputAmount(servicePrice);
    const rushAmount = rushFee.trim() ? inputAmount(rushFee) : 0;
    if (serviceAmount === null) return setFormError('Informe um valor válido para o serviço.');
    if (rushAmount === null) return setFormError('Informe uma taxa de urgência válida.');
    if (!content.trim()) return setFormError('Informe o conteúdo do pedido.');
    if (deliveryDays && (!Number.isInteger(Number(deliveryDays)) || Number(deliveryDays) <= 0)) {
      return setFormError('Selecione um prazo válido ou deixe o pedido sem prazo.');
    }

    setSubmitting(true);
    try {
      // createClient usa transação e retorna o cadastro existente se o WhatsApp já estiver cadastrado.
      // Assim, mudanças locais no nome não alteram o cadastro de cliente existente.
      const client = await createClient({ name: cleanName, whatsapp: whatsapp.trim() });
      const days = deliveryDays ? Number(deliveryDays) : undefined;
      const completed = initialStatus === 'completed';
      const order = await createOrder({
        clientId: client.id,
        serviceId: selectedService.id,
        status: initialStatus,
        paidAt,
        ...(eventDate ? { eventDate: dateFromInput(eventDate) } : {}),
        ...(days !== undefined ? { deliveryDays: days } : {}),
        content: content.trim(),
        servicePrice: serviceAmount,
        rushFee: rushAmount,
        totalPaid: initialValues && totalPaid.trim() ? inputAmount(totalPaid)! : serviceAmount + rushAmount,
        productionType: selectedService.productionType,
        source: 'manual',
        ...(completed ? { completedAt: new Date() } : {}),
      });
      await onCreated(order);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível criar o pedido.');
      setSubmitting(false);
    }
  };

  const deliveryOptions = [7, 4, 2];
  if (selectedService?.defaultDeliveryDays && !deliveryOptions.includes(selectedService.defaultDeliveryDays)) {
    deliveryOptions.push(selectedService.defaultDeliveryDays);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6" role="presentation">
      <button aria-label="Fechar formulário" className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div role="dialog" aria-modal="true" aria-labelledby="create-order-title" className="relative z-10 my-auto flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.02] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/20 text-blue-300"><Plus className="h-5 w-5" /></span>
            <div><h2 id="create-order-title" className="text-lg font-bold text-white">{initialValues ? 'Duplicar pedido' : 'Novo Pedido'}</h2><p className="text-xs text-white/45">{initialValues ? 'Revise os dados antes de criar o novo pedido' : 'Cadastro manual de pedido'}</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </header>

        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
          <div className="space-y-5 p-5 sm:p-6">
            {formError && <div role="alert" className="flex gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{formError}</div>}

            <section className="space-y-3">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Cliente</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Nome *<input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Nome do cliente" /></label>
                <label className={labelClass}>WhatsApp *<input required type="tel" value={whatsapp} onChange={(event) => { if (lookupState === 'found') setName(''); setWhatsapp(event.target.value); if (lookupState !== 'idle') setLookupState('idle'); setLookupMessage(''); }} onBlur={handleWhatsAppBlur} className={inputClass} placeholder="(31) 99999-9999" /></label>
              </div>
              {lookupMessage && <p className={`text-[11px] ${lookupState === 'found' ? 'text-emerald-300' : lookupState === 'error' ? 'text-red-300' : 'text-white/45'}`}>{lookupState === 'found' && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}{lookupMessage}</p>}
            </section>

            <section className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Serviço</h3>
              <label className={labelClass}>Serviço *
                <select required value={serviceId} onChange={(event) => handleServiceChange(event.target.value)} disabled={loadingServices || submitting} className={inputClass}>
                  <option value="">{loadingServices ? 'Carregando serviços…' : 'Selecione um serviço'}</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.title}{service.generateOrder === false ? ' · Pedidos desativados' : ''}</option>)}
                </select>
              </label>
              {servicesError && <p className="text-xs text-red-300">Não foi possível carregar os serviços. {servicesError}</p>}
              {selectedService && (serviceConfigured && initialStatus ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="text-white/45">Status inicial:</span><span className="font-semibold text-blue-200">{statusLabels[initialStatus]}</span>
                  <span className="ml-auto text-white/35">Produção: {productionLabels[selectedService.productionType!]}</span>
                </div>
              ) : <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Este serviço ainda não possui configuração de pedido. É necessário habilitar a geração e definir o tipo de produção e o status inicial.</p>)}
            </section>

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

            <section className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Valores</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Valor do serviço *<input required type="number" min="0" step="0.01" value={servicePrice} onChange={(event) => { setServicePrice(event.target.value); setTotalPaid(''); }} className={inputClass} placeholder="0,00" /></label>
                <label className={labelClass}>Taxa de urgência<input type="number" min="0" step="0.01" value={rushFee} onChange={(event) => { setRushFee(event.target.value); setTotalPaid(''); }} className={inputClass} placeholder="0,00" /></label>
              </div>
              {initialValues && <label className={labelClass}>Total pago *<input required type="number" min="0" step="0.01" value={totalPaid || String(total)} onChange={(event) => setTotalPaid(event.target.value)} className={inputClass} /></label>}
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3"><span className="text-xs font-semibold text-white/60">Total pago</span><strong className="text-base text-emerald-300">{formatMoney(total)}</strong></div>
            </section>
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/5 disabled:opacity-40">Cancelar</button>
            <button type="submit" disabled={submitting || loadingServices || !services.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? 'Criando pedido…' : initialValues ? 'Criar pedido duplicado' : 'Criar Pedido'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
