import React, { useState } from 'react';
import { Check, CheckCircle2, Loader2, Pause, Pencil, Play, Plus, Trash2, XCircle } from 'lucide-react';
import { completeOccurrence, createTask, deleteTask, setTaskStatus, updateTask, type RecurringTask, type TaskInput } from '../../services/missionsService';
import type { MissionsData } from './AdminMissionsPage';
import { taskReminderSupported } from '../../functions/missions-core.js';
import { AlexaReminderField, DifficultySelect, DifficultyStars, ErrorNote, WEEKDAYS, cardClass, ghostButton, inputClass, labelClass, primaryButton } from './missionsUi';

const NTH_LABELS: [number, string][] = [[1, 'primeira'], [2, 'segunda'], [3, 'terceira'], [4, 'quarta'], [-1, 'última']];
const FREQUENCY_LABELS = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };

function describe(task: RecurringTask): string {
  if (task.frequency === 'daily') return `Todos os dias às ${task.time}`;
  if (task.frequency === 'weekly') return `${task.weekdays.map((d) => WEEKDAYS[d]).join(', ')} às ${task.time}`;
  const parts: string[] = [];
  if (task.monthDay) parts.push(`dia ${task.monthDay}`);
  if (task.monthNth) parts.push(`${NTH_LABELS.find(([w]) => w === task.monthNth!.week)?.[1]} ${WEEKDAYS[task.monthNth.weekday]} do mês`);
  return `${parts.join(' e ')} às ${task.time}`;
}

