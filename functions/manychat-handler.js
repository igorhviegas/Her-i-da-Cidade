import { timingSafeEqual } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ACTIVITY_LOG_COLLECTION, GAMIFICATION_CONFIG_PATH, activityLogId, prepareActivityLog } from './activity-log.js';
import { MISSION_EVENT, createMissionFromManyChat, validateMissionPayload } from './missions-manychat.js';

const CLIENTS = 'clients';
const ORDERS = 'orders';
const SERVICES = 'services';
/** Reservas anti-duplicidade (só pedidos presenciais): uma por WhatsApp, gravadas na mesma transação do pedido. Acesso só pelo Admin SDK. */
const DEDUPE = 'manychatRequests';

function jsonError(res, status, code, message, extra = {}) {
  return res.status(status).json({ ok: false, error: { code, message }, ...extra });
}

function normalizeWhatsApp(value) {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  // Com "+" o número já vem completo, com o código do país: cliente internacional não recebe o 55 do Brasil.
  if (raw.startsWith('+')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Brasileiro com DDD (como sempre) ou internacional completo: "+" + código do país + número, 8 a 15 dígitos (E.164). */
function isValidWhatsApp(value) {
  const normalized = normalizeWhatsApp(value);
  if (!normalized) return false;
  if (/^55\d{10,11}$/.test(normalized)) return true;
  return String(value).trim().startsWith('+') && !normalized.startsWith('55') && /^[1-9]\d{7,14}$/.test(normalized);
}

function parseCatalogPrice(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^Apenas\s+R\$\s*(\d+(?:\.\d{3})*(?:,\d{1,2})?)$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/**
 * Chave do pré-agendamento de Vídeo Chamada. Número brasileiro: DDI + DDD + os 8 últimos dígitos (o número digitado no site e o que
 * o WhatsApp informa ao ManyChat podem diferir só pelo nono dígito; sem ele os dois caem na mesma chave). Internacional: o número inteiro.
 */
export const bookingKey = (normalizedWhatsApp) => (/^55\d{10,11}$/.test(normalizedWhatsApp) ? `${normalizedWhatsApp.slice(0, 4)}${normalizedWhatsApp.slice(-8)}` : normalizedWhatsApp);

export function validateManyChatOrderInput(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ['O corpo deve ser um objeto JSON.'];
  const acceptedKeys = new Set(['eventType', 'customer', 'childName']);
  const unexpectedKeys = Object.keys(body).filter((key) => !acceptedKeys.has(key));
  if (unexpectedKeys.length) errors.push(`Campos não aceitos nesta integração: ${unexpectedKeys.join(', ')}.`);
  if (body.eventType !== 'payment.paid') errors.push('eventType deve ser exatamente payment.paid.');
  if (!body.customer || typeof body.customer !== 'object' || Array.isArray(body.customer)) {
    errors.push('customer deve conter name e whatsapp.');
  } else {
    const unexpectedCustomerKeys = Object.keys(body.customer).filter((key) => !['name', 'whatsapp'].includes(key));
    if (unexpectedCustomerKeys.length) errors.push(`Campos não aceitos em customer: ${unexpectedCustomerKeys.join(', ')}.`);
    if (typeof body.customer.name !== 'string' || !body.customer.name.trim() || body.customer.name.trim().length > 120) errors.push('customer.name é obrigatório (até 120 caracteres).');
    if (!isValidWhatsApp(body.customer.whatsapp)) errors.push('customer.whatsapp deve ser um número brasileiro válido com DDD, ou internacional com "+" e o código do país.');
  }
  if (typeof body.childName !== 'string' || !body.childName.trim() || body.childName.trim().length > 100) errors.push('childName é obrigatório (até 100 caracteres).');
  return errors;
}


const VALID_STATUSES = ['scheduled', 'recording', 'editing', 'delivery', 'completed'];
const VALID_PRODUCTION_TYPES = ['scheduled', 'recording', 'editing', 'immediate'];
const DEFAULT_SERVICE = 'birthday-video';

const tiers = (price7, price4, price2) => ({
  '7_days': { days: 7, price: price7 },
  '4_days': { days: 4, price: price4 },
  '2_days': { days: 2, price: price2 },
});

/**
 * Serviços aceitos por este endpoint, identificados pelo campo opcional `service` do payload.
 * - pricing 'catalog': preço lido de services/{id} ("Apenas R$ …"); o payload não envia valor.
 * - pricing 'fixed': preço fixo definido aqui.
 * - pricing 'tiers': preço e prazo vêm da modalidade (`modality`); o payload não envia valor.
 * - pricing 'pending': pedido incompleto (evento presencial). Sem valores: o CRM os preenche depois pelo formulário de evento;
 *   nasce com eventDraft e nada é lançado no Financeiro. `dedupeMs` = janela em que o mesmo WhatsApp não gera outro pedido.
 * - fields: 'required' | 'optional' | ausente (campo não aceito para o serviço).
 * Status inicial, tipo de produção e prazo padrão vêm da configuração do serviço no CRM (Admin → Serviços);
 * a modalidade sobrepõe apenas o prazo.
 */
export const SERVICE_PROFILES = {
  'birthday-video': { serviceId: '1', title: 'Vídeo Especial de Aniversário', pricing: 'catalog', fields: { childName: 'required' } },
  'themed-video': { serviceId: '5', title: 'Vídeo Temático', pricing: 'catalog', fields: { childName: 'required', theme: 'required' } },
  'custom-video': { serviceId: '3', title: 'Vídeo Personalizado', pricing: 'tiers', tiers: tiers(60, 75, 85), fields: { childName: 'optional', details: 'optional', eventDate: 'optional' } },
  'invite-video': { serviceId: '4', title: 'Vídeo Convite', pricing: 'tiers', tiers: tiers(65, 80, 95), fields: { childName: 'optional', details: 'optional', eventDate: 'optional' } },
  'live-call': { serviceId: '2', title: 'Vídeo Chamada ao Vivo', pricing: 'fixed', price: 75, confirmsBooking: true, fields: { childName: 'optional', details: 'optional' } },
  'presential-event': { serviceId: '6', title: 'Serviços Presenciais', pricing: 'pending', dedupeMs: 10 * 60 * 1000, fields: {} },
};

const normalizeTitle = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Aceita YYYY-MM-DD ou data/hora ISO com fuso. Datas simples ficam às 12:00 de Brasília, como no cadastro manual. */
function parseEventDate(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let date;
  if (dateOnly) {
    const [, year, month, day] = dateOnly.map(Number);
    date = new Date(Date.UTC(year, month - 1, day, 15));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    date = new Date(text);
  } else {
    return null;
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Valida qualquer serviço do endpoint. Retorna { errors, profile }. Sem `service`, vale o contrato original do aniversário. */
export function validateManyChatPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: ['O corpo deve ser um objeto JSON.'], profile: null };
  if (body.service === undefined) return { errors: validateManyChatOrderInput(body), profile: SERVICE_PROFILES[DEFAULT_SERVICE] };
  const profile = typeof body.service === 'string' && Object.hasOwn(SERVICE_PROFILES, body.service) ? SERVICE_PROFILES[body.service] : null;
  if (!profile) return { errors: [`service deve ser um destes valores: ${Object.keys(SERVICE_PROFILES).join(', ')}.`], profile: null };

  const errors = [];
  const accepted = new Set(['eventType', 'service', 'customer', ...Object.keys(profile.fields), ...(profile.tiers ? ['modality'] : [])]);
  const unexpected = Object.keys(body).filter((key) => !accepted.has(key));
  if (unexpected.length) errors.push(`Campos não aceitos para ${body.service}: ${unexpected.join(', ')}.`);
  if (body.eventType !== 'payment.paid') errors.push('eventType deve ser exatamente payment.paid.');
  if (!body.customer || typeof body.customer !== 'object' || Array.isArray(body.customer)) {
    errors.push('customer deve conter name e whatsapp.');
  } else {
    const unexpectedCustomer = Object.keys(body.customer).filter((key) => !['name', 'whatsapp'].includes(key));
    if (unexpectedCustomer.length) errors.push(`Campos não aceitos em customer: ${unexpectedCustomer.join(', ')}.`);
    if (typeof body.customer.name !== 'string' || !body.customer.name.trim() || body.customer.name.trim().length > 120) errors.push('customer.name é obrigatório (até 120 caracteres).');
    if (!isValidWhatsApp(body.customer.whatsapp)) errors.push('customer.whatsapp deve ser um número brasileiro válido com DDD, ou internacional com "+" e o código do país.');
  }
  const textRules = { childName: 100, theme: 100, details: 1000 };
  for (const [field, limit] of Object.entries(textRules)) {
    const rule = profile.fields[field];
    if (!rule) continue;
    const value = body[field];
    const absent = value === undefined || value === null || (typeof value === 'string' && !value.trim());
    if (absent) { if (rule === 'required') errors.push(`${field} é obrigatório (até ${limit} caracteres).`); continue; }
    if (typeof value !== 'string' || value.trim().length > limit) errors.push(`${field} deve ser texto de até ${limit} caracteres.`);
  }
  if (profile.fields.eventDate) {
    const value = body.eventDate;
    const absent = value === undefined || value === null || value === '';
    if (!absent && !parseEventDate(value)) errors.push('eventDate deve ser YYYY-MM-DD ou data/hora ISO 8601 com fuso.');
  }
  if (profile.tiers && !(typeof body.modality === 'string' && Object.hasOwn(profile.tiers, body.modality))) {
    errors.push(`modality é obrigatório e deve ser um destes valores: ${Object.keys(profile.tiers).join(', ')}.`);
  }
  return { errors, profile };
}

/**
 * Status inicial do pedido: o configurado em Admin → Serviços. "Concluir automaticamente" só serve de
 * alternativa quando nenhum status inicial foi configurado. Espelha resolveInitialStatus de services/orderInitialStatus.js.
 */
export function resolveInitialStatus(service) {
  if (VALID_STATUSES.includes(service?.initialStatus)) return service.initialStatus;
  return service?.autoComplete === true ? 'completed' : null;
}

function calculateDeadlines(paidAt, deliveryDays) {
  const customerDueDate = new Date(paidAt);
  customerDueDate.setDate(customerDueDate.getDate() + deliveryDays);
  const internalDueDate = new Date(customerDueDate);
  internalDueDate.setDate(internalDueDate.getDate() - 1);
  return { customerDueDate, internalDueDate };
}

/** Confere se o serviço do CRM está configurado para gerar pedidos. Retorna { problem } ou { price, status, productionType, deliveryDays }. */
export function evaluateService(profile, service, modality) {
  const serviceName = service.title || service.name || '';
  const status = resolveInitialStatus(service);
  if (normalizeTitle(serviceName) !== normalizeTitle(profile.title) || service.active !== true || service.generateOrder !== true
    || !VALID_PRODUCTION_TYPES.includes(service.productionType) || !status) {
    return { problem: 'service_configuration_changed' };
  }
  let price;
  let days = service.defaultDeliveryDays;
  if (profile.pricing === 'pending') {
    // Evento presencial: não pode nascer concluído (a conclusão exige o cadastro do evento e a conferência de materiais no CRM).
    if (status === 'completed') return { problem: 'service_configuration_changed' };
    return { price: 0, status, productionType: service.productionType, deliveryDays: undefined };
  }
  if (profile.pricing === 'catalog') {
    price = parseCatalogPrice(service.price);
    if (price === null) return { problem: 'service_price_unavailable' };
  } else if (profile.pricing === 'fixed') {
    price = profile.price;
  } else {
    price = profile.tiers[modality].price;
    days = profile.tiers[modality].days; // o prazo contratado vale mais que o prazo padrão do serviço
  }
  return { price, status, productionType: service.productionType, deliveryDays: Number.isInteger(days) && days >= 0 ? days : undefined };
}

function buildOrderContent(input) {
  const lines = [];
  if (typeof input.childName === 'string' && input.childName.trim()) lines.push(`Aniversariante: ${input.childName.trim()}`);
  if (typeof input.theme === 'string' && input.theme.trim()) lines.push(`Tema: ${input.theme.trim()}`);
  if (typeof input.details === 'string' && input.details.trim()) lines.push(`Detalhes: ${input.details.trim()}`);
  return lines.join('\n') || 'Pedido recebido via ManyChat.';
}

function secretsMatch(providedHeader, expectedSecret) {
  if (typeof providedHeader !== 'string' || !providedHeader.startsWith('Bearer ') || !expectedSecret) return false;
  const supplied = Buffer.from(providedHeader.slice(7));
  const expected = Buffer.from(expectedSecret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function handleManyChatOrderRequest(req, res, { database, secret, logger: customLogger = console, onBookingConfirmed } = {}) {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') return jsonError(res, 405, 'method_not_allowed', 'Use POST.', { allowedMethods: ['POST'] });
  if (!req.is('application/json')) return jsonError(res, 415, 'unsupported_media_type', 'Envie application/json.');
  if (req.rawBody && req.rawBody.length > 256 * 1024) return jsonError(res, 413, 'payload_too_large', 'A requisição excede 256 KB.');
  if (!secretsMatch(req.get('authorization'), secret)) return jsonError(res, 401, 'unauthorized', 'Credencial ausente ou inválida.');

  const input = req.body;
  // Mesmo endpoint e segredo; evento distinto, sem tocar na validação de pedidos abaixo.
  if (input?.eventType === MISSION_EVENT) {
    const { errors, mission } = validateMissionPayload(input);
    if (errors.length) return jsonError(res, 400, 'validation_error', 'Revise os campos da requisição.', { details: errors });
    return createMissionFromManyChat(res, mission, { database, logger: customLogger || console });
  }
  const { errors: validationErrors, profile } = validateManyChatPayload(input);
  if (validationErrors.length) return jsonError(res, 400, 'validation_error', 'Revise os campos da requisição.', { details: validationErrors });

  const normalizedWhatsApp = normalizeWhatsApp(input.customer.whatsapp);
  const serviceRef = database.collection(SERVICES).doc(profile.serviceId);
  const whatsappIndexRef = database.collection(CLIENTS).doc(`whatsapp_${normalizedWhatsApp}`);
  const orderRef = database.collection(ORDERS).doc();
  const paidAt = Timestamp.now();

  let legacyClientRef = null;
  try {
    const currentIndex = await whatsappIndexRef.get();
    if (!currentIndex.exists) {
      const legacyMatches = await database.collection(CLIENTS)
        .where('whatsappNormalized', '==', normalizedWhatsApp)
        .limit(10)
        .get();
      const actualClients = legacyMatches.docs.filter((document) => document.get('recordType') !== 'whatsapp-index' && document.get('internalOnly') !== true);
      if (actualClients.length > 1) return jsonError(res, 409, 'ambiguous_client', 'Há mais de um cadastro legado com este WhatsApp; resolva a duplicidade manualmente.');
      if (actualClients.length === 1) legacyClientRef = actualClients[0].ref;
    }

    const transactionResult = await database.runTransaction(async (transaction) => {
      const [serviceSnapshot, indexSnapshot] = await Promise.all([
        transaction.get(serviceRef),
        transaction.get(whatsappIndexRef),
      ]);

      if (!serviceSnapshot.exists) return { problem: 'service_not_found' };

      const evaluation = evaluateService(profile, serviceSnapshot.data(), input.modality);
      if (evaluation.problem) return { problem: evaluation.problem };

      // Vídeo Chamada: se este WhatsApp tem um pré-agendamento do site aguardando pagamento, o pagamento o confirma (sem pedido novo).
      if (profile.confirmsBooking) {
        const pendingSnapshot = await transaction.get(database.collection('videoCallPending').doc(bookingKey(normalizedWhatsApp)));
        const bookedRef = pendingSnapshot.exists ? database.collection(ORDERS).doc(String(pendingSnapshot.get('orderId'))) : null;
        const bookedSnapshot = bookedRef ? await transaction.get(bookedRef) : null;
        if (bookedSnapshot?.exists && bookedSnapshot.get('paymentPending') === true) {
          // O valor cobrado é o que estava configurado quando a reserva foi feita (gravado no pedido).
          const bookedPrice = bookedSnapshot.get('servicePrice');
          const price = typeof bookedPrice === 'number' && bookedPrice >= 0 ? bookedPrice : evaluation.price;
          const confirmation = { paymentPending: FieldValue.delete(), paidAt, servicePrice: price, totalPaid: price, updatedAt: FieldValue.serverTimestamp() };
          if (evaluation.deliveryDays !== undefined) {
            const deadlines = calculateDeadlines(paidAt.toDate(), evaluation.deliveryDays);
            confirmation.deliveryDays = evaluation.deliveryDays;
            confirmation.customerDueDate = Timestamp.fromDate(deadlines.customerDueDate);
            confirmation.internalDueDate = Timestamp.fromDate(deadlines.internalDueDate);
          }
          transaction.update(bookedRef, confirmation);
          return { orderId: bookedRef.id, confirmedBooking: true };
        }
      }

      // Chamada repetida (reenvio do ManyChat, duplo clique): dentro da janela, devolve o pedido já criado em vez de criar outro.
      let dedupeRef = null;
      if (profile.dedupeMs) {
        dedupeRef = database.collection(DEDUPE).doc(`${profile.serviceId}_${normalizedWhatsApp}`);
        const previous = await transaction.get(dedupeRef);
        const previousOrderId = previous.exists ? previous.get('orderId') : null;
        const previousAt = previous.exists ? previous.get('createdAtMs') : null;
        if (typeof previousOrderId === 'string' && Number.isFinite(previousAt) && Date.now() - previousAt < profile.dedupeMs) {
          const previousOrder = await transaction.get(database.collection(ORDERS).doc(previousOrderId));
          if (previousOrder.exists) return { orderId: previousOrderId, duplicate: true };
        }
      }

      let clientRef = null;
      let shouldCreateClient = false;
      let shouldCreateIndex = false;
      if (indexSnapshot.exists) {
        const indexedClientId = indexSnapshot.get('clientId');
        if (typeof indexedClientId !== 'string' || !indexedClientId || indexedClientId.includes('/')) return { problem: 'invalid_client_index' };
        clientRef = database.collection(CLIENTS).doc(indexedClientId);
        const clientSnapshot = await transaction.get(clientRef);
        if (!clientSnapshot.exists) {
          shouldCreateClient = true;
          shouldCreateIndex = true;
        } else if (clientSnapshot.get('internalOnly') === true || clientSnapshot.get('whatsappNormalized') !== normalizedWhatsApp) {
          return { problem: 'invalid_client_index' };
        }
      } else if (legacyClientRef) {
        clientRef = legacyClientRef;
        const clientSnapshot = await transaction.get(clientRef);
        if (!clientSnapshot.exists) {
          shouldCreateClient = true;
          shouldCreateIndex = true;
        } else if (clientSnapshot.get('internalOnly') === true || clientSnapshot.get('whatsappNormalized') !== normalizedWhatsApp) {
          return { problem: 'invalid_client_index' };
        } else {
          shouldCreateIndex = true;
        }
      } else {
        clientRef = database.collection(CLIENTS).doc();
        shouldCreateClient = true;
        shouldCreateIndex = true;
      }

      const orderData = {
        clientId: clientRef.id,
        serviceId: profile.serviceId,
        status: evaluation.status,
        ...(profile.pricing === 'pending' ? { eventDraft: true } : { paidAt }),
        content: buildOrderContent(input),
        servicePrice: evaluation.price,
        rushFee: 0,
        totalPaid: evaluation.price,
        productionType: evaluation.productionType,
        source: 'manychat',
        technicalPurchaseId: orderRef.id,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (input.eventDate) orderData.eventDate = Timestamp.fromDate(parseEventDate(input.eventDate));
      if (evaluation.deliveryDays !== undefined) {
        const deadlines = calculateDeadlines(paidAt.toDate(), evaluation.deliveryDays);
        orderData.deliveryDays = evaluation.deliveryDays;
        orderData.customerDueDate = Timestamp.fromDate(deadlines.customerDueDate);
        orderData.internalDueDate = Timestamp.fromDate(deadlines.internalDueDate);
      }
      let activity = null;
      const logRef = database.collection(ACTIVITY_LOG_COLLECTION).doc(activityLogId('order_completed', orderRef.id));
      if (evaluation.status === 'completed') {
        orderData.completedAt = paidAt;
        // Pedido que já nasce concluído: registro permanente na mesma transação, com a dificuldade vigente.
        activity = await prepareActivityLog(transaction, { logRef, configRef: database.collection(GAMIFICATION_CONFIG_PATH[0]).doc(GAMIFICATION_CONFIG_PATH[1]) }, {
          type: 'order_completed', refId: orderRef.id, occurredAt: paidAt.toDate(), difficultyKey: `service_${profile.serviceId}`, meta: { serviceId: profile.serviceId },
        });
      }

      if (shouldCreateClient) {
        transaction.set(clientRef, {
          name: input.customer.name.trim(),
          whatsapp: String(input.customer.whatsapp).trim(),
          whatsappNormalized: normalizedWhatsApp,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (shouldCreateIndex) transaction.set(whatsappIndexRef, { clientId: clientRef.id, whatsappNormalized: normalizedWhatsApp, recordType: 'whatsapp-index' });
      transaction.set(orderRef, orderData);
      if (dedupeRef) transaction.set(dedupeRef, { orderId: orderRef.id, createdAtMs: Date.now(), whatsappNormalized: normalizedWhatsApp });
      if (activity) transaction.set(logRef, activity);
      return { orderId: orderRef.id };
    });

    if (transactionResult.problem === 'service_not_found') return jsonError(res, 422, 'service_not_found', `O serviço services/${profile.serviceId} não existe.`);
    if (transactionResult.problem === 'service_configuration_changed') return jsonError(res, 422, 'service_configuration_changed', `${profile.title} não está com a configuração esperada no CRM (ativo, gera pedido, tipo de produção e status inicial). Nenhum registro foi criado.`);
    if (transactionResult.problem === 'service_price_unavailable') return jsonError(res, 422, 'service_price_unavailable', 'O preço fixo cadastrado para o serviço não pôde ser interpretado. Nenhum registro foi criado.');
    if (transactionResult.problem === 'invalid_client_index') return jsonError(res, 409, 'invalid_client_index', 'O índice de WhatsApp existente é inválido; nenhum registro foi criado.');
    // Pré-agendamento confirmado: avisa quem chamou (ex.: marcar o evento da agenda como pago). Falha aqui não desfaz a confirmação.
    if (transactionResult.confirmedBooking && onBookingConfirmed) {
      try { await onBookingConfirmed(transactionResult.orderId); }
      catch (error) { (customLogger || console).error('Pagamento confirmado, mas o evento da agenda não foi atualizado.', { orderId: transactionResult.orderId, error: error instanceof Error ? error.message : String(error) }); }
    }
    return res.status(200).json({
      ok: true,
      orderId: transactionResult.orderId,
      technicalPurchaseId: transactionResult.orderId,
      ...(transactionResult.duplicate ? { duplicate: true } : {}),
      ...(transactionResult.confirmedBooking ? { confirmedBooking: true } : {}),
    });
  } catch (error) {
    const log = customLogger || console;
    log.error('Falha ao processar webhook ManyChat.', { orderId: orderRef.id, error: error instanceof Error ? error.message : String(error) });
    return jsonError(res, 500, 'internal_error', 'Não foi possível registrar a confirmação. Verifique o CRM antes de reenviar para evitar um pedido duplicado.');
  }
}
