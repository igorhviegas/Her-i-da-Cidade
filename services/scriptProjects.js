// Projetos de roteiro (tipos de conteúdo: Aranha Responde, vídeos temáticos, séries…): regras puras, sem React/Firebase.

/** Projeto fixo da Caixinha de Perguntas: não pode ser excluído (pode ser renomeado e trocar de ícone). */
export const CAIXINHA_PROJECT_ID = 'caixinha';
export const DEFAULT_ICON = 'Folder';
/** Criados na primeira vez que a coleção é lida vazia. */
export const DEFAULT_PROJECTS = [
  { id: CAIXINHA_PROJECT_ID, name: 'Aranha Responde', icon: 'MessageCircleQuestionMark' },
  { id: null, name: 'Vídeos temáticos', icon: 'Clapperboard' },
];
export const PROJECT_NAME_MAX = 60;

/** Nome limpo e válido (mesmos limites das regras do Firestore). Lança Error com mensagem para o usuário. */
export function cleanProject({ name, icon }) {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Dê um nome ao projeto.');
  if (clean.length > PROJECT_NAME_MAX) throw new Error(`O nome pode ter até ${PROJECT_NAME_MAX} caracteres.`);
  const iconName = /^[A-Za-z0-9]{1,40}$/.test(String(icon ?? '')) ? icon : DEFAULT_ICON;
  return { name: clean, icon: iconName };
}

/** Filtro da biblioteca: '' = todos, 'none' = sem projeto (inclui projeto excluído), senão o id. */
export function matchesProject(projectId, filter, knownIds) {
  if (!filter) return true;
  if (filter === 'none') return !projectId || !knownIds.has(projectId);
  return projectId === filter;
}
