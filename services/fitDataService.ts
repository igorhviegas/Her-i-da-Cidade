import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FIT_EVENT_TYPES } from '../functions/xp.js';
import { ACTIVITY_LOG_COLLECTION, activityLogId } from '../functions/activity-log.js';
import { checkinId, type Checkin, type CheckinKind } from './fitCheckin.js';
import type { Exercise, Workout } from './fitWorkout.js';

// Tudo do Fit mora em users/{uid}/... (regras: só o dono, administrador). Ver docs/fit.md.
function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}
const col = (uid: string, name: string) => collection(firestore(), 'users', uid, name);
const withId = <T,>(snapshot: { docs: { id: string; data(): any }[] }) => snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as T);

// ---- Peso manual (um por dia; o id é o dia) ----
export interface WeightEntry { id: string; day: string; kg: number }
export const loadWeights = async (uid: string, max = 400) => withId<WeightEntry>(await getDocs(query(col(uid, 'fitWeight'), orderBy('day', 'desc'), limit(max))));
export const saveWeight = (uid: string, { day, kg }: { day: string; kg: number }) => setDoc(doc(col(uid, 'fitWeight'), day), { day, kg, updatedAt: serverTimestamp() });
export const deleteWeight = (uid: string, day: string) => deleteDoc(doc(col(uid, 'fitWeight'), day));

// ---- Check-ins de academia e funcional (um por tipo e dia) ----
export const loadCheckins = async (uid: string, max = 200) => withId<Checkin>(await getDocs(query(col(uid, 'fitCheckins'), orderBy('day', 'desc'), limit(max))));
export type CheckinInput = { kind: CheckinKind; day: string; durationMin?: number; note?: string; workoutName?: string; exercisesDone?: number; exercisesTotal?: number };
/** Grava (ou corrige) o check-in do dia; o documento é regravado por inteiro, então campo omitido sai do registro. */
export const saveCheckin = (uid: string, input: CheckinInput) => setDoc(doc(col(uid, 'fitCheckins'), checkinId(input.kind, input.day)), { ...input, updatedAt: serverTimestamp() });
export const deleteCheckin = (uid: string, id: string) => deleteDoc(doc(col(uid, 'fitCheckins'), id));

// ---- Biblioteca de exercícios e planos de treino ----
export const loadExercises = async (uid: string) => withId<Exercise>(await getDocs(query(col(uid, 'fitExercises'), limit(500))));
export async function saveExercise(uid: string, id: string | null, value: { name: string; category: string; timerSec: number | null }) {
  const ref = id ? doc(col(uid, 'fitExercises'), id) : doc(col(uid, 'fitExercises'));
  await setDoc(ref, { ...value, updatedAt: serverTimestamp() });
  return ref.id;
}
export const deleteExercise = (uid: string, id: string) => deleteDoc(doc(col(uid, 'fitExercises'), id));

export const loadWorkouts = async (uid: string) => withId<Workout>(await getDocs(query(col(uid, 'fitWorkouts'), limit(100))));
export async function saveWorkout(uid: string, id: string | null, value: { name: string; exerciseIds: string[] }) {
  const ref = id ? doc(col(uid, 'fitWorkouts'), id) : doc(col(uid, 'fitWorkouts'));
  await setDoc(ref, { ...value, updatedAt: serverTimestamp() });
  return ref.id;
}
export const deleteWorkout = (uid: string, id: string) => deleteDoc(doc(col(uid, 'fitWorkouts'), id));

// ---- XP do Fit ----
export type FitXpType = 'fit_ride' | 'fit_steps' | 'fit_checkin';

/** Ids (tipo_refId) dos eventos de XP do Fit já coletados. */
export async function loadFitClaims(): Promise<Set<string>> {
  const snapshot = await getDocs(query(collection(firestore(), ACTIVITY_LOG_COLLECTION), where('type', 'in', FIT_EVENT_TYPES)));
  return new Set(snapshot.docs.map((d) => d.id));
}

/**
 * Coleta o XP: grava UM evento no activityLog (id tipo_refId, criado uma única vez, com o XP congelado e a hora do servidor).
 * Já coletado devolve 'already' sem gravar. As regras do Firestore conferem que a origem existe e que o XP não passa do que ela vale.
 */
export async function claimFitXp(type: FitXpType, refId: string, xp: number, meta: Record<string, unknown> = {}): Promise<'claimed' | 'already'> {
  const ref = doc(firestore(), ACTIVITY_LOG_COLLECTION, activityLogId(type, refId));
  return runTransaction(firestore(), async (tx) => {
    if ((await tx.get(ref)).exists()) return 'already';
    tx.set(ref, { type, refId, difficulty: null, difficultyKey: null, occurredAt: serverTimestamp(), xp, meta });
    return 'claimed';
  });
}
