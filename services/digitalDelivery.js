import { extractBirthdayPerson } from './orderReference.js';

const normalizeTitle = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

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
