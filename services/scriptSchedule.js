// Ordem da lista de roteiros por data de publicação (puro, sem React/Firebase).
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
