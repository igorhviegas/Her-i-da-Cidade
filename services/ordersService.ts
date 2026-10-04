import {
  collection, deleteField, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Order, OrderStatus, ProductionType, OrderSource } from "../types";
import { calculateOrderDeadlines } from "./orderDates";
import { CONTENT_SCRIPTS_COLLECTION } from "./contentScriptsService";
import { CLIENTS_COLLECTION } from "./clientsService";
import { SERVICES_COLLECTION } from "./servicesService";
import { activityRefs, prepareActivityLog } from "./activityLog";
import { StockError, isPresentialService, type ConsumptionLine } from "./stockCalculations.js";
import { prepareOrderConsumption, prepareOrderReversal } from "./stockTransactions.js";
import { currentActor } from "./stockService";
import { editingCostFields } from "./financeCalculations.js";
import { LEDGER_COLLECTION, LEDGER_KINDS, ledgerId, planCompletion, planEntry } from "./eventFinance.js";

export const ORDERS_COLLECTION = "orders";

export type CreateOrderInput = Omit<Order, "id" | "orderNumber" | "orderNumberDisplay" | "technicalPurchaseId" | "createdAt" | "completedAt" | "customerDueDate" | "internalDueDate"> & {
  paidAt?: Date | null;
  eventDate?: Date | null;
  completedAt?: Date | null;
  customerDueDate?: Date | null;
  internalDueDate?: Date | null;
};
export type UpdateOrderInput = Partial<Omit<Order, "id" | "orderNumber" | "orderNumberDisplay" | "technicalPurchaseId" | "createdAt" | "paidAt" | "eventDate" | "deliveryDays">> & {
  paidAt?: Date | null;
  eventDate?: Date | null;
  deliveryDays?: number | null;
  /** Consumo de materiais informado na conclusão de eventos presenciais (obrigatório nesse caso; pode ser vazio). */
  materialConsumption?: ConsumptionLine[];
  /** Conclusão excepcional com estoque insuficiente (só administradores; as regras do Firestore também exigem). Baixa o disponível e registra pendências. */
  allowStockShortage?: boolean;
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
  if (input.eventForm && input.status === 'completed') throw new Error('Pedidos de evento não podem ser criados já concluídos: o faturamento é lançado na conclusão pelo Kanban.');
  if (input.status === 'completed') {
    const serviceSnapshot = await getDoc(doc(db, SERVICES_COLLECTION, input.serviceId));
    if (serviceSnapshot.exists() && isPresentialService(serviceSnapshot.data())) {
      throw new StockError('consumption_required', 'Eventos presenciais não podem ser criados já concluídos: conclua pelo Kanban informando o consumo de materiais.');
    }
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
    ...(input.status === 'completed' ? editingCostFields(input.serviceId) : {}),
  };
  if (input.eventForm) await setEventOrder(reference, { ...payload, eventLedger: { entry: input.eventForm.entryValue } });
  else if (input.status === 'completed') await setCompletedOrder(reference, payload, completedAt || new Date());
  else await setDoc(reference, payload);
  return { ...input, ...(input.eventForm ? { eventLedger: { entry: input.eventForm.entryValue } } : {}), ...deadlines, id: reference.id, createdAt: undefined };
}

