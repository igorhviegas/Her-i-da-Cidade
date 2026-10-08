import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createCampaign, updateCampaign, type Templates } from '../../../services/instagramPlanningService';
import { buildTemplateSteps, CAMPAIGN_STATUSES, CATEGORIES, templateFor, validateCampaign, type Campaign, type CampaignInput } from '../../../services/instagramPlanning.js';
import { ghostBtn, inputClass, labelClass, primaryBtn } from '../financeFormat';
import { ErrorLine, Modal } from './planningUi';
import { StepRows, rowFromStep, rowsToSteps, type RowDraft } from './StepRows';
import { TemplateEditor } from './TemplateEditor';

const fromTemplate = (category: string, templates: Templates): RowDraft[] => buildTemplateSteps(templateFor(category, templates)).map(rowFromStep);

/** Criar/editar campanha. Ao escolher a categoria numa campanha nova, as etapas padrão são carregadas (e podem ser ajustadas só nesta campanha). */
export const CampaignForm: React.FC<{ initial: Campaign | null; templates: Templates; today: string; onClose: () => void; onSaved: (message: string) => void }> = ({ initial, templates, today, onClose, onSaved }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'new_service');
  const [launchDate, setLaunchDate] = useState(initial?.launchDate ?? '');
  const [status, setStatus] = useState<Campaign['status']>(initial?.status ?? 'planning');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [rows, setRows] = useState<RowDraft[]>(() => (initial ? initial.steps.map(rowFromStep) : fromTemplate('new_service', templates)));
  const [touched, setTouched] = useState(Boolean(initial)); // etapas mexidas à mão: trocar a categoria não as substitui
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const changeCategory = (next: string) => {
    setCategory(next);
    if (!touched) setRows(fromTemplate(next, templates));
  };
  const loadDefaults = () => {
    if (touched && !window.confirm('Substituir as etapas atuais pelas etapas padrão da categoria?')) return;
    setRows(fromTemplate(category, templates)); setTouched(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input: CampaignInput = { title, category, launchDate, status, notes, steps: rowsToSteps(rows) };
    const problems = validateCampaign(input);
    if (problems.length) { setErrors(problems); return; }
    setBusy(true); setErrors([]);
    try {
      if (initial) await updateCampaign(initial.id, input); else await createCampaign(input);
      onSaved(initial ? 'Campanha atualizada. As datas das etapas foram recalculadas.' : 'Campanha criada.');
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Não foi possível salvar a campanha.']);
    } finally { setBusy(false); }
  };

  return (
    <Modal title={initial ? 'Editar campanha' : 'Nova campanha'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className={labelClass}>Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Lançamento da plataforma de busca de vídeos" className={inputClass} maxLength={120} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>Categoria
            <select value={category} onChange={(e) => changeCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              {!CATEGORIES.some((c) => c.id === category) && <option value={category}>{category}</option>}
            </select>
          </label>
          <label className={labelClass}>Data de lançamento
            <input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className={labelClass}>Status
          <select value={status} onChange={(e) => setStatus(e.target.value as Campaign['status'])} className={inputClass}>
            {CAMPAIGN_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className={labelClass}>Observações (opcional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </label>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className={labelClass}>Etapas <span className="font-normal text-white/40">(prazo em relação ao lançamento)</span></p>
            <div className="flex gap-2">
              <button type="button" onClick={loadDefaults} className={ghostBtn}>Carregar etapas padrão</button>
              <button type="button" onClick={() => setEditingTemplate(true)} className={ghostBtn}>Editar modelo</button>
            </div>
          </div>
          <StepRows rows={rows} onChange={(next) => { setRows(next); setTouched(true); }} launchDate={launchDate} today={today} />
          {!launchDate && <p className="mt-1 text-[11px] text-white/40">Escolha a data de lançamento para ver a data de cada etapa.</p>}
        </div>

        <ErrorLine errors={errors} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancelar</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{initial ? 'Salvar' : 'Criar campanha'}</button>
        </div>
      </form>
      {editingTemplate && <TemplateEditor category={category} templates={templates} today={today} onClose={() => setEditingTemplate(false)} />}
    </Modal>
  );
};
