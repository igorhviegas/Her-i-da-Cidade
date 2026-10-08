import { normalizeWhatsApp } from '../../../services/clientsService';
import { formatOrderReference } from '../../../services/orderReference.js';
import type { Client, Order, Service } from '../../../types';
import { displayDate, displayDays, formatMoney } from './orderView';
import type { OrderView } from './orderView';

/** Link do WhatsApp do cliente com a mensagem de contato sobre o pedido; null quando indisponível. */
export function buildContactWhatsappUrl(client: Client | null | undefined, service: Service | null | undefined): string | null {
  let whatsappUrl: string | null = null;
  if (client?.whatsapp) {
    try {
      const phone = normalizeWhatsApp(client.whatsapp);
      const message = `Olá, ${client.name}! Estou entrando em contato sobre seu pedido de ${service?.title || 'serviço'} na Central do Herói.`;
      whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    } catch {
      whatsappUrl = null;
    }
  }
  return whatsappUrl;
}

type DetailRow = [string, string];

function buildEventRows({ order, client, service }: OrderView, event: NonNullable<Order['eventForm']>): DetailRow[] {
  return [
    ['Cliente', client?.name || 'Cliente não encontrado'],
    ['WhatsApp', client?.whatsapp || '—'],
    ['Nome da criança', order.childName || '—'],
    ['#formulário', event.formType],
    ['Serviço', service?.title || 'Serviço não encontrado'],
    ['Data do evento', displayDate(order.eventDate)],
    ['Horário de início', event.eventTime],
    ['Local', event.location],
    ['Autorização de uso de imagem', event.imageAuthorization ? 'Sim' : 'Não'],
    ['Teia extra', event.extraWeb ? String(event.extraWeb) : 'Não'],
    ['Valor total', formatMoney(event.totalValue)],
    ['Valor de entrada', formatMoney(event.entryValue)],
    ['Custo', typeof event.cost === 'number' ? formatMoney(event.cost) : '—'],
    ['Observações', event.observations || '—'],
  ];
}

function buildStandardRows({ order, client, service }: OrderView): DetailRow[] {
  return [
    ['Cliente', client?.name || 'Cliente não encontrado'],
    ['WhatsApp', client?.whatsapp || '—'],
    ['Serviço', service?.title || 'Serviço não encontrado'],
    ['Data do pagamento', displayDate(order.paidAt)],
    ['Data do evento/entrega', displayDate(order.eventDate)],
    ['Prazo contratado', displayDays(order.deliveryDays)],
    ['Prazo do cliente', displayDate(order.customerDueDate)],
    ['Prazo interno', displayDate(order.internalDueDate)],
    ['Valor do serviço', formatMoney(order.servicePrice)],
    ['Taxa de urgência', formatMoney(order.rushFee)],
    ['Total pago', formatMoney(order.totalPaid)],
  ];
}

export function buildOrderRows(view: OrderView, allOrderRecords: Order[]) {
  const { order } = view;
  const technicalRows: DetailRow[] = [
    ['Referência do pedido', formatOrderReference(order, allOrderRecords)],
    ['ID do documento', order.id],
  ];
  const detailRows = order.eventForm ? buildEventRows(view, order.eventForm) : buildStandardRows(view);
  return { technicalRows, detailRows };
}
