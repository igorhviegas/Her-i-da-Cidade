import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { InstagramPost } from './instagramMetrics.js';
import type { DailySummary } from './instagramDaily.js';

export interface InstagramProfile {
  username: string | null; followers: number | null; mediaCount: number | null; loadedPosts?: number;
  syncedAt?: string; lastAttemptAt?: string; lastError?: { code: string; message: string } | null;
  warning?: { code: string; message: string } | null; tokenExpiresAt?: string | null;
  daily?: DailySummary | null;
}

/** Perfil espelhado pelo servidor (null = ainda nunca sincronizado). */
export function subscribeInstagramProfile(onData: (profile: InstagramProfile | null) => void, onError: (e: Error) => void) {
  if (!db) { onError(new Error('Firestore não inicializado.')); return () => {}; }
  return onSnapshot(doc(db, 'instagramMeta', 'profile'), (snap) => onData(snap.exists() ? (snap.data() as InstagramProfile) : null), onError);
}

export function subscribeInstagramPosts(onData: (posts: InstagramPost[]) => void, onError: (e: Error) => void) {
  if (!db) { onError(new Error('Firestore não inicializado.')); return () => {}; }
  return onSnapshot(collection(db, 'instagramPosts'), (snap) => onData(snap.docs.map((d) => d.data() as InstagramPost)), onError);
}

/** Sincronização manual: o servidor valida o administrador e usa o token guardado no backend. */
export async function syncInstagramNow(): Promise<{ status: 'completed' | 'running' | 'cooldown'; afterFailure?: boolean }> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Faça login como administrador.');
  const response = await fetch('/api/instagram-sync', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? 'Não foi possível sincronizar agora.');
  return { status: body.status, afterFailure: Boolean(body.afterFailure) };
}