/** Cria uma única produção interna para um roteiro pronto e vincula os dois documentos atomicamente. */
export async function createRecordingOrderFromScript(input: { scriptId: string; clientId: string; serviceId: string }): Promise<Order> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const validateDocumentId = (id: string, label: string) => {
    if (typeof id !== 'string' || !id.trim() || id.includes('/')) {
      throw new Error(`ID inválido para referência de ${label}: ${String(id)}.`);
    }
  };
  validateDocumentId(input.scriptId, 'roteiro');
  validateDocumentId(input.clientId, 'cliente interno');
  validateDocumentId(input.serviceId, 'serviço interno');

  const firestore = db;
  let scriptRef: ReturnType<typeof doc>;
  let clientRef: ReturnType<typeof doc>;
  let serviceRef: ReturnType<typeof doc>;
  let orderRef: ReturnType<typeof doc>;
  try {
    scriptRef = doc(firestore, CONTENT_SCRIPTS_COLLECTION, input.scriptId);
    clientRef = doc(firestore, CLIENTS_COLLECTION, input.clientId);
    serviceRef = doc(firestore, SERVICES_COLLECTION, input.serviceId);
    orderRef = doc(collection(firestore, ORDERS_COLLECTION));
  } catch (error) {
    throw new Error(`Falha ao criar referências Firestore para a produção do roteiro ${input.scriptId}: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const [label, reference] of [
    ['roteiro', scriptRef],
    ['cliente interno', clientRef],
    ['serviço interno', serviceRef],
    ['novo pedido', orderRef],
  ] as const) {
    if (!reference || typeof reference.path !== 'string' || !reference.path || !reference.id) {
      throw new Error(`Referência Firestore inválida para ${label} na produção do roteiro ${input.scriptId}.`);
    }
  }

  // Web Firestore transactions only accept document references in transaction.get().
  // Check legacy/orphaned links before the transaction; scriptRef.orderId is rechecked
  // transactionally to prevent concurrent duplicate orders.
  let existingOrders;
  try {
    existingOrders = await getDocs(query(
      collection(firestore, ORDERS_COLLECTION),
      where('scriptId', '==', input.scriptId),
    ));
  } catch (error) {
    throw new Error(`Falha ao verificar pedidos previamente vinculados ao roteiro ${input.scriptId}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!existingOrders.empty) throw new Error('Este roteiro já possui um pedido de produção vinculado.');

  const created = await runTransaction(firestore, async (transaction) => {
    const [scriptSnapshot, clientSnapshot, serviceSnapshot] = await Promise.all([
      transaction.get(scriptRef),
      transaction.get(clientRef),
      transaction.get(serviceRef),
    ]);
    if (!scriptSnapshot.exists()) throw new Error('Roteiro não encontrado.');
    const script = scriptSnapshot.data();
    if (script.productionStatus !== 'ready') throw new Error('Somente roteiros prontos para gravar podem ser enviados.');
    if (script.orderId) throw new Error('Este roteiro já possui uma produção vinculada.');
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
  const firestore = db;
  const orderRef = doc(firestore, ORDERS_COLLECTION, id);
  await runTransaction(firestore, async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error('Pedido não encontrado para exclusão.');

    const order = orderSnapshot.data();
    // Pedido de evento: seus lançamentos no livro saem junto (exclusão explícita do pedido; as regras só permitem apagar se o pedido deixar de existir).
    const ledgerSnapshots = order.eventLedger
      ? await Promise.all(LEDGER_KINDS.map((kind) => transaction.get(doc(firestore, LEDGER_COLLECTION, ledgerId(id, kind)))))
      : [];
    let linkedScriptRef: ReturnType<typeof doc> | null = null;
    let linkedScript: Record<string, any> | null = null;
    if (typeof order.scriptId === 'string' && order.scriptId) {
      if (order.scriptId.includes('/')) throw new Error('O pedido possui um scriptId inválido; nenhum documento foi alterado.');
      linkedScriptRef = doc(firestore, CONTENT_SCRIPTS_COLLECTION, order.scriptId);
      const scriptSnapshot = await transaction.get(linkedScriptRef);
      if (scriptSnapshot.exists()) linkedScript = scriptSnapshot.data();
    }

    transaction.delete(orderRef);
    ledgerSnapshots.forEach((snapshot) => { if (snapshot.exists()) transaction.delete(snapshot.ref); });
    if (linkedScriptRef && linkedScript?.orderId === id) {
      const scriptUpdates: Record<string, unknown> = {
        orderId: deleteField(),
        updatedAt: serverTimestamp(),
      };
      if (linkedScript.productionStatus === 'in_production') scriptUpdates.productionStatus = 'ready';
      transaction.update(linkedScriptRef, scriptUpdates);
    }
  });
}

/** Pedido que já nasce concluído: grava o pedido e o registro de atividade na mesma transação. */
async function setCompletedOrder(reference: ReturnType<typeof doc>, payload: Record<string, unknown>, occurredAt: Date): Promise<void> {
  const firestore = db!;
  await runTransaction(firestore, async (transaction) => {
    const refs = activityRefs(firestore, 'order_completed', reference.id);
    const record = await prepareActivityLog(transaction, refs, {
      type: 'order_completed', refId: reference.id, occurredAt, difficultyKey: `service_${payload.serviceId}`, meta: { serviceId: payload.serviceId },
    });
    transaction.set(reference, payload);
    if (record) transaction.set(refs.logRef, record);
  });
}

/** Pedido de evento: o pedido e o lançamento da entrada (1ª parcela, data = criação) nascem na mesma transação. */
async function setEventOrder(reference: ReturnType<typeof doc>, payload: Record<string, unknown>): Promise<void> {
  const firestore = db!;
  const entry = planEntry(reference.id, payload as any, serverTimestamp());
  await runTransaction(firestore, async (transaction) => {
    transaction.set(reference, payload);
    transaction.set(doc(firestore, LEDGER_COLLECTION, ledgerId(reference.id, 'entry')), { ...entry, createdAt: serverTimestamp() });
  });
}

export async function listOrders(): Promise<Order[]> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const result = await getDocs(query(collection(db, ORDERS_COLLECTION), orderBy("createdAt", "desc")));
  return result.docs.map((item) => mapOrder(item.id, item.data()));
}

