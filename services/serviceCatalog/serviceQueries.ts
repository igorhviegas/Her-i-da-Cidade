import { logger } from '../../lib/logger.js';
import { collection, doc, getDocs, getDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Service } from "../../types";
import { SERVICES as FALLBACK_SERVICES } from "../../constants";
import { SERVICES_COLLECTION, mapDocToService } from "./serviceDocument";
import type { ServiceFetchOptions } from "./serviceInputs";

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
    logger.warn(warningMsg);
    if (!fallbackOnError) {
      throw new Error(warningMsg);
    }
    return onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES;
  }

  try {
    const querySnapshot = await getDocs(collection(db, SERVICES_COLLECTION));

    if (querySnapshot.empty) {
      logger.info("[servicesService] Coleção 'services' vazia. Utilizando fallback temporário.");
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
    logger.error("[servicesService] Erro ao buscar serviços:", error);

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
    logger.error(`[servicesService] Erro ao buscar serviço ID ${id}:`, error);
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
        logger.warn("[servicesService] Erro na inscrição em tempo real:", err);
        if (onError) onError(err);
        onUpdate(onlyActive ? FALLBACK_SERVICES.filter((s) => s.active !== false) : FALLBACK_SERVICES);
      }
    );
  } catch (error: any) {
    logger.warn("[servicesService] Falha ao iniciar listener:", error);
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
