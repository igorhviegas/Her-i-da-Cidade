import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Service, FirestoreService } from "../../types";
import { normalizeFaq } from "../serviceFaq.js";
import { getConfiguredWhatsAppUrl } from "../siteConfigService";
import { planCreateWhatsApp, planUpdateWhatsApp } from "../serviceWhatsApp.js";
import { SERVICES_COLLECTION } from "./serviceDocument";
import { OperationType, handleFirestoreError } from "./firestoreErrors";
import { getServices } from "./serviceQueries";
import type { CreateServiceInput, UpdateServiceInput } from "./serviceInputs";

/**
 * Cria um novo serviço no Firestore com validação completa dos campos obrigatórios.
 * O preço é mantido como string conforme arquitetura do projeto.
 */
export async function createService(input: CreateServiceInput): Promise<Service> {
  if (!db) {
    throw new Error("Firebase Firestore não inicializado.");
  }

  const title = input.title?.trim();
  const price = input.price?.trim();
  const description = input.description?.trim();
  const category = input.category?.trim();
  const imageUrl = input.imageUrl?.trim();

  if (!title) throw new Error("O nome do serviço é obrigatório.");
  if (!price) throw new Error("O preço do serviço é obrigatório.");
  if (!description) throw new Error("A descrição do serviço é obrigatória.");
  if (!category) throw new Error("A categoria do serviço é obrigatória.");
  if (!imageUrl) throw new Error("A URL da imagem é obrigatória.");
  const manualUrl = input.whatsappUrl?.trim();
  const { whatsappUrl, whatsappUrlSource } = planCreateWhatsApp({
    manualUrl,
    title,
    baseUrl: manualUrl ? undefined : await getConfiguredWhatsAppUrl(),
  });

  let order = typeof input.order === "number" ? input.order : undefined;
  if (order === undefined || isNaN(order)) {
    try {
      const existing = await getServices({ onlyActive: false, fallbackOnError: false });
      const maxOrder = existing.reduce((max, s) => Math.max(max, s.order ?? 0), 0);
      order = maxOrder + 1;
    } catch {
      order = 1;
    }
  }

  const newDocRef = doc(collection(db, SERVICES_COLLECTION));
  const docId = newDocRef.id;

  const payload: FirestoreService & { name?: string; image?: string } = {
    id: docId,
    title,
    name: title, // compatibilidade com blueprint legado
    price,
    description,
    imageUrl,
    image: imageUrl, // compatibilidade com blueprint legado
    category,
    whatsappUrl,
    whatsappUrlSource,
    active: input.active !== false,
    order,
    ...(input.badgeText?.trim() ? { badgeText: input.badgeText.trim() } : {}),
    ...(input.generateOrder !== undefined ? { generateOrder: input.generateOrder } : {}),
    ...(input.productionType !== undefined ? { productionType: input.productionType } : {}),
    ...(input.initialStatus !== undefined ? { initialStatus: input.initialStatus } : {}),
    ...(input.autoComplete !== undefined ? { autoComplete: input.autoComplete } : {}),
    ...(input.defaultDeliveryDays !== undefined ? { defaultDeliveryDays: input.defaultDeliveryDays } : {}),
    ...(input.deliveryMessage?.trim() ? { deliveryMessage: input.deliveryMessage.trim() } : {}),
    ...(normalizeFaq(input.faq).length ? { faq: normalizeFaq(input.faq) } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newDocRef, payload);
  } catch (err) {
    if (err?.message?.includes("permission") || err?.code === "permission-denied") {
      handleFirestoreError(err, OperationType.CREATE, `${SERVICES_COLLECTION}/${docId}`);
    }
    throw err;
  }

  return {
    id: docId,
    title,
    price,
    description,
    imageUrl,
    category,
    whatsappUrl,
    active: input.active !== false,
    order,
    ...(input.badgeText?.trim() ? { badgeText: input.badgeText.trim() } : {}),
  };
}

/**
 * Atualiza um serviço existente no Firestore.
 * Preserva o createdAt e atualiza updatedAt com serverTimestamp().
 */
