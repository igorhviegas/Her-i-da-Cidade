import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { summarizeRide, type StoredFitRide } from './fitRide.js';

export type { StoredFitRide };

const MAX_FILE_BYTES = 5 * 1024 * 1024; // um treino de horas tem poucas centenas de KB
export type ImportResult = { name: string; status: 'imported' | 'duplicate' | 'error'; message?: string };

function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}

/** Lê um .fit no navegador e grava só o resumo em users/{uid}/fitRides/{id}. O id é determinístico: reimportar o mesmo arquivo não duplica. */
export async function importFitFile(uid: string, file: File): Promise<ImportResult> {
  try {
    if (file.size > MAX_FILE_BYTES) return { name: file.name, status: 'error', message: 'Arquivo grande demais para um treino.' };
    const { default: FitParser } = await import('fit-file-parser'); // só carrega o leitor quando alguém importa
    const parsed = await new FitParser({ mode: 'list', force: false, speedUnit: 'm/s', lengthUnit: 'm' }).parseAsync(await file.arrayBuffer())
      .catch((error: unknown) => { throw new Error(`Arquivo FIT inválido (${typeof error === 'string' ? error : 'erro de leitura'}).`); });
    const result = summarizeRide(parsed);
    if ('error' in result) return { name: file.name, status: 'error', message: result.error };
    const ref = doc(firestore(), 'users', uid, 'fitRides', result.id);
    if ((await getDoc(ref)).exists()) return { name: file.name, status: 'duplicate' };
    await setDoc(ref, { ...result.ride, createdAt: serverTimestamp() });
    return { name: file.name, status: 'imported' };
  } catch (e) {
    return { name: file.name, status: 'error', message: e instanceof Error ? e.message : 'Não foi possível importar.' };
  }
}

export async function loadFitRides(uid: string, max = 200): Promise<StoredFitRide[]> {
  const snapshot = await getDocs(query(collection(firestore(), 'users', uid, 'fitRides'), orderBy('startedAt', 'desc'), limit(max)));
  return snapshot.docs.map((d) => { const data = d.data(); return { ...data, id: d.id, startedAt: data.startedAt.toDate() } as StoredFitRide; });
}

export const deleteFitRide = (uid: string, id: string) => deleteDoc(doc(firestore(), 'users', uid, 'fitRides', id));
