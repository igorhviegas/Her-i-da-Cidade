import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  deleteField,
  runTransaction,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Service, FirestoreService, OrderStatus, ProductionType } from "../types";
import { SERVICES as FALLBACK_SERVICES } from "../constants";
import { getConfiguredWhatsAppUrl } from "./siteConfigService";
import { isValidWhatsAppUrl, planCreateWhatsApp, planUpdateWhatsApp, planAutoLinkSync } from "./serviceWhatsApp.js";

export const SERVICES_COLLECTION = "services";
export const INTERNAL_CONTENT_SERVICE_ID = 'internal-content-production';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Opções de configuração para busca de serviços.
 */
export interface ServiceFetchOptions {
  /** Se deve buscar apenas serviços marcados como ativos. Padrão: false */
  onlyActive?: boolean;
  /** Se deve retornar os dados de fallback em caso de erro. Padrão: true */
  fallbackOnError?: boolean;
}

export interface CreateServiceInput {
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  category: string;
  /** Opcional: se omitido, é gerado a partir do número padrão configurado em /admin. */
  whatsappUrl?: string;
  active?: boolean;
  order?: number;
  badgeText?: string;
  generateOrder?: boolean;
  productionType?: ProductionType;
  initialStatus?: OrderStatus;
  autoComplete?: boolean;
  defaultDeliveryDays?: number;
}

export interface UpdateServiceInput {
  title?: string;
  price?: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  whatsappUrl?: string;
  active?: boolean;
  order?: number;
  badgeText?: string;
  generateOrder?: boolean;
  productionType?: ProductionType | null;
  initialStatus?: OrderStatus | null;
  autoComplete?: boolean;
  defaultDeliveryDays?: number | null;
}

/**
 * Validação de link de WhatsApp individual do serviço.
 * Aceita wa.me, api.whatsapp.com e rejeita esquemas inseguros ou vazios.
 */
export const isValidServiceWhatsAppUrl = isValidWhatsAppUrl;

/**
 * Interface que representa o estado de carregamento e dados dos serviços.
 */
export interface ServicesState {
  services: Service[];
  loading: boolean;
  error: string | null;
}

/**
 * Converte dados brutos do Firestore para o tipo Service da aplicação com fallback seguro.
 */
export function mapDocToService(docId: string, data: any): Service {
  // Se não houver whatsappUrl no documento, constrói a URL oficial inicial baseada no título
  const defaultWhatsapp = `https://wa.me/5531999044206?text=${encodeURIComponent(
    'Olá, gostaria de saber mais sobre os serviços do Heroi da Cidade! Tenho interesse no serviço: ' + (data.title || '')
  )}`;

  return {
    id: docId,
    title: data.title || "",
    price: data.price || "",
    description: data.description || "",
    imageUrl: data.imageUrl || "",
    category: data.category || "Geral",
    whatsappUrl: data.internalOnly ? data.whatsappUrl || '' : data.whatsappUrl || defaultWhatsapp,
    active: data.active !== false,
    order: typeof data.order === "number" ? data.order : 0,
    badgeText: data.badgeText || undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...(data.generateOrder !== undefined ? { generateOrder: data.generateOrder } : {}),
    ...(data.productionType !== undefined ? { productionType: data.productionType } : {}),
    ...(data.initialStatus !== undefined ? { initialStatus: data.initialStatus } : {}),
    ...(data.autoComplete !== undefined ? { autoComplete: data.autoComplete } : {}),
    ...(data.defaultDeliveryDays !== undefined ? { defaultDeliveryDays: data.defaultDeliveryDays } : {}),
    ...(data.internalOnly === true ? { internalOnly: true } : {}),
  };
}

/**
 * Função principal da camada de serviço:
 * Busca serviços da coleção 'services' do Firestore, filtra por serviços ativos por padrão
 * e ordena pelo campo 'order' de forma crescente.
 * 
 * Inclui tratamento de erros com log detalhado e estratégia de fallback resiliente.
 */
