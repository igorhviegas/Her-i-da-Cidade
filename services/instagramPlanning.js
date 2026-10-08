// Planejamento editorial e campanhas do Instagram (puro, sem React/Firebase).
// Datas são sempre 'AAAA-MM-DD' em Brasília. A data de cada etapa NUNCA é gravada: é calculada de (lançamento + prazo),
// então mudar o lançamento recalcula tudo e o calendário usa a campanha como única fonte de verdade.
import { addDays, parseDateKey } from '../functions/missions-core.js';

export const FORMATS = [
  { id: 'reels', label: 'Reels' }, { id: 'story', label: 'Story' }, { id: 'feed', label: 'Feed' },
  { id: 'carousel', label: 'Carrossel' }, { id: 'live', label: 'Live' }, { id: 'other', label: 'Outro' },
];
// Categorias iniciais. O id é o que fica salvo; um id desconhecido (categoria futura/configurável) é exibido como está.
export const CATEGORIES = [
  { id: 'new_service', label: 'Novo serviço' }, { id: 'new_product', label: 'Novo produto' },
  { id: 'new_feature', label: 'Novo recurso da plataforma' }, { id: 'new_post', label: 'Novo post' },
  { id: 'promo', label: 'Campanha promocional' }, { id: 'institutional', label: 'Institucional' }, { id: 'other', label: 'Outro' },
];
export const CAMPAIGN_STATUSES = [
  { id: 'planning', label: 'Planejamento' }, { id: 'active', label: 'Em andamento' },
  { id: 'completed', label: 'Concluída' }, { id: 'archived', label: 'Arquivada' },
];
export const STEP_STATUSES = [{ id: 'pending', label: 'Pendente' }, { id: 'doing', label: 'Em andamento' }, { id: 'done', label: 'Concluída' }];
export const MAX_OFFSET = 365;
export const TASK_DIFFICULTY = 2;

const labelOf = (list, id) => list.find((item) => item.id === id)?.label ?? String(id ?? '');
export const formatLabel = (id) => labelOf(FORMATS, id);
export const categoryLabel = (id) => labelOf(CATEGORIES, id);
export const campaignStatusLabel = (id) => labelOf(CAMPAIGN_STATUSES, id);
export const stepStatusLabel = (id) => labelOf(STEP_STATUSES, id);

/** Etapas padrão (prazo em dias em relação ao lançamento: negativo = antes). Os modelos salvos no Firestore substituem estes por categoria. */
const BASE = [['Definir estratégia', -14], ['Criar roteiro', -7], ['Gravar', -5], ['Criar thumbnail', -3], ['Editar', -2], ['Publicar', 0]];
export const DEFAULT_TEMPLATES = {
  new_service: BASE,
  new_product: BASE,
  new_feature: [['Definir estratégia', -10], ['Criar roteiro', -5], ['Gravar demonstração', -3], ['Editar', -2], ['Publicar', 0]],
  new_post: [['Criar roteiro', -3], ['Gravar', -2], ['Editar', -1], ['Publicar', 0]],
  promo: [['Definir oferta', -10], ['Criar roteiro', -6], ['Gravar', -4], ['Editar', -2], ['Publicar', 0], ['Lembrar o fim da promoção', 3]],
  institutional: [['Definir mensagem', -7], ['Criar roteiro', -4], ['Gravar', -3], ['Editar', -1], ['Publicar', 0]],
  other: [['Planejar', -7], ['Produzir', -3], ['Publicar', 0]],
};

export const isDayKey = (value) => typeof value === 'string' && parseDateKey(value) !== null;

/** Data concreta da etapa, ou null se o lançamento ou o prazo forem inválidos. */
export function stepDate(launchDate, offset) {
  if (!isDayKey(launchDate) || !Number.isInteger(offset)) return null;
  return addDays(launchDate, offset);
}

const br = (key) => key.split('-').reverse().join('/');
/** "13/10" (curto) — o ano só aparece em outra data que não a do ano corrente. */
export const shortDate = (key, todayKey) => {
  const [year, month, day] = key.split('-');
  return todayKey && todayKey.slice(0, 4) !== year ? `${day}/${month}/${year}` : `${day}/${month}`;
};
export const fullDate = (key) => br(key);

