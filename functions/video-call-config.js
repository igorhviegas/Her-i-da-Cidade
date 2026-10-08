// Configuração do agendamento de Vídeo Chamada (pura: sem Firebase nem Node). Usada pelo servidor (functions/video-call.js) e pela
// tela Admin → Agendamento de chamadas → Configurações. Fica gravada em siteConfig/videoCall; o que faltar ou vier inválido cai no padrão.

export const VIDEO_CALL_CONFIG_PATH = ['siteConfig', 'videoCall'];

export const DEFAULT_VIDEO_CALL_CONFIG = {
  profile: 'live-call', // chave em SERVICE_PROFILES (serviço "Vídeo Chamada ao Vivo", id 2); não é editável pela tela
  price: 75,
  durationMinutes: 15,
  minNoticeHours: 24,
  maxAdvanceDays: 30,
  /** Prazo de pagamento informado ao cliente ({prazo} nos textos). */
  paymentDeadlineHours: 24,
  /** Quando o pré-agendamento sem pagamento é de fato excluído (pedido, evento e trava). Maior que o prazo informado: cobre o fim de semana, sem atendimento. */
  expireAfterHours: 72,
  /** Dia da semana (0 = domingo) → horários de início, no horário local da agenda (America/Sao_Paulo). */
  weekly: {
    1: ['19:30', '20:00', '20:30'],
    3: ['19:30', '20:00', '20:30'],
    6: ['09:30', '10:00', '10:30'],
  },
  /** Agendas extras só para checar conflito (ex.: a agenda pessoal, onde o Calendly gravava). Precisam estar compartilhadas com a conta de serviço. */
  busyCalendarIds: [],
  /** Aceitam **negrito** e as variáveis {valor} {duracao} {prazo}; a mensagem do WhatsApp aceita também {data} e {horario}. */
  texts: {
    info: [
      '⚠️ **A reserva só é garantida após o envio do comprovante de pagamento.**',
      '🕷️ Nossa **Vídeo Chamada Espetacular** tem duração de **até {duracao} minutos**, custa **{valor}** e é super interativa! 😊',
      '💬 Vocês podem nos enviar assuntos e detalhes para o **Homem-Aranha** falar durante a ligação!',
      '💳 Formas de pagamento: **Pix** ou **link de cartão de crédito**.',
      '📅 As chamadas acontecem sempre às **segundas e quartas à noite** e aos **sábados pela manhã**.',
    ].join('\n\n'),
    confirm: '⏳ Ao prosseguir com a **pré-reserva**, você terá **{prazo}h** para efetuar o pagamento no valor de **{valor}**, ou sua reserva será **excluída automaticamente** do sistema.',
    whatsapp: 'Olá, acabei de fazer a reserva no dia {data} às {horario} (horário de Brasília), gostaria de fazer o pagamento.',
    /** Aviso discreto abaixo do agendamento, na página /agendar-chamada. */
    security: 'Seus dados são usados só para o agendamento. O pagamento é combinado direto no nosso WhatsApp oficial; nunca pedimos senha ou dados de cartão por aqui.',
  },
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const number = (value, fallback, min, max) => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback);
const integer = (value, fallback, min, max) => (Number.isInteger(value) ? number(value, fallback, min, max) : fallback);
const text = (value, fallback, max) => (typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : fallback);

/** "19:30, 20:00" / ['20:00','19:30'] → horários válidos, únicos e em ordem. */
export function parseTimes(value) {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(/[\s,;]+/);
  return [...new Set(parts.map((part) => String(part).trim()).filter((part) => TIME.test(part)))].sort();
}

/** Junta o que está salvo com o padrão, campo a campo. Nunca lança: um valor inválido vira o padrão. */
export function normalizeVideoCallConfig(raw) {
  const d = DEFAULT_VIDEO_CALL_CONFIG;
  const source = raw && typeof raw === 'object' ? raw : {};
  let weekly = d.weekly;
  if (source.weekly && typeof source.weekly === 'object') {
    weekly = {};
    for (let day = 0; day <= 6; day += 1) {
      const times = parseTimes(source.weekly[day]);
      if (times.length) weekly[day] = times;
    }
  }
  const texts = source.texts && typeof source.texts === 'object' ? source.texts : {};
  const paymentDeadlineHours = integer(source.paymentDeadlineHours, d.paymentDeadlineHours, 1, 720);
  return {
    profile: d.profile,
    price: number(source.price, d.price, 0, 100000),
    durationMinutes: integer(source.durationMinutes, d.durationMinutes, 5, 240),
    minNoticeHours: integer(source.minNoticeHours, d.minNoticeHours, 0, 720),
    maxAdvanceDays: integer(source.maxAdvanceDays, d.maxAdvanceDays, 1, 365),
    paymentDeadlineHours,
    // nunca exclui antes do prazo prometido ao cliente
    expireAfterHours: Math.max(paymentDeadlineHours, integer(source.expireAfterHours, d.expireAfterHours, 1, 720)),
    weekly,
    busyCalendarIds: [...new Set((Array.isArray(source.busyCalendarIds) ? source.busyCalendarIds : []).map((id) => String(id).trim()).filter((id) => id && id.length <= 200))].slice(0, 5),
    texts: { info: text(texts.info, d.texts.info, 4000), confirm: text(texts.confirm, d.texts.confirm, 2000), whatsapp: text(texts.whatsapp, d.texts.whatsapp, 1000), security: text(texts.security, d.texts.security, 600) },
  };
}

export const formatPrice = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value).replace(/\u00a0/g, ' ');

/** Troca {valor} {duracao} {prazo} (e {data} {horario}, quando informados) no texto. Variável desconhecida fica como está. */
export function fillText(template, config, slot = {}) {
  const values = {
    valor: formatPrice(config.price), duracao: config.durationMinutes, prazo: config.paymentDeadlineHours,
    ...(slot.date ? { data: slot.date.split('-').reverse().join('/') } : {}), ...(slot.time ? { horario: slot.time } : {}),
  };
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}
