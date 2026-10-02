import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { addDays, dateKey, endOfDay, occurrenceDueAt, parseDateKey, weekdayOf } from './missions-core.js';

// Skill Alexa → missão. Autoriza (skill + usuário), valida e grava em `missions` com os mesmos campos do ManyChat.
// A verificação da assinatura da Amazon fica em api/alexa.ts (precisa do corpo bruto da requisição).

const MISSIONS = 'missions';
const DEFAULT_DIFFICULTY = 3; // mesmo padrão do formulário "Nova missão" do CRM; a voz não informa dificuldade.
const MAX_TITLE = 120;

const WEEKDAYS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DATE_WORD = '(depois de amanh[ãa]|amanh[ãa]|hoje|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?';
const LEAD = '(?:para|pra|at[ée]|na|no|em|d[aeo])';
const TRAILING = new RegExp(`(?:\\s+${LEAD})?\\s+${DATE_WORD}\\s*[.!?]?$`, 'i');
const LEADING = new RegExp(`^(?:${LEAD}\\s+)?${DATE_WORD}\\s*[,:]?\\s+`, 'i');

const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "hoje/amanhã/depois de amanhã/<dia da semana>" → YYYY-MM-DD (Brasília); dia da semana = próxima ocorrência futura. */
function resolveDateWord(word, today) {
  const w = plain(word);
  if (w === 'hoje') return today;
  if (w === 'amanha') return addDays(today, 1);
  if (w === 'depois de amanha') return addDays(today, 2);
  const diff = (WEEKDAYS[w] - weekdayOf(today) + 7) % 7;
  return addDays(today, diff === 0 ? 7 : diff);
}

/**
 * Quando o Alexa não preenche o slot de data, a expressão pode ter ficado dentro do texto da tarefa
 * ("pagar a conta amanhã"). Só reconhece palavras de data no começo ou no fim; nada é deduzido além disso.
 */
export function extractDueDate(text, today) {
  for (const pattern of [TRAILING, LEADING]) {
    const match = pattern.exec(text);
    if (match) return { title: text.replace(pattern, '').trim(), date: resolveDateWord(match[1], today) };
  }
  return { title: text.trim(), date: null };
}

const say = (text, { end = true, reprompt } = {}) => ({
  version: '1.0',
  response: {
    outputSpeech: { type: 'PlainText', text },
    ...(reprompt ? { reprompt: { outputSpeech: { type: 'PlainText', text: reprompt } } } : {}),
    shouldEndSession: end,
  },
});

const spokenDate = (key) => { const { day, month } = parseDateKey(key); return `${day} de ${MONTHS[month - 1]}`; };
const spokenTime = (time) => { const [h, m] = time.split(':'); return `${Number(h)}h${m === '00' ? '' : m}`; };
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const HOUR_WORDS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12 };
const HOUR = '(\\d{1,2}|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)';
const END = '(?=\\s|[.,!?]|$)';
// "às 15h", "às 15:30", "às 15 horas", "às 3 e meia da tarde", "às três da manhã". Só "às/à" (com acento), para não confundir com "as 3 propostas".
const CLOCK = new RegExp(`(?:^|\\s)[àÀ]s?\\s+${HOUR}(?:\\s*(?:h|horas?|:)\\s*(\\d{2})?)?(?:\\s+e\\s+(meia|\\d{1,2}))?(?:\\s+d[aeo]s?\\s+(manh[ãa]|tarde|noite|madrugada))?${END}`, 'i');
const NOON = new RegExp(`(?:^|\\s)(?:ao\\s+)?(meio[- ]dia|meia[- ]noite)${END}`, 'i');

