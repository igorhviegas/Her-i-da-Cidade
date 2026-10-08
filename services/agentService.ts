import { logger } from '../lib/logger.js';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { DEFAULT_AGENT_FAQ, DEFAULT_AGENT_STEPS, sortByOrder, type AgentFaqCategory, type AgentStep, type AgentTrack } from './agentContent.js';

export type { AgentStep, AgentTrack, AgentItem, AgentFaqCategory, AgentFaqItem } from './agentContent.js';

// Leitura pública (a área /agente-hdc não tem login); escrita só de administradores (firestore.rules).
export const AGENT_STEPS_COLLECTION = 'agentSteps';
export const AGENT_TRACKS_COLLECTION = 'agentTracks';
export const AGENT_FAQ_COLLECTION = 'agentFaq';

function requireDb() {
  if (!db) throw new Error('Firebase Firestore não inicializado.');
  return db;
}

/** Assina uma coleção; `null` = ainda carregando ou erro (o consumidor decide o fallback). */
function useCollection<T extends { id: string; order: number }>(name: string): T[] | null {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(
      collection(db, name),
      (snap) => setItems(sortByOrder(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as unknown as T))),
      (error) => { logger.warn(`[agentService] ${name}:`, error); setItems(null); },
    );
  }, [name]);
  return items;
}

/** Hook do admin: dados crus (inclui inativos), `null` enquanto carrega. */
export const useAgentStepsAdmin = () => useCollection<AgentStep>(AGENT_STEPS_COLLECTION);
export const useAgentTracksAdmin = () => useCollection<AgentTrack>(AGENT_TRACKS_COLLECTION);
export const useAgentFaqAdmin = () => useCollection<AgentFaqCategory>(AGENT_FAQ_COLLECTION);

/**
 * Conteúdo da área do agente. Sem etapas gravadas (ou Firestore indisponível) usa o roteiro padrão,
 * então o link nunca abre vazio no meio de um evento.
 */
export function useAgentContent() {
  const rawSteps = useAgentStepsAdmin();
  const rawTracks = useAgentTracksAdmin();
  const rawFaq = useAgentFaqAdmin();
  const faq = rawFaq && rawFaq.length > 0 ? rawFaq : DEFAULT_AGENT_FAQ;
  const steps = rawSteps && rawSteps.length > 0 ? rawSteps : DEFAULT_AGENT_STEPS;
  return {
    steps: steps.filter((s) => s.active !== false),
    tracks: (rawTracks ?? []).filter((t) => t.active !== false && !!t.url),
    tracksLoading: rawTracks === null,
    faq: faq.filter((c) => c.active !== false),
  };
}

const stepPayload = (step: AgentStep) => ({
  title: step.title.trim(),
  kicker: step.kicker?.trim() ?? '',
  description: step.description ?? '',
  alert: step.alert ?? '',
  highlight: !!step.highlight,
  startButton: !!step.startButton,
  active: step.active !== false,
  order: step.order,
  items: step.items.map((i) => ({ id: i.id, text: i.text, heading: !!i.heading, note: !!i.note })),
  updatedAt: serverTimestamp(),
});

export const saveAgentStep = (step: AgentStep) => setDoc(doc(requireDb(), AGENT_STEPS_COLLECTION, step.id), stepPayload(step));
export const deleteAgentStep = (id: string) => deleteDoc(doc(requireDb(), AGENT_STEPS_COLLECTION, id));

const faqPayload = (c: AgentFaqCategory) => ({
  title: c.title.trim(), active: c.active !== false, order: c.order,
  items: c.items.map((i) => ({ id: i.id, question: i.question, answer: i.answer })),
  updatedAt: serverTimestamp(),
});
export const saveAgentFaq = (c: AgentFaqCategory) => setDoc(doc(requireDb(), AGENT_FAQ_COLLECTION, c.id), faqPayload(c));
export const deleteAgentFaq = (id: string) => deleteDoc(doc(requireDb(), AGENT_FAQ_COLLECTION, id));
export async function seedDefaultAgentFaq() {
  const batch = writeBatch(requireDb());
  DEFAULT_AGENT_FAQ.forEach((c) => batch.set(doc(requireDb(), AGENT_FAQ_COLLECTION, c.id), faqPayload(c)));
  await batch.commit();
}

export async function seedDefaultAgentSteps() {
  const batch = writeBatch(requireDb());
  DEFAULT_AGENT_STEPS.forEach((step) => batch.set(doc(requireDb(), AGENT_STEPS_COLLECTION, step.id), stepPayload(step)));
  await batch.commit();
}

export const saveAgentTrack = (track: AgentTrack) => setDoc(doc(requireDb(), AGENT_TRACKS_COLLECTION, track.id), {
  title: track.title.trim(), url: track.url, active: track.active !== false, order: track.order, parentId: track.parentId ?? '', updatedAt: serverTimestamp(),
});
export const deleteAgentTrack = (id: string) => deleteDoc(doc(requireDb(), AGENT_TRACKS_COLLECTION, id));

/** Grava a nova ordem (índice na lista = `order`) de uma só vez. */
export async function reorderAgentDocs(name: typeof AGENT_STEPS_COLLECTION | typeof AGENT_TRACKS_COLLECTION | typeof AGENT_FAQ_COLLECTION, ids: string[]) {
  const batch = writeBatch(requireDb());
  ids.forEach((id, order) => batch.update(doc(requireDb(), name, id), { order }));
  await batch.commit();
}

export const MAX_AUDIO_MB = 4;

/** Envia o áudio para /api/upload-agent-audio (Vercel Blob, só administradores) e devolve a URL pública. */
export async function uploadAgentAudio(file: File): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Faça login como administrador para enviar áudios.');
  if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
    throw new Error(`O arquivo tem ${(file.size / 1048576).toFixed(1)} MB; o limite de envio é ${MAX_AUDIO_MB} MB. Comprima o áudio (MP3 128 kbps) ou use o campo de link.`);
  }
  const formData = new FormData();
  formData.append('file', file);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch('/api/upload-agent-audio', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      body: formData,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success || !data?.url) throw new Error(data?.error || `Falha no upload do áudio (HTTP ${response.status}).`);
    return data.url as string;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Tempo limite esgotado ao enviar o áudio (90 s). Verifique a conexão e tente novamente.');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
