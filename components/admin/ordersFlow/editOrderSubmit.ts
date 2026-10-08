import { createClient, getClientByWhatsApp, normalizeWhatsApp, updateClient } from '../../../services/clientsService';
import type { updateOrder } from '../../../services/ordersService';
import { eventContentSummary, validateEventForm } from '../../../services/eventForm.js';
import type { planAdjustments } from '../../../services/eventFinance.js';
import { calculateOrderDeadlines } from '../../../services/orderDates';
import type { Client, Order, Service } from '../../../types';
import type { EventFormState } from '../EventOrderFields';
import { dateFromInput, fail } from './createOrderHelpers';
import { amount, dateInput, toDate } from './editOrderHelpers';

type SetError = (message: string) => void;
type EventValidation = ReturnType<typeof validateEventForm>;
type EventValues = EventValidation['value'];
export type EventAdjustment = ReturnType<typeof planAdjustments> | null;

interface EditBasicsInput {
  name: string;
  isEventOrder: boolean;
  eventState: EventFormState;
  paidDate: string;
  serviceId: string;
  services: Service[];
  service: Service | null | undefined;
  setError: SetError;
}

/** Valida nome, formulário de evento, data do pagamento e serviço; em caso de erro não retorna nada. */
export function validateEditBasics({ name, isEventOrder, eventState, paidDate, serviceId, services, service, setError }: EditBasicsInput) {
  const cleanName = name.trim();
  if (!cleanName) return fail(setError, 'Informe o nome do cliente.');
  const eventValidation = isEventOrder ? validateEventForm(eventState) : null;
  if (eventValidation?.error) return fail(setError, eventValidation.error);
  if (!isEventOrder && !paidDate) return fail(setError, 'Informe a data do pagamento.');
  if (!serviceId) return fail(setError, 'Selecione um serviço.');
  const selectedService = services.find((item) => item.id === serviceId) || (service?.id === serviceId ? service : null);
  if (!selectedService) return fail(setError, 'Serviço não encontrado. Atualize a página e tente novamente.');
  return { cleanName, eventValidation, selectedService };
}

export function validateEditWhatsApp(whatsapp: string, setError: SetError): { normalizedWhatsApp: string } | undefined {
  let normalizedWhatsApp: string;
  try {
    normalizedWhatsApp = normalizeWhatsApp(whatsapp);
    if (!/^55\d{10,11}$/.test(normalizedWhatsApp)) throw new Error();
  } catch {
    return fail(setError, 'Informe um WhatsApp válido com DDD.');
  }
  return { normalizedWhatsApp };
}

interface EditNumbersInput {
  deliveryDays: string;
  servicePrice: string;
  rushFee: string;
  totalPaid: string;
  content: string;
  setError: SetError;
}

/** Valida prazo, valores e conteúdo; em caso de erro não retorna nada. */
export function validateEditNumbers({ deliveryDays, servicePrice, rushFee, totalPaid, content, setError }: EditNumbersInput) {
  const days = deliveryDays.trim() ? Number(deliveryDays) : null;
  if (days !== null && (!Number.isInteger(days) || days < 0)) return fail(setError, 'O prazo deve ser um número inteiro não negativo ou ficar vazio.');
  const serviceAmount = amount(servicePrice);
  const rushAmount = amount(rushFee);
  const paidTotal = amount(totalPaid);
  if (serviceAmount === null) return fail(setError, 'Informe um valor válido para o serviço.');
  if (rushAmount === null) return fail(setError, 'Informe uma taxa de urgência válida.');
  if (paidTotal === null) return fail(setError, 'Informe um total pago válido.');
  if (!content.trim()) return fail(setError, 'Informe o conteúdo do pedido.');
  return { days, serviceAmount, rushAmount, paidTotal };
}

interface ResolveClientInput {
  client: Client | null | undefined;
  cleanName: string;
  whatsapp: string;
  normalizedWhatsApp: string;
}

