// Pré-agendamento público de Vídeo Chamada. Só servidor (Admin SDK), fora de api/ pelo mesmo motivo de firebase-admin.js.
//
// Reutiliza: Google Agenda (list/create/update/deleteCalendarEvent), o serviço "Vídeo Chamada ao Vivo" do CRM (mesma validação do
// ManyChat via evaluateService) e os clientes por WhatsApp. Não há pagamento aqui: o pedido nasce com `paymentPending: true` e o
// ManyChat o confirma quando recebe payment.paid (ver manychat-handler.js). Sem pagamento no prazo, expireUnpaidBookings o exclui.
//
// Regras, valor e textos vêm de siteConfig/videoCall (ver video-call-config.js), editáveis em Admin → Agendamento de chamadas.
//
// Anti double-booking: um documento-trava por horário (videoCallSlots/{data_HHmm}) lido e gravado na MESMA transação do Firestore que
// cria o pedido. Duas reservas simultâneas do mesmo horário conflitam; a segunda reexecuta, vê a trava e é recusada.
// A trava só vale enquanto o pedido existe: excluir o pedido no CRM libera o horário sozinho (sem limpeza manual).

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { addDayKey, createCalendarEvent, deleteCalendarEvent, eventDateKey, eventTimes, listCalendarEvents, updateCalendarEvent } from './google-calendar.js';
import { SERVICE_PROFILES, evaluateService } from './manychat-handler.js';
import { DEFAULT_VIDEO_CALL_CONFIG, VIDEO_CALL_CONFIG_PATH, fillText, formatPrice, normalizeVideoCallConfig } from './video-call-config.js';

export const VIDEO_CALL_CONFIG = DEFAULT_VIDEO_CALL_CONFIG;
export const SLOTS = 'videoCallSlots';
/** Um pré-agendamento aberto por WhatsApp: freia spam no endpoint público e reserva repetida. */
export const PENDING = 'videoCallPending';
const ORDERS = 'orders';
const CLIENTS = 'clients';
const SERVICES = 'services';

export class VideoCallError extends Error {
  constructor(code, message) { super(message); this.name = 'VideoCallError'; this.code = code; }
}

/** Configuração salva pelo admin, completada com o padrão. */
export async function loadVideoCallConfig(database) {
  const snapshot = await database.collection(VIDEO_CALL_CONFIG_PATH[0]).doc(VIDEO_CALL_CONFIG_PATH[1]).get();
  return normalizeVideoCallConfig(snapshot.exists ? snapshot.data() : null);
}

/** O que a página pública precisa mostrar (textos já com valor, duração e prazo preenchidos). */
export const publicConfig = (config) => ({
  price: config.price, priceLabel: formatPrice(config.price), durationMinutes: config.durationMinutes, paymentDeadlineHours: config.paymentDeadlineHours,
  texts: { info: fillText(config.texts.info, config), confirm: fillText(config.texts.confirm, config) },
});

// ---------- horários (puro) ----------

// ponytail: o Brasil não tem horário de verão desde 2019, então o fuso é fixo; se voltar, derivar o deslocamento via Intl.
const slotInstant = (date, time) => Date.parse(`${date}T${time}:00-03:00`);
const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const slotId = (date, time) => `${date}_${time.replace(':', '')}`;

/** Horários que a regra permite agora: dias da semana configurados, antecedência mínima (data e hora) e máxima (por data). */
export function candidateSlots(nowMs, config = VIDEO_CALL_CONFIG) {
  const today = eventDateKey(new Date(nowMs));
  const slots = [];
  for (let i = 0; i <= config.maxAdvanceDays; i += 1) {
    const date = addDayKey(today, i);
    for (const time of config.weekly[weekdayOf(date)] ?? []) {
      if (slotInstant(date, time) - nowMs >= config.minNoticeHours * 3_600_000) slots.push({ date, time });
    }
  }
  return slots;
}

/** O horário [date, time) cruza algum evento com hora marcada? Eventos de dia inteiro e os marcados como "Livre" não bloqueiam. */
export function hasCalendarConflict(events, date, time, minutes = VIDEO_CALL_CONFIG.durationMinutes) {
  const start = `${date}T${time}`;
  const end = eventTimes(date, time, minutes).end.slice(0, 16);
  return events.some((event) => !event.allDay && !event.transparent && `${event.startKey}T${event.startTime}` < end && `${event.endKey}T${event.endTime}` > start);
}

/** Eventos da agenda do sistema + das agendas extras configuradas (só para conflito). Qualquer falha propaga: não oferecemos horário às cegas. */
async function busyEvents({ config, from, to, listEvents, ctx }) {
  const env = ctx.env ?? process.env;
  const lists = await Promise.all([null, ...config.busyCalendarIds].map((calendarId) => listEvents({
    from, to, ...ctx, ...(calendarId ? { env: { ...env, GOOGLE_CALENDAR_ID: calendarId } } : {}),
  })));
  return lists.flatMap((list) => list.events);
}

