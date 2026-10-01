import {
  collection, deleteField, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where, setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Order, OrderStatus, ProductionType, OrderSource } from "../types";
import { calculateOrderDeadlines } from "./orderDates";

export const ORDERS_COLLECTION = "orders";

export type CreateOrderInput = Omit<Order, "id" | "createdAt" | "completedAt" | "customerDueDate" | "internalDueDate"> & {
  paidAt?: Date | null;
  eventDate?: Date | null;
  completedAt?: Date | null;
  customerDueDate?: Date | null;
  internalDueDate?: Date | null;
};
export type UpdateOrderInput = Partial<Omit<Order, "id" | "createdAt">>;

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

export async function getOrderById(id: string): Promise<Order | null> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!id) return null;
  const snapshot = await getDoc(doc(db, ORDERS_COLLECTION, id));
  return snapshot.exists() ? mapOrder(snapshot.id, snapshot.data()) : null;
}

export async function listOrders(): Promise<Order[]> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const result = await getDocs(query(collection(db, ORDERS_COLLECTION), orderBy("createdAt", "desc")));
  return result.docs.map((item) => mapOrder(item.id, item.data()));
}

export async function updateOrder(id: string, updates: UpdateOrderInput): Promise<void> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!id) throw new Error("ID do pedido é obrigatório.");
  const payload: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  if (updates.status === 'completed' && updates.completedAt === undefined) {
    payload.completedAt = serverTimestamp();
  } else if (updates.status !== undefined && updates.status !== 'completed' && updates.completedAt === undefined) {
    payload.completedAt = deleteField();
  }
  if (updates.paidAt !== undefined || updates.deliveryDays !== undefined) {
    const current = await getDoc(doc(db, ORDERS_COLLECTION, id));
    if (!current.exists()) throw new Error("Pedido não encontrado.");
    const currentData = current.data();
    const paidAtValue = updates.paidAt !== undefined ? updates.paidAt : currentData.paidAt;
    const paidAt = paidAtValue instanceof Date ? paidAtValue : paidAtValue?.toDate?.();
    const deliveryDays = updates.deliveryDays ?? currentData.deliveryDays;
    if (paidAt) Object.assign(payload, calculateOrderDeadlines(paidAt, deliveryDays));
  }
  await updateDoc(doc(db, ORDERS_COLLECTION, id), payload);
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
