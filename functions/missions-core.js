// Regras puras do módulo Missões (sem Firestore): datas em America/Sao_Paulo, recorrência, ciclos de metas,
// sequência de tarefas e notificações. Usado pelo front (services/missionsService.ts), pelo handler do
// ManyChat e pela função agendada. Mantido em functions/ porque só essa pasta é publicada no Firebase.

// ponytail: o Brasil não tem horário de verão desde 2019; offset fixo -03:00. Se voltar, trocar por Intl.
const TZ_OFFSET_HOURS = -3;
const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, '0');

/** Data local (Brasília) no formato YYYY-MM-DD. */
export function dateKey(date) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_HOURS * 3600000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function parseDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Instante UTC em que a data local começa (00:00 de Brasília). */
export function startOfDay(key) {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day) - TZ_OFFSET_HOURS * 3600000);
}

export function addDays(key, amount) {
  return dateKey(new Date(startOfDay(key).getTime() + amount * DAY_MS + 12 * 3600000));
}

export const weekdayOf = (key) => { const { year, month, day } = parseDateKey(key); return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); };
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Fim do dia (23:59:59.999 de Brasília) como instante. */
export function endOfDay(key) { return new Date(startOfDay(addDays(key, 1)).getTime() - 1); }

// ---------------------------------------------------------------- recorrência

/**
 * A tarefa recorre na data `key`?
 * task: { frequency: 'daily'|'weekly'|'monthly', weekdays?: number[], monthDay?: number|null,
 *         monthNth?: { week: 1..4|-1, weekday: 0..6 }|null }
 * Mensal aceita dia fixo, "n-ésimo dia da semana" ou ambos (união; no mesmo dia gera uma única ocorrência).
 * Dia fixo maior que o mês (ex.: 31 em fevereiro) cai no último dia do mês.
 */
export function recursOn(task, key) {
  const { year, month, day } = parseDateKey(key);
  if (task.frequency === 'daily') return true;
  if (task.frequency === 'weekly') return Array.isArray(task.weekdays) && task.weekdays.includes(weekdayOf(key));
  if (task.frequency !== 'monthly') return false;
  const last = daysInMonth(year, month);
  if (Number.isInteger(task.monthDay) && Math.min(task.monthDay, last) === day) return true;
  const nth = task.monthNth;
  if (nth && Number.isInteger(nth.week) && weekdayOf(key) === nth.weekday) {
    return nth.week === -1 ? day + 7 > last : Math.ceil(day / 7) === nth.week;
  }
  return false;
}

