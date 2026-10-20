import { logger } from '../lib/logger.js';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CONFIG_PATH, PARTNERS, PAYOUTS, normalizeCouponCode, normalizeInstagram, payoutId, quotaLimits } from './collab.js';
import type { CollabGrant, CollabPartner, CollabPayout } from './collab.js';
import { createClient, normalizeWhatsApp } from './clientsService';
import { createOrder, listOrders } from './ordersService';
import { getServiceById } from './servicesService';
import { resolveInitialStatus } from './orderInitialStatus.js';
import type { Order } from '../types';

/** Mamães em Collab no CRM (regras em firestore.rules › collabPartners/collabPayouts; limites em siteConfig/collab). */

function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}

function fail(operation: string, error: unknown): never {
  logger.error(`[collabService] Falha na operação: ${operation}`, { error });
  // Sem permissão aqui = regras do Firestore das Collabs ainda não publicadas (ou login sem acesso de administrador).
  if (error instanceof Error && /permission|PERMISSION/.test(error.message)) throw new Error(`Sem permissão para ${operation}. Confira se as regras do Firestore (firestore.rules) estão publicadas.`);
  throw error instanceof Error && error.message ? error : new Error(`Não foi possível ${operation}. Verifique a conexão e tente de novo.`);
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');

function mapPartner(id: string, data: Record<string, unknown>): CollabPartner {
  return {
    id,
    name: str(data.name), instagram: str(data.instagram), whatsapp: str(data.whatsapp), whatsappNormalized: str(data.whatsappNormalized), city: str(data.city),
    children: Array.isArray(data.children) ? data.children as CollabPartner['children'] : [], contentType: str(data.contentType),
    status: (str(data.status) || 'prospect') as CollabPartner['status'], criteria: (data.criteria ?? {}) as CollabPartner['criteria'],
    publicationModel: (str(data.publicationModel) || '') as CollabPartner['publicationModel'], theme: str(data.theme), briefingUrl: str(data.briefingUrl),
    conditionsAt: str(data.conditionsAt), reelStatus: str(data.reelStatus) as CollabPartner['reelStatus'], reelUrl: str(data.reelUrl),
    reelPublishedAt: str(data.reelPublishedAt), storiesAt: str(data.storiesAt), couponCode: str(data.couponCode),
    grants: Array.isArray(data.grants) ? data.grants as CollabGrant[] : [], notes: str(data.notes),
    terms: (data.terms ?? null) as CollabPartner['terms'], source: data.source === 'form' ? 'form' : 'manual', formAtMs: typeof data.formAtMs === 'number' ? data.formAtMs : null,
  };
}

export type PartnerInput = Omit<CollabPartner, 'id' | 'grants' | 'terms' | 'source' | 'formAtMs' | 'whatsappNormalized'>;

/** Campos editáveis já limpos: código e @ normalizados, WhatsApp também na forma do wa.me. */
function cleanPartner(input: PartnerInput) {
  const name = input.name.trim();
  if (!name) throw new Error('Informe o nome da criadora.');
  const whatsapp = input.whatsapp.trim();
  let whatsappNormalized = '';
  if (whatsapp) {
    try { whatsappNormalized = normalizeWhatsApp(whatsapp); } catch { throw new Error('Confira o WhatsApp (com DDD).'); }
  }
  return {
    ...input, name, whatsapp, whatsappNormalized, instagram: normalizeInstagram(input.instagram), couponCode: normalizeCouponCode(input.couponCode),
    city: input.city.trim(), contentType: input.contentType.trim(), theme: input.theme.trim(), briefingUrl: input.briefingUrl.trim(), reelUrl: input.reelUrl.trim(),
    notes: input.notes.trim(), children: input.children.map((c) => ({ name: c.name.trim(), age: c.age.trim() })).filter((c) => c.name || c.age),
  };
}

// ponytail: lê a coleção inteira (dezenas de parceiras); paginar se passar de alguns milhares.
export async function listPartners(): Promise<CollabPartner[]> {
  try {
    const snapshot = await getDocs(collection(firestore(), PARTNERS));
    return snapshot.docs.map((item) => mapPartner(item.id, item.data())).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } catch (error) {
    return fail('listar parceiras', error);
  }
}

export async function savePartner(id: string | null, input: PartnerInput): Promise<CollabPartner> {
  const clean = cleanPartner(input);
  const reference = id ? doc(firestore(), PARTNERS, id) : doc(collection(firestore(), PARTNERS));
  try {
    if (id) await updateDoc(reference, { ...clean, updatedAt: serverTimestamp() });
    else await setDoc(reference, { ...clean, grants: [], terms: null, source: 'manual', formAtMs: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (error) {
    return fail('salvar parceira', error);
  }
  const saved = await getDoc(reference);
  return mapPartner(reference.id, saved.data() ?? {});
}

/** Exclui a ficha (ex.: pedido da criadora). Pedidos e comissões já gravados ficam como estão. */
export async function deletePartner(id: string): Promise<void> {
  try { await deleteDoc(doc(firestore(), PARTNERS, id)); } catch (error) { fail('excluir parceira', error); }
}

/** Pedidos com cupom ou de benefício (o painel cruza com as parceiras). */
// ponytail: reaproveita listOrders (coleção inteira, como Clientes e Financeiro); filtrar no Firestore se ficar lento.
export async function listCollabOrders(): Promise<Order[]> {
  return (await listOrders()).filter((order) => order.collab || order.collabGrant);
}

export async function loadLimits(): Promise<Record<string, number>> {
  const snapshot = await getDoc(doc(firestore(), CONFIG_PATH[0], CONFIG_PATH[1]));
  return quotaLimits(snapshot.exists() ? snapshot.data() : null);
}

export async function saveLimits(limits: Record<string, number>): Promise<void> {
  try { await setDoc(doc(firestore(), CONFIG_PATH[0], CONFIG_PATH[1]), { limits, updatedAt: serverTimestamp() }, { merge: true }); } catch (error) { fail('salvar vagas', error); }
}

/**
 * Concede um serviço: abre um pedido sem valor para a criadora (cliente achado ou criado pelo WhatsApp), que segue pelo Kanban como
 * qualquer pedido, e registra a vaga na ficha.
 */
export async function grantService(partner: CollabPartner, serviceId: string): Promise<CollabGrant> {
  if (!partner.whatsapp) throw new Error('Cadastre o WhatsApp da criadora antes de conceder o serviço.');
  const service = await getServiceById(serviceId);
  const status = resolveInitialStatus(service);
  if (!service || !status || !service.productionType) throw new Error('O serviço não está configurado para gerar pedido (Admin → Serviços).');
  const client = await createClient({ name: partner.name, whatsapp: partner.whatsapp });
  const paidAt = new Date();
  const order = await createOrder({
    clientId: client.id, serviceId, status, productionType: service.productionType, source: 'manual', paidAt,
    content: `Mamães em Collab: benefício de ${partner.name}${partner.instagram ? ` (@${partner.instagram})` : ''}${partner.theme ? `\nTema: ${partner.theme}` : ''}`,
    servicePrice: 0, rushFee: 0, totalPaid: 0, collabGrant: partner.id,
    ...(Number.isInteger(service.defaultDeliveryDays) ? { deliveryDays: service.defaultDeliveryDays } : {}),
    ...(status === 'completed' ? { completedAt: paidAt } : {}),
  });
  const grant: CollabGrant = { serviceId, orderId: order.id, at: paidAt.toISOString().slice(0, 10) };
  try { await updateDoc(doc(firestore(), PARTNERS, partner.id), { grants: arrayUnion(grant), updatedAt: serverTimestamp() }); } catch (error) { fail('registrar a vaga', error); }
  return grant;
}

/** Libera a vaga (o pedido do benefício continua no Kanban; exclua lá se não for mais entregar). */
export async function removeGrant(partnerId: string, grant: CollabGrant): Promise<void> {
  try { await updateDoc(doc(firestore(), PARTNERS, partnerId), { grants: arrayRemove(grant), updatedAt: serverTimestamp() }); } catch (error) { fail('liberar a vaga', error); }
}

/** Resolve um aviso de cupom: vincula a uma parceira (com comissão) ou deixa sem comissão. */
export async function resolveCouponWarning(orderId: string, partnerId: string | null, commission: number): Promise<void> {
  try {
    await updateDoc(doc(firestore(), 'orders', orderId), { 'collab.partnerId': partnerId, 'collab.commission': commission, 'collab.reviewed': true });
  } catch (error) { fail('resolver o aviso', error); }
}

export async function listPayouts(): Promise<CollabPayout[]> {
  try {
    const snapshot = await getDocs(collection(firestore(), PAYOUTS));
    return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<CollabPayout, 'id'>) }));
  } catch (error) {
    return fail('listar pagamentos', error);
  }
}

/** Marca como pagas as vendas pendentes da semana (um documento por parceira e semana; um 2º pagamento na mesma semana soma). */
export async function markWeekPaid(partnerId: string, weekKey: string, orderIds: string[], amount: number): Promise<void> {
  try {
    await setDoc(doc(firestore(), PAYOUTS, payoutId(partnerId, weekKey)), {
      partnerId, weekKey, orderIds: arrayUnion(...orderIds), amount: increment(amount), paidAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) { fail('marcar como pago', error); }
}