// ---------- disponibilidade ----------

/** IDs de horários com reserva viva (trava + pedido existente). Trava órfã (pedido excluído) não conta. */
async function heldSlotIds(database, fromMs) {
  const held = new Set();
  const snapshot = await database.collection(SLOTS).where('startsAtMs', '>=', fromMs).get();
  await Promise.all(snapshot.docs.map(async (document) => {
    const order = await database.collection(ORDERS).doc(String(document.get('orderId'))).get();
    if (order.exists) held.add(document.id);
  }));
  return held;
}

/** Horários livres: regra + agendas do Google + reservas do próprio sistema. Devolve também a configuração usada. */
export async function getAvailability({ database, nowMs = Date.now(), config, listEvents = listCalendarEvents, ctx = {} }) {
  const settings = config ?? await loadVideoCallConfig(database);
  const candidates = candidateSlots(nowMs, settings);
  if (!candidates.length) return { days: [], config: settings };
  const [events, held] = await Promise.all([
    busyEvents({ config: settings, from: candidates[0].date, to: candidates[candidates.length - 1].date, listEvents, ctx }),
    heldSlotIds(database, nowMs),
  ]);
  const days = new Map();
  for (const { date, time } of candidates) {
    if (held.has(slotId(date, time)) || hasCalendarConflict(events, date, time, settings.durationMinutes)) continue;
    days.set(date, [...(days.get(date) ?? []), time]);
  }
  return { days: [...days].map(([date, times]) => ({ date, times })), config: settings };
}

// ---------- reserva ----------

const normalizeWhatsApp = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  const full = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return /^55\d{10,11}$/.test(full) ? full : null;
};

const text = (value, max) => (typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null);

/** Valida o formulário (mesmos dados que o Calendly coletava). Retorna { form } ou { errors }. */
export function validateBookingInput(input) {
  const errors = [];
  const slot = input?.slot ?? {};
  const form = {
    name: text(input?.name, 120), whatsapp: normalizeWhatsApp(input?.whatsapp), childName: text(input?.childName, 100),
    childAge: text(input?.childAge, 20), theme: text(input?.theme, 200),
    details: input?.details == null || input.details === '' ? '' : text(input.details, 1000),
    date: typeof slot.date === 'string' ? slot.date : '', time: typeof slot.time === 'string' ? slot.time : '',
  };
  if (!form.name) errors.push('Informe o nome do responsável.');
  if (!form.whatsapp) errors.push('Informe um WhatsApp válido com DDD.');
  if (!form.childName) errors.push('Informe o nome da criança.');
  if (!form.childAge) errors.push('Informe a idade da criança.');
  if (!form.theme) errors.push('Informe o tema principal da ligação.');
  if (form.details === null) errors.push('Os detalhes devem ter até 1000 caracteres.');
  return errors.length ? { errors } : { form };
}

const brDate = (date) => date.split('-').reverse().join('/');

function orderContent(form) {
  return [
    `Vídeo Chamada: ${brDate(form.date)} às ${form.time}`,
    `Criança: ${form.childName} (${form.childAge})`,
    `Tema: ${form.theme}`,
    ...(form.details ? [`Detalhes: ${form.details}`] : []),
  ].join('\n');
}

/** Evento da agenda. O título diz se já foi paga, para a agenda bastar sem abrir o CRM. */
function eventInput({ date, time, durationMinutes, customerName, whatsapp, childName, childAge, theme, details, paid }) {
  const { end } = eventTimes(date, time, durationMinutes);
  return {
    title: `Vídeo Chamada (${paid ? 'paga' : 'aguardando pagamento'}): ${customerName} - ${childName}`,
    date, startTime: time, endTime: end.slice(11, 16),
    description: [
      `👤 Responsável: ${customerName}`, `📱 WhatsApp: ${whatsapp}`, `🧒 Criança: ${childName} (${childAge})`,
      `🎯 Tema: ${theme}`, `📝 Detalhes: ${details || '—'}`, '',
      paid ? 'Agendamento feito pelo site; pagamento confirmado.' : 'Pré-agendamento feito pelo site; pagamento ainda não confirmado.',
    ].join('\n'),
  };
}

