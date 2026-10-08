import { addDoc, collection, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, type DocumentData, type Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MISSIONS_COLLECTION } from './missionsService';
import {
  cleanSteps, missionIdFor, taskDueChanges, taskFromStep, validateCampaign, validatePlan,
  type Campaign, type CampaignInput, type CampaignStatus, type Plan, type PlanInput, type StepStatus,
} from './instagramPlanning.js';

export const PLANS_COLLECTION = 'instagramPlans';
export const CAMPAIGNS_COLLECTION = 'instagramCampaigns';
export const TEMPLATES_COLLECTION = 'instagramCampaignTemplates'; // id = categoria; { steps: [{ title, offset }] }
export const CAMPAIGN_TASK_SOURCE = 'instagram_campaign';

export type Templates = Record<string, { title: string; offset: number }[]>;

function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}

function fail(errors: string[]): never {
  throw new Error(errors.join(' '));
}

function listen<T>(name: string, map: (id: string, data: DocumentData) => T, onData: (items: T[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db) { onError(new Error('Firestore não inicializado.')); return () => {}; }
  return onSnapshot(collection(db, name), (snap) => onData(snap.docs.map((d) => map(d.id, d.data()))), onError);
}

// ---------------------------------------------------------------------------------- planejamento editorial avulso

export const subscribePlans = (onData: (plans: Plan[]) => void, onError: (e: Error) => void) =>
  listen<Plan>(PLANS_COLLECTION, (id, d) => ({ id, date: d.date, title: d.title, format: d.format, notes: d.notes ?? '' }), onData, onError);

const cleanPlan = (input: PlanInput): PlanInput => {
  const errors = validatePlan(input);
  if (errors.length) fail(errors);
  return { date: input.date, title: input.title.trim(), format: input.format, notes: (input.notes ?? '').trim() };
};

export async function createPlan(input: PlanInput): Promise<void> {
  await addDoc(collection(firestore(), PLANS_COLLECTION), { ...cleanPlan(input), createdAt: serverTimestamp() });
}

export async function updatePlan(id: string, input: PlanInput): Promise<void> {
  await updateDoc(doc(firestore(), PLANS_COLLECTION, id), { ...cleanPlan(input), updatedAt: serverTimestamp() });
}

export async function deletePlan(id: string): Promise<void> {
  await deleteDoc(doc(firestore(), PLANS_COLLECTION, id));
}

// ----------------------------------------------------------------------------------------------------- campanhas

const toCampaign = (id: string, d: DocumentData): Campaign => ({
  id, title: d.title, category: d.category, launchDate: d.launchDate, status: d.status, notes: d.notes ?? '', steps: Array.isArray(d.steps) ? d.steps : [],
});

export const subscribeCampaigns = (onData: (items: Campaign[]) => void, onError: (e: Error) => void) => listen<Campaign>(CAMPAIGNS_COLLECTION, toCampaign, onData, onError);

function cleanCampaign(input: CampaignInput): CampaignInput {
  const errors = validateCampaign(input);
  if (errors.length) fail(errors);
  return { title: input.title.trim(), category: input.category.trim(), launchDate: input.launchDate, status: input.status, notes: (input.notes ?? '').trim(), steps: cleanSteps(input.steps) };
}

export async function createCampaign(input: CampaignInput): Promise<void> {
  await addDoc(collection(firestore(), CAMPAIGNS_COLLECTION), { ...cleanCampaign(input), createdAt: serverTimestamp() });
}

/**
 * Salva a campanha e, na mesma transação, acompanha o novo prazo das tarefas JÁ criadas no To-do List (lançamento ou prazo da etapa
 * alterados): só mexe em tarefas ainda pendentes. A data das etapas não é gravada em lugar nenhum — é sempre calculada.
 */
export async function updateCampaign(id: string, input: CampaignInput): Promise<void> {
  const clean = cleanCampaign(input);
  const database = firestore();
  const ref = doc(database, CAMPAIGNS_COLLECTION, id);
  await runTransaction(database, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Campanha não encontrada (pode ter sido excluída).');
    const before = toCampaign(id, snap.data());
    // missionId só é definido pelo sistema: preserva o vínculo das etapas que continuam existindo
    const linked = new Map(before.steps.filter((s) => s.missionId).map((s) => [s.id, s.missionId]));
    const steps = clean.steps.map((s) => (linked.has(s.id) ? { ...s, missionId: linked.get(s.id) } : s));
    const due = taskDueChanges(before, { ...clean, steps });
    const missions = await Promise.all(due.map(async (change) => ({ change, snap: await tx.get(doc(database, MISSIONS_COLLECTION, change.missionId)) })));
    tx.update(ref, { ...clean, steps, updatedAt: serverTimestamp() });
    for (const { change, snap: mission } of missions) {
      if (mission.exists() && mission.data().status === 'pending') tx.update(mission.ref, { dueAt: change.dueAt, updatedAt: serverTimestamp() });
    }
  });
}

