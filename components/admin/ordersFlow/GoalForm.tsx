import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GOAL_METRICS, type GoalMetric, type GoalPeriod } from '../../../functions/missions-core.js';
import { createGoal, updateGoal, type GoalInput, type GoalView } from '../../../services/missionsService';
import { ErrorNote, WEEKDAYS, cardClass, ghostButton, inputClass, labelClass, primaryButton } from '../missionsUi';

const useGoalBasics = (goal: GoalView | null) => {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [period, setPeriod] = useState<GoalPeriod>(goal?.period ?? 'weekly');
  const [target, setTarget] = useState(String(goal?.target ?? ''));
  return { title, setTitle, description, setDescription, period, setPeriod, target, setTarget };
};

const useGoalSchedule = (goal: GoalView | null) => {
  const [source, setSource] = useState<'manual' | 'auto'>(goal?.source ?? 'manual');
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'scripts_ready');
  const [weekStartsOn, setWeekStartsOn] = useState(goal?.weekStartsOn ?? 1);
  const [monthStartDay, setMonthStartDay] = useState(goal?.monthStartDay ?? 1);
  return { source, setSource, metric, setMetric, weekStartsOn, setWeekStartsOn, monthStartDay, setMonthStartDay };
};

export const GoalForm: React.FC<{ goal: GoalView | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ goal, onClose, onSaved }) => {
  const { title, setTitle, description, setDescription, period, setPeriod, target, setTarget } = useGoalBasics(goal);
  const { source, setSource, metric, setMetric, weekStartsOn, setWeekStartsOn, monthStartDay, setMonthStartDay } = useGoalSchedule(goal);
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