/** Link do WhatsApp do negócio com a mensagem do agendamento (troca o texto do link base; %20 em vez de "+", como nos links de serviço). */
export function bookingWhatsAppUrl(baseUrl, message) {
  try {
    const url = new URL(String(baseUrl ?? '').trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.searchParams.delete('text');
    return `${url.toString()}${url.search ? '&' : '?'}text=${encodeURIComponent(message)}`;
  } catch {
    return null;
  }
}

/**
 * Reserva o horário: valida de novo (regra, Google, trava) → grava trava + pedido + cliente numa transação → cria o evento no Google.
 * Se o Google falhar, desfaz a reserva e propaga o erro (nunca devolve sucesso sem o evento). As dependências injetáveis existem para os testes.
 */
export async function createVideoCallBooking({ database, input, nowMs = Date.now(), config, listEvents = listCalendarEvents, createEvent = createCalendarEvent, ctx = {}, logger = console }) {
  const { form, errors } = validateBookingInput(input);
  if (errors) throw new VideoCallError('validation_error', errors[0]);
  const settings = config ?? await loadVideoCallConfig(database);
  const unavailable = () => new VideoCallError('slot_unavailable', 'Esse horário acabou de ser reservado ou não está mais disponível. Escolha outro.');
  if (!candidateSlots(nowMs, settings).some((slot) => slot.date === form.date && slot.time === form.time)) throw unavailable();

  const events = await busyEvents({ config: settings, from: form.date, to: form.date, listEvents, ctx });
  if (hasCalendarConflict(events, form.date, form.time, settings.durationMinutes)) throw unavailable();

  const profile = SERVICE_PROFILES[settings.profile];
  const serviceSnapshot = await database.collection(SERVICES).doc(profile.serviceId).get();
  const evaluation = serviceSnapshot.exists ? evaluateService(profile, serviceSnapshot.data()) : { problem: 'service_not_found' };
  // Um serviço que nasce concluído não serve para reserva: o pedido precisa ficar aberto até o pagamento.
  if (evaluation.problem || evaluation.status === 'completed') throw new VideoCallError('service_unavailable', 'O agendamento está indisponível no momento. Fale conosco pelo WhatsApp.');

  const id = slotId(form.date, form.time);
  const slotRef = database.collection(SLOTS).doc(id);
  const pendingRef = database.collection(PENDING).doc(form.whatsapp);
  const indexRef = database.collection(CLIENTS).doc(`whatsapp_${form.whatsapp}`);
  const orderRef = database.collection(ORDERS).doc();

  // Cliente legado (sem índice) é achado antes da transação, como no ManyChat. Mais de um: usa o primeiro (o fluxo público não trava).
  let legacyRef = null;
  if (!(await indexRef.get()).exists) {
    const matches = await database.collection(CLIENTS).where('whatsappNormalized', '==', form.whatsapp).limit(10).get();
    legacyRef = matches.docs.find((d) => d.get('recordType') !== 'whatsapp-index' && d.get('internalOnly') !== true)?.ref ?? null;
  }

  let customerName = form.name;
  await database.runTransaction(async (transaction) => {
    const [slotSnap, pendingSnap, indexSnap] = await Promise.all([transaction.get(slotRef), transaction.get(pendingRef), transaction.get(indexRef)]);
    const slotOrder = slotSnap.exists ? await transaction.get(database.collection(ORDERS).doc(String(slotSnap.get('orderId')))) : null;
    if (slotOrder?.exists) throw unavailable();
    const pendingOrder = pendingSnap.exists ? await transaction.get(database.collection(ORDERS).doc(String(pendingSnap.get('orderId')))) : null;
    if (pendingOrder?.exists && pendingOrder.get('paymentPending') === true) {
      throw new VideoCallError('already_pending', 'Você já tem uma vídeo chamada aguardando pagamento. Conclua o pagamento pelo WhatsApp ou fale conosco para alterar.');
    }

    const clientRef = indexSnap.exists ? database.collection(CLIENTS).doc(String(indexSnap.get('clientId'))) : legacyRef ?? database.collection(CLIENTS).doc();
    const clientSnap = await transaction.get(clientRef);
    if (clientSnap.exists) customerName = clientSnap.get('name') || form.name;
    else {
      transaction.set(clientRef, { name: form.name, whatsapp: input.whatsapp.trim(), whatsappNormalized: form.whatsapp, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    }
    if (!indexSnap.exists) transaction.set(indexRef, { clientId: clientRef.id, whatsappNormalized: form.whatsapp, recordType: 'whatsapp-index' });

    transaction.set(orderRef, {
      clientId: clientRef.id, serviceId: profile.serviceId, status: evaluation.status, paymentPending: true,
      content: orderContent(form), childName: form.childName,
      // Mesma convenção do ManyChat: a data fica ao meio-dia de Brasília; o horário exato está em videoCall.time.
      eventDate: Timestamp.fromDate(new Date(`${form.date}T12:00:00-03:00`)),
      videoCall: {
        date: form.date, time: form.time, durationMinutes: settings.durationMinutes, slotId: id, bookedAtMs: nowMs,
        whatsapp: form.whatsapp, childAge: form.childAge, theme: form.theme, details: form.details,
      },
      // O valor é o da configuração no momento da reserva; a confirmação do pagamento usa este valor.
      servicePrice: settings.price, rushFee: 0, totalPaid: 0, productionType: evaluation.productionType,
      source: 'booking', technicalPurchaseId: orderRef.id, createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(slotRef, { orderId: orderRef.id, startsAtMs: slotInstant(form.date, form.time), whatsappNormalized: form.whatsapp, createdAt: FieldValue.serverTimestamp() });
    transaction.set(pendingRef, { orderId: orderRef.id, slotId: id });
  });

  try {
    const event = await createEvent({ input: eventInput({ ...form, durationMinutes: settings.durationMinutes, customerName, paid: false }), ...ctx });
    try {
      await orderRef.update({ googleCalendar: { eventId: event.id, calendarId: String((ctx.env ?? process.env).GOOGLE_CALENDAR_ID ?? ''), htmlLink: event.htmlLink ?? null, syncedAt: FieldValue.serverTimestamp() } });
    } catch {
      logger.error('[VideoCall] evento criado, mas o vínculo não foi gravado no pedido.', { orderId: orderRef.id, eventId: event.id });
    }
  } catch (error) {
    // Sem evento no Google não há reserva: libera tudo e deixa o cliente tentar de novo.
    try { await database.runTransaction(async (t) => { t.delete(orderRef); t.delete(slotRef); t.delete(pendingRef); }); }
    catch { logger.error('[VideoCall] falha ao desfazer reserva sem evento.', { orderId: orderRef.id }); }
    throw error;
  }

  const message = fillText(settings.texts.whatsapp, settings, form);
  return { orderId: orderRef.id, date: form.date, time: form.time, whatsappUrl: bookingWhatsAppUrl(serviceSnapshot.get('whatsappUrl'), message) };
}

// ---------- depois da reserva ----------

/** Pagamento confirmado: troca o título/descrição do evento para "paga". Melhor esforço (o pedido já está confirmado no CRM). */
export async function markVideoCallEventPaid({ database, orderId, updateEvent = updateCalendarEvent, ctx = {} }) {
  const order = await database.collection(ORDERS).doc(String(orderId)).get();
  const call = order.exists ? order.get('videoCall') : null;
  const eventId = order.exists ? order.get('googleCalendar')?.eventId : null;
  if (!call || !eventId) return false;
  const client = await database.collection(CLIENTS).doc(String(order.get('clientId'))).get();
  await updateEvent({
    id: eventId, ...ctx,
    input: eventInput({ ...call, customerName: client.get('name') || 'Cliente', whatsapp: call.whatsapp ?? client.get('whatsappNormalized') ?? '', childName: order.get('childName'), paid: true }),
  });
  return true;
}

/**
 * Exclui pré-agendamentos que passaram do prazo de pagamento: pedido + trava (o horário volta a ficar livre) e o evento da agenda.
 * O pedido é conferido de novo dentro da transação, então um pagamento que chegue no mesmo instante vence e nada é apagado.
 * Devolve quantos foram excluídos.
 */
export async function expireUnpaidBookings({ database, nowMs = Date.now(), config, deleteEvent = deleteCalendarEvent, ctx = {}, logger = console }) {
  const settings = config ?? await loadVideoCallConfig(database);
  const snapshot = await database.collection(ORDERS).where('paymentPending', '==', true).get();
  let expired = 0;
  for (const document of snapshot.docs) {
    const call = document.get('videoCall');
    const bookedAtMs = call?.bookedAtMs ?? document.get('createdAt')?.toMillis?.();
    if (!call || !(nowMs - bookedAtMs >= settings.paymentDeadlineHours * 3_600_000)) continue;
    const removed = await database.runTransaction(async (transaction) => {
      const slotRef = database.collection(SLOTS).doc(String(call.slotId));
      const [fresh, slot] = await Promise.all([transaction.get(document.ref), transaction.get(slotRef)]);
      if (!fresh.exists || fresh.get('paymentPending') !== true) return false;
      const ownsSlot = slot.exists && slot.get('orderId') === document.id;
      const pendingRef = ownsSlot && slot.get('whatsappNormalized') ? database.collection(PENDING).doc(String(slot.get('whatsappNormalized'))) : null;
      const pending = pendingRef ? await transaction.get(pendingRef) : null;
      transaction.delete(document.ref);
      if (ownsSlot) transaction.delete(slotRef);
      if (pending?.exists && pending.get('orderId') === document.id) transaction.delete(pendingRef);
      return true;
    });
    if (!removed) continue;
    expired += 1;
    const eventId = document.get('googleCalendar')?.eventId;
    if (eventId) {
      try { await deleteEvent({ id: eventId, ...ctx }); }
      catch { logger.error('[VideoCall] reserva expirada excluída, mas o evento ficou na agenda.', { orderId: document.id, eventId }); }
    }
  }
  return expired;
}
