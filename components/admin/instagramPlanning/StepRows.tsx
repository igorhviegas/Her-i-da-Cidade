import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { makeStepId, offsetFrom, shortDate, splitOffset, stepDate, type CampaignStep, type StepStatus } from '../../../services/instagramPlanning.js';
import { ghostBtn, inputClass } from '../financeFormat';

type Direction = 'before' | 'on' | 'after';
/** Linha editável de etapa. `enabled` = etapa ativa (as desativadas não são salvas na campanha). */
export interface RowDraft { id: string; title: string; direction: Direction; days: string; status: StepStatus; notes: string; missionId?: string; enabled: boolean }

export const rowFromStep = (step: CampaignStep): RowDraft => ({ id: step.id, title: step.title, ...splitOffset(step.offset), status: step.status, notes: step.notes ?? '', missionId: step.missionId, enabled: true });
export const newRow = (): RowDraft => ({ id: makeStepId(), title: '', direction: 'before', days: '1', status: 'pending', notes: '', enabled: true });
export const rowsToSteps = (rows: RowDraft[]): CampaignStep[] => rows.filter((r) => r.enabled).map((r) => ({
  id: r.id, title: r.title, offset: offsetFrom(r.direction, r.days), status: r.status, notes: r.notes, ...(r.missionId ? { missionId: r.missionId } : {}),
}));

const DIRECTIONS: { id: Direction; label: string }[] = [{ id: 'before', label: 'dias antes' }, { id: 'on', label: 'no dia' }, { id: 'after', label: 'dias depois' }];

/** Editor de etapas: usado no formulário de campanha (com data calculada) e no editor de modelos (sem lançamento). */
export const StepRows: React.FC<{ rows: RowDraft[]; onChange: (rows: RowDraft[]) => void; launchDate?: string; today: string; allowToggle?: boolean }> = ({ rows, onChange, launchDate, today, allowToggle = true }) => {
  const patch = (id: string, change: Partial<RowDraft>) => onChange(rows.map((row) => (row.id === id ? { ...row, ...change } : row)));
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const date = launchDate ? stepDate(launchDate, offsetFrom(row.direction, row.days)) : null;
        return (
          <div key={row.id} className={`rounded-xl border border-white/10 bg-white/[0.03] p-2 ${row.enabled ? '' : 'opacity-50'}`}>
            <div className="flex items-center gap-2">
              {allowToggle && <input type="checkbox" checked={row.enabled} onChange={(e) => patch(row.id, { enabled: e.target.checked })} aria-label="Etapa ativa" className="h-4 w-4 shrink-0 accent-purple-500" />}
              <input value={row.title} onChange={(e) => patch(row.id, { title: e.target.value })} placeholder="Nome da etapa" aria-label="Nome da etapa" className={`${inputClass} !mt-0 min-w-0 flex-1`} />
              <button type="button" onClick={() => onChange(rows.filter((r) => r.id !== row.id))} aria-label="Remover etapa" className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-0 sm:pl-6">
              {row.direction !== 'on' && <input value={row.days} onChange={(e) => patch(row.id, { days: e.target.value })} inputMode="numeric" aria-label="Quantidade de dias" className={`${inputClass} !mt-0 w-16 text-center`} />}
              <select value={row.direction} onChange={(e) => patch(row.id, { direction: e.target.value as Direction })} aria-label="Antes ou depois do lançamento" className={`${inputClass} !mt-0 w-auto`}>
                {DIRECTIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              {launchDate && <span className="text-xs font-semibold text-amber-200">{date ? `→ ${shortDate(date, today)}` : '→ prazo inválido'}</span>}
            </div>
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...rows, newRow()])} className={ghostBtn}><Plus className="h-3.5 w-3.5" aria-hidden />Adicionar etapa</button>
    </div>
  );
};
