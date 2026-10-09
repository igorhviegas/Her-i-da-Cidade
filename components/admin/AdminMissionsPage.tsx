import { logger } from '../../lib/logger.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, CheckCircle2, ChevronDown, Flame, ListTodo, Loader2, Plus, RefreshCw, Repeat, Target } from 'lucide-react';
import { addDays, dateKey, taskStreak } from '../../functions/missions-core.js';
import {
  getActivityDifficulties, listMissions, listOccurrencesSince, listTasks, loadGoals,
  runClientSync, setActivityDifficulty,
  type GoalView, type Mission, type RecurringTask, type TaskOccurrence,
} from '../../services/missionsService';
import { getServices } from '../../services/servicesService';
import { MissionTasksTab } from './MissionTasksTab';
import { MissionGoalsTab } from './MissionGoalsTab';
import { MissionForm } from './ordersFlow/MissionForm';
import { MissionRow } from './ordersFlow/MissionItems';
import {
  DifficultyStars, ErrorNote, WarningNote, cardClass, formatDateTime, ghostButton, primaryButton,
} from './missionsUi';

type Tab = 'missions' | 'tasks' | 'goals';

export interface MissionsData {
  missions: { pending: Mission[]; history: Mission[] };
  tasks: RecurringTask[];
  occurrences: TaskOccurrence[];
  goals: GoalView[];
  today: string;
}

const emptyData: MissionsData = { missions: { pending: [], history: [] }, tasks: [], occurrences: [], goals: [], today: dateKey(new Date()) };

export const AdminMissionsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('missions');
  const [data, setData] = useState<MissionsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const loadSeq = useRef(0);

  /**
   * `sync` (abrir a página e "Atualizar"): gera ocorrências/avisos e espera as metas. Depois de uma ação (concluir, editar...) só as listas
   * baratas são relidas antes de liberar a tela; as metas (leitura pesada) chegam em segundo plano.
   */
  const reload = useCallback(async ({ sync = false }: { sync?: boolean } = {}) => {
    const seq = ++loadSeq.current;
    setError(null);
    setWarning(null);
    const now = new Date();
    const today = dateKey(now);
    const goalsPromise = loadGoals(now);
    goalsPromise.catch(() => undefined); // tratado abaixo; evita rejeição não tratada enquanto a sincronização roda
    const applyGoals = (goals: PromiseSettledResult<GoalView[]>) => {
      if (seq !== loadSeq.current) return; // um recarregamento mais novo já assumiu
      if (goals.status === 'fulfilled') { setData((current) => ({ ...current, goals: goals.value })); return; }
      logger.error('[AdminMissionsPage] Falha ao carregar metas:', goals.reason);
      setError((current) => current ?? 'Não foi possível carregar: metas. O restante foi exibido normalmente.');
    };
    if (sync) {
      // A sincronização é complementar: se falhar, as listas ainda carregam e o erro vira um aviso.
      try {
        await runClientSync(now, goalsPromise);
      } catch (err) {
        logger.error('[AdminMissionsPage] Falha na sincronização:', err);
        setWarning('Não foi possível sincronizar as tarefas de hoje agora; exibindo os dados já salvos. Use Atualizar para tentar de novo.');
      }
    }
    // Cada bloco carrega de forma independente: uma falha não esconde os demais, que mantêm o último valor conhecido.
    const [missions, tasks, occurrences] = await Promise.allSettled([listMissions(now), listTasks(), listOccurrencesSince(addDays(today, -60))]);
    setData((current) => ({
      ...current,
      missions: missions.status === 'fulfilled' ? missions.value : current.missions,
      tasks: tasks.status === 'fulfilled' ? tasks.value : current.tasks,
      occurrences: occurrences.status === 'fulfilled' ? occurrences.value : current.occurrences,
      today,
    }));
    const failed = [['missões', missions], ['tarefas', tasks], ['ocorrências', occurrences]].filter(([, r]) => (r as PromiseSettledResult<unknown>).status === 'rejected');
    if (failed.length) {
      failed.forEach(([name, r]) => logger.error(`[AdminMissionsPage] Falha ao carregar ${name}:`, (r as PromiseRejectedResult).reason));
      setError(`Não foi possível carregar: ${failed.map(([name]) => name).join(', ')}. O restante foi exibido normalmente.`);
    }
    setLoading(false);
    const goalsSettled = Promise.allSettled([goalsPromise]).then(([goals]) => applyGoals(goals));
    if (sync) await goalsSettled;
  }, []);

  useEffect(() => { void reload({ sync: true }); }, [reload]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'missions', label: 'To-do list', icon: ListTodo },
    { id: 'tasks', label: 'Tarefas', icon: Repeat },
    { id: 'goals', label: 'Metas', icon: Target },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Missões</h2>
          <p className="text-xs text-white/50">Missões, tarefas recorrentes e metas do dia a dia.</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); void reload({ sync: true }); }} disabled={loading} className={ghostButton}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Atualizar
        </button>
      </div>

      <ErrorNote message={error} />
      <WarningNote message={warning} />
      <DaySummary data={data} />

      <div className="flex gap-1 rounded-xl border border-white/10 bg-[#0B1120] p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${tab === id ? 'bg-blue-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
            <Icon className="h-4 w-4" /><span>{label}</span>
          </button>
        ))}
      </div>

      {loading && !data.tasks.length && !data.missions.pending.length ? (
        <div className="flex justify-center py-12 text-white/50"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          {tab === 'missions' && <MissionsTab missions={data.missions} reload={reload} />}
          {tab === 'tasks' && <MissionTasksTab data={data} reload={reload} />}
          {tab === 'goals' && <MissionGoalsTab goals={data.goals} reload={reload} />}
        </>
      )}
      <ActivityDifficulties />
    </div>
  );
};