export async function updateService(id: string, updates: UpdateServiceInput): Promise<void> {
  if (!db) {
    throw new Error("Firebase Firestore não inicializado.");
  }
  if (!id) {
    throw new Error("ID do serviço é obrigatório para atualização.");
  }

  const payload: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.title !== undefined) {
    const trimmed = updates.title.trim();
    if (!trimmed) throw new Error("O nome do serviço não pode ser vazio.");
    payload.title = trimmed;
    payload.name = trimmed;
  }

  if (updates.deliveryMessage !== undefined) {
    const message = updates.deliveryMessage?.trim();
    payload.deliveryMessage = message ? message : deleteField();
  }

  if (updates.faq !== undefined) {
    const faq = normalizeFaq(updates.faq);
    payload.faq = faq.length ? faq : deleteField();
  }

  for (const field of ["generateOrder", "productionType", "initialStatus", "autoComplete", "defaultDeliveryDays"] as const) {
    if (updates[field] !== undefined) payload[field] = updates[field] === null ? deleteField() : updates[field];
  }

  if (updates.price !== undefined) {
    const trimmed = updates.price.trim();
    if (!trimmed) throw new Error("O preço do serviço não pode ser vazio.");
    payload.price = trimmed;
  }

  if (updates.description !== undefined) {
    const trimmed = updates.description.trim();
    payload.description = trimmed;
  }

  if (updates.category !== undefined) {
    const trimmed = updates.category.trim();
    payload.category = trimmed;
  }

  if (updates.imageUrl !== undefined) {
    const trimmed = updates.imageUrl.trim();
    if (!trimmed) throw new Error("A URL da imagem não pode ser vazia.");
    payload.imageUrl = trimmed;
    payload.image = trimmed;
  }

  if (updates.whatsappUrl !== undefined) {
    const trimmed = updates.whatsappUrl.trim();
    if (!trimmed) throw new Error("O link do WhatsApp não pode ser vazio.");
  }

  // Link manual (validado) ou, se o título mudou, regeneração do link automático.
  if (updates.whatsappUrl !== undefined || updates.title !== undefined) {
    if (updates.whatsappUrl !== undefined && !updates.whatsappUrl.trim()) {
      throw new Error("O link do WhatsApp não pode ser vazio.");
    }
    const manualUrl = updates.whatsappUrl?.trim();
    const current = manualUrl ? undefined : (await getDoc(doc(db, SERVICES_COLLECTION, id))).data();
    Object.assign(payload, await planUpdateWhatsApp({
      manualUrl,
      title: payload.title,
      current,
      getBaseUrl: getConfiguredWhatsAppUrl,
    }));
  }

  if (updates.active !== undefined) {
    payload.active = Boolean(updates.active);
  }

  if (updates.order !== undefined) {
    const parsedOrder = Number(updates.order);
    if (!isNaN(parsedOrder)) {
      payload.order = parsedOrder;
    }
  }

  if (updates.badgeText !== undefined) {
    const trimmed = updates.badgeText.trim();
    payload.badgeText = trimmed || deleteField();
  }

  const docRef = doc(db, SERVICES_COLLECTION, id);
  try {
    try {
      await updateDoc(docRef, payload);
    } catch (updateErr) {
      // Se o documento ainda não existia fisicamente, cria com merge
      if (updateErr?.code === 'not-found' || updateErr?.message?.includes('No document to update')) {
        await setDoc(docRef, payload, { merge: true });
      } else {
        throw updateErr;
      }
    }
  } catch (err) {
    if (err?.message?.includes("permission") || err?.code === "permission-denied") {
      handleFirestoreError(err, OperationType.UPDATE, `${SERVICES_COLLECTION}/${id}`);
    }
    throw err;
  }
}

/**
 * Exclui permanentemente um serviço da coleção 'services' no Firestore.
 */
export async function deleteService(id: string): Promise<void> {
  if (!db) {
    throw new Error("Firebase Firestore não inicializado.");
  }
  if (!id) {
    throw new Error("ID do serviço é obrigatório para exclusão.");
  }

  const docRef = doc(db, SERVICES_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    if (err?.message?.includes("permission") || err?.code === "permission-denied") {
      handleFirestoreError(err, OperationType.DELETE, `${SERVICES_COLLECTION}/${id}`);
    }
    throw err;
  }
}

/**
 * Alterna imediatamente o status active (ativo/inativo) de um serviço.
 */
export async function toggleServiceStatus(id: string, currentStatus: boolean): Promise<boolean> {
  const newStatus = !currentStatus;
  await updateService(id, { active: newStatus });
  return newStatus;
}

/**
 * Atualiza o campo 'order' para reordenação dos serviços.
 */
export async function updateServiceOrder(id: string, newOrder: number): Promise<void> {
  const orderNum = Number(newOrder);
  if (isNaN(orderNum)) {
    throw new Error("A ordem deve ser um número válido.");
  }
  await updateService(id, { order: orderNum });
}
