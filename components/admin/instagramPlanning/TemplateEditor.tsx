import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { resetTemplate, saveTemplate, type Templates } from '../../../services/instagramPlanningService';
import { buildTemplateSteps, categoryLabel, templateFor } from '../../../services/instagramPlanning.js';
import { ghostBtn, primaryBtn } from '../financeFormat';
import { ErrorLine, Modal } from './planningUi';
import { StepRows, rowFromStep, rowsToSteps, type RowDraft } from './StepRows';

/** Etapas padrão de uma categoria. Vale só para campanhas NOVAS; as campanhas existentes não são alteradas. */
export const TemplateEditor: React.FC<{ category: string; templates: Templates; today: string; onClose: () => void }> = ({ category, templates, today, onClose }) => {
  const [rows, setRows] = useState<RowDraft[]>(() => buildTemplateSteps(templateFor(category, templates)).map(rowFromStep));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const customized = Boolean(templates[category]?.length);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setErrors([]);
    try { await action(); onClose(); } catch (e) { setErrors([e instanceof Error ? e.message : 'Não foi possível salvar.']); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Etapas padrão — ${categoryLabel(category)}`} onClose={onClose}>
      <p className="mb-3 text-xs text-white/50">Estas etapas são carregadas ao criar uma campanha desta categoria. Mudar aqui não altera campanhas já criadas.</p>
      <StepRows rows={rows} onChange={setRows} today={today} allowToggle={false} />
      <div className="mt-3"><ErrorLine errors={errors} /></div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button type="button" disabled={busy || !customized} onClick={() => run(() => resetTemplate(category))} className={ghostBtn}>Restaurar padrão</button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancelar</button>
          <button type="button" disabled={busy} onClick={() => run(() => saveTemplate(category, rowsToSteps(rows).map(({ title, offset }) => ({ title, offset }))))} className={primaryBtn}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Salvar modelo
          </button>
        </div>
      </div>
    </Modal>
  );
};
