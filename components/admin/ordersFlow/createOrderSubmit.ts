import { normalizeWhatsApp } from '../../../services/clientsService';
import { createOrder } from '../../../services/ordersService';
import { eventContentSummary, validateEventForm } from '../../../services/eventForm.js';
import { buildVideoContents, findVideoService, VIDEO_KINDS } from '../../../services/eventVideos.js';
import type { VideoAddons, VideoKind } from '../../../services/eventVideos.js';
import type { OrderStatus, ProductionType, Service } from '../../../types';
import type { EventFormState } from '../EventOrderFields';
import { dateFromInput, deriveServiceState, fail, inputAmount } from './createOrderHelpers';
import type { CreateOrderInitialValues } from './createOrderHelpers';

type SetFormError = (message: string) => void;
type EventValues = ReturnType<typeof validateEventForm>['value'];

interface ClientAndServiceInput {
  name: string;
  whatsapp: string;
  selectedService: Service | undefined;
  serviceConfigured: boolean;
  initialStatus: OrderStatus | null;
  setFormError: SetFormError;
}

/** Valida cliente e serviço; em caso de erro mostra a mensagem e não retorna nada. */
export function validateClientAndService({ name, whatsapp, selectedService, serviceConfigured, initialStatus, setFormError }: ClientAndServiceInput): { cleanName: string } | undefined {
  const cleanName = name.trim();
  if (!cleanName) return fail(setFormError, 'Informe o nome do cliente.');
  let normalizedWhatsApp: string;
  try {
    normalizedWhatsApp = normalizeWhatsApp(whatsapp);
    if (!/^55\d{10,11}$/.test(normalizedWhatsApp)) throw new Error();
  } catch {
    return fail(setFormError, 'Informe um WhatsApp válido com DDD.');
  }
  if (!selectedService) return fail(setFormError, 'Selecione um serviço.');
  if (selectedService.generateOrder === false) return fail(setFormError, 'Este serviço está configurado para não gerar pedidos.');
  if (!serviceConfigured || !initialStatus || !selectedService.productionType) {
    return fail(setFormError, 'Este serviço ainda não tem configuração de pedido. Configure geração, tipo de produção e status inicial antes de criar pedidos.');
  }
  return { cleanName };
}

interface OrderDetailsInput {
  isEvent: boolean;
  eventState: EventFormState;
  paidDate: string;
  servicePrice: string;
  rushFee: string;
  content: string;
  deliveryDays: string;
  setFormError: SetFormError;
}

interface OrderDetails {
  paidAt: Date | undefined;
  serviceAmount: number;
  rushAmount: number;
  eventValues: EventValues;
}

/** Valida os campos do evento (formulário manual) ou do pedido comum; em caso de erro não retorna nada. */
export function validateOrderDetails({ isEvent, eventState, paidDate, servicePrice, rushFee, content, deliveryDays, setFormError }: OrderDetailsInput): OrderDetails | undefined {
  let paidAt: Date | undefined;
  let serviceAmount = 0;
  let rushAmount = 0;
  let eventValues: EventValues;
  if (isEvent) {
    const validated = validateEventForm(eventState);
    if (validated.error) return fail(setFormError, validated.error);
    eventValues = validated.value;
  } else {
    if (!paidDate) return fail(setFormError, 'Informe a data do pagamento.');
    paidAt = dateFromInput(paidDate);
    const parsedService = inputAmount(servicePrice);
    const parsedRush = rushFee.trim() ? inputAmount(rushFee) : 0;
    if (parsedService === null) return fail(setFormError, 'Informe um valor válido para o serviço.');
    if (parsedRush === null) return fail(setFormError, 'Informe uma taxa de urgência válida.');
    serviceAmount = parsedService;
    rushAmount = parsedRush;
    if (!content.trim()) return fail(setFormError, 'Informe o conteúdo do pedido.');
    if (deliveryDays && (!Number.isInteger(Number(deliveryDays)) || Number(deliveryDays) <= 0)) {
      return fail(setFormError, 'Selecione um prazo válido ou deixe o pedido sem prazo.');
    }
  }
  return { paidAt, serviceAmount, rushAmount, eventValues };
}

interface CreateOrderInputArgs extends OrderDetails {
  clientId: string;
  selectedService: Service;
  initialStatus: OrderStatus;
  eventDate: string;
  deliveryDays: string;
  content: string;
  totalPaid: string;
  initialValues: CreateOrderInitialValues | undefined;
}

