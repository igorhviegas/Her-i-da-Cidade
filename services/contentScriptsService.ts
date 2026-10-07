import { collection, deleteField, doc, documentId, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { activityRefs, prepareActivityLog } from './activityLog';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../types';

export const CONTENT_SCRIPTS_COLLECTION = 'contentScripts';

function logContentScriptsError(operation: string, error: unknown): void {
  console.error(`[contentScriptsService] Falha na operação: ${operation}`, {
    error,
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export type ContentScriptInput = {
  title: string;
  content: string;
  category: string;
  productionStatus: ScriptProductionStatus;
  publicationStatus: ScriptPublicationStatus;
  publishedAt?: Date | null;
  notes: string;
  parentScriptId?: string | null;
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
    ...(typeof data.parentScriptId === 'string' ? { parentScriptId: data.parentScriptId } : {}),
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
  try {
    const snapshot = await getDocs(collection(db, CONTENT_SCRIPTS_COLLECTION));
    return snapshot.docs
      .map((item) => mapScript(item.id, item.data()))
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
  } catch (error) {
    logContentScriptsError(`getDocs(collection(db, '${CONTENT_SCRIPTS_COLLECTION}'))`, error);
    throw error;
  }
}

/** Busca roteiros associados a pedidos em consultas agrupadas, evitando uma leitura por pedido. */
export async function getContentScriptsByIds(ids: string[]): Promise<ContentScript[]> {
  if (!db) throw new Error('Firestore não inicializado.');
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim())));
  if (uniqueIds.some((id) => id.includes('/'))) throw new Error('A lista contém um ID inválido de roteiro.');
  const results: ContentScript[] = [];
  for (let start = 0; start < uniqueIds.length; start += 30) {
    const idBatch = uniqueIds.slice(start, start + 30);
    try {
      const snapshot = await getDocs(query(
        collection(db, CONTENT_SCRIPTS_COLLECTION),
        where(documentId(), 'in', idBatch),
      ));
      results.push(...snapshot.docs.map((item) => mapScript(item.id, item.data())));
    } catch (error) {
      logContentScriptsError(`buscar roteiros em lote por IDs (${idBatch.join(', ')})`, error);
      throw error;
    }
  }
  return results;
}

export async function getContentScriptById(id: string): Promise<ContentScript | null> {
  if (!db) throw new Error('Firestore não inicializado.');
  if (!id) return null;
  try {
    const snapshot = await getDoc(doc(db, CONTENT_SCRIPTS_COLLECTION, id));
    return snapshot.exists() ? mapScript(snapshot.id, snapshot.data()) : null;
  } catch (error) {
    logContentScriptsError(`getDoc(doc(db, '${CONTENT_SCRIPTS_COLLECTION}', '${id}'))`, error);
    throw error;
  }
}

export async function createContentScript(input: ContentScriptInput): Promise<ContentScript> {
  if (!db) throw new Error('Firestore não inicializado.');
  const clean = validate(input);
  await validateParent(undefined, clean.parentScriptId);
  const reference = doc(collection(db, CONTENT_SCRIPTS_COLLECTION));
  const { publishedAt, parentScriptId, ...fields } = clean;
  const payload = {
    ...fields,
    ...(publishedAt ? { publishedAt } : {}),
    ...(parentScriptId ? { parentScriptId } : {}),
    ...(fields.productionStatus === 'ready' ? { readyAt: serverTimestamp() } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (fields.productionStatus === 'ready' || fields.publicationStatus === 'published') {
    const firestore = db;
    await runTransaction(firestore, async (transaction) => {
      const refs = activityRefs(firestore, 'script_ready', reference.id);
      const record = fields.productionStatus === 'ready' ? await prepareActivityLog(transaction, refs, { type: 'script_ready', refId: reference.id, occurredAt: new Date(), difficultyKey: 'script_created' }) : null;
      const publishRefs = activityRefs(firestore, 'content_published', reference.id);
      const publishRecord = fields.publicationStatus === 'published' ? await prepareActivityLog(transaction, publishRefs, { type: 'content_published', refId: reference.id, occurredAt: new Date() }) : null;
      transaction.set(reference, payload);
      if (record) transaction.set(refs.logRef, record);
      if (publishRecord) transaction.set(publishRefs.logRef, publishRecord);
    });
  } else {
    await setDoc(reference, payload);
  }
  return { ...clean, ...(parentScriptId ? { parentScriptId } : {}), id: reference.id };
}

export async function updateContentScript(id: string, input: ContentScriptInput): Promise<void> {
  if (!db) throw new Error('Firestore não inicializado.');
  if (!id) throw new Error('ID do roteiro é obrigatório.');
  const clean = validate(input);
  await validateParent(id, clean.parentScriptId);
  const { publishedAt, parentScriptId, ...fields } = clean;
  const firestore = db;
  const scriptRef = doc(firestore, CONTENT_SCRIPTS_COLLECTION, id);
  await runTransaction(firestore, async (transaction) => {
    const current = await transaction.get(scriptRef);
    if (!current.exists()) throw new Error('Roteiro não encontrado.');
    // Evento "Pronto para gravar": gravado uma única vez, nunca limpado; alimenta as metas automáticas sem contar duas vezes
    // e vira registro permanente em activityLog (dificuldade da atividade "Criação de roteiro" congelada neste instante).
    const becomesReady = fields.productionStatus === 'ready' && !current.data().readyAt;
    const refs = becomesReady ? activityRefs(firestore, 'script_ready', id) : null;
    const record = refs ? await prepareActivityLog(transaction, refs, { type: 'script_ready', refId: id, occurredAt: new Date(), difficultyKey: 'script_created' }) : null;
    // Conteúdo publicado: evento permanente (2.000 XP) na 1ª vez que o roteiro vira Publicado (ID por roteiro, então republicar não paga de novo).
    // Roteiros já publicados na criação do baseline ficam em xpBaseline.counted.scripts e não pagam de novo (ver functions/xp.js).
    const becomesPublished = fields.publicationStatus === 'published' && current.data().publicationStatus !== 'published';
    const publishRefs = becomesPublished ? activityRefs(firestore, 'content_published', id) : null;
    const publishRecord = publishRefs ? await prepareActivityLog(transaction, publishRefs, { type: 'content_published', refId: id, occurredAt: new Date() }) : null;
    transaction.update(scriptRef, {
      ...fields,
      publishedAt: publishedAt || deleteField(),
      parentScriptId: parentScriptId || deleteField(),
      ...(becomesReady ? { readyAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
    if (refs && record) transaction.set(refs.logRef, record);
    if (publishRefs && publishRecord) transaction.set(publishRefs.logRef, publishRecord);
  });
}

/** Exclui apenas um roteiro sem tocar em filhos ou pedidos relacionados. */
export async function deleteContentScript(id: string): Promise<void> {
  if (!db) throw new Error('Firestore não inicializado.');
  if (typeof id !== 'string' || !id.trim() || id.includes('/')) throw new Error('ID de roteiro inválido para exclusão.');
  const firestore = db;
  const scriptRef = doc(firestore, CONTENT_SCRIPTS_COLLECTION, id);

  const [childrenSnapshot, linkedOrdersSnapshot] = await Promise.all([
    getDocs(query(collection(firestore, CONTENT_SCRIPTS_COLLECTION), where('parentScriptId', '==', id))),
    getDocs(query(collection(firestore, 'orders'), where('scriptId', '==', id))),
  ]);
  if (!childrenSnapshot.empty) throw new Error('Este roteiro possui roteiros filhos. Remova ou reassocie os filhos antes de excluí-lo.');
  const activeOrders = linkedOrdersSnapshot.docs.filter((order) => order.data().status !== 'completed');
  if (activeOrders.length) throw new Error('Este roteiro possui um pedido ativo. Resolva o pedido antes de excluí-lo.');
  if (!linkedOrdersSnapshot.empty) throw new Error('Este roteiro possui pedidos concluídos. A exclusão foi bloqueada para preservar o histórico de produção.');

  await runTransaction(firestore, async (transaction) => {
    const scriptSnapshot = await transaction.get(scriptRef);
    if (!scriptSnapshot.exists()) throw new Error('Roteiro não encontrado para exclusão.');
    const current = scriptSnapshot.data();
    if (typeof current.orderId === 'string' && current.orderId) {
      if (current.orderId.includes('/')) throw new Error('O roteiro possui um vínculo de pedido inválido; nenhum documento foi alterado.');
      const linkedOrderRef = doc(firestore, 'orders', current.orderId);
      const linkedOrderSnapshot = await transaction.get(linkedOrderRef);
      if (linkedOrderSnapshot.exists()) {
        const linkedOrder = linkedOrderSnapshot.data();
        if (linkedOrder.scriptId !== id) throw new Error('O vínculo do roteiro aponta para um pedido associado a outro roteiro; a exclusão foi bloqueada.');
        if (linkedOrder.status === 'completed') throw new Error('Este roteiro possui um pedido concluído. A exclusão foi bloqueada para preservar o histórico de produção.');
        throw new Error('Este roteiro possui um pedido ativo. Resolva o pedido antes de excluí-lo.');
      }
    }
    transaction.delete(scriptRef);
  });
}

async function validateParent(scriptId: string | undefined, parentScriptId: string | null | undefined): Promise<void> {
  if (!parentScriptId) return;
  if (scriptId && parentScriptId === scriptId) throw new Error('Um roteiro não pode ser seu próprio roteiro pai.');
  const scripts = await listContentScripts();
  const scriptsById = new Map(scripts.map((script) => [script.id, script]));
  if (!scriptsById.has(parentScriptId)) throw new Error('O roteiro pai selecionado não foi encontrado.');
  const visited = new Set<string>();
  let currentId: string | undefined = parentScriptId;
  while (currentId) {
    if (currentId === scriptId) throw new Error('Esta relação criaria um ciclo na hierarquia de roteiros.');
    if (visited.has(currentId)) throw new Error('A hierarquia existente contém uma relação circular.');
    visited.add(currentId);
    currentId = scriptsById.get(currentId)?.parentScriptId;
  }
}

function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof (value as any)?.toDate === 'function') return (value as any).toDate().getTime();
  const parsed = value ? new Date(value as string | number).getTime() : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}
