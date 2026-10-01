import { timingSafeEqual } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const CLIENTS = 'clients';
const ORDERS = 'orders';
const SERVICES = 'services';

function jsonError(res, status, code, message, extra = {}) {
  return res.status(status).json({ ok: false, error: { code, message }, ...extra });
}

function normalizeWhatsApp(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function parseCatalogPrice(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^Apenas\s+R\$\s*(\d+(?:\.\d{3})*(?:,\d{1,2})?)$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

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
    const normalized = normalizeWhatsApp(body.customer.whatsapp);
    if (!normalized || !/^55\d{10,11}$/.test(normalized)) errors.push('customer.whatsapp deve ser um número brasileiro válido com DDD.');
  }
  if (typeof body.childName !== 'string' || !body.childName.trim() || body.childName.trim().length > 100) errors.push('childName é obrigatório (até 100 caracteres).');
  return errors;
}


const VALID_STATUSES = ['scheduled', 'recording', 'editing', 'delivery', 'completed'];
const VALID_PRODUCTION_TYPES = ['scheduled', 'recording', 'editing', 'immediate'];
const DEFAULT_SERVICE = 'birthday-video';
const MAX_AMOUNT = 10000;

/**
 * Serviços aceitos por este endpoint, identificados pelo campo opcional `service` do payload.
 * - pricing 'catalog': preço fixo lido de services/{id}; o payload não pode enviar valor.
 * - pricing 'payload': preço variável no catálogo ("A partir de…"); o valor pago vem em `amountPaid`.
 * - fields: 'required' | 'optional' | ausente (campo não aceito para o serviço).
 * - directDelivery: serviço digital que nasce em "Entregar" (espelha initialStatusFor do frontend).
 * Status, tipo de produção e prazo padrão dos serviços novos vêm da configuração do serviço no CRM.
 */
export const SERVICE_PROFILES = {
  'birthday-video': { serviceId: '1', title: 'Vídeo Especial de Aniversário', pricing: 'catalog', legacy: true, directDelivery: true, fields: { childName: 'required' } },
  'themed-video': { serviceId: '5', title: 'Vídeo Temático', pricing: 'catalog', directDelivery: true, fields: { childName: 'required' } },
  'custom-video': { serviceId: '3', title: 'Vídeo Personalizado', pricing: 'payload', fields: { childName: 'optional', details: 'optional', eventDate: 'optional' } },
  'invite-video': { serviceId: '4', title: 'Vídeo Convite', pricing: 'payload', fields: { childName: 'optional', details: 'optional', eventDate: 'optional' } },
  'live-call': { serviceId: '2', title: 'Vídeo Chamada ao Vivo', pricing: 'payload', fields: { childName: 'optional', details: 'optional', eventDate: 'required' } },
};

const normalizeTitle = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  if (typeof value !== 'string' || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  return Math.round(Number(value.trim().replace(',', '.')) * 100) / 100;
}

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
  const accepted = new Set(['eventType', 'service', 'customer', ...Object.keys(profile.fields), ...(profile.pricing === 'payload' ? ['amountPaid'] : [])]);
  const unexpected = Object.keys(body).filter((key) => !accepted.has(key));
  if (unexpected.length) errors.push(`Campos não aceitos para ${body.service}: ${unexpected.join(', ')}.`);
  if (body.eventType !== 'payment.paid') errors.push('eventType deve ser exatamente payment.paid.');
  if (!body.customer || typeof body.customer !== 'object' || Array.isArray(body.customer)) {
    errors.push('customer deve conter name e whatsapp.');
  } else {
    const unexpectedCustomer = Object.keys(body.customer).filter((key) => !['name', 'whatsapp'].includes(key));
    if (unexpectedCustomer.length) errors.push(`Campos não aceitos em customer: ${unexpectedCustomer.join(', ')}.`);
    if (typeof body.customer.name !== 'string' || !body.customer.name.trim() || body.customer.name.trim().length > 120) errors.push('customer.name é obrigatório (até 120 caracteres).');
    const normalized = normalizeWhatsApp(body.customer.whatsapp);
    if (!normalized || !/^55\d{10,11}$/.test(normalized)) errors.push('customer.whatsapp deve ser um número brasileiro válido com DDD.');
  }
  const textRules = { childName: 100, details: 1000 };
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
    if (absent) { if (profile.fields.eventDate === 'required') errors.push('eventDate é obrigatório (YYYY-MM-DD ou data/hora ISO 8601 com fuso).'); }
    else if (!parseEventDate(value)) errors.push('eventDate deve ser YYYY-MM-DD ou data/hora ISO 8601 com fuso.');
  }
  if (profile.pricing === 'payload') {
    const amount = parseAmount(body.amountPaid);
    if (amount === null || amount <= 0 || amount > MAX_AMOUNT) errors.push(`amountPaid é obrigatório: valor pago em reais, maior que 0 e até ${MAX_AMOUNT} (ex.: 75 ou "75,50").`);
  }
  return { errors, profile };
}

/** Status inicial como no cadastro manual: serviços digitais vão direto para Entregar; os demais seguem a configuração do serviço. */
function resolveInitialStatus(profile, service) {
  if (profile.directDelivery) return 'delivery';
  const status = service.autoComplete === true || service.initialStatus === 'completed' ? 'completed' : service.initialStatus;
  return VALID_STATUSES.includes(status) ? status : null;
}

function calculateDeadlines(paidAt, deliveryDays) {
  const customerDueDate = new Date(paidAt);
  customerDueDate.setDate(customerDueDate.getDate() + deliveryDays);
  const internalDueDate = new Date(customerDueDate);
  internalDueDate.setDate(internalDueDate.getDate() - 1);
  return { customerDueDate, internalDueDate };
}

