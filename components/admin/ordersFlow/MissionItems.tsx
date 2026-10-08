import React from 'react';
import { AlertTriangle, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import { completeMission, deleteMission, toggleChecklistItem, type Mission } from '../../../services/missionsService';
import { DifficultyStars, cardClass, formatDateTime, ghostButton } from '../missionsUi';

type RunAction = (id: string, action: () => Promise<void>) => Promise<void>;

const MissionMeta: React.FC<{ m: Mission; overdue: boolean }> = ({ m, overdue }) => (
  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
    <DifficultyStars value={m.difficulty} />
    {m.dueAt ? <span className={overdue ? 'inline-flex items-center gap-1 font-semibold text-red-300' : 'text-white/60'}>{overdue && <AlertTriangle className="h-3 w-3" />}{overdue ? 'Atrasada · ' : 'Prazo · '}{formatDateTime(m.dueAt)}</span> : <span className="text-white/40">Sem prazo</span>}
    {m.source === 'manychat' && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">WhatsApp</span>}
    {m.source === 'event_checklist' && <span className="rounded-full bg-orange-500/15 px-2 py-0.5 font-semibold text-orange-300">Evento</span>}
    {m.orderState === 'deleted' && <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-300" title="O pedido deste evento foi excluído. A missão foi mantida com o progresso do checklist.">Pedido excluído</span>}
  </div>
);

const MissionChecklist: React.FC<{ m: Mission; busyId: string | null; run: RunAction }> = ({ m, busyId, run }) => (
  <>
    {m.checklist && m.checklist.length > 0 && (
      <div className="mt-2">
        <p className="mb-1 text-[11px] font-semibold text-white/50">Checklist · {m.checklist.filter((i) => i.done).length}/{m.checklist.length}</p>
        <ul className="space-y-1">
          {m.checklist.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={item.done} disabled={busyId === m.id} onChange={(e) => void run(m.id, () => toggleChecklistItem(m.id, item.id, e.target.checked))} className="h-4 w-4 shrink-0" />
                <span className={item.done ? 'text-white/40 line-through' : 'text-white/85'}>{item.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    )}
  </>
);

interface MissionRowProps {
  m: Mission;
  busyId: string | null;
  run: RunAction;
  onEdit: (mission: Mission) => void;
}

export const MissionRow: React.FC<MissionRowProps> = ({ m, busyId, run, onEdit }) => {
  const overdue = !!m.dueAt && m.dueAt < new Date();
  return (
    <li className={`${cardClass} flex items-start gap-3`}>
      <button type="button" title="Concluir missão" disabled={busyId === m.id} onClick={() => run(m.id, () => completeMission(m.id))} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white/30 text-transparent transition-colors hover:border-emerald-400 hover:text-emerald-400 disabled:opacity-50">
        {busyId === m.id ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">{m.title}</p>
        {m.description && <p className="mt-0.5 whitespace-pre-line text-xs text-white/60">{m.description}</p>}
        <MissionMeta m={m} overdue={overdue} />
        <MissionChecklist m={m} busyId={busyId} run={run} />
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" title="Editar" onClick={() => onEdit(m)} className={ghostButton}><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" title="Excluir" disabled={busyId === m.id} onClick={() => { if (confirm(`Excluir a missão "${m.title}"?`)) void run(m.id, () => deleteMission(m.id)); }} className={`${ghostButton} hover:!bg-red-500/20 hover:!text-red-300`}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </li>
  );
};
