import { logger } from '../lib/logger.js';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { KartPilot, KartRace } from './kart.js';
import { DEFAULT_KART_PILOTS } from './kartPilots.js';
import type { KartVideo } from './kartVideos.js';

export type { KartPilot, KartRace, KartResult } from './kart.js';
export type { KartVideo, KartVideoKind } from './kartVideos.js';

// Leitura pública (a área /kart não tem login); escrita só de administradores (firestore.rules).
const PILOTS = 'kartPilots';
const RACES = 'kartRaces';
const VIDEOS = 'kartVideos';

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

export const useKartPilots = () => useCollection<KartPilot>(PILOTS);
export const useKartRaces = () => useCollection<KartRace>(RACES);
export const useKartVideos = () => useCollection<KartVideo>(VIDEOS);

/** Id estável da corrida (data + horário da bateria): importar o mesmo PDF de novo atualiza em vez de duplicar. */
export const raceDocId = (date: string, time: string) => `${date}-${time.replace(':', '') || 'x'}`;

export const saveKartRace = (race: KartRace) => setDoc(doc(requireDb(), RACES, race.id), {
  date: race.date, heat: race.heat, weather: race.weather, results: race.results, updatedAt: serverTimestamp(),
});
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
  title: v.title.trim(), youtubeId: v.youtubeId, kind: v.kind, order: v.order, active: v.active !== false, updatedAt: serverTimestamp(),
});
export const deleteKartVideo = (id: string) => deleteDoc(doc(requireDb(), VIDEOS, id));
