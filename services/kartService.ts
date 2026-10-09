import { logger } from '../lib/logger.js';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import type { KartPilot, KartRace } from './kart.js';
import { DEFAULT_KART_PILOTS } from './kartPilots.js';
import type { KartNextConfig } from './kartNext.js';
import type { KartVideo } from './kartVideos.js';

export type { KartPilot, KartRace, KartResult } from './kart.js';
export type { KartVideo, KartVideoKind } from './kartVideos.js';

// Leitura pública (a área /kart não tem login); escrita só de administradores (firestore.rules).
const PILOTS = 'kartPilots';
const RACES = 'kartRaces';
const VIDEOS = 'kartVideos';
const CONFIG = 'kartConfig';

function requireDb() {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  return db;
}

/** Assina uma coleção; `null` = ainda carregando ou com erro. */
function useCollection<T>(name: string): T[] | null {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(
      collection(db, name),
      (snap) => setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T)),
      (error) => { logger.warn(`[kartService] ${name}:`, error); setItems(null); },
    );
  }, [name]);
  return items;
}

/** Próxima corrida (kartConfig/next): undefined = carregando, null = nenhuma cadastrada. */
export function useKartNext(): KartNextConfig | null | undefined {
  const [next, setNext] = useState<KartNextConfig | null | undefined>(undefined);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(
      doc(db, CONFIG, 'next'),
      (snap) => setNext(snap.exists() ? (snap.data() as KartNextConfig) : null),
      (error) => { logger.warn('[kartService] kartConfig/next:', error); setNext(null); },
    );
  }, []);
  return next;
}

export const saveKartNext = (n: KartNextConfig) => setDoc(doc(requireDb(), CONFIG, 'next'), {
  date: n.date, time: n.time ?? '', place: (n.place ?? '').trim(), note: (n.note ?? '').trim(), updatedAt: serverTimestamp(),
});
export const clearKartNext = () => deleteDoc(doc(requireDb(), CONFIG, 'next'));

export const useKartPilots = () => useCollection<KartPilot>(PILOTS);
export const useKartRaces = () => useCollection<KartRace>(RACES);
export const useKartVideos = () => useCollection<KartVideo>(VIDEOS);

/** Id estável da corrida (data + horário da bateria): importar o mesmo PDF de novo atualiza em vez de duplicar. */
export const raceDocId = (date: string, time: string) => `${date}-${time.replace(':', '') || 'x'}`;

export const saveKartRace = (race: KartRace) => setDoc(doc(requireDb(), RACES, race.id), {
  date: race.date, heat: race.heat, weather: race.weather, extra: !!race.extra, pdfUrl: race.pdfUrl ?? '', results: race.results, updatedAt: serverTimestamp(),
});
/** Envia o PDF original da corrida para /api/upload-kart-pdf (Vercel Blob, só administradores) e devolve a URL pública. */
export async function uploadKartPdf(file: File): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Faça login como administrador para anexar o PDF.');
  const formData = new FormData();
  formData.append('file', file);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch('/api/upload-kart-pdf', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body: formData, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data?.url) throw new Error(data?.error || `Falha no upload do PDF (HTTP ${response.status}).`);
    return data.url as string;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Tempo limite esgotado ao enviar o PDF (60 s). Verifique a conexão e tente novamente.');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const deleteKartRace = (id: string) => deleteDoc(doc(requireDb(), RACES, id));

export const saveKartPilot = (p: KartPilot) => setDoc(doc(requireDb(), PILOTS, p.id), {
  name: p.name.trim(), aliases: p.aliases.map((a) => a.trim()).filter(Boolean), active: p.active !== false, updatedAt: serverTimestamp(),
});
export const deleteKartPilot = (id: string) => deleteDoc(doc(requireDb(), PILOTS, id));

/** Cadastra os pilotos iniciais (os do Notion). Só é oferecido quando a lista está vazia. */
export async function seedKartPilots() {
  const batch = writeBatch(requireDb());
  for (const p of DEFAULT_KART_PILOTS) batch.set(doc(requireDb(), PILOTS, p.id), { name: p.name, aliases: p.aliases, active: true, updatedAt: serverTimestamp() });
  await batch.commit();
}

export const saveKartVideo = (v: KartVideo) => setDoc(doc(requireDb(), VIDEOS, v.id), {
  title: v.title.trim(), youtubeId: v.youtubeId, kind: v.kind, raceId: v.raceId ?? '', order: v.order, active: v.active !== false, updatedAt: serverTimestamp(),
});
export const deleteKartVideo = (id: string) => deleteDoc(doc(requireDb(), VIDEOS, id));