export function validateTask(input) {
  const errors = [];
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) errors.push('Informe o título.');
  if (!Number.isInteger(input.difficulty) || input.difficulty < 1 || input.difficulty > 5) errors.push('A dificuldade deve ser de 1 a 5.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) errors.push('Informe um horário válido (HH:mm).');
  if (!['daily', 'weekly', 'monthly'].includes(input.frequency)) errors.push('Frequência inválida.');
  if (input.frequency === 'weekly' && !(Array.isArray(input.weekdays) && input.weekdays.length && input.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) errors.push('Escolha ao menos um dia da semana.');
  if (input.frequency === 'monthly') {
    const hasDay = Number.isInteger(input.monthDay) && input.monthDay >= 1 && input.monthDay <= 31;
    const nth = input.monthNth;
    const hasNth = !!nth && [1, 2, 3, 4, -1].includes(nth.week) && Number.isInteger(nth.weekday) && nth.weekday >= 0 && nth.weekday <= 6;
    if (!hasDay && !hasNth) errors.push('Escolha um dia do mês, uma posição na semana ou ambos.');
  }
  return errors;
}

/**
 * A tarefa pode ter lembrete recorrente na Alexa? A API só aceita regras simples: diária, semanal e mensal em dia fixo (1 a 28).
 * "N-ésimo dia da semana" e dia fixo 29-31 (que aqui cai no último dia do mês) não têm equivalente, então ficam sem lembrete.
 */
export function taskReminderSupported(task) {
  if (task.frequency === 'daily') return true;
  if (task.frequency === 'weekly') return Array.isArray(task.weekdays) && task.weekdays.length > 0;
  return task.frequency === 'monthly' && !task.monthNth && Number.isInteger(task.monthDay) && task.monthDay >= 1 && task.monthDay <= 28;
}

/**
 * Plano de geração: datas (> lastGeneratedDate, <= hoje) em que a tarefa recorre. Datas anteriores a hoje
 * nascem como `missed` (a aplicação ficou fora do ar), a de hoje nasce `pending`.
 * Limite de 62 dias de retroativo; pausas não geram backlog porque a retomada reposiciona lastGeneratedDate.
 */
export function planOccurrences(task, today) {
  const startFloor = addDays(today, -62);
  let from = task.lastGeneratedDate && task.lastGeneratedDate >= startFloor ? addDays(task.lastGeneratedDate, 1) : startFloor;
  if (task.startDate && from < task.startDate) from = task.startDate;
  const plan = [];
  for (let key = from; key <= today; key = addDays(key, 1)) {
    if (recursOn(task, key)) plan.push({ date: key, status: key < today ? 'missed' : 'pending' });
  }
  return plan;
}

export const occurrenceId = (taskId, date) => `${taskId}_${date}`;

/** Instante-limite da ocorrência (data + horário em Brasília). */
export function occurrenceDueAt(date, time) {
  const [h, m] = time.split(':').map(Number);
  return new Date(startOfDay(date).getTime() + (h * 60 + m) * 60000);
}

/**
 * Rotina idempotente (meia-noite e catch-up ao abrir o CRM). `store` abstrai o Firestore:
 *  listActiveTasks(), listPendingOccurrences(), createOccurrenceIfAbsent(id, data), resolveOccurrence(id, patch), updateTask(id, patch)
 * Datas são sempre Date puros; o adapter converte.
 */
export async function syncRecurringTasks(store, now = new Date()) {
  const today = dateKey(now);
  const tasks = await store.listActiveTasks();
  const activeIds = new Set(tasks.map((t) => t.id));
  const created = [];
  for (const task of tasks) {
    for (const item of planOccurrences(task, today)) {
      const id = occurrenceId(task.id, item.date);
      const data = {
        taskId: task.id, date: item.date, time: task.time, title: task.title, description: task.description || '',
        difficulty: task.difficulty, status: item.status, dueAt: occurrenceDueAt(item.date, task.time),
        createdAt: now, ...(item.status === 'missed' ? { missedAt: now } : {}),
      };
      if (await store.createOccurrenceIfAbsent(id, data)) created.push({ id, ...data });
    }
    if (task.lastGeneratedDate !== today) await store.updateTask(task.id, { lastGeneratedDate: today });
  }
  // Pendentes de dias anteriores: perdida (tarefa ativa) ou ignorada (tarefa pausada/excluída: não quebra sequência).
  const resolved = [];
  for (const occurrence of await store.listPendingOccurrences()) {
    if (occurrence.date >= today) continue;
    const status = activeIds.has(occurrence.taskId) ? 'missed' : 'skipped';
    await store.resolveOccurrence(occurrence.id, status === 'missed' ? { status, missedAt: now } : { status });
    resolved.push({ ...occurrence, status });
  }
  return { created, resolved };
}

// ------------------------------------------------------------------- sequência

/**
 * Dias seguidos sem falhar: percorre de hoje para trás; dia sem ocorrências é neutro; dia com alguma
 * `missed` quebra; dia com todas concluídas soma 1; dia de hoje ainda pendente não conta nem quebra.
 * `skipped` é ignorada. `since` (YYYY-MM-DD) limita a janela (usado pelas metas por ciclo).
 */
export function taskStreak(occurrences, today, since = null) {
  const byDate = new Map();
  for (const o of occurrences) {
    if (o.status === 'skipped') continue;
    if (!byDate.has(o.date)) byDate.set(o.date, []);
    byDate.get(o.date).push(o.status);
  }
  const oldest = [...byDate.keys()].sort()[0];
  let streak = 0;
  for (let key = today; oldest && key >= oldest && (!since || key >= since); key = addDays(key, -1)) {
    const statuses = byDate.get(key);
    if (!statuses) continue;
    if (statuses.includes('missed')) break;
    if (statuses.every((s) => s === 'completed')) streak += 1;
    else if (key !== today) break; // pendente em dia passado nunca deveria ocorrer; trata como falha
  }
  return streak;
}

// ----------------------------------------------------------------------- metas

/**
 * Limites do ciclo que contém `now`. config: { weekStartsOn: 0..6 (padrão 1 = segunda), monthStartDay: 1..28 (padrão 1) }.
 * Retorna { key, start, end, startKey, endKey } com start inclusivo e end exclusivo (instantes).
 */
export function cycleBounds(period, now, config = {}) {
  const today = dateKey(now);
  let startKey;
  let endKey; // exclusivo, como chave de data
  if (period === 'daily') {
    startKey = today; endKey = addDays(today, 1);
  } else if (period === 'weekly') {
    const weekStartsOn = Number.isInteger(config.weekStartsOn) ? config.weekStartsOn : 1;
    startKey = addDays(today, -((weekdayOf(today) - weekStartsOn + 7) % 7));
    endKey = addDays(startKey, 7);
  } else if (period === 'monthly') {
    const startDay = Number.isInteger(config.monthStartDay) ? Math.min(Math.max(config.monthStartDay, 1), 28) : 1;
    const { year, month, day } = parseDateKey(today);
    const [sy, sm] = day >= startDay ? [year, month] : month === 1 ? [year - 1, 12] : [year, month - 1];
    const [ey, em] = sm === 12 ? [sy + 1, 1] : [sy, sm + 1];
    startKey = `${sy}-${pad(sm)}-${pad(startDay)}`;
    endKey = `${ey}-${pad(em)}-${pad(startDay)}`;
  } else {
    throw new Error('Período de meta inválido.');
  }
  return { key: startKey, startKey, endKey, start: startOfDay(startKey), end: startOfDay(endKey) };
}

export const GOAL_METRICS = {
  revenue_completed: 'Faturamento de serviços concluídos (R$)',
  services_sold: 'Serviços vendidos',
  scripts_created: 'Roteiros criados',
  scripts_ready: 'Roteiros prontos para gravação',
  content_published: 'Conteúdos publicados',
  missions_completed: 'Missões concluídas',
  task_streak: 'Sequência de dias sem falhar',
  ig_followers_gain: 'Instagram: ganho de seguidores',
  ig_posts: 'Instagram: publicações feitas',
  ig_likes: 'Instagram: curtidas das publicações do ciclo',
  ig_comments: 'Instagram: comentários das publicações do ciclo',
  ig_views: 'Instagram: visualizações das publicações do ciclo',
};

export const INSTAGRAM_METRICS = ['ig_followers_gain', 'ig_posts', 'ig_likes', 'ig_comments', 'ig_views'];
const IG_POST_KEY = { ig_likes: 'likes', ig_comments: 'comments', ig_views: 'views' };
const EMPTY_INSTAGRAM = { followers: null, syncedAt: null, posts: [], stats: [] };

/** Publicações (da última sincronização) publicadas dentro do ciclo. */
const igPostsIn = (ig, start, end) => ig.posts.filter((p) => inRange(p.publishedAt, start, end));

/**
 * Ganho de seguidores no ciclo = seguidores no fim − seguidores no início. O início é o retrato diário (primeira sincronização
 * do dia, gravada em instagramStats) do primeiro dia do ciclo que tiver um; se o primeiro retrato é de depois do início do ciclo,
 * o ganho é parcial (`partial`, contado desde `from`). O fim é o valor atual (ciclo em andamento) ou o retrato do dia seguinte ao
 * ciclo (ciclo encerrado). Sem nenhum retrato no ciclo: value 0 e from null.
 * ig.stats: [{ day: 'YYYY-MM-DD', followers }].
 */
export function followersGain({ start, end }, ig, today) {
  const firstDay = dateKey(start);
  const lastDay = dateKey(new Date(end.getTime() - 1));
  const valid = ig.stats.filter((s) => Number.isFinite(s.followers)).sort((a, b) => a.day.localeCompare(b.day));
  const inCycle = valid.filter((s) => s.day >= firstDay && s.day <= lastDay);
  const base = inCycle[0];
  if (!base) return { value: 0, from: null, partial: false };
  let endFollowers = null;
  if (today <= lastDay) endFollowers = Number.isFinite(ig.followers) ? ig.followers : null;
  else endFollowers = (valid.find((s) => s.day > lastDay) ?? inCycle[inCycle.length - 1]).followers;
  if (endFollowers === null) return { value: 0, from: base.day, partial: base.day > firstDay };
  return { value: endFollowers - base.followers, from: base.day, partial: base.day > firstDay };
}

const fmtDay = (key) => key.split('-').reverse().slice(0, 2).join('/');
const fmtSync = (iso) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date(iso)).replace(', ', ' às ');