export async function getServices(options: ServiceFetchOptions = {}): Promise<Service[]> {
  const { onlyActive = true, fallbackOnError = true } = options;

  if (!db) {
    const warningMsg = "[servicesService] Firebase Firestore não inicializado. Utilizando fallback local.";
    console.warn(warningMsg);
    if (!fallbackOnError) {
      throw new Error(warningMsg);
    }
    return onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES;
  }

  try {
    const querySnapshot = await getDocs(collection(db, SERVICES_COLLECTION));

    if (querySnapshot.empty) {
      console.info("[servicesService] Coleção 'services' vazia. Utilizando fallback temporário.");
      return onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES;
    }

    let services: Service[] = querySnapshot.docs.map((docSnap) =>
      mapDocToService(docSnap.id, docSnap.data())
    );

    // Filtrar apenas serviços ativos se solicitado
    if (onlyActive) {
      services = services.filter((service) => service.active !== false && !service.internalOnly);
    }

    // Ordenar pelo campo 'order' ascendente (1, 2, 3, ...)
    services.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return services.length > 0
      ? services
      : (onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES);
  } catch (error: any) {
    const errorMessage = error?.message || "Erro desconhecido ao carregar serviços do Firestore";
    console.error("[servicesService] Erro ao buscar serviços:", error);

    if (!fallbackOnError) {
      throw new Error(`Falha no serviço de serviços: ${errorMessage}`);
    }

    // Resiliência: mantém a interface visual intacta em caso de falha de conexão/permissões
    return onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES;
  }
}

/**
 * Alias semântico para buscar exclusivamente serviços ativos ordenados por 'order'.
 */
export async function getActiveServices(): Promise<Service[]> {
  return getServices({ onlyActive: true });
}

/**
 * Busca um serviço específico por ID no Firestore.
 */
export async function getServiceById(id: string): Promise<Service | null> {
  if (!db || !id) {
    return FALLBACK_SERVICES.find((s) => s.id === id) || null;
  }

  try {
    const docRef = doc(db, SERVICES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return mapDocToService(docSnap.id, docSnap.data());
    }

    return FALLBACK_SERVICES.find((s) => s.id === id) || null;
  } catch (error) {
    console.error(`[servicesService] Erro ao buscar serviço ID ${id}:`, error);
    return FALLBACK_SERVICES.find((s) => s.id === id) || null;
  }
}

/**
 * Inscrição em tempo real para mudanças nos serviços (ativos por padrão).
 */
export function subscribeToServices(
  onUpdate: (services: Service[]) => void,
  onError?: (error: Error) => void,
  options: ServiceFetchOptions = {}
): Unsubscribe {
  const { onlyActive = true } = options;

  if (!db) {
    onUpdate(onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES);
    return () => {};
  }

  try {
    return onSnapshot(
      collection(db, SERVICES_COLLECTION),
      (snapshot) => {
        if (snapshot.empty) {
          onUpdate(onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES);
          return;
        }

        let services: Service[] = snapshot.docs.map((docSnap) =>
          mapDocToService(docSnap.id, docSnap.data())
        );

        if (onlyActive) {
          services = services.filter((s) => s.active !== false && !s.internalOnly);
        }

        services.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        onUpdate(services.length > 0 ? services : FALLBACK_SERVICES);
      },
      (err) => {
        console.warn("[servicesService] Erro na inscrição em tempo real:", err);
        if (onError) onError(err);
        onUpdate(onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES);
      }
    );
  } catch (error: any) {
    console.warn("[servicesService] Falha ao iniciar listener:", error);
    if (onError) onError(error);
    onUpdate(onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES);
    return () => {};
  }
}

/**
 * Alias semântico para inscrição em tempo real de serviços ativos.
 */