export async function setCampaignStatus(id: string, status: CampaignStatus): Promise<void> {
  await updateDoc(doc(firestore(), CAMPAIGNS_COLLECTION, id), { status, updatedAt: serverTimestamp() });
}

/** Exclui só a campanha: tarefas já criadas no To-do List continuam lá (podem ter sido concluídas). */
export async function deleteCampaign(id: string): Promise<void> {
  await deleteDoc(doc(firestore(), CAMPAIGNS_COLLECTION, id));
}

/** Muda o status de uma etapa lendo o documento salvo (transação), para dois cliques ou duas abas não sobrescreverem as demais etapas. */
export async function setStepStatus(campaignId: string, stepId: string, status: StepStatus): Promise<void> {
  const database = firestore();
  const ref = doc(database, CAMPAIGNS_COLLECTION, campaignId);
  await runTransaction(database, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Campanha não encontrada (pode ter sido excluída).');
    const steps = toCampaign(campaignId, snap.data()).steps;
    if (!steps.some((s) => s.id === stepId)) throw new Error('Etapa não encontrada.');
    tx.update(ref, { steps: steps.map((s) => (s.id === stepId ? { ...s, status } : s)), updatedAt: serverTimestamp() });
  });
}

/**
 * Cria a tarefa da etapa no To-do List (coleção missions): título da etapa, dificuldade 2, prazo = data calculada.
 * O id da missão é determinístico (campanha + etapa) e a criação é transacional: repetir a ação, ou fazê-la em outra aba, nunca duplica.
 */
export async function createStepTask(campaignId: string, stepId: string): Promise<{ missionId: string; created: boolean }> {
  const database = firestore();
  const campaignRef = doc(database, CAMPAIGNS_COLLECTION, campaignId);
  return runTransaction(database, async (tx) => {
    const snap = await tx.get(campaignRef);
    if (!snap.exists()) throw new Error('Campanha não encontrada (pode ter sido excluída).');
    const campaign = toCampaign(campaignId, snap.data());
    const step = campaign.steps.find((s) => s.id === stepId);
    if (!step) throw new Error('Etapa não encontrada.');
    const missionId = missionIdFor(campaignId, stepId);
    const missionRef = doc(database, MISSIONS_COLLECTION, missionId);
    const existing = await tx.get(missionRef);
    if (!existing.exists()) {
      const task = taskFromStep(campaign, step);
      tx.set(missionRef, {
        title: task.title, description: task.description, difficulty: task.difficulty, status: 'pending', source: CAMPAIGN_TASK_SOURCE,
        dueAt: task.dueAt, alexaReminder: false, campaignId, stepId, createdAt: serverTimestamp(),
      });
    }
    if (step.missionId !== missionId) tx.update(campaignRef, { steps: campaign.steps.map((s) => (s.id === stepId ? { ...s, missionId } : s)), updatedAt: serverTimestamp() });
    return { missionId, created: !existing.exists() };
  });
}

// ----------------------------------------------------------------------------------- modelos de etapas por categoria

export const subscribeTemplates = (onData: (templates: Templates) => void, onError: (e: Error) => void) =>
  listen<[string, { title: string; offset: number }[]]>(TEMPLATES_COLLECTION, (id, d) => [id, Array.isArray(d.steps) ? d.steps : []], (items) => onData(Object.fromEntries(items)), onError);

export async function saveTemplate(category: string, steps: { title: string; offset: number }[]): Promise<void> {
  const clean = steps.map((s) => ({ title: s.title.trim(), offset: s.offset }));
  const errors = validateCampaign({ title: 'modelo', category, launchDate: '2000-01-01', status: 'planning', steps: clean.map((s, i) => ({ id: String(i), ...s, status: 'pending', notes: '' })) });
  if (errors.length) fail(errors);
  await setDoc(doc(firestore(), TEMPLATES_COLLECTION, category), { steps: clean, updatedAt: serverTimestamp() });
}

/** Volta ao modelo padrão da categoria (apaga só o modelo personalizado). */
export async function resetTemplate(category: string): Promise<void> {
  await deleteDoc(doc(firestore(), TEMPLATES_COLLECTION, category));
}
