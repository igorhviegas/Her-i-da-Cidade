import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SystemStatusDoc } from './systemHealth.js';

/** Telemetria das rotinas agendadas (systemStatus/{job}, gravada pelo servidor; só administradores leem). */
export function subscribeSystemStatus(onData: (status: Record<string, SystemStatusDoc>) => void, onError: (error: Error) => void) {
  if (!db) { onError(new Error('Firestore não inicializado.')); return () => {}; }
  return onSnapshot(
    collection(db, 'systemStatus'),
    (snapshot) => onData(Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data() as SystemStatusDoc]))),
    onError,
  );
}
