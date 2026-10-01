import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, where, setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Order, OrderStatus, ProductionType, OrderSource } from "../types";
import { calculateOrderDeadlines } from "./orderDates";
import { CONTENT_SCRIPTS_COLLECTION } from "./contentScriptsService";
import { CLIENTS_COLLECTION } from "./clientsService";
import { SERVICES_COLLECTION } from "./servicesService";

export const ORDERS_COLLECTION = "orders";

export type CreateOrderInput = Omit<Order, "id" | "createdAt" | "completedAt" | "customerDueDate" | "internalDueDate"> & {
  paidAt?: Date | null;
  eventDate?: Date | null;
  completedAt?: Date | null;
  customerDueDate?: Date | null;
  internalDueDate?: Date | null;
};
export type UpdateOrderInput = Partial<Omit<Order, "id" | "createdAt" | "paidAt" | "eventDate" | "deliveryDays">> & {
  paidAt?: Date | null;
  eventDate?: Date | null;
  deliveryDays?: number | null;
};

function mapOrder(id: string, data: Record<string, any>): Order {
  return { ...data, id } as Order;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!input.clientId || !input.serviceId) throw new Error("Cliente e serviço são obrigatórios.");
  if (input.deliveryDays !== undefined && (!Number.isInteger(input.deliveryDays) || input.deliveryDays < 0)) {
    throw new Error("O prazo deve ser informado em dias corridos.");
  }
  const reference = doc(collection(db, ORDERS_COLLECTION));
  const deadlines: Partial<{ customerDueDate: Date; internalDueDate: Date }> = input.paidAt && input.deliveryDays !== undefined
    ? calculateOrderDeadlines(input.paidAt, input.deliveryDays)
    : {};
  const { completedAt, ...fields } = input;
  const payload = {
    ...fields,
    ...(deadlines.customerDueDate ? deadlines : {}),
    createdAt: serverTimestamp(),
    ...(completedAt ? { completedAt } : {}),
  };
  await setDoc(reference, payload);
  return { ...input, ...deadlines, id: reference.id, createdAt: undefined };
}

/** Cria uma única produção interna para um roteiro pronto e vincula os dois documentos atomicamente. */
export async function createRecordingOrderFromScript(input: { scriptId: string; clientId: string; serviceId: string }): Promise<Order> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!input.scriptId || !input.clientId || !input.serviceId) throw new Error('Roteiro, cliente interno e serviço interno são obrigatórios.');
  const firestore = db;
  const scriptRef = doc(firestore, CONTENT_SCRIPTS_COLLECTION, input.scriptId);
  const clientRef = doc(firestore, CLIENTS_COLLECTION, input.clientId);
  const serviceRef = doc(firestore, SERVICES_COLLECTION, input.serviceId);
  const orderRef = doc(collection(firestore, ORDERS_COLLECTION));

  const created = await runTransaction(firestore, async (transaction) => {
    const [scriptSnapshot, clientSnapshot, serviceSnapshot, existingOrders] = await Promise.all([
      transaction.get(scriptRef),
      transaction.get(clientRef),
      transaction.get(serviceRef),
      transaction.get(query(collection(firestore, ORDERS_COLLECTION), where('scriptId', '==', input.scriptId))),
    ]);
    if (!scriptSnapshot.exists()) throw new Error('Roteiro não encontrado.');
    const script = scriptSnapshot.data();
    if (script.productionStatus !== 'ready') throw new Error('Somente roteiros prontos para gravar podem ser enviados.');
    if (script.orderId || !existingOrders.empty) throw new Error('Este roteiro já possui uma produção vinculada.');
    if (!clientSnapshot.exists()) throw new Error('Cliente interno de Conteúdo não encontrado.');
    if (!serviceSnapshot.exists()) throw new Error('Serviço interno de Conteúdo não encontrado.');
    const service = serviceSnapshot.data();
    if (service.internalOnly !== true || service.active !== false || service.category !== 'Conteúdo' || service.generateOrder !== true || service.productionType !== 'recording' || service.initialStatus !== 'recording' || service.autoComplete !== false || service.defaultDeliveryDays !== undefined || service.price !== 'R$ 0,00') {
      throw new Error('A configuração do serviço interno de Conteúdo está incompleta ou foi alterada.');
    }

    transaction.set(orderRef, {
      clientId: input.clientId,
      serviceId: input.serviceId,
      status: 'recording',
      content: String(script.content || ''),
      servicePrice: 0,
      rushFee: 0,
      totalPaid: 0,
      productionType: 'recording',
      source: 'manual',
      scriptId: input.scriptId,
      createdAt: serverTimestamp(),
    });
    transaction.update(scriptRef, {
      orderId: orderRef.id,
      productionStatus: 'in_production',
      updatedAt: serverTimestamp(),
    });
    return {
      id: orderRef.id,
      clientId: input.clientId,
      serviceId: input.serviceId,
      status: 'recording' as const,
      content: String(script.content || ''),
      servicePrice: 0,
      rushFee: 0,
      totalPaid: 0,
      productionType: 'recording' as const,
      source: 'manual' as const,
      scriptId: input.scriptId,
    };
  });
  return created;
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!id) return null;
  const snapshot = await getDoc(doc(db, ORDERS_COLLECTION, id));
  return snapshot.exists() ? mapOrder(snapshot.id, snapshot.data()) : null;
}