/** Observação exibida na meta do Instagram: frescor dos dados e limitações (base parcial, sem retrato, sem sincronização). */
export function instagramNote(metric, bounds, data, today) {
  if (!INSTAGRAM_METRICS.includes(metric)) return null;
  const ig = data.instagram ?? EMPTY_INSTAGRAM;
  if (!ig.syncedAt) return 'Instagram ainda não sincronizado: sem dados para esta meta.';
  const fresh = `Dados do Instagram de ${fmtSync(ig.syncedAt)}`;
  if (metric === 'ig_followers_gain') {
    const gain = followersGain(bounds, ig, today);
    if (gain.from === null) return `${fresh}. Aguardando o primeiro retrato diário de seguidores neste ciclo.`;
    return gain.partial ? `${fresh}. Contando desde ${fmtDay(gain.from)} (primeiro retrato do ciclo).` : fresh + '.';
  }
  return `${fresh}. Soma das últimas publicações sincronizadas (até 100).`;
}

const millis = (v) => (v instanceof Date ? v.getTime() : typeof v?.toDate === 'function' ? v.toDate().getTime() : v ? new Date(v).getTime() : NaN);
const inRange = (v, start, end) => { const t = millis(v); return t >= start.getTime() && t < end.getTime(); };

/**
 * Valor real (sem limite) de uma meta automática no ciclo. A contagem é por documento e por campo de data
 * do evento (completedAt, paidAt, readyAt…), logo é idempotente: editar ou repetir não conta de novo.
 * data: { orders, scripts, missions, occurrences, revenueEntries, instagram: { followers, syncedAt, posts, stats } }. `revenueEntries` são as entradas de faturamento do módulo
 * Financeiro (buildRevenueEntries em services/financeCalculations.js): a meta de faturamento só soma o que o Financeiro soma.
 */
