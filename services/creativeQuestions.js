// Caixinha de Perguntas (Espaço Criativo): regras puras, sem React/Firebase.

/** Colunas do Kanban, na ordem do fluxo. */
export const QUESTION_STATUSES = [
  ['draft', 'Rascunhos'],
  ['ready', 'Prontas para responder'],
  ['answered', 'Respondidas'],
  ['scripted', 'Roteiro criado'],
];
const STATUS_IDS = QUESTION_STATUSES.map(([id]) => id);
export const QUESTION_LIMITS = { text: 500, category: 60, notes: 2000 };

/** Limpa e valida o que vai para o Firestore (mesmos limites das regras). Lança Error com mensagem para o usuário. */
export function cleanQuestion(input) {
  const text = String(input.text ?? '').trim();
  const category = String(input.category ?? '').trim();
  const notes = String(input.notes ?? '').trim();
  if (!text) throw new Error('Escreva a pergunta.');
  if (text.length > QUESTION_LIMITS.text) throw new Error(`A pergunta pode ter até ${QUESTION_LIMITS.text} caracteres.`);
  if (category.length > QUESTION_LIMITS.category) throw new Error(`A categoria pode ter até ${QUESTION_LIMITS.category} caracteres.`);
  if (notes.length > QUESTION_LIMITS.notes) throw new Error(`As observações podem ter até ${QUESTION_LIMITS.notes} caracteres.`);
  if (!STATUS_IDS.includes(input.status)) throw new Error('Status inválido.');
  const scriptId = input.scriptId ? String(input.scriptId) : null;
  if (scriptId && (scriptId.includes('/') || scriptId.length > 128)) throw new Error('Roteiro relacionado inválido.');
  return { text, category, notes, status: input.status, scriptId };
}

/**
 * Data da resposta: só existe em Respondidas/Roteiro criado. Mantém a já registrada (ou a escolhida pelo usuário);
 * na primeira vez que a pergunta chega a essas colunas, usa `now`. Voltar para Rascunhos/Prontas limpa.
 */
export function answeredAtFor(status, current, now) {
  if (status !== 'answered' && status !== 'scripted') return null;
  return current ?? now;
}

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');

/** Busca (sem acento/caixa) na pergunta, categoria e observações + filtros de categoria e status. */
export function filterQuestions(questions, { search = '', category = '', status = '' } = {}) {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  return questions.filter((question) => {
    if (category && question.category !== category) return false;
    if (status && question.status !== status) return false;
    if (!terms.length) return true;
    const haystack = normalize(`${question.text} ${question.category} ${question.notes}`);
    return terms.every((term) => haystack.includes(term));
  });
}
