import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Order } from '../types';

/** Evento antigo importado do PDF do Google Forms (aba Mapa). Não é pedido: não entra no Kanban nem no Financeiro. */
export interface HistoryEvent { id: string; childName: string; eventDate: string; eventTime: string; location: string; eventGeo?: Order['eventGeo'] }

const COLLECTION = 'eventHistory';

export async function listEventHistory(): Promise<HistoryEvent[]> {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  return (await getDocs(collection(db, COLLECTION))).docs.map((d) => ({ ...(d.data() as Omit<HistoryEvent, 'id'>), id: d.id }));
}

/** Grava (ou sobrescreve, se o mesmo PDF for importado de novo) um evento antigo. */
export async function saveHistoryEvent(event: HistoryEvent): Promise<void> {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  const { id, childName, eventDate, eventTime, location } = event;
  await setDoc(doc(db, COLLECTION, id), { childName, eventDate, eventTime, location, source: 'google-form', importedAt: serverTimestamp() });
}
