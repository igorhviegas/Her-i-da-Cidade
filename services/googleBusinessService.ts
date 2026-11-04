import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebaseAuth';
import type { DailyMetric, NormalizedReview } from '../functions/google-business.js';

export interface GoogleProfile {
  rating: number | null; total: number | null; loaded: number; unanswered: number;
  syncedAt?: string; lastAttemptAt?: string; lastError?: { code: string; message: string } | null; metricsError?: string | null;
}
export type GoogleReview = NormalizedReview & { syncedAt?: string };
export type GoogleDay = DailyMetric;

/** Resumo espelhado pelo servidor (null = ainda nunca sincronizado). */
export function subscribeGoogleProfile(onData: (profile: GoogleProfile | null) => void, onError: (e: Error) => void) {
  if (!db) { onError(new Error('Firestore não inicializado.')); return () => {}; }
  return onSnapshot(doc(db, 'googleMeta', 'profile'), (snap) => onData(snap.exists() ? (snap.data() as GoogleProfile) : null), onError);
}

export function subscribeGoogleReviews(onData: (reviews: GoogleReview[]) => void, onError: (e: Error) => void) {
  if (!db) { onError(new Error('Firestore não inicializado.')); return () => {}; }
  return onSnapshot(collection(db, 'googleReviews'), (snap) => onData(snap.docs.map((d) => d.data() as GoogleReview)), onError);
}

export function subscribeGoogleDays(onData: (days: GoogleDay[]) => void, onError: (e: Error) => void) {
  if (!db) { onError(new Error('Firestore não inicializado.')); return () => {}; }
  return onSnapshot(doc(db, 'googleMeta', 'daily'), (snap) => onData(snap.exists() ? ((snap.data().days ?? []) as GoogleDay[]) : []), onError);
}

/** Sincronização manual: o servidor valida o administrador e usa as credenciais guardadas no backend. */
export async function syncGoogleNow(): Promise<{ status: 'completed' | 'cooldown'; afterFailure?: boolean; metricsError?: string | null }> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Faça login como administrador.');
  const response = await fetch('/api/google-business', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? 'Não foi possível sincronizar agora.');
  return { status: body.status, afterFailure: Boolean(body.afterFailure), metricsError: body.metricsError ?? null };
}
