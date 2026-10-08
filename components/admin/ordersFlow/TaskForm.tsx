import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { taskReminderSupported } from '../../../functions/missions-core.js';
import { createTask, updateTask, type RecurringTask, type TaskInput } from '../../../services/missionsService';
import { AlexaReminderField, DifficultySelect, ErrorNote, WEEKDAYS, cardClass, ghostButton, inputClass, labelClass, primaryButton } from '../missionsUi';

export const NTH_LABELS: [number, string][] = [[1, 'primeira'], [2, 'segunda'], [3, 'terceira'], [4, 'quarta'], [-1, 'última']];

const useTaskBasics = (task: RecurringTask | null) => {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [difficulty, setDifficulty] = useState(task?.difficulty ?? 3);
  const [time, setTime] = useState(task?.time ?? '09:00');
  const [frequency, setFrequency] = useState<TaskInput['frequency']>(task?.frequency ?? 'daily');
  return { title, setTitle, description, setDescription, difficulty, setDifficulty, time, setTime, frequency, setFrequency };
};

const useTaskMonthDay = (task: RecurringTask | null) => {
  const [weekdays, setWeekdays] = useState<number[]>(task?.weekdays ?? [1]);
  const [useDay, setUseDay] = useState(task ? task.monthDay != null : true);
  const [monthDay, setMonthDay] = useState(task?.monthDay ?? 1);
  return { weekdays, setWeekdays, useDay, setUseDay, monthDay, setMonthDay };
};

const useTaskNth = (task: RecurringTask | null) => {
  const [useNth, setUseNth] = useState(!!task?.monthNth);
  const [nthWeek, setNthWeek] = useState(task?.monthNth?.week ?? 1);
  const [nthWeekday, setNthWeekday] = useState(task?.monthNth?.weekday ?? 1);
  const [alexaReminder, setAlexaReminder] = useState(task?.alexaReminder === true);
  return { useNth, setUseNth, nthWeek, setNthWeek, nthWeekday, setNthWeekday, alexaReminder, setAlexaReminder };
};

export const TaskForm: React.FC<{ task: RecurringTask | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ task, onClose, onSaved }) => {
  const { title, setTitle, description, setDescription, difficulty, setDifficulty, time, setTime, frequency, setFrequency } = useTaskBasics(task);
  const { weekdays, setWeekdays, useDay, setUseDay, monthDay, setMonthDay } = useTaskMonthDay(task);
  const { useNth, setUseNth, nthWeek, setNthWeek, nthWeekday, setNthWeekday, alexaReminder, setAlexaReminder } = useTaskNth(task);
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
