import React, { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Save, X } from 'lucide-react';
import { createClient, getClientByWhatsApp, normalizeWhatsApp, updateClient } from '../../services/clientsService';
import { updateOrder } from '../../services/ordersService';
import { eventContentSummary, validateEventForm } from '../../services/eventForm.js';
import { EventOrderFields, eventFormFromOrder } from './EventOrderFields';
import { calculateOrderDeadlines } from '../../services/orderDates';
import { getServices } from '../../services/servicesService';
import type { Client, Order, Service } from '../../types';

interface EditOrderModalProps {
  order: Order;
  client: Client | null | undefined;
  service: Service | null | undefined;
  onClose: () => void;
  onSaved: (order: Order, client: Client, service: Service) => void;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as any)?.toDate === 'function') return (value as any).toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateInput(value: unknown): string {
  const date = toDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function amount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
const labelClass = 'block text-xs font-semibold text-white/70';

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, client, service, onClose, onSaved }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(client?.name || '');
  const [whatsapp, setWhatsapp] = useState(client?.whatsapp || '');
  const [serviceId, setServiceId] = useState(order.serviceId);
  const [paidDate, setPaidDate] = useState(dateInput(order.paidAt));
  const [eventDate, setEventDate] = useState(dateInput(order.eventDate));
  const [deliveryDays, setDeliveryDays] = useState(order.deliveryDays === undefined ? '' : String(order.deliveryDays));
  const [content, setContent] = useState(order.content || '');
  const [servicePrice, setServicePrice] = useState(String(order.servicePrice ?? ''));
  const [rushFee, setRushFee] = useState(String(order.rushFee ?? 0));
  const [totalPaid, setTotalPaid] = useState(String(order.totalPaid ?? ''));
  // Pedido criado pelo formulário manual de evento: edita os campos do evento (os lançamentos já feitos no Financeiro não mudam).
  const isDraft = order.eventDraft === true; // criado pelo ManyChat: só cliente e WhatsApp até este cadastro
  const isEventOrder = Boolean(order.eventForm) || isDraft;
  const [eventState, setEventState] = useState(() => eventFormFromOrder(order));
  const booked = order.eventLedger;
  const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  useEffect(() => {
    let cancelled = false;
    getServices({ onlyActive: false, fallbackOnError: false })
      .then((items) => {
        if (!cancelled) {
          const available = items.some((item) => item.id === order.serviceId) || !service
            ? items
            : [...items, service];
          setServices(available);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os serviços.');
      })
      .finally(() => { if (!cancelled) setLoadingServices(false); });
    return () => { cancelled = true; };
  }, [order.serviceId, service]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const cleanName = name.trim();
    if (!cleanName) return setError('Informe o nome do cliente.');
    const eventValidation = isEventOrder ? validateEventForm(eventState) : null;
    if (eventValidation?.error) return setError(eventValidation.error);
    if (!isEventOrder && !paidDate) return setError('Informe a data do pagamento.');
    if (!serviceId) return setError('Selecione um serviço.');
    const selectedService = services.find((item) => item.id === serviceId) || (service?.id === serviceId ? service : null);
    if (!selectedService) return setError('Serviço não encontrado. Atualize a página e tente novamente.');

    let normalizedWhatsApp: string;
    try {
      normalizedWhatsApp = normalizeWhatsApp(whatsapp);
      if (!/^55\d{10,11}$/.test(normalizedWhatsApp)) throw new Error();
    } catch {
      return setError('Informe um WhatsApp válido com DDD.');
    }
    const days = deliveryDays.trim() ? Number(deliveryDays) : null;
    if (days !== null && (!Number.isInteger(days) || days < 0)) return setError('O prazo deve ser um número inteiro não negativo ou ficar vazio.');
    const serviceAmount = amount(servicePrice);
    const rushAmount = amount(rushFee);
    const paidTotal = amount(totalPaid);
    if (serviceAmount === null) return setError('Informe um valor válido para o serviço.');
    if (rushAmount === null) return setError('Informe uma taxa de urgência válida.');
    if (paidTotal === null) return setError('Informe um total pago válido.');
    if (!content.trim()) return setError('Informe o conteúdo do pedido.');

    setSaving(true);
    try {
      const existingClient = await getClientByWhatsApp(normalizedWhatsApp);
      let updatedClient: Client;
      if (existingClient) {
        if (client?.id === existingClient.id) {
          await updateClient(client.id, { name: cleanName, whatsapp: whatsapp.trim() });
          updatedClient = { ...client, name: cleanName, whatsapp: whatsapp.trim(), whatsappNormalized: normalizedWhatsApp };
        } else {
          // Um WhatsApp já cadastrado aponta para o cliente canônico; não cria duplicata nem sobrescreve seu nome.
          updatedClient = existingClient;
        }
      } else if (client) {
        await updateClient(client.id, { name: cleanName, whatsapp: whatsapp.trim() });
        updatedClient = { ...client, name: cleanName, whatsapp: whatsapp.trim(), whatsappNormalized: normalizedWhatsApp };
      } else {
        updatedClient = await createClient({ name: cleanName, whatsapp: whatsapp.trim() });
      }

      const eventValues = eventValidation?.value;
      const paidAt = paidDate ? dateFromInput(paidDate) : undefined;
      const eventDay = eventValues ? eventValues.eventDate : eventDate;
      const eventAt = eventDay ? dateFromInput(eventDay) : null;
      const paidAtChanged = !isEventOrder && dateInput(order.paidAt) !== paidDate;
      const eventDateChanged = dateInput(order.eventDate) !== eventDay;
      const deliveryDaysChanged = (order.deliveryDays === undefined ? '' : String(order.deliveryDays)) !== deliveryDays.trim();
      const orderUpdates: Parameters<typeof updateOrder>[1] = {
        clientId: updatedClient.id,
        serviceId: selectedService.id,
        content: content.trim(),
        servicePrice: serviceAmount,
        rushFee: rushAmount,
        totalPaid: paidTotal,
      };
      if (paidAtChanged) orderUpdates.paidAt = paidAt;
      if (eventDateChanged) orderUpdates.eventDate = eventAt;
      if (deliveryDaysChanged) orderUpdates.deliveryDays = days;
      const eventUpdates: Partial<Order> = eventValues ? {
        childName: eventValues.childName,
        content: eventContentSummary(eventValues),
        servicePrice: eventValues.totalValue,
        rushFee: 0,
        totalPaid: eventValues.totalValue,
        eventForm: {
          eventTime: eventValues.eventTime, location: eventValues.location, imageAuthorization: eventValues.imageAuthorization, extraWeb: eventValues.extraWeb,
          totalValue: eventValues.totalValue, entryValue: eventValues.entryValue, cost: eventValues.cost, observations: eventValues.observations, formType: eventValues.formType,
        },
      } : {};
      Object.assign(orderUpdates, eventUpdates);
      await updateOrder(order.id, orderUpdates);

      const updatedOrder: Order = {
        ...order,
        clientId: updatedClient.id,
        serviceId: selectedService.id,
        ...(paidAtChanged ? { paidAt } : {}),
        ...(eventDateChanged ? { eventDate: eventAt || undefined } : {}),
        ...(deliveryDaysChanged ? { deliveryDays: days === null ? undefined : days } : {}),
        content: content.trim(),
        servicePrice: serviceAmount,
        rushFee: rushAmount,
        totalPaid: paidTotal,
        ...eventUpdates,
        ...(isDraft && eventValues ? { eventDraft: undefined, eventLedger: { entry: eventValues.entryValue } } : {}),
      };
      if (paidAtChanged || deliveryDaysChanged) {
        const deadlinePaidAt = paidAtChanged ? paidAt : toDate(order.paidAt);
        const deadlineDays = deliveryDaysChanged ? days : order.deliveryDays;
        const deadlines = deadlinePaidAt && deadlineDays !== null && deadlineDays !== undefined
          ? calculateOrderDeadlines(deadlinePaidAt, deadlineDays)
          : null;
        updatedOrder.customerDueDate = deadlines?.customerDueDate;
        updatedOrder.internalDueDate = deadlines?.internalDueDate;
      }
      onSaved(updatedOrder, updatedClient, selectedService);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar as alterações do pedido.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="edit-order-title" className="my-auto flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-300">Pedido existente</p><h2 id="edit-order-title" className="mt-1 text-lg font-bold text-white">Editar pedido</h2></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar edição" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
        </header>
        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
          <div className="space-y-5 p-5 sm:p-6">
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}

            <section className="space-y-3">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Cliente</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Nome do cliente *<input required value={name} onChange={(event) => setName(event.target.value)} disabled={saving} className={inputClass} /></label>
                <label className={labelClass}>WhatsApp *<input required type="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} disabled={saving} className={inputClass} placeholder="(31) 99999-9999" /></label>
              </div>
              <p className="text-[11px] text-white/40">O WhatsApp será normalizado e atualizado no cadastro do cliente.</p>
            </section>

            {isDraft && (
              <p className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-[11px] text-blue-100">
                Pedido recebido pelo ManyChat: complete os dados do evento. Ao salvar, a entrada é lançada no Financeiro (a 2ª parcela e a despesa são lançadas na conclusão).
              </p>
            )}
            {isEventOrder && booked && (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                Lançamentos já efetivados no Financeiro: entrada {money(booked.entry)}{booked.final !== undefined ? ` · 2ª parcela ${money(booked.final)}` : ''}{booked.cost !== undefined ? ` · despesa evento ${money(booked.cost)}` : ''}.
                Alterar valor total, entrada ou custo aqui NÃO modifica esses lançamentos; a 2ª parcela e a despesa ainda não lançadas usam os valores vigentes na primeira conclusão.
              </p>
            )}
            {isEventOrder ? <EventOrderFields value={eventState} onChange={setEventState} disabled={saving} /> : (
              <>
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

            <section className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Valores registrados no pedido</h3>
              <p className="text-[11px] text-white/40">Estes valores são snapshots do pedido; alterar o serviço não modifica o preço cadastrado nele.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className={labelClass}>Valor do serviço *<input required type="number" min="0" step="0.01" value={servicePrice} onChange={(event) => setServicePrice(event.target.value)} disabled={saving} className={inputClass} /></label>
                <label className={labelClass}>Taxa de urgência<input required type="number" min="0" step="0.01" value={rushFee} onChange={(event) => setRushFee(event.target.value)} disabled={saving} className={inputClass} /></label>
                <label className={labelClass}>Total pago *<input required type="number" min="0" step="0.01" value={totalPaid} onChange={(event) => setTotalPaid(event.target.value)} disabled={saving} className={inputClass} /></label>
              </div>
            </section>
              </>
            )}
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/5 disabled:opacity-40">Cancelar</button>
            <button type="submit" disabled={saving || loadingServices || !services.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando…' : 'Salvar pedido'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};