export function subscribeToActiveServices(
  onUpdate: (services: Service[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return subscribeToServices(onUpdate, onError, { onlyActive: true });
}

/**
 * Estratégia de estado de carregamento (Loading State Strategy):
 * Hook React que encapsula:
 * - Carregamento inicial (loading: true -> loading: false)
 * - Tratamento de erros detalhado (error: string | null)
 * - Sincronização em tempo real opcional
 * - Função manual de recarga (refetch)
 */
export function useServices(hookOptions: {
  onlyActive?: boolean;
  realTime?: boolean;
} = {}) {
  const { onlyActive = true, realTime = true } = hookOptions;

  const [state, setState] = useState<ServicesState>({
    services: [],
    loading: true,
    error: null,
  });

  const fetchServicesData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getServices({ onlyActive });
      setState({
        services: data,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      const errorMsg = err?.message || "Não foi possível carregar os serviços.";
      setState({
        services: FALLBACK_SERVICES,
        loading: false,
        error: errorMsg,
      });
    }
  }, [onlyActive]);

  useEffect(() => {
    let isMounted = true;

    if (!realTime) {
      fetchServicesData();
      return () => {
        isMounted = false;
      };
    }

    // Estratégia com listener em tempo real
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe = subscribeToServices(
      (updatedServices) => {
        if (isMounted) {
          setState({
            services: updatedServices,
            loading: false,
            error: null,
          });
        }
      },
      (err) => {
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            services: prev.services.length > 0 ? prev.services : FALLBACK_SERVICES,
            loading: false,
            error: err?.message || "Erro na sincronização em tempo real.",
          }));
        }
      },
      { onlyActive }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [realTime, onlyActive, fetchServicesData]);

  return {
    services: state.services,
    loading: state.loading,
    error: state.error,
    refetch: fetchServicesData,
  };
}

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
    const existingMap = new Map<string, any>();
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
    console.error("[servicesService] Falha ao migrar serviços para o Firestore:", error);
    throw error;
  }
}

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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newDocRef, payload);
  } catch (err: any) {
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
    } catch (updateErr: any) {
      // Se o documento ainda não existia fisicamente, cria com merge
      if (updateErr?.code === 'not-found' || updateErr?.message?.includes('No document to update')) {
        await setDoc(docRef, payload, { merge: true });
      } else {
        throw updateErr;
      }
    }
  } catch (err: any) {
    if (err?.message?.includes("permission") || err?.code === "permission-denied") {
      handleFirestoreError(err, OperationType.UPDATE, `${SERVICES_COLLECTION}/${id}`);
    }
    throw err;
  }
}

/** Cria (uma única vez) o serviço oculto usado por pedidos de gravação da biblioteca. */
export async function ensureInternalContentService(): Promise<Service> {
  if (!db) throw new Error('Firestore não inicializado.');
  const firestore = db;
  const reference = doc(firestore, SERVICES_COLLECTION, INTERNAL_CONTENT_SERVICE_ID);
  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) {
      const service = mapDocToService(snapshot.id, snapshot.data());
      if (!service.internalOnly || service.active !== false || service.category !== 'Conteúdo' || service.generateOrder !== true || service.productionType !== 'recording' || service.initialStatus !== 'recording' || service.autoComplete !== false || service.defaultDeliveryDays !== undefined || service.price !== 'R$ 0,00') {
        throw new Error('O ID reservado ao serviço interno de Conteúdo já está ocupado por uma configuração diferente. Revise-o manualmente.');
      }
      return service;
    }
    const service: Service = {
      id: INTERNAL_CONTENT_SERVICE_ID,
      title: 'Produção interna de conteúdo',
      price: 'R$ 0,00',
      description: 'Serviço interno para roteiros enviados à gravação pela Biblioteca de Roteiros.',
      imageUrl: '',
      category: 'Conteúdo',
      whatsappUrl: '',
      active: false,
      order: 0,
      generateOrder: true,
      productionType: 'recording',
      initialStatus: 'recording',
      autoComplete: false,
      internalOnly: true,
    };
    transaction.set(reference, { ...service, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return service;
  });
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
  } catch (err: any) {
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