/** Horário falado no texto → { title (sem o horário), time: 'HH:mm' | null | 'invalid' }. */
export function extractTime(text) {
  const noon = NOON.exec(text);
  if (noon) return { title: text.replace(NOON, ' ').replace(/\s+/g, ' ').trim(), time: /dia/i.test(noon[1]) ? '12:00' : '00:00' };
  const m = CLOCK.exec(text);
  if (!m) return { title: text.trim(), time: null };
  const [, hourText, minuteText, extra, period] = m;
  let hour = /^\d+$/.test(hourText) ? Number(hourText) : HOUR_WORDS[plain(hourText)];
  const minute = minuteText ? Number(minuteText) : extra === 'meia' ? 30 : extra ? Number(extra) : 0;
  if (/tarde|noite/i.test(period ?? '') && hour < 12) hour += 12;
  const title = text.replace(CLOCK, ' ').replace(/\s+/g, ' ').trim();
  if (hour > 23 || minute > 59) return { title, time: 'invalid' };
  return { title, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

/** Texto ditado → { title, dueKey, time } ou { ask } (pergunta de esclarecimento). Nada é inventado. */
export function interpretSlots(slots, now) {
  const today = dateKey(now);
  const value = (name) => (typeof slots?.[name]?.value === 'string' ? slots[name].value.trim() : '');
  const spoken = extractTime(value('tarefa'));
  if (spoken.time === 'invalid') return { ask: 'Não entendi o horário. Diga, por exemplo, às 15h ou às três da tarde.' };
  const time = spoken.time;
  let title = spoken.title;
  let dueKey = null;

  const rawDate = value('data');
  if (rawDate) {
    if (!parseDateKey(rawDate)) return { ask: 'Não entendi o dia. Diga uma data específica, como amanhã ou sexta-feira.' };
    dueKey = rawDate;
  } else {
    ({ title, date: dueKey } = extractDueDate(title, today));
  }
  // Horário sem dia: o próximo horário que chegar (hoje se ainda não passou, senão amanhã). A resposta falada informa o dia.
  if (time && !dueKey) dueKey = occurrenceDueAt(today, time) > now ? today : addDays(today, 1);

  if (!title) return { ask: 'O que você quer que eu lembre?', elicit: 'tarefa' };
  if (title.length > MAX_TITLE) return { ask: `A missão é longa demais. Resuma em até ${MAX_TITLE} caracteres.`, elicit: 'tarefa' };
  return { title: capitalize(title), dueKey, time };
}

/** Mesmo requestId (reenvio da Amazon) → mesmo documento → uma única missão. */
export const missionIdFor = (requestId) => `alexa_${createHash('sha256').update(requestId).digest('hex').slice(0, 32)}`;

const list = (value) => String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Processa o envelope JSON da Alexa e devolve o JSON de resposta. `config`: { skillId, allowedUserIds[] }.
 * Pressupõe assinatura e timestamp já verificados.
 */
export async function handleAlexaEnvelope(envelope, { database, config, now = new Date(), logger = console }) {
  const request = envelope?.request;
  const appId = envelope?.session?.application?.applicationId ?? envelope?.context?.System?.application?.applicationId;
  const userId = envelope?.session?.user?.userId ?? envelope?.context?.System?.user?.userId;
  if (!request || typeof request.type !== 'string') return say('Requisição inválida.');

  if (request.type === 'SessionEndedRequest') return { version: '1.0', response: {} };
  if (!config.skillId || appId !== config.skillId) return say('Esta skill não está autorizada.');

  const allowed = config.allowedUserIds;
  if (!userId || !allowed.includes(userId)) {
    logger.warn('[Alexa] Usuário não autorizado. Para liberar, adicione este userId em ALEXA_ALLOWED_USER_IDS:', userId);
    return say('Este dispositivo ainda não está autorizado a criar missões no Herói da Cidade.');
  }

  if (request.type === 'LaunchRequest') {
    return say('Herói da Cidade. Diga, por exemplo: me lembrar de gravar três vídeos amanhã.', { end: false, reprompt: 'O que você quer registrar como missão?' });
  }
  if (request.type !== 'IntentRequest') return say('Não consegui processar esse pedido.');

  const intent = request.intent?.name;
  if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent') return say('Certo.');
  if (intent === 'AMAZON.HelpIntent') {
    return say('Você pode dizer: me lembrar de pagar a conta amanhã, ou: adicionar tarefa preparar o roteiro.', { end: false, reprompt: 'O que você quer registrar?' });
  }
  if (intent !== 'CriarMissaoIntent') {
    return say('Não entendi. Diga, por exemplo: me lembrar de pagar a conta amanhã.', { end: false, reprompt: 'O que você quer registrar?' });
  }

  const result = interpretSlots(request.intent.slots, now);
  if (result.ask) {
    const out = say(result.ask, { end: false, reprompt: result.ask });
    if (result.elicit) out.response.directives = [{ type: 'Dialog.ElicitSlot', slotToElicit: result.elicit, updatedIntent: request.intent }];
    return out;
  }

  const dueAt = result.dueKey ? (result.time ? occurrenceDueAt(result.dueKey, result.time) : endOfDay(result.dueKey)) : null;
  if (!request.requestId) return say('Requisição inválida.');
  const ref = database.collection(MISSIONS).doc(missionIdFor(String(request.requestId)));
  try {
    await ref.create({
      title: result.title, description: '', difficulty: DEFAULT_DIFFICULTY, status: 'pending', source: 'alexa',
      ...(dueAt ? { dueAt: Timestamp.fromDate(dueAt) } : {}),
      createdAt: FieldValue.serverTimestamp(), createdDate: dateKey(now),
    });
  } catch (error) {
    if (error?.code !== 6 && error?.code !== 'already-exists') { // 6 = ALREADY_EXISTS: reenvio, a missão já foi criada
      logger.error('[Alexa] Falha ao criar missão.', { error: error instanceof Error ? error.message : String(error) });
      return say('Não consegui criar a missão agora. Tente novamente em instantes.');
    }
  }
  const when = result.dueKey ? ` para ${spokenDate(result.dueKey)}${result.time ? ` às ${spokenTime(result.time)}` : ''}` : ', sem prazo';
  return say(`Missão criada${when}: ${result.title}.`);
}

export const parseAllowedUsers = list;
