import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Service } from "../../types";
import { SERVICES_COLLECTION, INTERNAL_CONTENT_SERVICE_ID, mapDocToService } from "./serviceDocument";

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
