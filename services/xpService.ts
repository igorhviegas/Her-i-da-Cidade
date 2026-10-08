import { collection, doc, getCountFromServer, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, type DocumentSnapshot, type QuerySnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BASELINE_PATH, buildBaseline } from '../functions/xp.js';
import { ACTIVITY_LOG_COLLECTION } from './activityLog';
import { ORDERS_COLLECTION } from './ordersService';
import { CONTENT_SCRIPTS_COLLECTION } from './contentScriptsService';
import { GOALS_COLLECTION, GOAL_CYCLES_COLLECTION, MISSIONS_COLLECTION, OCCURRENCES_COLLECTION, getActivityDifficulties } from './missionsService';

function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}

const rows = async (name: string, ...constraints: ReturnType<typeof where>[]) =>
  (await getDocs(query(collection(firestore(), name), ...constraints))).docs.map((d) => ({ ...d.data(), id: d.id }) as Record<string, any>);

/** Escuta a linha de base do XP; sem Firestore inicializado não há o que escutar (retorna undefined). */
export function subscribeToXpBaseline(next: (snapshot: DocumentSnapshot) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  return onSnapshot(doc(db, ...BASELINE_PATH), next, onError);
}

/** Escuta o histórico de atividades (base do XP e das janelinhas de ganho). */
export function subscribeToActivityLog(next: (snapshot: QuerySnapshot) => void, onError: (error: Error) => void): Unsubscribe | undefined {
  if (!db) return;
  return onSnapshot(collection(db, ACTIVITY_LOG_COLLECTION), next, onError);
}

/** XP retroativo calculado com os dados que existem agora (somente leitura; não grava nada). */
export async function previewBaseline() {
  const profile = await getDoc(doc(firestore(), 'instagramMeta', 'profile'));
  const [orders, scripts, posts, missions, occurrences, goalCycles, goals, difficulties] = await Promise.all([
    rows(ORDERS_COLLECTION, where('status', '==', 'completed')),
    rows(CONTENT_SCRIPTS_COLLECTION),
    rows('instagramPosts'), // todos os já sincronizados (inclusive os que saíram das últimas 100): acumulado, não só o conjunto atual
    rows(MISSIONS_COLLECTION, where('status', '==', 'completed')),
    rows(OCCURRENCES_COLLECTION, where('status', '==', 'completed')),
    rows(GOAL_CYCLES_COLLECTION),
    rows(GOALS_COLLECTION),
    getActivityDifficulties(),
  ]);
  const followers = profile.exists() && typeof profile.data().followers === 'number' ? profile.data().followers : 0;
  return buildBaseline({ orders, scripts, ig: { followers, posts }, missions, occurrences, goalCycles, goals, scriptDifficulty: difficulties.script_created ?? null });
}

/** Grava a linha de base uma única vez (as regras do Firestore recusam qualquer nova gravação ou alteração). */
export async function activateXp(baseline: Awaited<ReturnType<typeof previewBaseline>>): Promise<void> {
  await setDoc(doc(firestore(), ...BASELINE_PATH), { ...baseline, at: serverTimestamp() });
}

/** Contadores e seguidores do perfil, direto das fontes reais (nada é copiado nem cadastrado à mão). */
export async function loadProfileCounts() {
  const count = async (name: string, ...constraints: ReturnType<typeof where>[]) => (await getCountFromServer(query(collection(firestore(), name), ...constraints))).data().count;
  const [profile, missions, goals] = await Promise.all([
    getDoc(doc(firestore(), 'instagramMeta', 'profile')),
    count(MISSIONS_COLLECTION, where('status', '==', 'completed')),
    count(ACTIVITY_LOG_COLLECTION, where('type', '==', 'goal_completed')),
  ]);
  const followers = profile.exists() && typeof profile.data().followers === 'number' ? (profile.data().followers as number) : null;
  return { followers, syncedAt: (profile.data()?.syncedAt as string | undefined) ?? null, missions, goals };
}
