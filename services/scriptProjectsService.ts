import { logger } from '../lib/logger.js';
import { collection, deleteDoc, deleteField, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CONTENT_SCRIPTS_COLLECTION } from './contentScriptsService';
import { CAIXINHA_PROJECT_ID, cleanProject, DEFAULT_PROJECTS } from './scriptProjects.js';
import type { ScriptProject } from './scriptProjects.js';

/** Projetos de roteiro (regras em firestore.rules › scriptProjects). Roteiros apontam para eles por `projectId`. */
export const SCRIPT_PROJECTS_COLLECTION = 'scriptProjects';

function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}

function fail(operation: string, error: unknown): never {
  logger.error(`[scriptProjectsService] Falha na operação: ${operation}`, { error, stack: error instanceof Error ? error.stack : undefined });
  throw error instanceof Error && error.message && !/permission/i.test(error.message) ? error : new Error('Não foi possível salvar o projeto. Verifique a conexão e tente de novo.');
}

const toProject = (item: QueryDocumentSnapshot): ScriptProject => ({ id: item.id, name: String(item.data().name ?? ''), icon: String(item.data().icon ?? '') });
const byName = (a: ScriptProject, b: ScriptProject) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

/** Lista os projetos; na primeira vez (sem o projeto da Caixinha) cria os projetos padrão. */
export async function listProjects(): Promise<ScriptProject[]> {
  const store = firestore();
  try {
    const snapshot = await getDocs(collection(store, SCRIPT_PROJECTS_COLLECTION));
    const projects = snapshot.docs.map(toProject);
    if (projects.some((project) => project.id === CAIXINHA_PROJECT_ID)) return projects.sort(byName);
    const firstTime = projects.length === 0; // coleção vazia: todos os padrões; senão só o da Caixinha
    const batch = writeBatch(store);
    for (const preset of DEFAULT_PROJECTS) {
      if (preset.id !== CAIXINHA_PROJECT_ID && !firstTime) continue;
      const reference = preset.id ? doc(store, SCRIPT_PROJECTS_COLLECTION, preset.id) : doc(collection(store, SCRIPT_PROJECTS_COLLECTION));
      batch.set(reference, { name: preset.name, icon: preset.icon, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      projects.push({ id: reference.id, name: preset.name, icon: preset.icon });
    }
    try {
      await batch.commit();
    } catch (error) {
      // Outra aba/aparelho criou os padrões ao mesmo tempo: o id fixo da Caixinha faz este lote falhar inteiro (sem duplicar). Relê.
      const again = await getDocs(collection(store, SCRIPT_PROJECTS_COLLECTION));
      if (!again.docs.some((item) => item.id === CAIXINHA_PROJECT_ID)) throw error;
      return again.docs.map(toProject).sort(byName);
    }
    return projects.sort(byName);
  } catch (error) {
    return fail('listar projetos', error);
  }
}

export async function createProject(input: { name: string; icon: string }): Promise<ScriptProject> {
  const clean = cleanProject(input);
  const reference = doc(collection(firestore(), SCRIPT_PROJECTS_COLLECTION));
  try {
    await setDoc(reference, { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } catch (error) {
    return fail('criar projeto', error);
  }
  return { id: reference.id, ...clean };
}

/** Renomear e/ou trocar o ícone: os roteiros guardam só o id, então mudam juntos. */
export async function updateProject(id: string, input: { name: string; icon: string }): Promise<ScriptProject> {
  if (!id || id.includes('/')) throw new Error('Projeto inválido.');
  const clean = cleanProject(input);
  try {
    await updateDoc(doc(firestore(), SCRIPT_PROJECTS_COLLECTION, id), { ...clean, updatedAt: serverTimestamp() });
  } catch (error) {
    return fail(`atualizar projeto ${id}`, error);
  }
  return { id, ...clean };
}

/** Exclui o projeto e tira o vínculo dos roteiros dele (os roteiros continuam, só ficam "Sem projeto"). Devolve quantos mudaram. */
export async function deleteProject(id: string): Promise<number> {
  if (!id || id.includes('/')) throw new Error('Projeto inválido.');
  if (id === CAIXINHA_PROJECT_ID) throw new Error('O projeto da Caixinha de Perguntas não pode ser excluído; renomeie ou troque o ícone.');
  const store = firestore();
  try {
    const linked = await getDocs(query(collection(store, CONTENT_SCRIPTS_COLLECTION), where('projectId', '==', id)));
    const refs = linked.docs.map((item) => item.ref);
    for (let start = 0; start < refs.length; start += 400) {
      const batch = writeBatch(store);
      refs.slice(start, start + 400).forEach((ref) => batch.update(ref, { projectId: deleteField() }));
      await batch.commit();
    }
    await deleteDoc(doc(store, SCRIPT_PROJECTS_COLLECTION, id));
    return refs.length;
  } catch (error) {
    return fail(`excluir projeto ${id}`, error);
  }
}
