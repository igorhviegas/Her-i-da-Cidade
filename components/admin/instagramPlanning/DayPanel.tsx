import React, { useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { createPlan, deletePlan, updatePlan } from '../../../services/instagramPlanningService';
import { describeOffset, FORMATS, formatLabel, fullDate, stepStatusLabel, validatePlan, type DayEntries, type FormatId, type Plan } from '../../../services/instagramPlanning.js';
import { ghostBtn, inputClass, labelClass, primaryBtn } from '../financeFormat';
import { Chip, ErrorLine, Modal, PLAN_TONE, STEP_TONE } from './planningUi';

interface Draft { id: string | null; title: string; format: FormatId; notes: string }
const EMPTY: Draft = { id: null, title: '', format: 'reels', notes: '' };

/** Um dia do calendário: o que o Instagram já mostra (resumo), os planejamentos avulsos (criar/editar/excluir) e as etapas de campanha. */
export const DayPanel: React.FC<{ dayKey: string; summary: string; entries: DayEntries | undefined; onClose: () => void; onOpenCampaign: (campaignId: string) => void }> = ({ dayKey, summary, entries, onClose, onOpenCampaign }) => {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [flash, setFlash] = useState('');
  const plans = entries?.plans ?? [];
  const steps = entries?.steps ?? [];

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = { date: dayKey, title: draft.title, format: draft.format, notes: draft.notes };
    const problems = validatePlan(input);
    if (problems.length) { setErrors(problems); return; }
    setBusy(true); setErrors([]); setFlash('');
    try {
      if (draft.id) await updatePlan(draft.id, input); else await createPlan(input);
      setDraft(EMPTY); setFlash(draft.id ? 'Planejamento atualizado.' : 'Planejamento adicionado.');
    } catch (e) { setErrors([e instanceof Error ? e.message : 'Não foi possível salvar.']); } finally { setBusy(false); }
  };
  const remove = async (plan: Plan) => {
    if (!window.confirm(`Excluir "${plan.title}"?`)) return;
    setBusy(true); setErrors([]); setFlash('');
    try { await deletePlan(plan.id); if (draft.id === plan.id) setDraft(EMPTY); setFlash('Planejamento excluído.'); } catch (e) { setErrors([e instanceof Error ? e.message : 'Não foi possível excluir.']); } finally { setBusy(false); }
  };

  return (
    <Modal title={fullDate(dayKey)} onClose={onClose}>
      <p className="mb-3 rounded-xl bg-white/[0.04] p-2.5 text-xs text-white/65">{summary}</p>

      {steps.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200/80">Campanhas</p>
          <ul className="space-y-1.5">
            {steps.map((step) => (
              <li key={`${step.campaignId}:${step.stepId ?? 'launch'}`}>
                <button type="button" onClick={() => onOpenCampaign(step.campaignId)} className={`flex w-full items-start gap-2 rounded-xl p-2 text-left ${STEP_TONE}`}>
                  <span aria-hidden>{step.launch ? '🚀' : '📌'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{step.title}{step.launch && step.stepId && ' (lançamento)'}</span>
                    <span className="block truncate text-[11px] opacity-80">Campanha: {step.campaignTitle} · {describeOffset(step.offset)}</span>
                  </span>
                  {step.status && <Chip tone="bg-black/30 text-white/80">{stepStatusLabel(step.status)}</Chip>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-sky-200/80">Planejamento avulso</p>
        {plans.length === 0 ? <p className="text-xs text-white/40">Nada planejado para este dia.</p> : (
          <ul className="space-y-1.5">
            {plans.map((plan) => (
              <li key={plan.id} className={`flex items-start gap-2 rounded-xl p-2 ${PLAN_TONE}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{plan.title} <span className="font-normal opacity-80">— {formatLabel(plan.format)}</span></span>
                  {plan.notes && <span className="block text-[11px] opacity-75">{plan.notes}</span>}
                </span>
                <button type="button" disabled={busy} onClick={() => setDraft({ id: plan.id, title: plan.title, format: plan.format, notes: plan.notes ?? '' })} aria-label={`Editar ${plan.title}`} className="rounded-lg p-1 hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                <button type="button" disabled={busy} onClick={() => remove(plan)} aria-label={`Excluir ${plan.title}`} className="rounded-lg p-1 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={save} className="space-y-2 border-t border-white/10 pt-3">
        <p className={labelClass}>{draft.id ? 'Editar planejamento' : 'Adicionar planejamento'}</p>
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Título do conteúdo (ex.: Dia das crianças)" aria-label="Título do conteúdo" maxLength={120} className={inputClass} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Formato">
          {FORMATS.map((format) => (
            <button key={format.id} type="button" aria-pressed={draft.format === format.id} onClick={() => setDraft({ ...draft, format: format.id })}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${draft.format === format.id ? 'border-sky-400/60 bg-sky-500/25 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}>{format.label}</button>
          ))}
        </div>
        <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Observações (opcional)" aria-label="Observações" maxLength={500} className={inputClass} />
        <ErrorLine errors={errors} />
        {flash && <p role="status" className="text-xs text-emerald-300">{flash}</p>}
        <div className="flex justify-end gap-2">
          {draft.id && <button type="button" onClick={() => { setDraft(EMPTY); setErrors([]); }} className={ghostBtn}>Cancelar edição</button>}
          <button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{draft.id ? 'Salvar' : 'Adicionar planejamento'}</button>
        </div>
      </form>
    </Modal>
  );
};