/** Confere se o serviço do CRM está configurado para gerar pedidos. Retorna { problem } ou { price, status, productionType }. */
function evaluateService(profile, service) {
  const serviceName = service.title || service.name || '';
  if (profile.legacy) {
    const servicePrice = parseCatalogPrice(service.price);
    if (serviceName !== profile.title || service.active !== true || service.category !== 'Pronta entrega' || service.generateOrder !== true || service.productionType !== 'immediate' || service.initialStatus !== 'completed' || service.autoComplete !== true || (service.defaultDeliveryDays !== undefined && service.defaultDeliveryDays !== null)) {
      return { problem: 'service_configuration_changed' };
    }
    if (servicePrice === null) return { problem: 'service_price_unavailable' };
    return { price: servicePrice, status: 'delivery', productionType: 'immediate' };
  }
  const status = resolveInitialStatus(profile, service);
  if (normalizeTitle(serviceName) !== normalizeTitle(profile.title) || service.active !== true || service.generateOrder !== true
    || !VALID_PRODUCTION_TYPES.includes(service.productionType) || !status) {
    return { problem: 'service_configuration_changed' };
  }
  let price = null;
  if (profile.pricing === 'catalog') {
    price = parseCatalogPrice(service.price);
    if (price === null) return { problem: 'service_price_unavailable' };
  }
  const days = service.defaultDeliveryDays;
  return { price, status, productionType: service.productionType, deliveryDays: Number.isInteger(days) && days >= 0 ? days : undefined };
}

function buildOrderContent(input) {
  const lines = [];
  if (typeof input.childName === 'string' && input.childName.trim()) lines.push(`Aniversariante: ${input.childName.trim()}`);
  if (typeof input.details === 'string' && input.details.trim()) lines.push(`Detalhes: ${input.details.trim()}`);
  return lines.join('\n') || 'Pedido recebido via ManyChat.';
}

function secretsMatch(providedHeader, expectedSecret) {
  if (typeof providedHeader !== 'string' || !providedHeader.startsWith('Bearer ') || !expectedSecret) return false;
  const supplied = Buffer.from(providedHeader.slice(7));
  const expected = Buffer.from(expectedSecret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function handleManyChatOrderRequest(req, res, { database, secret, logger: customLogger = console } = {}) {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') return jsonError(res, 405, 'method_not_allowed', 'Use POST.', { allowedMethods: ['POST'] });
  if (!req.is('application/json')) return jsonError(res, 415, 'unsupported_media_type', 'Envie application/json.');
  if (req.rawBody && req.rawBody.length > 256 * 1024) return jsonError(res, 413, 'payload_too_large', 'A requisição excede 256 KB.');
  if (!secretsMatch(req.get('authorization'), secret)) return jsonError(res, 401, 'unauthorized', 'Credencial ausente ou inválida.');

  const input = req.body;
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

      const evaluation = evaluateService(profile, serviceSnapshot.data());
      if (evaluation.problem) return { problem: evaluation.problem };
      const servicePrice = profile.pricing === 'payload' ? parseAmount(input.amountPaid) : evaluation.price;

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
        paidAt,
        content: profile.legacy ? `Aniversariante: ${input.childName.trim()}` : buildOrderContent(input),
        servicePrice,
        rushFee: 0,
        totalPaid: servicePrice,
        productionType: evaluation.productionType,
        source: 'manychat',
        technicalPurchaseId: orderRef.id,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (!profile.legacy) {
        if (input.eventDate) orderData.eventDate = Timestamp.fromDate(parseEventDate(input.eventDate));
        if (evaluation.deliveryDays !== undefined) {
          const deadlines = calculateDeadlines(paidAt.toDate(), evaluation.deliveryDays);
          orderData.deliveryDays = evaluation.deliveryDays;
          orderData.customerDueDate = Timestamp.fromDate(deadlines.customerDueDate);
          orderData.internalDueDate = Timestamp.fromDate(deadlines.internalDueDate);
        }
        if (evaluation.status === 'completed') orderData.completedAt = paidAt;
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
      return { orderId: orderRef.id, technicalPurchaseId: orderRef.id };
    });

    if (transactionResult.problem === 'service_not_found') return jsonError(res, 422, 'service_not_found', `O serviço services/${profile.serviceId} não existe.`);
    if (transactionResult.problem === 'service_configuration_changed') return jsonError(res, 422, 'service_configuration_changed', `${profile.title} não está com a configuração esperada no CRM (ativo, gera pedido, tipo de produção e status inicial). Nenhum registro foi criado.`);
    if (transactionResult.problem === 'service_price_unavailable') return jsonError(res, 422, 'service_price_unavailable', 'O preço fixo cadastrado para o serviço não pôde ser interpretado. Nenhum registro foi criado.');
    if (transactionResult.problem === 'invalid_client_index') return jsonError(res, 409, 'invalid_client_index', 'O índice de WhatsApp existente é inválido; nenhum registro foi criado.');
    return res.status(200).json({
      ok: true,
      orderId: transactionResult.orderId,
      technicalPurchaseId: transactionResult.technicalPurchaseId,
    });
  } catch (error) {
    const log = customLogger || console;
    log.error('Falha ao processar webhook ManyChat.', { orderId: orderRef.id, error: error instanceof Error ? error.message : String(error) });
    return jsonError(res, 500, 'internal_error', 'Não foi possível registrar a confirmação. Verifique o CRM antes de reenviar para evitar um pedido duplicado.');
  }
}
