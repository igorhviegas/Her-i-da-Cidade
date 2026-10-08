import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { GOAL_METRICS, type GoalMetric, type GoalPeriod } from '../../functions/missions-core.js';
import { createGoal, deleteGoal, listGoalCycles, setGoalProgress, setGoalStatus, updateGoal, type Goal, type GoalCycle, type GoalInput, type GoalView } from '../../services/missionsService';
import { ErrorNote, ProgressBar, WEEKDAYS, cardClass, ghostButton, inputClass, labelClass, primaryButton } from './missionsUi';

const PERIOD_LABELS: Record<GoalPeriod, string> = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };
const fmt = (n: number) => Number(n.toFixed(2)).toLocaleString('pt-BR');
const isMoney = (g: Goal) => g.source === 'auto' && g.metric === 'revenue_completed';
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const show = (g: Goal, n: number) => (isMoney(g) ? money(n) : fmt(n));
const dayMonth = (d: Date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);

export const MissionGoalsTab: React.FC<{ goals: GoalView[]; reload: () => Promise<void> }> = ({ goals, reload }) => {
  const [editing, setEditing] = useState<GoalView | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id); setError(null);
    try { await action(); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Operação falhou.'); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setEditing('new')} className={primaryButton}><Plus className="h-4 w-4" />Nova meta</button>
      <ErrorNote message={error} />
      {editing && <GoalForm goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />}
      {goals.length === 0 && !editing && <p className={`${cardClass} text-center text-sm text-white/50`}>Nenhuma meta cadastrada.</p>}
      <ul className="space-y-2">
        {goals.map((g) => (
          <li key={g.id} className={`${cardClass} space-y-2 ${g.status === 'paused' ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">
                  {g.title}
                  {g.view.reached && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"><CheckCircle2 className="h-3 w-3" />Concluída</span>}
                  {g.status === 'paused' && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">pausada</span>}
                </p>
                {g.description && <p className="mt-0.5 text-xs text-white/60">{g.description}</p>}
                <p className="mt-1 text-[11px] text-white/50">
                  {PERIOD_LABELS[g.period]} · ciclo {dayMonth(g.cycleStart)} a {dayMonth(new Date(g.cycleEnd.getTime() - 1))} · {g.source === 'auto' ? `automática: ${GOAL_METRICS[g.metric]}` : 'manual'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" title={g.status === 'active' ? 'Pausar' : 'Retomar'} disabled={busyId === g.id} onClick={() => run(g.id, () => setGoalStatus(g.id, g.status === 'active' ? 'paused' : 'active'))} className={ghostButton}>{g.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
                <button type="button" title="Editar" onClick={() => setEditing(g)} className={ghostButton}><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" title="Excluir" disabled={busyId === g.id} onClick={() => { if (confirm(`Excluir a meta "${g.title}"? O histórico de ciclos também será removido da tela.`)) void run(g.id, () => deleteGoal(g.id)); }} className={`${ghostButton} hover:!bg-red-500/20 hover:!text-red-300`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <ProgressBar percent={g.view.percent} done={g.view.reached} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-white">{show(g, g.view.shown)} / {show(g, g.target)} <span className="font-normal text-white/50">({g.view.percent}%)</span>
                {g.actual > g.target && <span className="ml-2 font-normal text-emerald-300/80">real: {show(g, g.actual)}</span>}
                {g.actual < 0 && <span className="ml-2 font-normal text-red-300/90">real: {show(g, g.actual)} (a barra não mostra valor negativo)</span>}</span>
              {g.source === 'manual' && <ManualProgress goal={g} busy={busyId === g.id} onSave={(value) => run(g.id, () => setGoalProgress(g.id, value))} />}
            </div>
            {g.note && <p className="text-[11px] text-white/45">{g.note}</p>}
            <GoalHistory goal={g} />
          </li>
        ))}
      </ul>
    </div>
  );
};

const ManualProgress: React.FC<{ goal: Goal; busy: boolean; onSave: (value: number) => void }> = ({ goal, busy, onSave }) => {
  const [value, setValue] = useState(String(goal.progress));
  return (
    <span className="flex items-center gap-1.5">
      <button type="button" disabled={busy} onClick={() => onSave(Math.max(0, goal.progress - 1))} className={ghostButton}>−1</button>
      <button type="button" disabled={busy} onClick={() => onSave(goal.progress + 1)} className={ghostButton}>+1</button>
      <input type="number" min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)} className="w-20 rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-white" aria-label="Progresso atual" />
      <button type="button" disabled={busy || value === '' || Number(value) === goal.progress} onClick={() => onSave(Number(value))} className={ghostButton}>Definir</button>
    </span>
  );
};

const GoalHistory: React.FC<{ goal: Goal }> = ({ goal }) => {
  const [open, setOpen] = useState(false);
  const [cycles, setCycles] = useState<GoalCycle[] | null>(null);
  const toggle = async () => {
    setOpen((v) => !v);
    if (!cycles) setCycles(await listGoalCycles(goal.id).catch(() => []));
  };
  return (
    <div>
      <button type="button" onClick={() => void toggle()} className="flex items-center gap-1 text-[11px] font-semibold text-white/50 hover:text-white"><ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />Ciclos anteriores</button>
      {open && (cycles === null ? <Loader2 className="mt-2 h-4 w-4 animate-spin text-white/50" /> : (
        <ul className="mt-1.5 space-y-1">
          {cycles.length === 0 && <li className="text-[11px] text-white/40">Ainda não há ciclos encerrados.</li>}
          {cycles.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-[11px] text-white/60">
              <span>{c.startKey.split('-').reverse().slice(0, 2).join('/')} a {c.endKey.split('-').reverse().slice(0, 2).join('/')}</span>
              <span className={c.reached ? 'font-semibold text-emerald-300' : ''}>{show(goal, c.value)} / {show(goal, c.target)} {c.reached ? '✓' : ''}</span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
};

const GoalForm: React.FC<{ goal: GoalView | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ goal, onClose, onSaved }) => {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [period, setPeriod] = useState<GoalPeriod>(goal?.period ?? 'weekly');
  const [target, setTarget] = useState(String(goal?.target ?? ''));
  const [source, setSource] = useState<'manual' | 'auto'>(goal?.source ?? 'manual');
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'scripts_ready');
  const [weekStartsOn, setWeekStartsOn] = useState(goal?.weekStartsOn ?? 1);
  const [monthStartDay, setMonthStartDay] = useState(goal?.monthStartDay ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(null);
    const input: GoalInput = { title, description, period, target: Number(target.replace(',', '.')), source, metric: source === 'auto' ? metric : undefined, weekStartsOn, monthStartDay };
    try {
      if (goal) await updateGoal(goal, input); else await createGoal(input);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${cardClass} space-y-3`}>
      <label className={labelClass}>Título<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={inputClass} /></label>
      <label className={labelClass}>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} className={inputClass} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>Período
          <select value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)} className={inputClass}><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select>
        </label>
        <label className={labelClass}>Valor-alvo<input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} required className={inputClass} /></label>
        <label className={labelClass}>Origem do progresso
          <select value={source} onChange={(e) => setSource(e.target.value as 'manual' | 'auto')} className={inputClass}><option value="manual">Manual</option><option value="auto">Automática</option></select>
        </label>
      </div>
      {source === 'auto' && (
        <label className={labelClass}>Indicador
          <select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)} className={inputClass}>{Object.entries(GOAL_METRICS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </label>
      )}
      {period === 'weekly' && (
        <label className={labelClass}>A semana começa em
          <select value={weekStartsOn} onChange={(e) => setWeekStartsOn(Number(e.target.value))} className={inputClass}>{WEEKDAYS.map((n, d) => <option key={d} value={d}>{n}</option>)}</select>
        </label>
      )}
      {period === 'monthly' && (
        <label className={labelClass}>O ciclo mensal começa no dia (1–28)
          <input type="number" min={1} max={28} value={monthStartDay} onChange={(e) => setMonthStartDay(Number(e.target.value))} className={inputClass} />
        </label>
      )}
      {goal && <p className="text-[11px] text-white/40">Mudar o período ou os limites do ciclo inicia um novo ciclo; o progresso manual do ciclo atual é zerado.</p>}
      <ErrorNote message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButton}>Cancelar</button>
        <button type="submit" disabled={saving} className={primaryButton}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{goal ? 'Salvar' : 'Criar meta'}</button>
      </div>
    </form>
  );
};
