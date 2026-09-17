import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  Unsubscribe,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";
import {
  Service,
  FirestoreService,
  FirestoreVideo,
  adaptFirestoreServiceToLegacy,
  adaptLegacyServiceToFirestore
} from "../types";
import { SERVICES as DEFAULT_SERVICES } from "../constants";
import { getActiveServices, subscribeToActiveServices, seedServicesIfEmpty } from "../services/servicesService";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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

/**
 * Tratamento centralizado de erros do Firestore conforme diretrizes de segurança.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentAuth = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.uid,
      email: currentAuth?.email,
      emailVerified: currentAuth?.emailVerified,
      isAnonymous: currentAuth?.isAnonymous,
      tenantId: currentAuth?.tenantId,
      providerInfo: currentAuth?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error("[Firestore Error]", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Busca todos os serviços públicos ativos no Firestore através da camada oficial servicesService.
 */
export async function getPublicServices(): Promise<Service[]> {
  return getActiveServices();
}

/**
 * Inscrição em tempo real para mudanças nos serviços públicos através da camada oficial servicesService.
 */
export function subscribeToPublicServices(
  onUpdate: (services: Service[]) => void
): Unsubscribe {
  return subscribeToActiveServices(onUpdate);
}

/**
 * Função utilitária de migração:
 * Popula a coleção 'services' no Firestore a partir dos dados do constants.tsx
 * caso a coleção esteja vazia. Pode ser executada por um administrador.
 */
export async function seedInitialServices(): Promise<{ success: boolean; count: number }> {
  const res = await seedServicesIfEmpty();
  return { success: true, count: res.insertedCount };
}

/**
 * Busca de vídeos para o futuro catálogo de vídeos do Instagram.
 */
export async function getPublicVideos(): Promise<FirestoreVideo[]> {
  if (!db) return [];

  const path = "videos";
  try {
    const snapshot = await getDocs(collection(db, path));

    const videos = snapshot.docs
      .map((d) => ({
        ...(d.data() as Omit<FirestoreVideo, "id">),
        id: d.id,
      }))
      .filter((v: any) => v.active !== false);

    videos.sort((a: any, b: any) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    return videos;
  } catch (error) {
    console.warn("[Firestore] Não foi possível carregar vídeos:", error);
    return [];
  }
}
