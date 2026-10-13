// Pedido de áudio personalizado da página /clientes: validação do formulário e mensagem do WhatsApp. Funções puras.
// Não há registro no servidor: o pedido chega pelo WhatsApp e quem grava o áudio controla internamente o que já foi feito
// (um áudio gratuito por cliente; o aviso ao cliente é só texto).

/** WhatsApp comercial que recebe o pedido: DDI 55 + DDD 31 + número, só dígitos (formato do wa.me). */
export const AUDIO_WHATSAPP_NUMBER = '5531997462823';
export const AUDIO_MESSAGE_MAX = 500;
export const AUDIO_MESSAGE_MIN = 5;
export const AUDIO_NAME_MAX = 60;
export const AUDIO_NOTICE = 'Atenção: cada cliente tem direito a um único áudio gratuito. Os áudios são gravados pelo próprio Herói da Cidade, no horário em que ele estiver no estúdio. A solicitação não significa que o áudio será gravado ou enviado imediatamente.';

const EARLIEST_DATE = '2020-01-01';

/** 'YYYY-MM-DD' que existe no calendário. */
export function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Texto do pedido: quebras de linha unificadas em \n, sem caracteres de controle, sem espaços nas pontas. */
export function cleanMessage(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .trim();
}

/**
 * Valida e normaliza o formulário. `todayKey` é a data de hoje (YYYY-MM-DD) no fuso de Brasília.
 * Devolve { ok: true, value } ou { ok: false, errors: { eventDate?, childName?, message?, accepted? } }.
 */
export function validateAudioRequest(input, todayKey) {
  const source = input && typeof input === 'object' ? input : {};
  const errors = {};
  const eventDate = typeof source.eventDate === 'string' ? source.eventDate.trim() : '';
  const childName = String(source.childName ?? '').replace(/\s+/g, ' ').trim();
  const message = cleanMessage(source.message);

  if (!isRealDate(eventDate)) errors.eventDate = 'Informe a data da festa.';
  else if (eventDate < EARLIEST_DATE) errors.eventDate = 'Informe a data em que o Herói da Cidade esteve na festa.';
  else if (eventDate > todayKey) errors.eventDate = 'A data da festa não pode ser no futuro.';

  if (childName.length < 2 || childName.length > AUDIO_NAME_MAX || !/^\p{L}[\p{L}\p{M}'’ .-]*$/u.test(childName)) {
    errors.childName = 'Informe o nome da criança (apenas letras).';
  }

  if (message.length < AUDIO_MESSAGE_MIN) errors.message = 'Conte o que o Herói da Cidade deve falar no áudio.';
  else if (message.length > AUDIO_MESSAGE_MAX) errors.message = `A mensagem pode ter até ${AUDIO_MESSAGE_MAX} caracteres.`;

  if (source.accepted !== true) errors.accepted = 'Marque que leu e concorda com as condições.';

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { eventDate, childName, message } };
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'. */
export const formatDateBr = (dateKey) => dateKey.split('-').reverse().join('/');

/** Mensagem que o cliente confirma dentro do WhatsApp. */
export function buildWhatsAppMessage({ eventDate, childName, message }) {
  return [
    'Olá! Gostaria de solicitar meu áudio personalizado do Herói da Cidade.',
    `Data do evento: ${formatDateBr(eventDate)}`,
    `Nome da criança: ${childName}`,
    'Mensagem desejada:',
    message,
  ].join('\n');
}

/** Link do WhatsApp com a mensagem já preenchida (acentos e quebras de linha codificados). */
export function buildWhatsAppUrl(fields) {
  return `https://wa.me/${AUDIO_WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(fields))}`;
}
