// Cor de identificação por serviço (usada nos cards do Kanban). IDs do catálogo com fallback por título.
const BY_ID = { '1': 'red', '5': 'yellow', '3': 'blue', '4': 'purple', '2': 'green' };
const BY_TITLE = [
  ['aniversario', 'red'],
  ['tematico', 'yellow'],
  ['personalizado', 'blue'],
  ['convite', 'purple'],
  ['chamada', 'green'],
];

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** 'red' | 'yellow' | 'blue' | 'purple' | 'green', ou null para serviços sem cor definida. */
export function getServiceColor(service) {
  if (!service) return null;
  const title = normalize(service.title ?? service.name);
  const byTitle = BY_TITLE.find(([term]) => title.includes(term));
  return byTitle ? byTitle[1] : BY_ID[String(service.id ?? '')] ?? null;
}
