import React, { useState } from 'react';
import { Archive, ArrowLeft, CheckCircle2, Circle, ExternalLink, ListPlus, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from '../../../lib/router';
import { createStepTask, deleteCampaign, setCampaignStatus, setStepStatus } from '../../../services/instagramPlanningService';
import {
  campaignProgress, campaignStatusLabel, categoryLabel, describeOffset, fullDate, resolveSteps, shortDate, STEP_STATUSES, stepStatusLabel,
  type Campaign, type StepStatus,
} from '../../../services/instagramPlanning.js';
import { cardClass, ghostBtn } from '../financeFormat';
import { CAMPAIGN_STATUS_TONE, Chip, STEP_STATUS_TONE } from './planningUi';

/** Checklist de execução da campanha. As datas vêm de (lançamento + prazo) a cada render: nada é guardado nem duplicado. */
export const CampaignDetail: React.FC<{ campaign: Campaign; today: string; onBack: () => void; onEdit: () => void }> = ({ campaign, today, onBack, onEdit }) => {
  const { navigate } = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const steps = resolveSteps(campaign);
  const progress = campaignProgress(campaign);
  const archived = campaign.status === 'archived';

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key); setMessage(null);
    try { const text = await action(); if (typeof text === 'string') setMessage({ ok: true, text }); } catch (e) { setMessage({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível concluir a ação.' }); } finally { setBusy(null); }
  };
  const changeStep = (stepId: string, status: StepStatus) => run(`s:${stepId}`, () => setStepStatus(campaign.id, stepId, status));
  const makeTask = (stepId: string) => run(`t:${stepId}`, async () => {
    const result = await createStepTask(campaign.id, stepId);
    return result.created ? 'Tarefa criada no To-do List.' : 'Esta etapa já tinha tarefa no To-do List (nada foi duplicado).';
  });
  const remove = () => {
    if (window.confirm(`Excluir a campanha "${campaign.title}"? As tarefas já criadas no To-do List continuam lá.`)) void run('delete', async () => { await deleteCampaign(campaign.id); onBack(); });
  };

  return (
    <section className="space-y-4" aria-label={`Campanha ${campaign.title}`}>
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Todas as campanhas</button>

      <div className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-white">{campaign.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
              <Chip tone="bg-purple-500/20 text-purple-200">{categoryLabel(campaign.category)}</Chip>
              <Chip tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? CAMPAIGN_STATUS_TONE.planning}>{campaignStatusLabel(campaign.status)}</Chip>
              <span>Lançamento: <strong className="text-amber-200">{fullDate(campaign.launchDate)}</strong></span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className={ghostBtn}><Pencil className="h-3.5 w-3.5" aria-hidden />Editar</button>
            <button type="button" disabled={busy === 'status'} onClick={() => run('status', () => setCampaignStatus(campaign.id, archived ? 'planning' : 'archived'))} className={ghostBtn}>
              {archived ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <Archive className="h-3.5 w-3.5" aria-hidden />}{archived ? 'Restaurar' : 'Arquivar'}
            </button>
            <button type="button" disabled={busy === 'delete'} onClick={remove} className={`${ghostBtn} !text-red-300`}><Trash2 className="h-3.5 w-3.5" aria-hidden />Excluir</button>
          </div>
        </div>
        {campaign.notes && <p className="mt-3 whitespace-pre-line text-sm text-white/70">{campaign.notes}</p>}
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-white/50"><span>{progress.done} de {progress.total} etapas concluídas</span>{progress.next?.date && <span>Próxima: {progress.next.title} — {shortDate(progress.next.date, today)}</span>}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
        </div>
      </div>

      {message && <p role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>}

      {steps.length === 0 ? <p className={`${cardClass} text-sm text-white/50`}>Esta campanha ainda não tem etapas. Use “Editar” para adicionar.</p> : (
        <ul className="space-y-2">
          {steps.map((step) => {
            const done = step.status === 'done';
            return (
              <li key={step.id} className={`${cardClass} !p-3 ${step.offset === 0 ? '!border-amber-400/40' : ''}`}>
                <div className="flex items-start gap-3">
                  <button type="button" disabled={busy === `s:${step.id}`} onClick={() => changeStep(step.id, done ? 'pending' : 'done')} aria-label={done ? 'Reabrir etapa' : 'Concluir etapa'} className="mt-0.5 shrink-0 text-white/60 hover:text-emerald-300">
                    {busy === `s:${step.id}` ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden /> : <Circle className="h-5 w-5" aria-hidden />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${done ? 'text-white/50 line-through' : 'text-white'}`}>{step.offset === 0 && '🚀 '}{step.title}</p>
                    <p className="text-xs text-white/55">{describeOffset(step.offset)} · <strong className="text-amber-200">{step.date ? shortDate(step.date, today) : 'sem data'}</strong></p>
                    {step.notes && <p className="mt-1 text-xs text-white/50">{step.notes}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select value={step.status} onChange={(e) => changeStep(step.id, e.target.value as StepStatus)} disabled={busy === `s:${step.id}`} aria-label={`Status da etapa ${step.title}`} className="rounded-lg border border-white/10 bg-[#070B14] px-2 py-1 text-xs text-white">
                        {STEP_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <Chip tone={STEP_STATUS_TONE[step.status]}>{stepStatusLabel(step.status)}</Chip>
                      {step.missionId ? (
                        <button type="button" onClick={() => navigate('/admin/missoes')} className="flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Tarefa criada · abrir no To-do</button>
                      ) : (
                        <button type="button" disabled={busy === `t:${step.id}` || !step.date} onClick={() => makeTask(step.id)} className={ghostBtn}>
                          {busy === `t:${step.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ListPlus className="h-3.5 w-3.5" aria-hidden />}Criar tarefa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