export async function resolveUpdatedClient({ client, cleanName, whatsapp, normalizedWhatsApp }: ResolveClientInput): Promise<Client> {
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
  return updatedClient;
}

/** Tudo o que o salvamento precisa depois da validação e da resolução do cliente. */
export interface EditSaveContext {
  order: Order;
  updatedClient: Client;
  selectedService: Service;
  eventValues: EventValues;
  isEventOrder: boolean;
  isDraft: boolean;
  adjustment: EventAdjustment;
  paidDate: string;
  eventDate: string;
  deliveryDays: string;
  content: string;
  days: number | null;
  serviceAmount: number;
  rushAmount: number;
  paidTotal: number;
}

export function computeEditChanges({ order, eventValues, isEventOrder, paidDate, eventDate, deliveryDays }: EditSaveContext) {
  const paidAt = paidDate ? dateFromInput(paidDate) : undefined;
  const eventDay = eventValues ? eventValues.eventDate : eventDate;
  const eventAt = eventDay ? dateFromInput(eventDay) : null;
  const paidAtChanged = !isEventOrder && dateInput(order.paidAt) !== paidDate;
  const eventDateChanged = dateInput(order.eventDate) !== eventDay;
  const deliveryDaysChanged = (order.deliveryDays === undefined ? '' : String(order.deliveryDays)) !== deliveryDays.trim();
  return { paidAt, eventAt, paidAtChanged, eventDateChanged, deliveryDaysChanged };
}

type EditChanges = ReturnType<typeof computeEditChanges>;

export function buildEventUpdates(eventValues: EventValues): Partial<Order> {
  return eventValues ? {
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
}

export function buildOrderUpdates(ctx: EditSaveContext, changes: EditChanges, eventUpdates: Partial<Order>): Parameters<typeof updateOrder>[1] {
  const { updatedClient, selectedService, content, days, serviceAmount, rushAmount, paidTotal } = ctx;
  const orderUpdates: Parameters<typeof updateOrder>[1] = {
    clientId: updatedClient.id,
    serviceId: selectedService.id,
    content: content.trim(),
    servicePrice: serviceAmount,
    rushFee: rushAmount,
    totalPaid: paidTotal,
  };
  if (changes.paidAtChanged) orderUpdates.paidAt = changes.paidAt;
  if (changes.eventDateChanged) orderUpdates.eventDate = changes.eventAt;
  if (changes.deliveryDaysChanged) orderUpdates.deliveryDays = days;
  Object.assign(orderUpdates, eventUpdates);
  return orderUpdates;
}

/** Recalcula os prazos do cliente e internos quando a data do pagamento ou o prazo contratado mudou. */
function applyDeadlines(updatedOrder: Order, { order, days }: EditSaveContext, { paidAt, paidAtChanged, deliveryDaysChanged }: EditChanges) {
  if (paidAtChanged || deliveryDaysChanged) {
    const deadlinePaidAt = paidAtChanged ? paidAt : toDate(order.paidAt);
    const deadlineDays = deliveryDaysChanged ? days : order.deliveryDays;
    const deadlines = deadlinePaidAt && deadlineDays !== null && deadlineDays !== undefined
      ? calculateOrderDeadlines(deadlinePaidAt, deadlineDays)
      : null;
    updatedOrder.customerDueDate = deadlines?.customerDueDate;
    updatedOrder.internalDueDate = deadlines?.internalDueDate;
  }
}

export function buildUpdatedOrder(ctx: EditSaveContext, changes: EditChanges, eventUpdates: Partial<Order>): Order {
  const { order, updatedClient, selectedService, eventValues, isDraft, adjustment, content, days, serviceAmount, rushAmount, paidTotal } = ctx;
  const { paidAt, eventAt, paidAtChanged, eventDateChanged, deliveryDaysChanged } = changes;
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
    ...(adjustment?.next ? { eventLedger: adjustment.next } : {}),
  };
  applyDeadlines(updatedOrder, ctx, changes);
  return updatedOrder;
}
