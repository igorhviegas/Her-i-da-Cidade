import { extractBirthdayPerson } from './orderReference.js';

// Serviços digitais: não passam por gravação/edição, nascem direto em "Entregar".
// IDs do catálogo (seed): 1 = Aniversário, 5 = Temático. "Missão Digital" não tem ID fixo
// (criada pelo admin), então cai no fallback por título normalizado.
const DIGITAL_SERVICE_IDS = new Set(['1', '5']);
const DIGITAL_SERVICE_TITLES = new Set(['video especial de aniversario', 'video tematico', 'missao digital']);

const normalizeTitle = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function isDigitalDeliveryService(service) {
  if (!service) return false;
  return DIGITAL_SERVICE_IDS.has(String(service.id ?? '')) || DIGITAL_SERVICE_TITLES.has(normalizeTitle(service.title ?? service.name));
}

/** Status inicial de um novo pedido: serviços digitais vão direto para "delivery". */
export function initialStatusFor(service, configuredStatus) {
  return isDigitalDeliveryService(service) ? 'delivery' : configuredStatus;
}

/** Link wa.me com a mensagem de entrega, ou null se o telefone for inválido. Nunca envia sozinho. */
export function buildDeliveryWhatsAppUrl(whatsapp, order) {
  const digits = String(whatsapp ?? '').replace(/\D/g, '');
  const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55\d{10,11}$/.test(phone)) return null;
  const child = extractBirthdayPerson(order) || 'seu pequeno herói';
  const message = `Olááá! 🕸️ Aqui está o vídeo para ${child}! 🥰 Espero que gostem, foi feito com muito carinho pelo Homem-Aranha!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