/** Monta o payload de createOrder: pedido de evento (formulário manual) ou pedido comum. */
export function buildCreateOrderInput({ clientId, selectedService, initialStatus, eventValues, paidAt, eventDate, deliveryDays, content, serviceAmount, rushAmount, totalPaid, initialValues }: CreateOrderInputArgs): Parameters<typeof createOrder>[0] {
  const days = deliveryDays ? Number(deliveryDays) : undefined;
  const completed = initialStatus === 'completed';
  return eventValues ? {
    clientId,
    serviceId: selectedService.id,
    status: initialStatus,
    eventDate: dateFromInput(eventValues.eventDate),
    childName: eventValues.childName,
    content: eventContentSummary(eventValues),
    servicePrice: eventValues.totalValue,
    rushFee: 0,
    totalPaid: eventValues.totalValue,
    productionType: selectedService.productionType,
    source: 'manual',
    eventForm: {
      eventTime: eventValues.eventTime, location: eventValues.location, imageAuthorization: eventValues.imageAuthorization, extraWeb: eventValues.extraWeb,
      totalValue: eventValues.totalValue, entryValue: eventValues.entryValue, cost: eventValues.cost, observations: eventValues.observations, formType: eventValues.formType,
      birthDate: eventValues.birthDate, pcd: eventValues.pcd,
    },
  } : {
    clientId,
    serviceId: selectedService.id,
    status: initialStatus,
    paidAt,
    ...(eventDate ? { eventDate: dateFromInput(eventDate) } : {}),
    ...(days !== undefined ? { deliveryDays: days } : {}),
    content: content.trim(),
    servicePrice: serviceAmount,
    rushFee: rushAmount,
    totalPaid: initialValues && totalPaid.trim() ? inputAmount(totalPaid) : serviceAmount + rushAmount,
    productionType: selectedService.productionType,
    source: 'manual',
    ...(completed ? { completedAt: new Date() } : {}),
  };
}

interface VideoOrdersInput {
  addons: VideoAddons;
  services: Service[];
  event: { eventDate: string; eventTime: string; location: string };
  setFormError: SetFormError;
}

interface PlannedVideo { service: Service; status: OrderStatus; content: string }

/** Valida os vídeos marcados (dados + serviço existente e configurado) e devolve o serviço e o conteúdo de cada pedido a criar. */
export function validateVideoOrders({ addons, services, event, setFormError }: VideoOrdersInput): PlannedVideo[] | undefined {
  const contents = buildVideoContents(addons, event);
  if (contents.error) return fail(setFormError, contents.error);
  const planned: PlannedVideo[] = [];
  for (const [kind, content] of Object.entries(contents.value) as Array<[VideoKind, string]>) {
    const service = findVideoService(services, kind);
    if (!service) return fail(setFormError, `Serviço "${VIDEO_KINDS[kind].title}" não encontrado entre os serviços ativos. Desmarque o vídeo ou cadastre o serviço.`);
    const { serviceConfigured, initialStatus } = deriveServiceState(service);
    if (!serviceConfigured || !initialStatus) return fail(setFormError, `O serviço "${service.title}" ainda não tem configuração de pedido (geração, tipo de produção e status inicial).`);
    planned.push({ service, status: initialStatus, content });
  }
  return planned;
}

/** Pedido do vídeo contratado com o evento: sem valor (já está no total do evento), pago na data da criação. */
export function buildVideoOrderInput({ clientId, eventDate, service, status, content }: PlannedVideo & { clientId: string; eventDate: string }): Parameters<typeof createOrder>[0] {
  const now = new Date();
  return {
    clientId,
    serviceId: service.id,
    status,
    paidAt: now,
    eventDate: dateFromInput(eventDate),
    ...(service.defaultDeliveryDays !== undefined ? { deliveryDays: service.defaultDeliveryDays } : {}),
    content,
    servicePrice: 0,
    rushFee: 0,
    totalPaid: 0,
    productionType: service.productionType as ProductionType,
    source: 'manual',
    ...(status === 'completed' ? { completedAt: now } : {}),
  };
}

/** Cria os pedidos de vídeo um a um; devolve o aviso (quais falharam) ou undefined. O evento já existe, então uma falha não desfaz nada. */
export async function createVideoOrders(videos: PlannedVideo[], clientId: string, eventDate: string): Promise<string | undefined> {
  const failed: string[] = [];
  for (const video of videos) {
    try {
      await createOrder(buildVideoOrderInput({ ...video, clientId, eventDate }));
    } catch {
      failed.push(video.service.title);
    }
  }
  return failed.length ? `Evento salvo, mas não foi possível criar o pedido de: ${failed.join(', ')}. Crie manualmente em Novo pedido.` : undefined;
}