export function describeOffset(offset) {
  if (offset === 0) return 'No dia do lançamento';
  const n = Math.abs(offset);
  return `${n} ${n === 1 ? 'dia' : 'dias'} ${offset < 0 ? 'antes' : 'depois'} do lançamento`;
}

export const makeStepId = (random = Math.random) => `s${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;

/** Etapas novas a partir de um modelo (lista de [título, prazo] ou de { title, offset }). */
export function buildTemplateSteps(template, newId = makeStepId) {
  return (template ?? []).map((item) => {
    const [title, offset] = Array.isArray(item) ? item : [item.title, item.offset];
    return { id: newId(), title, offset, status: 'pending', notes: '' };
  });
}

/** Modelo da categoria: o personalizado (válido) salvo no Firestore ou o padrão. */
export function templateFor(category, custom) {
  const saved = custom?.[category];
  if (Array.isArray(saved) && saved.length && saved.every((s) => typeof s?.title === 'string' && Number.isInteger(s.offset))) return saved.map((s) => [s.title, s.offset]);
  return DEFAULT_TEMPLATES[category] ?? DEFAULT_TEMPLATES.other;
}

const norm = (text) => String(text ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Lista de erros (vazia = válido). `steps` aceita qualquer etapa; a data só é exigida via lançamento válido. */
export function validateCampaign(input) {
  const errors = [];
  if (!String(input?.title ?? '').trim()) errors.push('Informe o título da campanha.');
  if (!String(input?.category ?? '').trim()) errors.push('Escolha a categoria.');
  if (!isDayKey(input?.launchDate)) errors.push('Informe uma data de lançamento válida.');
  if (!CAMPAIGN_STATUSES.some((s) => s.id === input?.status)) errors.push('Status da campanha inválido.');
  const seen = new Set();
  (input?.steps ?? []).forEach((step, index) => {
    const name = String(step?.title ?? '').trim();
    if (!name) errors.push(`A etapa ${index + 1} está sem nome.`);
    if (!Number.isInteger(step?.offset) || Math.abs(step.offset) > MAX_OFFSET) errors.push(`Prazo inválido na etapa "${name || index + 1}" (use um número inteiro de até ${MAX_OFFSET} dias).`);
    if (!STEP_STATUSES.some((s) => s.id === step?.status)) errors.push(`Status inválido na etapa "${name || index + 1}".`);
    const key = `${norm(name)}|${step?.offset}`;
    if (name && seen.has(key)) errors.push(`Etapa duplicada: "${name}" com o mesmo prazo.`);
    seen.add(key);
  });
  return errors;
}

export function validatePlan(input) {
  const errors = [];
  if (!isDayKey(input?.date)) errors.push('Data inválida.');
  const title = String(input?.title ?? '').trim();
  if (!title) errors.push('Informe o título do conteúdo.');
  else if (title.length > 120) errors.push('O título pode ter até 120 caracteres.');
  if (!FORMATS.some((f) => f.id === input?.format)) errors.push('Escolha o formato.');
  if (String(input?.notes ?? '').length > 500) errors.push('As observações podem ter até 500 caracteres.');
  return errors;
}

export const cleanSteps = (steps) => (steps ?? []).map((s) => ({
  id: s.id, title: String(s.title).trim(), offset: s.offset, status: s.status, notes: String(s.notes ?? '').trim(),
  ...(s.missionId ? { missionId: s.missionId } : {}),
}));

/** Etapas com a data calculada, em ordem de data (empates mantêm a ordem em que foram criadas). */
export function resolveSteps(campaign) {
  return (campaign.steps ?? [])
    .map((step, index) => ({ ...step, date: stepDate(campaign.launchDate, step.offset), index }))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.index - b.index);
}

/** Primeiro e último dia da campanha (da 1ª etapa ao lançamento — ou à última etapa, se houver depois). */
export function campaignSpan(campaign) {
  const dates = [campaign.launchDate, ...resolveSteps(campaign).map((s) => s.date)].filter(Boolean).sort();
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}

export function campaignProgress(campaign) {
  const steps = resolveSteps(campaign);
  const done = steps.filter((s) => s.status === 'done').length;
  return { done, total: steps.length, next: steps.find((s) => s.status !== 'done') ?? null };
}

/** Itens de calendário: planejamentos avulsos e etapas de campanha por dia, e o período de cada campanha (arquivadas ficam de fora). */
export function calendarEntries({ plans, campaigns }) {
  const byDay = new Map();
  const slot = (day) => { if (!byDay.has(day)) byDay.set(day, { plans: [], steps: [] }); return byDay.get(day); };
  for (const plan of plans ?? []) if (isDayKey(plan.date)) slot(plan.date).plans.push(plan);
  const spans = [];
  for (const campaign of (campaigns ?? []).filter((c) => c.status !== 'archived')) {
    const span = campaignSpan(campaign);
    if (span) spans.push({ campaignId: campaign.id, title: campaign.title, ...span });
    for (const step of resolveSteps(campaign)) {
      if (step.date) slot(step.date).steps.push({ campaignId: campaign.id, campaignTitle: campaign.title, stepId: step.id, title: step.title, status: step.status, offset: step.offset, launch: step.offset === 0 });
    }
    if (isDayKey(campaign.launchDate) && !resolveSteps(campaign).some((s) => s.offset === 0)) {
      slot(campaign.launchDate).steps.push({ campaignId: campaign.id, campaignTitle: campaign.title, stepId: null, title: 'Lançamento', status: null, offset: 0, launch: true });
    }
  }
  return { byDay, spans };
}

export const campaignsOnDay = (spans, key) => spans.filter((s) => key >= s.start && key <= s.end).map((s) => s.campaignId);

// ---------------------------------------------------------------------------------------- To-do List (missões)

/** Prazo da tarefa: fim do expediente (18:00, Brasília) da data calculada da etapa. */
export const taskDueAt = (date) => new Date(`${date}T18:00:00-03:00`);
/** Id determinístico: converter a mesma etapa duas vezes (cliques repetidos, outra aba) cai no mesmo documento e nunca duplica. */
export const missionIdFor = (campaignId, stepId) => `igcamp_${campaignId}_${stepId}`;

/** Missão (To-do) correspondente a uma etapa: título da etapa, dificuldade 2 e prazo = data calculada. */
export function taskFromStep(campaign, step) {
  const date = stepDate(campaign.launchDate, step.offset);
  if (!date) throw new Error('A etapa não tem uma data válida.');
  const lines = [`Campanha: ${campaign.title}`, `${describeOffset(step.offset)} (${fullDate(date)})`];
  if (step.notes) lines.push(step.notes);
  return { title: step.title, description: lines.join('\n'), difficulty: TASK_DIFFICULTY, dueAt: taskDueAt(date) };
}

/** Tarefas já criadas cujo prazo mudou porque o lançamento ou o prazo da etapa mudou: [{ missionId, dueAt }]. */
export function taskDueChanges(before, after) {
  const old = new Map((before.steps ?? []).map((s) => [s.id, stepDate(before.launchDate, s.offset)]));
  const changes = [];
  for (const step of after.steps ?? []) {
    if (!step.missionId) continue;
    const date = stepDate(after.launchDate, step.offset);
    if (date && date !== old.get(step.id)) changes.push({ missionId: step.missionId, dueAt: taskDueAt(date) });
  }
  return changes;
}

// ------------------------------------------------------------------------------------------ formulário (conversões)

/** Direção + dias (texto digitado) -> prazo com sinal. Dias vazio/ inválido vira NaN e é barrado por validateCampaign. */
export function offsetFrom(direction, days) {
  if (direction === 'on') return 0;
  const n = /^\d+$/.test(String(days).trim()) ? Number(days) : NaN;
  return direction === 'before' ? -n : n;
}
export const splitOffset = (offset) => ({ direction: offset < 0 ? 'before' : offset > 0 ? 'after' : 'on', days: String(Math.abs(offset)) });

/** Dias de hoje até a data (negativo = já passou). */
export function daysUntil(todayKey, key) {
  const a = parseDateKey(todayKey);
  const b = parseDateKey(key);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
}