/** Exclui definitivamente o pedido sem afetar o cadastro do cliente. */
export async function deleteOrder(id: string): Promise<void> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!id) throw new Error("ID do pedido é obrigatório.");
  await deleteDoc(doc(db, ORDERS_COLLECTION, id));
}

export async function listOrders(): Promise<Order[]> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const result = await getDocs(query(collection(db, ORDERS_COLLECTION), orderBy("createdAt", "desc")));
  return result.docs.map((item) => mapOrder(item.id, item.data()));
}

export async function updateOrder(id: string, updates: UpdateOrderInput): Promise<void> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!id) throw new Error("ID do pedido é obrigatório.");
  const firestore = db;
  const orderRef = doc(firestore, ORDERS_COLLECTION, id);
  await runTransaction(firestore, async (transaction) => {
    const current = await transaction.get(orderRef);
    if (!current.exists()) throw new Error("Pedido não encontrado.");
    const currentData = current.data();
    const payload: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
    if (updates.eventDate === null) payload.eventDate = deleteField();
    if (updates.deliveryDays === null) payload.deliveryDays = deleteField();
    if (updates.status === 'completed' && updates.completedAt === undefined) {
      payload.completedAt = serverTimestamp();
    } else if (updates.status !== undefined && updates.status !== 'completed' && updates.completedAt === undefined) {
      payload.completedAt = deleteField();
    }

    const deliveryDaysChanged = Object.prototype.hasOwnProperty.call(updates, 'deliveryDays');
    if (updates.paidAt !== undefined || deliveryDaysChanged) {
      const paidAtValue = updates.paidAt !== undefined ? updates.paidAt : currentData.paidAt;
      const paidAt = paidAtValue instanceof Date ? paidAtValue : paidAtValue?.toDate?.();
      const deliveryDays = deliveryDaysChanged ? updates.deliveryDays : currentData.deliveryDays;
      if (paidAt && Number.isInteger(deliveryDays) && deliveryDays >= 0) {
        Object.assign(payload, calculateOrderDeadlines(paidAt, deliveryDays));
      } else {
        payload.customerDueDate = deleteField();
        payload.internalDueDate = deleteField();
      }
    }

    let linkedScriptRef: ReturnType<typeof doc> | null = null;
    let linkedScript: Record<string, any> | null = null;
    if (updates.status === 'completed' && typeof currentData.scriptId === 'string') {
      linkedScriptRef = doc(firestore, CONTENT_SCRIPTS_COLLECTION, currentData.scriptId);
      const scriptSnapshot = await transaction.get(linkedScriptRef);
      if (!scriptSnapshot.exists()) throw new Error('O roteiro vinculado ao pedido não foi encontrado; o pedido não foi concluído.');
      linkedScript = scriptSnapshot.data();
    }

    transaction.update(orderRef, payload);
    if (linkedScriptRef && linkedScript) {
      transaction.update(linkedScriptRef, {
        productionStatus: 'produced',
        publicationStatus: 'published',
        publishedAt: linkedScript.publishedAt || (updates.completedAt instanceof Date ? updates.completedAt : serverTimestamp()),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function completeOrder(id: string, completedAt: Date = new Date()): Promise<void> {
  await updateOrder(id, { status: "completed", completedAt });
}

export async function getOrdersByClientId(clientId: string): Promise<Order[]> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const result = await getDocs(query(collection(db, ORDERS_COLLECTION), where("clientId", "==", clientId), orderBy("createdAt", "desc")));
  return result.docs.map((item) => mapOrder(item.id, item.data()));
}

export async function getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const result = await getDocs(query(collection(db, ORDERS_COLLECTION), where("status", "==", status), orderBy("createdAt", "desc")));
  return result.docs.map((item) => mapOrder(item.id, item.data()));
}

export type { OrderStatus, ProductionType, OrderSource };