/** Etapas do Kanban em andamento: todas as colunas, exceto Concluído (mesma divisão de AdminOrdersPage). */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["scheduled", "recording", "editing", "delivery"];

type ActiveListener = { onData: (orders: Order[]) => void; onError: (error: Error) => void };
const activeListeners = new Set<ActiveListener>();
let stopActive: (() => void) | null = null;
let lastActive: Order[] | null = null;

/**
 * Pedidos em andamento em tempo real. Um único listener Firestore é compartilhado entre o contador do menu e o widget
 * da página Principal; mudança de status, criação, exclusão ou conclusão chegam sem nova leitura completa.
 */
export function subscribeActiveOrders(onData: (orders: Order[]) => void, onError: (error: Error) => void): () => void {
  if (!db) { onError(new Error("Firebase Firestore não inicializado.")); return () => {}; }
  const listener = { onData, onError };
  activeListeners.add(listener);
  if (lastActive) onData(lastActive);
  if (!stopActive) {
    stopActive = onSnapshot(
      query(collection(db, ORDERS_COLLECTION), where("status", "in", ACTIVE_ORDER_STATUSES)),
      (snapshot) => {
        lastActive = snapshot.docs.map((item) => mapOrder(item.id, item.data()));
        activeListeners.forEach((l) => l.onData(lastActive!));
      },
      (error) => {
        // O Firestore encerra a escuta após um erro: limpa o estado para que a próxima assinatura crie uma nova (nada de contagem velha).
        stopActive = null;
        lastActive = null;
        const failed = [...activeListeners];
        activeListeners.clear();
        failed.forEach((l) => l.onError(error));
      },
    );
  }
  return () => {
    activeListeners.delete(listener);
    if (activeListeners.size === 0) { stopActive?.(); stopActive = null; lastActive = null; }
  };
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
    const safeUpdates = { ...updates } as Record<string, unknown>;
    delete safeUpdates.materialConsumption;
    delete safeUpdates.allowStockShortage;
    delete safeUpdates.orderNumber;
    delete safeUpdates.orderNumberDisplay;
    delete safeUpdates.technicalPurchaseId;
    const payload: Record<string, unknown> = { ...safeUpdates, updatedAt: serverTimestamp() };
    if (updates.eventDate === null) payload.eventDate = deleteField();
    if (updates.deliveryDays === null) payload.deliveryDays = deleteField();
    if (updates.status === 'completed' && updates.completedAt === undefined && currentData.status === 'completed') {
      // já concluído: repetir a conclusão não reescreve a data (reabrir e concluir de novo continua gerando nova data)
    } else if (updates.status === 'completed' && updates.completedAt === undefined) {
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

    // Estoque: concluir evento presencial baixa o consumo informado; reabrir estorna. Tudo na mesma transação do pedido,
    // então ou o pedido e o estoque mudam juntos, ou nada muda. Este é o único ponto de conclusão de pedidos no CRM.
    let stock: { apply(): void } | null = null;
    if (updates.status === 'completed' && currentData.status !== 'completed') {
      const serviceSnapshot = await transaction.get(doc(firestore, SERVICES_COLLECTION, updates.serviceId ?? currentData.serviceId));
      if (serviceSnapshot.exists() && isPresentialService(serviceSnapshot.data())) {
        if (!updates.materialConsumption) throw new StockError('consumption_required', 'Informe o consumo de materiais para concluir um evento presencial.');
        stock = await prepareOrderConsumption(transaction, firestore, { orderId: id, lines: updates.materialConsumption, actor: currentActor(), allowShortage: updates.allowStockShortage === true });
      }
    } else if (currentData.status === 'completed' && updates.status !== undefined && updates.status !== 'completed') {
      stock = await prepareOrderReversal(transaction, firestore, { orderId: id, actor: currentActor() });
    }

    // Pedido presencial do ManyChat (eventDraft): sem os dados do evento não há o que faturar, então não pode ser concluído.
    if (updates.status === 'completed' && currentData.status !== 'completed' && currentData.eventDraft === true) {
      throw new Error('Complete os dados do evento em "Editar pedido" antes de concluir.');
    }
    // Primeira vez que o cadastro do evento é salvo num rascunho: vira evento comum e a entrada é lançada (data = este momento).
    // ID determinístico + checagem na transação: salvar de novo nunca lança outra entrada.
    let draftEntry: { id: string; record: Record<string, unknown> } | null = null;
    if (currentData.eventDraft === true && updates.eventForm) {
      const entryRef = doc(firestore, LEDGER_COLLECTION, ledgerId(id, 'entry'));
      const existingEntry = await transaction.get(entryRef);
      const record = planEntry(id, { ...currentData, ...updates }, serverTimestamp());
      if (!existingEntry.exists()) draftEntry = { id: entryRef.id, record: { ...record, createdAt: serverTimestamp() } };
      payload.eventDraft = deleteField();
      payload.eventLedger = { entry: record.amount };
    }

    // Evento com livro de lançamentos: a PRIMEIRA conclusão lança a 2ª parcela e a "Despesa evento" (IDs determinísticos, create-only).
    // Se o lançamento já existe (reabertura, repetição, falha de rede com nova tentativa), nada é criado nem alterado.
    // Dados financeiros incompletos bloqueiam a conclusão (EventFinanceError) sem lançar nada.
    const ledgerWrites: Array<{ id: string; record: Record<string, unknown> }> = [];
    if (updates.status === 'completed' && currentData.status !== 'completed' && currentData.eventLedger && currentData.eventForm) {
      const [entrySnap, finalSnap, costSnap] = await Promise.all((['entry', 'final', 'cost'] as const).map((kind) => transaction.get(doc(firestore, LEDGER_COLLECTION, ledgerId(id, kind)))));
      const eventOrder = { ...currentData, eventForm: { ...currentData.eventForm, ...updates.eventForm } };
      const date = updates.completedAt instanceof Date ? updates.completedAt : serverTimestamp();
      for (const record of planCompletion(id, eventOrder, { bookedEntry: entrySnap.exists() ? entrySnap.data().amount : undefined, final: finalSnap.exists(), cost: costSnap.exists() }, date)) {
        ledgerWrites.push({ id: ledgerId(id, record.kind), record: { ...record, createdAt: serverTimestamp() } });
        payload[`eventLedger.${record.kind}`] = record.amount;
      }
    }

    // Primeira conclusão do pedido vira registro permanente (ID por pedido): reabrir e concluir de novo, editar ou excluir o
    // pedido não altera nem apaga o histórico, e a dificuldade fica congelada com a configuração vigente neste instante.
    const serviceId = updates.serviceId ?? currentData.serviceId;
    const activityRefsForOrder = updates.status === 'completed' && currentData.status !== 'completed' ? activityRefs(firestore, 'order_completed', id) : null;
    const activityRecord = activityRefsForOrder
      ? await prepareActivityLog(transaction, activityRefsForOrder, {
        type: 'order_completed', refId: id, occurredAt: updates.completedAt instanceof Date ? updates.completedAt : new Date(),
        difficultyKey: `service_${serviceId}`, meta: { serviceId, ...(currentData.scriptId ? { scriptId: currentData.scriptId } : {}) },
      })
      : null;

    if (updates.status === 'completed' && currentData.status !== 'completed') Object.assign(payload, editingCostFields(serviceId, currentData));

    transaction.update(orderRef, payload);
    stock?.apply();
    ledgerWrites.forEach(({ id: entryId, record }) => transaction.set(doc(firestore, LEDGER_COLLECTION, entryId), record));
    if (draftEntry) transaction.set(doc(firestore, LEDGER_COLLECTION, draftEntry.id), draftEntry.record);
    if (activityRefsForOrder && activityRecord) transaction.set(activityRefsForOrder.logRef, activityRecord);
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
