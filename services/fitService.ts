import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FitDailyRow } from './fitDaily.js';

export type { FitDailyRow };

/** Totais diários do Apple Saúde (users/{uid}/fitDaily, gravados pelo servidor; as regras só deixam o próprio dono ler). */
export async function loadFitDaily(uid: string, days: number): Promise<FitDailyRow[]> {
  if (!db) throw new Error('Firestore não inicializado.');
  const snapshot = await getDocs(query(collection(db, 'users', uid, 'fitDaily'), orderBy('day', 'desc'), limit(days))); // 1 documento por dia
  return snapshot.docs.map((d) => {
    const data = d.data();
    return { ...data, day: d.id, updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate() : undefined } as FitDailyRow;
  });
}
