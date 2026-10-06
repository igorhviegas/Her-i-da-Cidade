// Lógica pura da área /agente-hdc (sem React/Firebase): conteúdo padrão, timer do evento e gatilhos de alerta.

export const EVENT_DURATION_MS = 60 * 60 * 1000;
export const ALERT_30_MS = 30 * 60 * 1000;
export const ALERT_5_MS = 5 * 60 * 1000;

/** Tempo do evento a partir do início oficial. O ajuste (ms, positivo ou negativo) soma ao 1 h contratado. */
export function computeTimer({ startedAt, adjustMs = 0 }, now) {
  const remainingMs = startedAt + EVENT_DURATION_MS + adjustMs - now;
  return { elapsedMs: Math.max(0, now - startedAt), remainingMs, finished: remainingMs <= 0 };
}

/** mm:ss (ou h:mm:ss a partir de 1 h). Sempre em valor absoluto: o chamador decide se é atraso. */
export function formatClock(ms) {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Próximo alerta pendente ('m5' | 'm30' | null). O de 5 min tem prioridade: se o app ficou em segundo plano
 * e já passou dos 5 min, o agente vê só o mais urgente. `fired` = { m30?, m5? }.
 */
export function dueAlert(remainingMs, fired = {}) {
  if (remainingMs <= ALERT_5_MS) return fired.m5 ? null : 'm5';
  if (remainingMs <= ALERT_30_MS) return fired.m30 ? null : 'm30';
  return null;
}

/** Marca o alerta como exibido; o de 5 min também encerra o de 30 (não faz sentido mostrá-lo depois). */
export function markFired(fired = {}, alert) {
  return alert === 'm5' ? { m30: true, m5: true } : { ...fired, [alert]: true };
}

/** Ao adicionar tempo, alertas cujo limiar voltou a ficar no futuro podem disparar de novo. */
export function resetFired(remainingMs, fired = {}) {
  return { m30: !!fired.m30 && remainingMs <= ALERT_30_MS, m5: !!fired.m5 && remainingMs <= ALERT_5_MS };
}

/** Troca o item de `index` com o vizinho (-1 sobe, +1 desce); nas pontas devolve a mesma lista. */
export function moveItem(list, index, delta) {
  const next = index + delta;
  if (index < 0 || index >= list.length || next < 0 || next >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

export function sortByOrder(list) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export const newId = () => Math.random().toString(36).slice(2, 10);

/** Alertas do timer (textos fixos; o conteúdo editável pelo admin são as etapas). */
export const TIMER_ALERTS = {
  m30: {
    title: 'Está chegando a hora dos parabéns',
    tone: 'amber',
    items: [
      'Falar com os pais/responsáveis.',
      'Combinar o horário exato dos parabéns.',
      'Perguntar se haverá algum agradecimento antes dos parabéns.',
      'Perguntar se haverá oração antes dos parabéns.',
    ],
  },
  m5: {
    title: 'Faltam 5 minutos para o fim!',
    tone: 'red',
    items: [
      'LIGAR O DISTINTIVO — é o sinal para o Homem-Aranha de que o evento está acabando.',
      'Começar a guardar os equipamentos.',
      'Organizar os materiais.',
      'Preparar o encerramento.',
    ],
  },
};

const it = (text, extra = {}) => ({ text, ...extra });

/**
 * Roteiro padrão. Usado enquanto o admin não gravou nada no Firestore e como ponto de partida
 * ("Carregar roteiro padrão" no admin). IDs fixos para a gravação ser idempotente.
 * `alert` aparece em destaque no topo da etapa; `note` em um item abre um campo de anotação.
 */
export const DEFAULT_AGENT_STEPS = [
  {
    id: 'chegada', title: 'Chegada', kicker: 'Etapa 1',
    description: 'O evento dura 1 hora, mas você chega ~30 minutos antes para preparar tudo.',
    items: [
      it('Estacionar o carro'), it('Pegar a caixa de som'), it('Colocar o distintivo'),
      it('Colocar o crachá da empresa'), it('Pegar a maleta'), it('Ir até a porta do evento'),
      it('Ao chegar à porta', { heading: true }),
      it('Procurar o responsável pela festa'),
      it('Informar que será feita a montagem do equipamento de som'),
      it('Perguntar onde está disponível uma tomada para o equipamento'),
    ],
  },
  {
    id: 'instalacao', title: 'Instalação da caixa de som', kicker: 'Etapa 2',
    alert: '⚠️ ATENÇÃO: confira a voltagem da tomada antes de ligar a caixa de som.',
    description: '',
    items: [
      // Procedimento provisório: o administrador ajusta em Ajustes → Agente.
      it('Posicionar a caixa de som no local combinado'),
      it('Conferir a voltagem da tomada'),
      it('Ligar a caixa de som na tomada'),
      it('Ligar a caixa de som e testar o áudio'),
      it('Depois da caixa de som', { heading: true }),
      it('Ligar o microfone'), it('Pegar a teia'), it('Pegar um microfone'),
      it('Pegar as figurinhas'), it('Pegar os lançadores de teia'),
    ],
  },
  {
    id: 'caca-ao-tesouro', title: 'Explicar o Caça ao Tesouro', kicker: 'Etapa 3',
    description: 'Antes de voltar ao carro, explique a dinâmica à mãe/responsável da festa.',
    items: [
      it('Procurar a mãe/responsável da festa'),
      it('Explicar: um dos convidados ficará com o lançador de teia'),
      it('Explicar: em determinado momento o Homem-Aranha pedirá ajuda às crianças para encontrar esse convidado'),
    ],
  },
  {
    id: 'observacoes', title: 'Observar antes de voltar ao carro', kicker: 'Etapa 4',
    description: 'Anote o que for importante: o Homem-Aranha vai precisar.',
    items: [
      it('Há muitas crianças/convidados?'),
      it('Existe espaço suficiente para a apresentação?'),
      it('Existe passagem adequada até o local da apresentação?'),
      it('Como o aniversariante está vestido', { note: true }),
      it('Características relevantes do aniversariante', { note: true }),
      it('Como está vestido o portador do lançador de teia', { note: true }),
      it('Características relevantes do portador do lançador', { note: true }),
    ],
  },
  {
    id: 'preparacao-carro', title: 'Preparação no carro', kicker: 'Etapa 5',
    description: 'Volte ao carro e informe tudo ao Homem-Aranha. Enquanto aguardam:',
    items: [
      it('Informar tudo ao Homem-Aranha'),
      it('Conferir se o traje está com os zíperes corretamente fechados'),
      it('Instalar o microfone sem fio no traje'),
      it('Colocar um dos lançadores de teia'),
      it('Colocar a teia'),
    ],
  },
  {
    id: 'dez-minutos', title: '10 minutos antes', kicker: 'Etapa 6', highlight: true, startButton: true,
    description: 'Hora de preparar a entrada do herói!',
    items: [
      it('Ir até a porta do evento'), it('Chamar as crianças para se reunirem'),
      it('Organizar as crianças para o início da apresentação'),
      it('Quando estiver tudo pronto, avisar o Homem-Aranha'),
      it('Liberar a música de entrada'),
    ],
  },
  {
    id: 'meia-hora', title: 'Faltando 30 minutos', kicker: 'Etapa 7',
    description: 'Está chegando a hora dos parabéns. Converse com os responsáveis:',
    items: [
      it('Falar com os pais/responsáveis'), it('Combinar o horário exato dos parabéns'),
      it('Perguntar se haverá algum agradecimento antes dos parabéns'),
      it('Perguntar se haverá oração antes dos parabéns'),
    ],
  },
  {
    id: 'parabens', title: 'Momento dos parabéns', kicker: 'Etapa 8',
    description: '',
    items: [
      it('Confirmar com os responsáveis o momento dos parabéns'),
      it('Organizar as crianças'), it('Realizar os parabéns'), it('Entregar o certificado'),
      it('Entregar a medalha para o Homem-Aranha entregar à criança'),
    ],
  },
  {
    id: 'cinco-minutos', title: 'Cinco minutos finais', kicker: 'Etapa 9', highlight: true,
    description: 'O evento está chegando ao fim.',
    items: [
      it('Ligar o distintivo (sinal visual para o Homem-Aranha)'),
      it('Começar a guardar os equipamentos'), it('Organizar os materiais'), it('Preparar o encerramento'),
    ],
  },
].map((step, order) => ({
  alert: '', active: true, highlight: false, startButton: false, ...step, order,
  // IDs estáveis: o progresso salvo no aparelho é chaveado por etapa+item e precisa sobreviver a recarregamentos.
  items: step.items.map((item, i) => ({ ...item, id: `${step.id}-${i + 1}` })),
}));

/** WhatsApp do agente mais experiente (Vitor), para suporte urgente durante o evento. */
export const SUPPORT_WHATSAPP_URL = `https://wa.me/5531995152224?text=${encodeURIComponent('Olá Vitor, preciso de um suporte urgente!')}`;

/** FAQ padrão (categorias do menu Suporte). O conteúdo real é cadastrado pelo admin em Ajustes → Agente → Suporte. */
export const DEFAULT_AGENT_FAQ = [
  {
    id: 'caixa-de-som', title: 'Caixa de som',
    items: [{ question: 'Qual cuidado antes de ligar a caixa de som?', answer: 'Confira a voltagem da tomada antes de ligar a caixa de som.' }],
  },
].map((category, order) => ({
  active: true, ...category, order,
  items: category.items.map((item, i) => ({ ...item, id: `${category.id}-${i + 1}` })),
}));

/** Minúsculas e sem acentos, para a busca não depender de como o agente digita ("voltagem" = "Voltagém"). */
export const normalizeText = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Todas as palavras da busca precisam aparecer em algum dos textos (em qualquer ordem; uma frase exata também casa). */
export function matchesQuery(query, ...texts) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeText(texts.join(' '));
  return terms.every((term) => haystack.includes(term));
}

/** Perguntas e respostas de todas as categorias que casam com a busca, mantendo a ordem do FAQ. */
export function searchFaq(categories, query) {
  return categories.flatMap((category) =>
    category.items.filter((item) => matchesQuery(query, item.question, item.answer)).map((item) => ({ category, item })));
}

/**
 * Agrupa a playlist (já ordenada): cada música principal com seus "efeitos" (músicas com parentId apontando para ela).
 * Parent inexistente/inativo ou aninhado em outra filha vira música principal: nada some da lista.
 */
export function groupTracks(tracks) {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const isChild = (t) => !!t.parentId && t.parentId !== t.id && byId.has(t.parentId) && !byId.get(t.parentId).parentId;
  return tracks.filter((t) => !isChild(t)).map((track) => ({ track, children: tracks.filter((c) => isChild(c) && c.parentId === track.id) }));
}
