import { logger } from '../../lib/logger.js';
import { collection, doc, getDocs, setDoc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { FirestoreService } from "../../types";
import { SERVICES as FALLBACK_SERVICES } from "../../constants";
import { getConfiguredWhatsAppUrl } from "../siteConfigService";
import { planAutoLinkSync } from "../serviceWhatsApp.js";
import { SERVICES_COLLECTION } from "./serviceDocument";

/**
 * Script utilitário e idempotente de migração.
 * Insere os 6 serviços padrão no Firestore preservando rigorosamente:
 * - Document IDs: '1', '2', '3', '4', '5', '6'
 * - order: 1, 2, 3, 4, 5, 6
 * - active: true
 * 
 * Se os documentos já existirem, NÃO duplica nem sobrescreve.
 */
export async function seedServicesIfEmpty(): Promise<{
  executed: boolean;
  insertedCount: number;
  existingCount: number;
  message: string;
}> {
  if (!db) {
    throw new Error("Firebase Firestore não inicializado.");
  }

  try {
    const currentSnap = await getDocs(collection(db, SERVICES_COLLECTION));
    const existingMap = new Map<string, unknown>();
    currentSnap.docs.forEach((d) => existingMap.set(d.id, d.data()));

    let inserted = 0;

    for (let index = 0; index < FALLBACK_SERVICES.length; index++) {
      const item = FALLBACK_SERVICES[index];
      const docId = item.id;

      if (existingMap.has(docId)) {
        continue;
      }

      const firestorePayload: FirestoreService = {
        id: docId,
        title: item.title,
        price: item.price,
        description: item.description,
        imageUrl: item.imageUrl,
        category: item.category,
        whatsappUrl: item.whatsappUrl || `https://wa.me/5531999044206?text=${encodeURIComponent('Olá, gostaria de saber mais sobre os serviços do Heroi da Cidade! Tenho interesse no serviço: ' + item.title)}`,
        active: true,
        order: index + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = doc(db, SERVICES_COLLECTION, docId);
      await setDoc(docRef, firestorePayload);
      inserted++;
    }

    return {
      executed: inserted > 0,
      insertedCount: inserted,
      existingCount: currentSnap.size,
      message: inserted > 0
        ? `${inserted} serviços migrados com sucesso para o Firestore.`
        : `Todos os serviços já existem no Firestore (${currentSnap.size} encontrados). Nenhuma duplicata gerada.`,
    };
  } catch (error) {
    logger.error("[servicesService] Falha ao migrar serviços para o Firestore:", error);
    throw error;
  }
}

/**
 * Após mudar o número padrão: regenera SÓ os serviços com whatsappUrlSource === 'auto'.
 * Links manuais, documentos antigos (sem o campo) e internos nunca são tocados.
 * Com dryRun, apenas lista o que mudaria.
 */
export async function syncAutoServiceWhatsAppUrls(options: { dryRun?: boolean } = {}): Promise<{ changed: number; ids: string[] }> {
  if (!db) throw new Error("Firebase Firestore não inicializado.");
  const baseUrl = await getConfiguredWhatsAppUrl();
  const snap = await getDocs(collection(db, SERVICES_COLLECTION));
  const changes = planAutoLinkSync(snap.docs.map((d) => ({ id: d.id, data: d.data() })), baseUrl);
  if (!options.dryRun) {
    for (let i = 0; i < changes.length; i += 400) {
      const batch = writeBatch(db);
      for (const { id, whatsappUrl } of changes.slice(i, i + 400)) {
        batch.update(doc(db, SERVICES_COLLECTION, id), { whatsappUrl, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }
  }
  return { changed: changes.length, ids: changes.map((c) => c.id) };
}

/**
 * Migração idempotente para preencher whatsappUrl nos serviços existentes no Firestore.
 * - Se whatsappUrl já existir: preserva o valor atual.
 * - Se não existir: preenche com o link oficial correspondente àquele serviço.
 */
export async function migrateServiceWhatsAppUrls(): Promise<{
  total: number;
  migrated: number;
  preserved: number;
}> {
  if (!db) {
    throw new Error("Firebase Firestore não inicializado.");
  }

  const querySnapshot = await getDocs(collection(db, SERVICES_COLLECTION));
  let migrated = 0;
  let preserved = 0;

  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    if (data.whatsappUrl && typeof data.whatsappUrl === 'string' && data.whatsappUrl.trim().length > 0) {
      preserved++;
      continue;
    }

    const title = data.title || "";
    const defaultUrl = `https://wa.me/5531999044206?text=${encodeURIComponent(
      'Olá, gostaria de saber mais sobre os serviços do Heroi da Cidade! Tenho interesse no serviço: ' + title
    )}`;

    await updateDoc(docSnap.ref, {
      whatsappUrl: defaultUrl,
      updatedAt: serverTimestamp(),
    });
    migrated++;
  }

  return {
    total: querySnapshot.size,
    migrated,
    preserved,
  };
}
