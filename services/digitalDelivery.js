import { extractBirthdayPerson } from './orderReference.js';

const normalizeTitle = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const INVITE_SERVICE_IDS = new Set(['4']);
const INVITE_SERVICE_TITLES = new Set(['video convite']);

export function isInviteVideoService(service) {
  if (!service) return false;
  return INVITE_SERVICE_IDS.has(String(service.id ?? '')) || INVITE_SERVICE_TITLES.has(normalizeTitle(service.title ?? service.name));
}

const VIDEO_CALL_SERVICE_IDS = new Set(['2']);
const VIDEO_CALL_SERVICE_TITLES = new Set(['video chamada ao vivo']);

export function isVideoCallService(service) {
  if (!service) return false;
  return VIDEO_CALL_SERVICE_IDS.has(String(service.id ?? '')) || VIDEO_CALL_SERVICE_TITLES.has(normalizeTitle(service.title ?? service.name));
}

export const VIDEO_CALL_DEFAULT_MESSAGE = [
  'Ooii! Aqui é o Homem-Aranha 🕷️🕸️',
  'Nossa vídeo chamada espetacular será por este número!',
  'Para deixar esse momento ainda mais incrível, seguem algumas orientações:',
  '✨ Quando faltar cerca de 5 minutos, envie um “Ok” para confirmar que está tudo pronto.',
  '📱 Deixe o celular apoiado, em um local com boa iluminação e pouco barulho.',
  '👨‍👩‍👧‍👦 É importante que um responsável esteja presente durante a chamada, pois algumas crianças podem ficar tímidas no início e vão se soltando aos poucos.',
  'Nos vemos em breve! 🥳🤟🏻',
].join('\n');

/**
 * Texto da mensagem de entrega por serviço. Serviços sem modelo próprio usam a mensagem padrão;
 * novos modelos entram aqui. Sem nome da criança, usa uma alternativa segura (nunca "undefined").
 */
export function buildDeliveryMessage(order, service) {
  // Mensagem personalizada do serviço (modal de Serviços) tem prioridade; vazia = padrão do tipo.
  const custom = typeof service?.deliveryMessage === 'string' ? service.deliveryMessage.replace(/\r\n/g, '\n').trim() : '';
  if (custom) return custom;
  if (isVideoCallService(service)) return VIDEO_CALL_DEFAULT_MESSAGE;
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
