// Ordem da lista de roteiros por data de publicação (puro, sem React/Firebase).
import { dateKey } from '../functions/missions-core.js';

// Datas chegam como Date (recém-salvo) ou Timestamp do Firestore (com toDate()).

const toMillis = (value) => {
  const date = value instanceof Date ? value : typeof value?.toDate === 'function' ? value.toDate() : null;
  const time = date ? date.getTime() : NaN;
  return Number.isNaN(time) ? null : time;
};

/** Data de referência do roteiro: a real quando publicado, senão a prevista; null = sem data de lançamento. */
export function scriptPublishTime(script) {
  const real = script.publicationStatus === 'published' ? toMillis(script.publishedAt) : null;
  return real ?? toMillis(script.plannedPublishAt);
}

/** Mais antigos primeiro (ou mais recentes, com `newestFirst`); roteiros sem data sempre no final. */
export function sortByPublishDate(scripts, newestFirst = false) {
  return scripts
    .map((script) => [script, scriptPublishTime(script)])
    .sort(([, a], [, b]) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : newestFirst ? b - a : a - b))
    .map(([script]) => script);
}

/**
 * Roteiros ainda não publicados com previsão de postagem, no formato de planejamento avulso do calendário do Instagram.
 * Derivados a cada leitura (nada é gravado em instagramPlans): a previsão no roteiro é a única fonte de verdade.
 */
export function scriptCalendarPlans(scripts) {
  return scripts.flatMap((script) => {
    const time = script.publicationStatus === 'published' ? null : toMillis(script.plannedPublishAt);
    return time === null ? [] : [{ id: `script-${script.id}`, scriptId: script.id, date: dateKey(new Date(time)), title: script.title, format: 'reels' }];
  });
}

/** Ordem manual (arrastar): roteiros ainda sem posição ficam no topo, na ordem recebida; os demais por `sortOrder`. */
export function sortByManualOrder(scripts) {
  const unplaced = scripts.filter((script) => typeof script.sortOrder !== 'number');
  const placed = scripts.filter((script) => typeof script.sortOrder === 'number').sort((a, b) => a.sortOrder - b.sortOrder);
  return [...unplaced, ...placed];
}

/**
 * Solta `draggedId` sobre `targetId` na ordem manual de TODOS os roteiros (inclusive os ocultos pelos filtros):
 * descendo, fica logo depois do alvo; subindo, logo antes. Devolve só as posições que mudaram, para gravar.
 */
export function moveScript(scripts, draggedId, targetId) {
  const ids = sortByManualOrder(scripts).map((script) => script.id);
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return [];
  ids.splice(from, 1);
  ids.splice(to, 0, draggedId);
  const current = new Map(scripts.map((script) => [script.id, script.sortOrder]));
  return ids.flatMap((id, index) => (current.get(id) === index ? [] : [{ id, sortOrder: index }]));
}
