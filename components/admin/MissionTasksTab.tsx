import React, { useState } from 'react';
import { Check, CheckCircle2, Loader2, Pause, Pencil, Play, Plus, Trash2, XCircle } from 'lucide-react';
import { completeOccurrence, deleteTask, setTaskStatus, type RecurringTask } from '../../services/missionsService';
import type { MissionsData } from './AdminMissionsPage';
import { DifficultyStars, ErrorNote, WEEKDAYS, cardClass, ghostButton, primaryButton } from './missionsUi';
import { NTH_LABELS, TaskForm } from './ordersFlow/TaskForm';

const FREQUENCY_LABELS = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };

function describe(task: RecurringTask): string {
  if (task.frequency === 'daily') return `Todos os dias às ${task.time}`;
  if (task.frequency === 'weekly') return `${task.weekdays.map((d) => WEEKDAYS[d]).join(', ')} às ${task.time}`;
  const parts: string[] = [];
  if (task.monthDay) parts.push(`dia ${task.monthDay}`);
  if (task.monthNth) parts.push(`${NTH_LABELS.find(([w]) => w === task.monthNth.week)?.[1]} ${WEEKDAYS[task.monthNth.weekday]} do mês`);
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
