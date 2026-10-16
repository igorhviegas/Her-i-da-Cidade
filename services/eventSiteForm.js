// Formulário do evento presencial preenchido pelo cliente no site (/formulario-evento). Regras puras, usadas no navegador (aviso
// imediato) e no servidor (validação que vale). O telefone é normalizado de novo no servidor (functions/video-call.js#normalizePhone).

import { packageById } from './eventQuote.js';

export const FORM_PATH = '/formulario-evento';
/** Preços dos adicionais com desconto (só valem junto de um pacote presencial). */
export const ADDON_PRICES = { extraWeb: 15, birthdayVideo: 20, inviteVideo: 45 };
export const FORM_PREFIX = 'A';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidDate(value) {
  const match = DATE.exec(value ?? '');
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** CPF com dígitos verificadores válidos (aceita com ou sem pontuação). */
export function isValidCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length) => {
    const sum = [...digits.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    return ((sum * 10) % 11) % 10;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export const formatCpf = (value) => String(value ?? '').replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
export const formNumberLabel = (number) => `${FORM_PREFIX}${number}`;

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/**
 * Valida o envio. `today` = 'AAAA-MM-DD' de Brasília (data do evento não pode ser passada).
 * Retorna { form } (valores limpos) ou { errors, fields } (mensagens na ordem dos passos e o campo de cada uma).
 */
export function validateSiteForm(input, { today }) {
  const i = input && typeof input === 'object' ? input : {};
  const pack = packageById(i.packageId);
  const isVip = pack?.id === 'vip';
  const form = {
    packageId: pack?.id ?? '',
    childName: text(i.childName, 100), childAge: text(i.childAge, 20),
    pcd: i.pcd === 'yes' ? true : i.pcd === 'no' ? false : null, pcdDetails: text(i.pcdDetails, 300),
    eventDate: typeof i.eventDate === 'string' ? i.eventDate : '', eventTime: typeof i.eventTime === 'string' ? i.eventTime : '',
    location: text(i.location, 300), reference: text(i.reference, 200),
    responsibleName: text(i.responsibleName, 120), cpf: String(i.cpf ?? '').replace(/\D/g, ''), email: text(i.email, 254).toLowerCase(),
    ddi: String(i.ddi ?? '55').replace(/\D/g, '') || '55', whatsapp: text(i.whatsapp, 40),
    extraWeb: [0, 1, 2].includes(Number(i.extraWeb)) ? Number(i.extraWeb) : -1,
    birthdayVideo: i.birthdayVideo === true, birthdayName: text(i.birthdayName, 40),
    inviteVideo: i.inviteVideo === true, inviteDetails: text(i.inviteDetails, 500),
    observations: text(i.observations, 1000),
    imageAuthorization: i.imageAuthorization === 'yes' ? true : i.imageAuthorization === 'no' ? false : null,
    acceptTerms: i.acceptTerms === true,
    quoteId: typeof i.quoteId === 'string' && /^[A-Za-z0-9]{10,40}$/.test(i.quoteId) ? i.quoteId : '',
  };
  const errors = [];
  const fields = [];
  const add = (field, message) => { errors.push(message); fields.push(field); };
  if (!pack) add('packageId', 'Escolha o pacote do evento.');
  if (!form.childName) add('childName', isVip ? 'Informe o nome do evento ou da empresa.' : 'Informe o nome do aniversariante.');
  if (!isValidDate(form.eventDate)) add('eventDate', 'Informe a data do evento.');
  else if (today && form.eventDate < today) add('eventDate', 'A data do evento já passou.');
  if (!TIME.test(form.eventTime)) add('eventTime', 'Informe o horário de início.');
  if (form.location.length < 8) add('location', 'Informe o endereço completo do evento (rua, número, bairro e cidade).');
  if (form.responsibleName.length < 3) add('responsibleName', 'Informe o nome do responsável.');
  if (!isValidCpf(form.cpf)) add('cpf', 'Informe um CPF válido.');
  const phoneDigits = form.whatsapp.replace(/\D/g, '');
  if (phoneDigits.length < (form.ddi === '55' ? 10 : 6) || phoneDigits.length > 15) add('whatsapp', 'Informe um WhatsApp válido com DDD.');
  if (!EMAIL.test(form.email)) add('email', 'Informe um e-mail válido.');
  if (form.extraWeb < 0) add('extraWeb', 'Escolha a quantidade de teias extras.');
  if (form.birthdayVideo && !form.birthdayName) add('birthdayName', 'Informe o primeiro nome para o Vídeo Especial de Aniversário.');
  if (form.imageAuthorization === null) add('imageAuthorization', 'Responda se autoriza o uso de imagens.');
  if (!form.acceptTerms) add('acceptTerms', 'Para concluir, leia e aceite os termos de contratação.');
  return errors.length ? { errors, fields } : { form };
}

/** Soma dos adicionais escolhidos. */
export const addonsTotal = (form) => form.extraWeb * ADDON_PRICES.extraWeb + (form.birthdayVideo ? ADDON_PRICES.birthdayVideo : 0) + (form.inviteVideo ? ADDON_PRICES.inviteVideo : 0);

/** Endereço gravado no pedido (com o ponto de referência, se houver). */
export const fullLocation = (form) => (form.reference ? `${form.location} (ref.: ${form.reference})` : form.location);

/** Linhas de observação para o CRM e a agenda: o que o formulário do CRM não tem campo próprio. */
export function observationLines(form) {
  return [
    form.childAge && `Idade: ${form.childAge}`,
    form.pcd && form.pcdDetails && `PCD/PNE: ${form.pcdDetails}`,
    form.birthdayVideo && `Vídeo Especial de Aniversário: ${form.birthdayName} (+R$ ${ADDON_PRICES.birthdayVideo})`,
    form.inviteVideo && `Vídeo Convite (+R$ ${ADDON_PRICES.inviteVideo})${form.inviteDetails ? `: ${form.inviteDetails}` : ''}`,
    form.observations && `Cliente: ${form.observations}`,
  ].filter(Boolean);
}

const brDate = (key) => key.split('-').reverse().join('/');

/** Mensagem do botão do WhatsApp na tela final. */
export function whatsappDoneMessage({ number, packageId, eventDate, eventTime, childName }) {
  const pack = packageById(packageId);
  return `Olá! Preenchi o formulário ${formNumberLabel(number)} (${pack?.title ?? 'evento'} de ${childName}, ${brDate(eventDate)} às ${eventTime}). Aguardo os dados para o pagamento do sinal de 50% da reserva.`;
}
