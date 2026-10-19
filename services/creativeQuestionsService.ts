import { logger } from '../lib/logger.js';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { answeredAtFor, cleanQuestion } from './creativeQuestions.js';
import type { CreativeQuestion, QuestionInput } from './creativeQuestions.js';

/** Caixinha de Perguntas do Espaço Criativo (regras em firestore.rules › creativeQuestions). */
export const CREATIVE_QUESTIONS_COLLECTION = 'creativeQuestions';

function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}

function fail(operation: string, error: unknown): never {
  logger.error(`[creativeQuestionsService] Falha na operação: ${operation}`, { error, stack: error instanceof Error ? error.stack : undefined });
  throw error instanceof Error && error.message && !/permission|PERMISSION/.test(error.message) ? error : new Error('Não foi possível salvar. Verifique a conexão e tente de novo.');
}

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null);

function mapQuestion(id: string, data: Record<string, unknown>): CreativeQuestion {
  return {
    id,
    text: typeof data.text === 'string' ? data.text : '',
    category: typeof data.category === 'string' ? data.category : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
    status: (['draft', 'ready', 'answered', 'scripted'].includes(data.status as string) ? data.status : 'draft') as CreativeQuestion['status'],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    answeredAt: toDate(data.answeredAt),
    scriptId: typeof data.scriptId === 'string' && data.scriptId ? data.scriptId : null,
  };
}

// ponytail: lê a coleção inteira (como a biblioteca de roteiros) para a busca por texto funcionar no cliente;
// com dezenas de milhares de perguntas, paginar Respondidas/Roteiro criado por answeredAt.
export async function listQuestions(): Promise<CreativeQuestion[]> {
  try {
    const snapshot = await getDocs(collection(firestore(), CREATIVE_QUESTIONS_COLLECTION));
    return snapshot.docs.map((item) => mapQuestion(item.id, item.data()))
      .sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now()));
  } catch (error) {
    return fail('listar perguntas', error);
  }
}

export async function createQuestion(input: QuestionInput, answeredAt: Date | null = null): Promise<CreativeQuestion> {
  const clean = cleanQuestion(input);
  const now = new Date();
  const nextAnsweredAt = answeredAtFor(clean.status, answeredAt, now);
  const reference = doc(collection(firestore(), CREATIVE_QUESTIONS_COLLECTION));
  try {
    await setDoc(reference, { ...clean, answeredAt: nextAnsweredAt, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (error) {
    return fail('criar pergunta', error);
  }
  return { ...clean, id: reference.id, answeredAt: nextAnsweredAt, createdAt: now, updatedAt: now };
}

/**
 * Grava a pergunta inteira. `answeredAt` explícito (data escolhida no formulário) prevalece;
 * senão a data é mantida/preenchida/limpa conforme o status (ver answeredAtFor).
 */
export async function updateQuestion(current: CreativeQuestion, input: QuestionInput, answeredAt?: Date | null): Promise<CreativeQuestion> {
  if (!current.id || current.id.includes('/')) throw new Error('Pergunta inválida.');
  const clean = cleanQuestion(input);
  const now = new Date();
  const nextAnsweredAt = answeredAtFor(clean.status, answeredAt === undefined ? current.answeredAt : answeredAt, now);
  try {
    await updateDoc(doc(firestore(), CREATIVE_QUESTIONS_COLLECTION, current.id), { ...clean, answeredAt: nextAnsweredAt, updatedAt: serverTimestamp() });
  } catch (error) {
    return fail(`atualizar pergunta ${current.id}`, error);
  }
  return { ...current, ...clean, answeredAt: nextAnsweredAt, updatedAt: now };
}

/** Exclui só a pergunta; o roteiro relacionado (se houver) continua intacto. */
export async function deleteQuestion(id: string): Promise<void> {
  if (!id || id.includes('/')) throw new Error('Pergunta inválida.');
  try {
    await deleteDoc(doc(firestore(), CREATIVE_QUESTIONS_COLLECTION, id));
  } catch (error) {
    fail(`excluir pergunta ${id}`, error);
  }
}