// ------------------------------------------------------------------------ resumo do dia

const DaySummary: React.FC<{ data: MissionsData }> = ({ data }) => {
  const now = new Date();
  const todays = data.occurrences.filter((o) => o.date === data.today);
  const overdue = data.missions.pending.filter((m) => m.dueAt && m.dueAt < now).length;
  const startOfToday = new Date(`${data.today}T00:00:00-03:00`);
  const doneMissions = data.missions.history.filter((m) => m.completedAt && m.completedAt >= startOfToday).length;
  const doneTasks = todays.filter((o) => o.status === 'completed').length;
  const streak = taskStreak(data.occurrences, data.today);
  const activeGoals = data.goals.filter((g) => g.status === 'active');

  const stat = (icon: React.ReactNode, label: string, value: React.ReactNode, hint?: string) => (
    <div className={cardClass}>
      <div className="mb-2 flex items-center justify-between text-white/50"><span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-white/50">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat(<ListTodo className="h-4 w-4 text-blue-400" />, 'Missões pendentes', data.missions.pending.length, overdue ? `${overdue} atrasada(s)` : 'nenhuma atrasada')}
        {stat(<CalendarCheck className="h-4 w-4 text-indigo-400" />, 'Tarefas de hoje', `${doneTasks}/${todays.length}`, todays.length ? `${todays.length - doneTasks} a fazer` : 'nada previsto')}
        {stat(<CheckCircle2 className="h-4 w-4 text-emerald-400" />, 'Concluído hoje', doneMissions + doneTasks, `${doneMissions} missão(ões) · ${doneTasks} tarefa(s)`)}
        {stat(<Flame className="h-4 w-4 text-orange-400" />, 'Dias sem falhar', streak, 'sequência das tarefas')}
      </div>
      {activeGoals.length > 0 && (
        <div className={cardClass}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Metas em andamento</p>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {activeGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-xs text-white/80">{g.title}</span>
                <span className={`text-xs font-semibold ${g.view.reached ? 'text-emerald-300' : 'text-white/60'}`}>{Number(g.view.shown.toFixed(2))}/{g.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------------ aba To-do list

type Sort = 'due' | 'difficulty' | 'created';
type StatusFilter = 'all' | 'overdue' | 'on_time' | 'no_due';

const MissionsTab: React.FC<{ missions: MissionsData['missions']; reload: () => Promise<void> }> = ({ missions, reload }) => {
  const [editing, setEditing] = useState<Mission | 'new' | null>(null);
  const [sort, setSort] = useState<Sort>('due');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [difficulty, setDifficulty] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const now = new Date();
    return missions.pending
      .filter((m) => (difficulty ? m.difficulty === difficulty : true))
      .filter((m) => status === 'all' || (status === 'overdue' ? !!m.dueAt && m.dueAt < now : status === 'no_due' ? !m.dueAt : !!m.dueAt && m.dueAt >= now))
      .sort((a, b) => {
        if (sort === 'difficulty') return b.difficulty - a.difficulty;
        if (sort === 'created') return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
        return (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity); // sem prazo por último
      });
  }, [missions.pending, sort, status, difficulty]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id); setError(null);
    try { await action(); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Operação falhou.'); } finally { setBusyId(null); }
  };

  const small = 'rounded-lg border border-white/10 bg-[#070B14] px-2.5 py-1.5 text-xs text-white outline-none';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setEditing('new')} className={primaryButton}><Plus className="h-4 w-4" />Nova missão</button>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={small} aria-label="Ordenar"><option value="due">Ordenar: prazo</option><option value="difficulty">Ordenar: dificuldade</option><option value="created">Ordenar: mais recentes</option></select>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={small} aria-label="Status"><option value="all">Todos os status</option><option value="overdue">Atrasadas</option><option value="on_time">No prazo</option><option value="no_due">Sem prazo</option></select>
        <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className={small} aria-label="Dificuldade"><option value={0}>Toda dificuldade</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Dificuldade {n}</option>)}</select>
      </div>

      <ErrorNote message={error} />
      {editing && <MissionForm mission={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />}

      {visible.length === 0 ? (
        <p className={`${cardClass} text-center text-sm text-white/50`}>Nenhuma missão pendente com esses filtros.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((m) => <MissionRow key={m.id} m={m} busyId={busyId} run={run} onEdit={setEditing} />)}
        </ul>
      )}

      <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0B1120] px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white">
        <span>Concluídas nos últimos 30 dias ({missions.history.length})</span><ChevronDown className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
      </button>
      {showHistory && (
        <ul className="space-y-1.5">
          {missions.history.length === 0 && <li className="text-center text-xs text-white/40">Nenhuma missão concluída no período.</li>}
          {missions.history.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#0B1120] px-4 py-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="min-w-0 flex-1 truncate text-sm text-white/70 line-through decoration-white/20">{m.title}</span>
              <DifficultyStars value={m.difficulty} />
              <span className="text-[11px] text-white/40">{formatDateTime(m.completedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ------------------------------------------------- dificuldade por tipo de atividade (gamificação)

const ActivityDifficulties: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, number>>({});
  const [services, setServices] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || services.length) return;
    Promise.all([getActivityDifficulties(), getServices()])
      .then(([saved, list]) => { setValues(saved); setServices(list.filter((s) => !s.internalOnly).map((s) => ({ id: s.id, title: s.title }))); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar.'));
  }, [open, services.length]);

  const rows = [...services.map((s) => ({ key: `service_${s.id}`, label: `Serviço: ${s.title}` })), { key: 'script_created', label: 'Criação de roteiro' }];
  const change = async (key: string, value: number) => {
    setValues((current) => ({ ...current, [key]: value }));
    try { await setActivityDifficulty(key, value); setError(null); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar.'); }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#0B1120]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-white/60 hover:text-white">
        <span>Dificuldade por tipo de atividade <span className="font-normal text-white/40">(base para a futura gamificação)</span></span><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-white/10 p-4">
          <p className="text-[11px] text-white/40">Missões e tarefas recorrentes têm dificuldade individual. Nenhum XP é calculado ainda.</p>
          <ErrorNote message={error} />
          {rows.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-xs text-white/80">{label}</span>
              <select value={values[key] ?? 0} onChange={(e) => void change(key, Number(e.target.value))} className="rounded-lg border border-white/10 bg-[#070B14] px-2 py-1.5 text-xs text-white outline-none">
                <option value={0} disabled>não definida</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
