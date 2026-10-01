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

const INVITE_SERVICE_IDS = new Set(['4']);
const INVITE_SERVICE_TITLES = new Set(['video convite']);

export function isInviteVideoService(service) {
  if (!service) return false;
  return INVITE_SERVICE_IDS.has(String(service.id ?? '')) || INVITE_SERVICE_TITLES.has(normalizeTitle(service.title ?? service.name));
}

/**
 * Texto da mensagem de entrega por serviço. Serviços sem modelo próprio usam a mensagem padrão;
 * novos modelos entram aqui. Sem nome da criança, usa uma alternativa segura (nunca "undefined").
 */
export function buildDeliveryMessage(order, service) {
  const name = extractBirthdayPerson(order);
  if (isInviteVideoService(service)) {
    return `Olá! Aqui está o vídeo convite para a festa ${name ? `do ${name}` : 'do seu pequeno herói'} 🥰 espero que gostem, foi feito com muito carinho pelo Homem-Aranha! 🕸️`;
  }
  return `Olááá! 🕸️ Aqui está o vídeo para ${name || 'seu pequeno herói'}! 🥰 Espero que gostem, foi feito com muito carinho pelo Homem-Aranha!`;
}

/** Link wa.me com a mensagem de entrega, ou null se o telefone for inválido. Nunca envia sozinho. */
export function buildDeliveryWhatsAppUrl(whatsapp, order, service) {
  const digits = String(whatsapp ?? '').replace(/\D/g, '');
  const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55\d{10,11}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildDeliveryMessage(order, service))}`;
}
