import { collection, deleteField, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../types';

export const CONTENT_SCRIPTS_COLLECTION = 'contentScripts';

export type ContentScriptInput = {
  title: string;
  content: string;
  category: string;
  productionStatus: ScriptProductionStatus;
  publicationStatus: ScriptPublicationStatus;
  publishedAt?: Date | null;
  notes: string;
};

function mapScript(id: string, data: Record<string, any>): ContentScript {
  return {
    id,
    title: data.title || '',
    content: data.content || '',
    category: data.category || '',
    productionStatus: data.productionStatus || 'draft',
    publicationStatus: data.publicationStatus || 'unpublished',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    publishedAt: data.publishedAt,
    notes: data.notes || '',
    ...(typeof data.orderId === 'string' ? { orderId: data.orderId } : {}),
    ...(typeof data.sourceScriptId === 'string' ? { sourceScriptId: data.sourceScriptId } : {}),
  };
}

function validate(input: ContentScriptInput): ContentScriptInput {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new Error('Informe o título do roteiro.');
  if (!content) throw new Error('Informe o conteúdo do roteiro.');
  return { ...input, title, content, category: input.category.trim(), notes: input.notes.trim() };
}

export async function listContentScripts(): Promise<ContentScript[]> {
  if (!db) throw new Error('Firestore não inicializado.');
  const snapshot = await getDocs(collection(db, CONTENT_SCRIPTS_COLLECTION));
  return snapshot.docs
    .map((item) => mapScript(item.id, item.data()))
    .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
}

export async function createContentScript(input: ContentScriptInput): Promise<ContentScript> {
  if (!db) throw new Error('Firestore não inicializado.');
  const clean = validate(input);
  const reference = doc(collection(db, CONTENT_SCRIPTS_COLLECTION));
  const { publishedAt, ...fields } = clean;
  await setDoc(reference, {
    ...fields,
    ...(publishedAt ? { publishedAt } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ...clean, id: reference.id };
}

export async function updateContentScript(id: string, input: ContentScriptInput): Promise<void> {
  if (!db) throw new Error('Firestore não inicializado.');
  if (!id) throw new Error('ID do roteiro é obrigatório.');
  const clean = validate(input);
  const { publishedAt, ...fields } = clean;
  await updateDoc(doc(db, CONTENT_SCRIPTS_COLLECTION, id), {
    ...fields,
    publishedAt: publishedAt || deleteField(),
    updatedAt: serverTimestamp(),
  });
}

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof (value as any)?.toDate === 'function') return (value as any).toDate().getTime();
  const parsed = value ? new Date(value as string | number).getTime() : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}