export const MissionTasksTab: React.FC<{ data: MissionsData; reload: () => Promise<void> }> = ({ data, reload }) => {
  const [editing, setEditing] = useState<RecurringTask | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id); setError(null);
    try { await action(); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Operação falhou.'); } finally { setBusyId(null); }
  };

  const todays = data.occurrences.filter((o) => o.date === data.today).sort((a, b) => a.time.localeCompare(b.time));
  const missedRecent = data.occurrences.filter((o) => o.status === 'missed').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="space-y-4">
      <ErrorNote message={error} />
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Hoje</h3>
        {todays.length === 0 ? <p className={`${cardClass} text-center text-sm text-white/50`}>Nenhuma tarefa prevista para hoje.</p> : (
          <ul className="space-y-2">
            {todays.map((o) => (
              <li key={o.id} className={`${cardClass} flex items-center gap-3`}>
                {o.status === 'completed' ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                  : <button type="button" title="Concluir" disabled={busyId === o.id || o.status !== 'pending'} onClick={() => run(o.id, () => completeOccurrence(o.id))} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white/30 text-transparent hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-50">
                    {busyId === o.id ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : <Check className="h-3.5 w-3.5" />}
                  </button>}
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${o.status === 'completed' ? 'text-white/50 line-through' : 'text-white'}`}>{o.title}</p>
                  <p className="text-[11px] text-white/50">{o.time} · <DifficultyStars value={o.difficulty} /></p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {missedRecent.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-red-300/80">
            <XCircle className="h-3.5 w-3.5" />Perdidas recentemente:
            {missedRecent.map((o) => <span key={o.id}>{o.title} ({o.date.split('-').reverse().slice(0, 2).join('/')})</span>)}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">Tarefas recorrentes</h3>
          <button type="button" onClick={() => setEditing('new')} className={primaryButton}><Plus className="h-4 w-4" />Nova tarefa</button>
        </div>
        {editing && <TaskForm task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} />}
        {data.tasks.length === 0 && !editing && <p className={`${cardClass} text-center text-sm text-white/50`}>Nenhuma tarefa cadastrada.</p>}
        <ul className="space-y-2">
          {data.tasks.map((t) => (
            <li key={t.id} className={`${cardClass} flex items-start gap-3 ${t.status === 'paused' ? 'opacity-60' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{t.title} <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">{FREQUENCY_LABELS[t.frequency]}{t.status === 'paused' ? ' · pausada' : ''}</span></p>
                {t.description && <p className="mt-0.5 text-xs text-white/60">{t.description}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-white/60"><span>{describe(t)}</span><DifficultyStars value={t.difficulty} /></p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" title={t.status === 'active' ? 'Pausar' : 'Retomar'} disabled={busyId === t.id} onClick={() => run(t.id, () => setTaskStatus(t.id, t.status === 'active' ? 'paused' : 'active'))} className={ghostButton}>{t.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
                <button type="button" title="Editar" onClick={() => setEditing(t)} className={ghostButton}><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" title="Excluir" disabled={busyId === t.id} onClick={() => { if (confirm(`Excluir a tarefa "${t.title}"? O histórico de ocorrências já concluídas ou perdidas é mantido.`)) void run(t.id, () => deleteTask(t.id)); }} className={`${ghostButton} hover:!bg-red-500/20 hover:!text-red-300`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

const TaskForm: React.FC<{ task: RecurringTask | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ task, onClose, onSaved }) => {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [difficulty, setDifficulty] = useState(task?.difficulty ?? 3);
  const [time, setTime] = useState(task?.time ?? '09:00');
  const [frequency, setFrequency] = useState<TaskInput['frequency']>(task?.frequency ?? 'daily');
  const [weekdays, setWeekdays] = useState<number[]>(task?.weekdays ?? [1]);
  const [useDay, setUseDay] = useState(task ? task.monthDay != null : true);
  const [monthDay, setMonthDay] = useState(task?.monthDay ?? 1);
  const [useNth, setUseNth] = useState(!!task?.monthNth);
  const [nthWeek, setNthWeek] = useState(task?.monthNth?.week ?? 1);
  const [nthWeekday, setNthWeekday] = useState(task?.monthNth?.weekday ?? 1);
  const [alexaReminder, setAlexaReminder] = useState(task?.alexaReminder === true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(null);
    const input: TaskInput = {
      title, description, difficulty, time, frequency, weekdays,
      monthDay: useDay ? monthDay : null, monthNth: useNth ? { week: nthWeek, weekday: nthWeekday } : null, alexaReminder,
    };
    try {
      if (task) await updateTask(task.id, input); else await createTask(input);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
      setSaving(false);
    }
  };

  const reminderSupported = taskReminderSupported({ frequency, weekdays, monthDay: frequency === 'monthly' && useDay ? monthDay : null, monthNth: frequency === 'monthly' && useNth ? { week: nthWeek, weekday: nthWeekday } : null });
  const toggleDay = (day: number) => setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));

  return (
    <form onSubmit={submit} className={`${cardClass} space-y-3`}>
      <label className={labelClass}>Título<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={inputClass} /></label>
      <label className={labelClass}>Descrição<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} className={inputClass} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>Horário<input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputClass} /></label>
        <label className={labelClass}>Dificuldade<DifficultySelect value={difficulty} onChange={setDifficulty} /></label>
        <label className={labelClass}>Frequência
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as TaskInput['frequency'])} className={inputClass}>
            <option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option>
          </select>
        </label>
      </div>

      {frequency === 'weekly' && (
        <div className={labelClass}>Dias da semana
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((name, day) => (
              <button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${weekdays.includes(day) ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>{name}</button>
            ))}
          </div>
        </div>
      )}

      {frequency === 'monthly' && (
        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <p className="text-[11px] text-white/50">Marque uma ou as duas modalidades. Dia fixo maior que o mês (ex.: 31 em fevereiro) cai no último dia.</p>
          <label className="flex flex-wrap items-center gap-2 text-xs text-white/80">
            <input type="checkbox" checked={useDay} onChange={(e) => setUseDay(e.target.checked)} />Dia fixo do mês:
            <input type="number" min={1} max={31} value={monthDay} disabled={!useDay} onChange={(e) => setMonthDay(Number(e.target.value))} className="w-20 rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-white disabled:opacity-40" />
          </label>
          <label className="flex flex-wrap items-center gap-2 text-xs text-white/80">
            <input type="checkbox" checked={useNth} onChange={(e) => setUseNth(e.target.checked)} />Posição na semana:
            <select value={nthWeek} disabled={!useNth} onChange={(e) => setNthWeek(Number(e.target.value))} className="rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-white disabled:opacity-40">{NTH_LABELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select value={nthWeekday} disabled={!useNth} onChange={(e) => setNthWeekday(Number(e.target.value))} className="rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-white disabled:opacity-40">{WEEKDAYS.map((n, d) => <option key={d} value={d}>{n}</option>)}</select>
            do mês
          </label>
        </div>
      )}

      <AlexaReminderField
        checked={alexaReminder}
        onChange={setAlexaReminder}
        disabled={!reminderSupported}
        disabledReason="A Alexa só repete lembretes diários, semanais ou mensais em dia fixo (1 a 28). Esta recorrência não é suportada."
      />

      {task && <p className="text-[11px] text-white/40">As alterações valem para as próximas ocorrências; o histórico anterior é preservado.</p>}
      <ErrorNote message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButton}>Cancelar</button>
        <button type="submit" disabled={saving} className={primaryButton}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{task ? 'Salvar' : 'Criar tarefa'}</button>
      </div>
    </form>
  );
};
