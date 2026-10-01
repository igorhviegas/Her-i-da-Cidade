import {
  collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Client } from "../types";

export const CLIENTS_COLLECTION = "clients";
const whatsappIndexId = (normalized: string) => `whatsapp_${normalized}`;

/** Remove símbolos e aplica o código do Brasil quando informado um número nacional. */
export function normalizeWhatsApp(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) throw new Error("O WhatsApp é obrigatório.");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function mapClient(id: string, data: Record<string, any>): Client {
  return {
    id, name: data.name || "", whatsapp: data.whatsapp || "",
    whatsappNormalized: data.whatsappNormalized || normalizeWhatsApp(data.whatsapp || ""),
    createdAt: data.createdAt, updatedAt: data.updatedAt,
  };
}

export async function getClientByWhatsApp(whatsapp: string): Promise<Client | null> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const normalized = normalizeWhatsApp(whatsapp);
  const indexSnapshot = await getDoc(doc(db, CLIENTS_COLLECTION, whatsappIndexId(normalized)));
  if (indexSnapshot.exists()) {
    const clientId = indexSnapshot.data().clientId as string | undefined;
    return clientId ? getClientById(clientId) : null;
  }
  // Compatibilidade com clientes registrados antes da criação do índice lógico.
  const result = await getDocs(query(collection(db, CLIENTS_COLLECTION), where("whatsappNormalized", "==", normalized)));
  const client = result.empty ? null : mapClient(result.docs[0].id, result.docs[0].data());
  return client;
}

/** Reutiliza o cliente existente para o mesmo WhatsApp normalizado. */
export async function createClient(input: { name: string; whatsapp: string }): Promise<Client> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const name = input.name?.trim();
  const whatsapp = input.whatsapp?.trim();
  if (!name) throw new Error("O nome do cliente é obrigatório.");
  const whatsappNormalized = normalizeWhatsApp(whatsapp);
  const reference = doc(collection(db, CLIENTS_COLLECTION));
  const indexReference = doc(db, CLIENTS_COLLECTION, whatsappIndexId(whatsappNormalized));
  const legacyClient = await getClientByWhatsApp(whatsapp);
  return runTransaction(db, async (transaction) => {
    const indexSnapshot = await transaction.get(indexReference);
    if (indexSnapshot.exists()) {
      const clientSnapshot = await transaction.get(doc(db!, CLIENTS_COLLECTION, indexSnapshot.data().clientId));
      if (clientSnapshot.exists()) return mapClient(clientSnapshot.id, clientSnapshot.data());
      transaction.set(reference, { name, whatsapp, whatsappNormalized, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      transaction.set(indexReference, { clientId: reference.id, whatsappNormalized, recordType: 'whatsapp-index' });
      return { id: reference.id, name, whatsapp, whatsappNormalized };
    }
    if (legacyClient) {
      transaction.set(indexReference, { clientId: legacyClient.id, whatsappNormalized, recordType: 'whatsapp-index' });
      return legacyClient;
    }
    transaction.set(reference, { name, whatsapp, whatsappNormalized, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    transaction.set(indexReference, { clientId: reference.id, whatsappNormalized, recordType: 'whatsapp-index' });
    return { id: reference.id, name, whatsapp, whatsappNormalized };
  });
}

export async function getClientById(id: string): Promise<Client | null> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!id) return null;
  const snapshot = await getDoc(doc(db, CLIENTS_COLLECTION, id));
  return snapshot.exists() ? mapClient(snapshot.id, snapshot.data()) : null;
}

export async function updateClient(id: string, updates: { name?: string; whatsapp?: string }): Promise<void> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  if (!id) throw new Error("ID do cliente é obrigatório.");
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) throw new Error("O nome do cliente não pode ser vazio.");
    payload.name = name;
  }
  if (updates.whatsapp !== undefined) {
    const whatsapp = updates.whatsapp.trim();
    const normalized = normalizeWhatsApp(whatsapp);
    const clientWithWhatsApp = await getClientByWhatsApp(whatsapp);
    if (clientWithWhatsApp && clientWithWhatsApp.id !== id) throw new Error("Este WhatsApp já está associado a outro cliente.");
    payload.whatsapp = whatsapp;
    payload.whatsappNormalized = normalized;
  }
  const current = await getClientById(id);
  if (!current) throw new Error("Cliente não encontrado.");
  await runTransaction(db, async (transaction) => {
    const indexReference = updates.whatsapp !== undefined
      ? doc(db!, CLIENTS_COLLECTION, whatsappIndexId(String(payload.whatsappNormalized)))
      : null;
    const oldIndexReference = updates.whatsapp !== undefined && current.whatsappNormalized !== payload.whatsappNormalized
      ? doc(db!, CLIENTS_COLLECTION, whatsappIndexId(current.whatsappNormalized))
      : null;
    const newIndex = indexReference ? await transaction.get(indexReference) : null;
    const oldIndex = oldIndexReference ? await transaction.get(oldIndexReference) : null;
    if (newIndex?.exists() && newIndex.data().clientId !== id) throw new Error("Este WhatsApp já está associado a outro cliente.");
    if (updates.whatsapp !== undefined) {
      transaction.set(indexReference!, { clientId: id, whatsappNormalized: payload.whatsappNormalized, recordType: 'whatsapp-index' });
      if (oldIndex?.exists() && oldIndex.data().clientId === id) transaction.delete(oldIndexReference!);
    }
    transaction.update(doc(db!, CLIENTS_COLLECTION, id), payload);
  });
}
