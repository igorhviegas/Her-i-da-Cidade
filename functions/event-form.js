// Formulário do evento presencial pelo site + orçamento do Calendário. Só servidor (Admin SDK), fora de api/ como video-call.js.
//
// Envio do cliente: valida → numa transação do Firestore reserva o próximo número (counters/eventForm, começa em 214), cria/acha o
// cliente pelo WhatsApp e grava o pedido como rascunho de evento (`eventDraft`) aguardando o sinal (`paymentPending`). Depois cria o
// evento na agenda ("aguardando sinal") por melhor esforço: o formulário do cliente nunca se perde por falha do Google (o botão
// "Enviar para Google Agenda" do pedido refaz). Confirmação do sinal: pelo ManyChat (mesmo WhatsApp, eventFormPending) ou ao salvar
// o pedido em "Editar pedido" (o rascunho vira evento e a entrada é lançada, como nos rascunhos do ManyChat).
//
// Pacotes, preços dos adicionais, prazo do sinal e termos vêm de siteConfig/eventForm (editáveis no CRM; ver eventFormConfig.js).
//
// Sem sinal: depois do prazo do sinal aparece a missão de recontatar; o mesmo prazo depois de ela ser concluída, sem pagamento, o pedido
// e o evento são excluídos (syncEventFormHolds, rodada no cron diário das missões).

import { randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { calendarEventId, deleteCalendarEvent, eventDateKey, syncOrderToCalendar } from './google-calendar.js';
import { SERVICE_PROFILES, bookingKey, evaluateService } from './manychat-handler.js';
import { TravelRouteError, computeLegsMeters, geocodeAddress } from './travel-route.js';
import { bookingWhatsAppUrl, normalizePhone } from './video-call.js';
import { zonedInstant } from './video-call-time.js';
import { computeQuote, normalizeQuoteConfig, packageById } from '../services/eventQuote.js';
import { addonsTotal, childrenNames, formNumberLabel, fullLocation, observationLines, validateSiteForm, whatsappDoneMessage } from '../services/eventSiteForm.js';
import { FORM_CONFIG_PATH, normalizeFormConfig } from '../services/eventFormConfig.js';

export const FIRST_FORM_NUMBER = 215; // A214 já existe (último do Google Forms)
// Próximo número em siteConfig (o admin lê e corrige na aba Formulário, ex.: depois de apagar testes). Antes ficava em counters/eventForm.
export const COUNTER = ['siteConfig', 'eventFormCounter'];
const LEGACY_COUNTER = ['counters', 'eventForm'];
export const PENDING = 'eventFormPending';
export const QUOTES = 'eventQuotes';
export const QUOTE_CONFIG_PATH = ['siteConfig', 'eventQuote'];
export const DEPOSIT_MISSION_SOURCE = 'event_deposit';
export const depositMissionId = (orderId) => `evento-sinal-${orderId}`;
const DAY_MS = 86_400_000;
const QUOTE_TTL_DAYS = 30;

export class EventFormError extends Error {
  constructor(code, message) { super(message); this.name = 'EventFormError'; this.code = code; }
}

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const brDate = (key) => key.split('-').reverse().join('/');

// ---------- orçamento salvo → formulário pré-preenchido ----------

/** Orçamento do link (?orcamento=ID) para pré-preencher o formulário; null se não existe, venceu ou já virou formulário. */
export async function getQuotePrefill({ database, quoteId, nowMs = Date.now() }) {
  if (typeof quoteId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(quoteId)) return null;
  const snapshot = await database.collection(QUOTES).doc(quoteId).get();
  if (!snapshot.exists || snapshot.get('usedByOrderId') || nowMs - Number(snapshot.get('createdAtMs')) > QUOTE_TTL_DAYS * DAY_MS) return null;
  const quote = snapshot.data();
  return { quoteId, packageId: quote.packageId, date: quote.date, location: quote.location, total: quote.total };
}

/** Configuração do formulário salva no CRM, completada com o padrão. */
export async function loadFormConfig(database) {
  const snapshot = await database.collection(FORM_CONFIG_PATH[0]).doc(FORM_CONFIG_PATH[1]).get();
  return normalizeFormConfig(snapshot.exists ? snapshot.data() : null);
}

// ---------- envio do formulário ----------

function orderContent(form, number, quoteNote, config) {
  const pack = config.packages.find((p) => p.id === form.packageId);
  return [
    `Formulário: ${formNumberLabel(number)} · ${pack.title} (enviado pelo site)`,
    `Nome do aniversariante: ${childrenNames(form)}`,
    `Horário de início: ${form.eventTime}`,
    `Local: ${fullLocation(form)}`,
    `Responsável: ${form.responsibleName} · ${form.email}`,
    ...observationLines(form, config.addonPrices),
    ...(quoteNote ? [quoteNote] : []),
  ].join('\n');
}

/**
 * Grava o formulário enviado. Retorna o que a tela final precisa: número, link do WhatsApp com a mensagem e a data/hora do aceite.
 * As dependências injetáveis existem para os testes.
 */
export async function submitEventForm({ database, input, nowMs = Date.now(), syncCalendar = syncOrderToCalendar, ctx = {}, logger = console }) {
  const { form, errors } = validateSiteForm(input, { today: eventDateKey(new Date(nowMs)) });
  if (errors) throw new EventFormError('validation_error', errors[0]);
  const contact = normalizePhone(form.ddi, form.whatsapp);
  if (!contact) throw new EventFormError('validation_error', 'Informe um WhatsApp válido com DDD.');
  const config = await loadFormConfig(database);
  // O cliente aceitou o texto que a página mostrou: se os termos mudaram no meio do preenchimento, ele precisa ler a versão nova.
  if (String(input?.termsVersion ?? '') !== config.termsVersion) throw new EventFormError('terms_changed', 'Os termos de contratação foram atualizados. Recarregue a página e confira a versão nova antes de concluir.');

  const profile = SERVICE_PROFILES['presential-event'];
  const serviceSnapshot = await database.collection('services').doc(profile.serviceId).get();
  const evaluation = serviceSnapshot.exists ? evaluateService(profile, serviceSnapshot.data()) : { problem: 'service_not_found' };
  if (evaluation.problem) throw new EventFormError('service_unavailable', 'O formulário está indisponível no momento. Fale conosco pelo WhatsApp.');

  const counterRef = database.collection(COUNTER[0]).doc(COUNTER[1]);
  const legacyCounterRef = database.collection(LEGACY_COUNTER[0]).doc(LEGACY_COUNTER[1]);
  const pendingRef = database.collection(PENDING).doc(bookingKey(contact.e164));
  const indexRef = database.collection('clients').doc(`whatsapp_${contact.e164}`);
  const quoteRef = form.quoteId ? database.collection(QUOTES).doc(form.quoteId) : null;
  const orderRef = database.collection('orders').doc();

  // Cliente legado (sem índice) é achado antes da transação, como no ManyChat e na vídeo chamada.
  let legacyRef = null;
  if (!(await indexRef.get()).exists) {
    const matches = await database.collection('clients').where('whatsappNormalized', '==', contact.e164).limit(10).get();
    legacyRef = matches.docs.find((d) => d.get('recordType') !== 'whatsapp-index' && d.get('internalOnly') !== true)?.ref ?? null;
  }

  let number = FIRST_FORM_NUMBER;
  let customerName = form.responsibleName;
  let order = null;
  await database.runTransaction(async (transaction) => {
    const [counterSnap, legacySnap, pendingSnap, indexSnap, quoteSnap] = await Promise.all([
      transaction.get(counterRef), transaction.get(legacyCounterRef), transaction.get(pendingRef), transaction.get(indexRef), quoteRef ? transaction.get(quoteRef) : null,
    ]);
    const pendingOrder = pendingSnap.exists ? await transaction.get(database.collection('orders').doc(String(pendingSnap.get('orderId')))) : null;
    if (pendingOrder?.exists && pendingOrder.get('paymentPending') === true) {
      const previous = pendingOrder.get('eventFormSite')?.number;
      throw new EventFormError('already_pending', `Este WhatsApp já tem um formulário aguardando o sinal${previous ? ` (${formNumberLabel(previous)})` : ''}. Fale conosco pelo WhatsApp para alterar ou incluir outro evento.`);
    }
    // O valor salvo vale mesmo se for menor que o anterior (correção do dono); só nunca fica abaixo do primeiro número.
    const saved = counterSnap.exists ? counterSnap.get('next') : legacySnap.exists ? legacySnap.get('next') : 0;
    number = Math.max(FIRST_FORM_NUMBER, Math.trunc(Number(saved)) || 0);

    // Valor: só vem do orçamento quando pacote e data batem com o que foi orçado (senão o dono confere no CRM).
    const quote = quoteSnap?.exists && !quoteSnap.get('usedByOrderId') ? quoteSnap.data() : null;
    const quoteMatches = quote && quote.packageId === form.packageId && quote.date === form.eventDate;
    const total = quoteMatches ? money(quote.total + addonsTotal(form, config.addonPrices)) : 0;
    const quoteNote = quote && !quoteMatches ? `Atenção: pacote ou data diferente do orçamento (${packageById(quote.packageId)?.title ?? quote.packageId}, ${brDate(quote.date)}, ${quote.total}). Conferir o valor.` : quote ? null : 'Valor: conferir o orçamento enviado no WhatsApp.';

    const clientRef = indexSnap.exists ? database.collection('clients').doc(String(indexSnap.get('clientId'))) : legacyRef ?? database.collection('clients').doc();
    const clientSnap = await transaction.get(clientRef);
    if (clientSnap.exists) customerName = clientSnap.get('name') || form.responsibleName;
    else transaction.set(clientRef, { name: form.responsibleName, whatsapp: `+${contact.e164}`, whatsappNormalized: contact.e164, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    if (!indexSnap.exists) transaction.set(indexRef, { clientId: clientRef.id, whatsappNormalized: contact.e164, recordType: 'whatsapp-index' });

    const pack = config.packages.find((p) => p.id === form.packageId);
    const { quoteId: _quoteId, acceptTerms: _accepted, ...submittedForm } = form;
    order = {
      clientId: clientRef.id, serviceId: profile.serviceId, status: evaluation.status, eventDraft: true, paymentPending: true,
      content: orderContent(form, number, quoteNote, config), childName: childrenNames(form),
      eventDate: Timestamp.fromDate(new Date(zonedInstant(form.eventDate, '12:00'))),
      // Mesmo formato do formulário manual do CRM: "Editar pedido" abre tudo preenchido; salvar lá confirma o sinal.
      eventForm: {
        eventTime: form.eventTime, location: fullLocation(form), imageAuthorization: form.imageAuthorization, extraWeb: form.extraWeb,
        totalValue: total, entryValue: money(total / 2), cost: null, observations: [...observationLines(form, config.addonPrices), ...(quoteNote ? [quoteNote] : [])].join('\n'),
        formType: `${formNumberLabel(number)} · ${pack.title}`, birthDate: '', pcd: form.pcd,
      },
      eventFormSite: {
        number, packageId: form.packageId, submittedAtMs: nowMs, termsVersion: config.termsVersion, cpf: form.cpf, email: form.email,
        whatsapp: contact.e164, ddi: contact.ddi, phone: contact.phone,
        ...(form.extraChildren.length ? { extraChildren: form.extraChildren } : {}),
        videos: { birthday: form.birthdayVideo, birthdayName: form.birthdayName, invite: form.inviteVideo, inviteParents: form.inviteParents, inviteGuestTime: form.inviteGuestTime, inviteDetails: form.inviteDetails, childAge: form.childAge },
        ...(quote ? { quoteId: form.quoteId, quoteTotal: quote.total } : {}),
        // Envio completo + preços da época: o CRM gera o mesmo PDF que o cliente baixou (Detalhes do pedido → Baixar formulário).
        form: submittedForm, prices: config.addonPrices,
      },
      servicePrice: 0, rushFee: 0, totalPaid: 0, productionType: evaluation.productionType,
      source: 'event-form', technicalPurchaseId: orderRef.id, createdAt: FieldValue.serverTimestamp(),
    };
    transaction.set(orderRef, order);
    transaction.set(counterRef, { next: number + 1, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(pendingRef, { orderId: orderRef.id, number });
    if (quote) transaction.update(quoteRef, { usedByOrderId: orderRef.id });
  });

  try {
    const event = await syncCalendar({ orderId: orderRef.id, order: { ...order, eventDate: order.eventDate.toDate() }, client: { name: customerName, whatsapp: `+${contact.e164}`, whatsappNormalized: contact.e164 }, ...ctx });
    await orderRef.update({ googleCalendar: { eventId: event.eventId, calendarId: event.calendarId, htmlLink: event.htmlLink ?? null, syncedAt: FieldValue.serverTimestamp() } });
  } catch (error) {
    logger.error('[EventForm] pedido criado sem evento na agenda (usar "Enviar para Google Agenda").', { orderId: orderRef.id, code: error?.code });
  }

  const message = whatsappDoneMessage({ number, ...form, childName: childrenNames(form), packageTitle: config.packages.find((p) => p.id === form.packageId)?.title });
  return { number, label: formNumberLabel(number), acceptedAtMs: nowMs, termsVersion: config.termsVersion, total: order.eventForm.totalValue, whatsappUrl: bookingWhatsAppUrl(serviceSnapshot.get('whatsappUrl'), message) };
}

// ---------- depois do envio ----------

/** Sinal confirmado pelo ManyChat: reenvia o evento (sai o "aguardando sinal"). Melhor esforço; false se não é pedido do formulário. */
export async function markEventFormPaid({ database, orderId, syncCalendar = syncOrderToCalendar, ctx = {} }) {
  const snapshot = await database.collection('orders').doc(String(orderId)).get();
  if (!snapshot.exists || !snapshot.get('eventFormSite')) return false;
  const order = snapshot.data();
  const client = await database.collection('clients').doc(String(order.clientId)).get();
  await syncCalendar({ orderId: snapshot.id, order: { ...order, eventDate: order.eventDate?.toDate?.() ?? order.eventDate }, client: client.data(), ...ctx });
  return true;
}

/**
 * Rotina diária (cron das missões). Para cada formulário do site ainda sem sinal:
 * - prazo do sinal (depositDays) após o envio, cria a missão "Recontatar cliente" (uma por pedido);
 * - o mesmo prazo após essa missão ser concluída, ainda sem sinal: exclui pedido + trava do WhatsApp + evento da agenda.
 * Missões de pedidos que já foram pagos ou excluídos somem (não há mais o que cobrar). Devolve contagens.
 */
export async function syncEventFormHolds({ database, nowMs = Date.now(), deleteEvent = deleteCalendarEvent, ctx = {}, logger = console }) {
  const result = { reminders: 0, expired: 0, cleared: 0 };
  const { depositDays } = await loadFormConfig(database);
  const pending = await database.collection('orders').where('paymentPending', '==', true).get();
  const holdIds = new Set();
  for (const document of pending.docs) {
    const site = document.get('eventFormSite');
    if (!site) continue;
    holdIds.add(document.id);
    const missionRef = database.collection('missions').doc(depositMissionId(document.id));
    const mission = await missionRef.get();
    if (!mission.exists) {
      if (nowMs - site.submittedAtMs < depositDays * DAY_MS) continue;
      const when = eventDateKey(document.get('eventDate'));
      await missionRef.create({
        title: `Recontatar cliente: sinal do formulário ${formNumberLabel(site.number)}`,
        description: [`Evento: ${document.get('childName')}${when ? ` · ${brDate(when)}` : ''}`, `WhatsApp: +${site.whatsapp}`,
          `Sem sinal em ${depositDays} dias. Concluir esta missão depois de falar com o cliente: se ele não pagar em mais ${depositDays} dias, o pedido e o evento da agenda são excluídos.`].join('\n'),
        difficulty: 1, status: 'pending', source: DEPOSIT_MISSION_SOURCE, orderId: document.id,
        dueAt: Timestamp.fromMillis(nowMs), createdAt: Timestamp.fromMillis(nowMs),
      }).then(() => { result.reminders += 1; }, (error) => { if (!/ALREADY_EXISTS/.test(String(error?.message)) && error?.code !== 6) throw error; });
      continue;
    }
    const completedAt = mission.get('completedAt');
    const completedMs = completedAt?.toMillis?.() ?? (completedAt instanceof Date ? completedAt.getTime() : NaN);
    if (mission.get('status') !== 'completed' || !(nowMs - completedMs >= depositDays * DAY_MS)) continue;
    const pendingRef = database.collection(PENDING).doc(bookingKey(String(site.whatsapp)));
    const eventId = document.get('googleCalendar')?.eventId ?? calendarEventId(document.id);
    const removed = await database.runTransaction(async (transaction) => {
      const [fresh, lock] = await Promise.all([transaction.get(document.ref), transaction.get(pendingRef)]);
      if (!fresh.exists || fresh.get('paymentPending') !== true) return false; // pagamento no mesmo instante vence
      transaction.delete(document.ref);
      if (lock.exists && lock.get('orderId') === document.id) transaction.delete(pendingRef);
      return true;
    });
    if (!removed) continue;
    result.expired += 1;
    try { await deleteEvent({ id: eventId, ...ctx }); }
    catch (error) { if (error?.code !== 'event_not_found') logger.error('[EventForm] formulário expirado excluído, mas o evento ficou na agenda.', { orderId: document.id }); }
  }
  const missions = await database.collection('missions').where('source', '==', DEPOSIT_MISSION_SOURCE).where('status', '==', 'pending').get();
  for (const mission of missions.docs) {
    if (holdIds.has(String(mission.get('orderId')))) continue;
    await mission.ref.delete();
    result.cleared += 1;
  }
  return result;
}

// ---------- orçamento (admin) ----------

export async function loadQuoteConfig(database) {
  const snapshot = await database.collection(QUOTE_CONFIG_PATH[0]).doc(QUOTE_CONFIG_PATH[1]).get();
  return normalizeQuoteConfig(snapshot.exists ? snapshot.data() : null);
}

/** Endereço de partida do orçamento (casa do dono). Só servidor; nunca vai para o navegador. */
export const quoteOrigin = (env = process.env) => String(env.QUOTE_ORIGIN_ADDRESS || env.TRAVEL_STOP_ADDRESS || '').trim();

/**
 * Calcula o orçamento: geocodifica o endereço, mede a ida (casa → evento) na Routes API e aplica as regras salvas.
 * Devolve { quote, address: { formatted, precise, city } }. Erros do Google vêm como TravelRouteError.
 */
export async function calculateQuote({ database, input, env = process.env, fetchImpl = fetch }) {
  const apiKey = String(env.GOOGLE_MAPS_API_KEY ?? '').trim();
  const origin = quoteOrigin(env);
  if (!apiKey || !origin) throw new TravelRouteError('not_configured');
  const address = typeof input?.address === 'string' ? input.address.trim().slice(0, 300) : '';
  if (address.length < 5) throw new EventFormError('validation_error', 'Informe o endereço do evento.');
  const [home, place] = await Promise.all([
    geocodeAddress(origin, { apiKey, fetchImpl, label: 'partida' }),
    geocodeAddress(address, { apiKey, fetchImpl, label: 'evento' }),
  ]);
  const [meters] = await computeLegsMeters([home, place], { apiKey, fetchImpl });
  const config = await loadQuoteConfig(database);
  const quote = computeQuote({ packageId: input.packageId, km: meters / 1000, date: input.date, city: place.city, companyBase: input.companyBase }, config);
  if (quote.error) throw new EventFormError('validation_error', quote.error);
  return { quote, address: { formatted: place.formatted, precise: place.precise, city: place.city } };
}

/** Guarda o orçamento enviado e devolve o ID do link (?orcamento=ID). O valor pode ter sido ajustado à mão pelo dono. */
export async function saveQuote({ database, input, nowMs = Date.now() }) {
  const pack = packageById(input?.packageId);
  const total = Number(input?.total);
  const location = typeof input?.location === 'string' ? input.location.trim().slice(0, 300) : '';
  if (!pack || !/^\d{4}-\d{2}-\d{2}$/.test(input?.date ?? '') || !location || !(total > 0)) throw new EventFormError('validation_error', 'Orçamento incompleto: pacote, data, endereço e valor.');
  const id = randomBytes(12).toString('hex');
  await database.collection(QUOTES).doc(id).create({
    packageId: pack.id, date: input.date, location, total: money(total), km: Number(input.km) || 0, city: String(input.city ?? '').slice(0, 80),
    createdAtMs: nowMs, createdAt: FieldValue.serverTimestamp(),
  });
  return { id };
}
