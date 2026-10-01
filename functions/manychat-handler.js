import { timingSafeEqual } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const CLIENTS = 'clients';
const ORDERS = 'orders';
const SERVICES = 'services';
const ANNIVERSARY_SERVICE_ID = '1';
const ANNIVERSARY_SERVICE_NAME = 'Vídeo Especial de Aniversário';

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
  const validationErrors = validateManyChatOrderInput(input);
  if (validationErrors.length) return jsonError(res, 400, 'validation_error', 'Revise os campos da requisição.', { details: validationErrors });

  const normalizedWhatsApp = normalizeWhatsApp(input.customer.whatsapp);
  const serviceRef = database.collection(SERVICES).doc(ANNIVERSARY_SERVICE_ID);
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

      const service = serviceSnapshot.data();
      const serviceName = service.title || service.name || '';
      const servicePrice = parseCatalogPrice(service.price);
      if (serviceName !== ANNIVERSARY_SERVICE_NAME || service.active !== true || service.category !== 'Pronta entrega' || service.generateOrder !== true || service.productionType !== 'immediate' || service.initialStatus !== 'completed' || service.autoComplete !== true || (service.defaultDeliveryDays !== undefined && service.defaultDeliveryDays !== null)) {
        return { problem: 'service_configuration_changed' };
      }
      if (servicePrice === null) return { problem: 'service_price_unavailable' };

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
        serviceId: ANNIVERSARY_SERVICE_ID,
        status: 'completed',
        paidAt,
        content: `Aniversariante: ${input.childName.trim()}`,
        servicePrice,
        rushFee: 0,
        totalPaid: servicePrice,
        productionType: 'immediate',
        source: 'manychat',
        technicalPurchaseId: orderRef.id,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: paidAt,
      };

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

    if (transactionResult.problem === 'service_not_found') return jsonError(res, 422, 'service_not_found', 'O serviço services/1 não existe.');
    if (transactionResult.problem === 'service_configuration_changed') return jsonError(res, 422, 'service_configuration_changed', 'Vídeo Especial de Aniversário não está com a configuração esperada de pronta entrega. Nenhum registro foi criado.');
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