export function metricValue(metric, { start, end }, data, today) {
  switch (metric) {
    case 'revenue_completed':
      // Mesma regra do Financeiro: valor e data de faturamento de cada entrada (inclui parcelas/ajustes do livro dos eventos).
      return data.revenueEntries.filter((e) => inRange(e.revenueDate, start, end)).reduce((sum, e) => sum + e.value, 0);
    case 'services_sold':
      // vendido = pagamento confirmado (paidAt); pedidos internos de produção de roteiro não são venda.
      return data.orders.filter((o) => !o.scriptId && inRange(o.paidAt, start, end)).length;
    case 'scripts_created': return data.scripts.filter((s) => inRange(s.createdAt, start, end)).length;
    case 'scripts_ready': return data.scripts.filter((s) => inRange(s.readyAt, start, end)).length;
    case 'content_published':
      return data.scripts.filter((s) => s.publicationStatus === 'published' && inRange(s.publishedAt, start, end)).length;
    case 'missions_completed': return data.missions.filter((m) => m.status === 'completed' && inRange(m.completedAt, start, end)).length;
    case 'ig_followers_gain': return followersGain({ start, end }, data.instagram ?? EMPTY_INSTAGRAM, today).value;
    case 'ig_posts': return igPostsIn(data.instagram ?? EMPTY_INSTAGRAM, start, end).length;
    case 'ig_likes': case 'ig_comments': case 'ig_views': {
      // Métrica ausente (curtidas ocultas, views indisponíveis) fica fora da soma, nunca vira 0 contado.
      const key = IG_POST_KEY[metric];
      return igPostsIn(data.instagram ?? EMPTY_INSTAGRAM, start, end).reduce((sum, p) => sum + (Number.isFinite(p[key]) ? p[key] : 0), 0);
    }
    case 'task_streak': {
      // Só conta até o último dia do ciclo; em ciclo encerrado, "hoje" é o último dia dele (não o dia atual).
      const lastDay = dateKey(new Date(end.getTime() - 1));
      const asOf = today < lastDay ? today : lastDay;
      return taskStreak(data.occurrences.filter((o) => o.date <= asOf), asOf, dateKey(start));
    }
    default: return 0;
  }
}

/** O ciclo salvo na meta já não corresponde ao ciclo calculado (virou o período ou mudaram os limites)? */
export function cycleChanged(goal, bounds) {
  return goal.cycleKey !== bounds.key || millis(goal.cycleEnd) !== bounds.end.getTime();
}

/**
 * Registro do histórico de ciclos (goalCycles). `endedEarly` marca ciclo interrompido por reconfiguração da meta;
 * nesse caso o fim é o dia da alteração.
 */
export function cycleArchiveRecord(goal, value, now, { endedEarly = false } = {}) {
  return {
    goalId: goal.id, title: goal.title, period: goal.period, metric: goal.metric ?? null, source: goal.source,
    startKey: goal.cycleKey, endKey: endedEarly ? dateKey(now) : dateKey(new Date(millis(goal.cycleEnd) - 1)),
    target: goal.target, value, reached: value >= goal.target, closedAt: now, ...(endedEarly ? { endedEarly: true } : {}),
  };
}

/** Valor mostrado: progresso limitado ao alvo; `actual` preserva o real. */
export function goalProgress(actual, target) {
  const shown = Math.min(actual, target);
  return { actual, shown, percent: target > 0 ? Math.round((shown / target) * 100) : 0, reached: target > 0 && actual >= target };
}

export function validateGoal(input) {
  const errors = [];
  if (!(typeof input.title === 'string' && input.title.trim())) errors.push('Informe o título.');
  if (!['daily', 'weekly', 'monthly'].includes(input.period)) errors.push('Período inválido.');
  if (!(Number.isFinite(input.target) && input.target > 0)) errors.push('O valor-alvo deve ser maior que zero.');
  if (!['manual', 'auto'].includes(input.source)) errors.push('Origem inválida.');
  if (input.source === 'auto' && !Object.hasOwn(GOAL_METRICS, input.metric)) errors.push('Escolha o indicador da meta automática.');
  return errors;
}

// ------------------------------------------------------------------- notificações

/** IDs estáveis dos avisos ligados a uma missão ou ocorrência de tarefa (os mesmos de buildNotifications). */
export const missionNotificationIds = (missionId) => [`mission_overdue_${missionId}`, `mission_due_soon_${missionId}`];
export const occurrenceNotificationIds = (occurrenceId) => [`task_today_${occurrenceId}`, `task_missed_${occurrenceId}`];

const DUE_SOON_MS = 24 * 3600000;
const GOAL_NEAR_RATIO = 0.8;

/**
 * Candidatas a notificação. O id é determinístico (tipo + referência [+ ciclo]); quem grava só cria se
 * ainda não existe, e avisos descartados continuam existindo — por isso nunca duplicam nem reaparecem.
 */
export function buildNotifications({ missions = [], occurrences = [], goals = [] }, now = new Date()) {
  const list = [];
  const add = (id, type, title, body, ref) => list.push({ id, type, title, body, ...ref });
  for (const m of missions) {
    if (m.status !== 'pending' || !m.dueAt) continue;
    const due = millis(m.dueAt);
    if (due < now.getTime()) add(`mission_overdue_${m.id}`, 'mission_overdue', 'Missão atrasada', m.title, { refType: 'mission', refId: m.id });
    else if (due - now.getTime() <= DUE_SOON_MS) add(`mission_due_soon_${m.id}`, 'mission_due_soon', 'Missão próxima do prazo', m.title, { refType: 'mission', refId: m.id });
  }
  for (const o of occurrences) {
    if (o.status === 'pending' && o.date === dateKey(now)) add(`task_today_${o.id}`, 'task_today', 'Tarefa prevista para hoje', `${o.title} às ${o.time}`, { refType: 'task', refId: o.taskId });
    if (o.status === 'missed') add(`task_missed_${o.id}`, 'task_missed', 'Tarefa não concluída', `${o.title} (${o.date.split('-').reverse().join('/')})`, { refType: 'task', refId: o.taskId });
  }
  for (const g of goals) {
    if (g.progress.reached) add(`goal_done_${g.id}_${g.cycleKey}`, 'goal_completed', 'Meta concluída', g.title, { refType: 'goal', refId: g.id });
    else if (g.progress.actual / g.target >= GOAL_NEAR_RATIO) add(`goal_near_${g.id}_${g.cycleKey}`, 'goal_near', 'Meta quase lá', `${g.title}: ${g.progress.actual}/${g.target}`, { refType: 'goal', refId: g.id });
  }
  return list;
}
