import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createMission, updateMission, type Mission } from '../../../services/missionsService';
import { AlexaReminderField, ChecklistEditor, type ChecklistDraft, DifficultySelect, ErrorNote, cardClass, ghostButton, inputClass, labelClass, primaryButton, toInputValue } from '../missionsUi';

const useMissionDraft = (mission: Mission | null) => {
  const [title, setTitle] = useState(mission?.title ?? '');
  const [description, setDescription] = useState(mission?.description ?? '');
  const [dueAt, setDueAt] = useState(toInputValue(mission?.dueAt));
  const [difficulty, setDifficulty] = useState(mission?.difficulty ?? 3);
  const [alexaReminder, setAlexaReminder] = useState(mission?.alexaReminder === true);
  const [checklist, setChecklist] = useState<ChecklistDraft[] | null>(mission?.checklist?.length ? mission.checklist : null);
  return { title, setTitle, description, setDescription, dueAt, setDueAt, difficulty, setDifficulty, alexaReminder, setAlexaReminder, checklist, setChecklist };
};

export const MissionForm: React.FC<{ mission: Mission | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ mission, onClose, onSaved }) => {
  const { title, setTitle, description, setDescription, dueAt, setDueAt, difficulty, setDifficulty, alexaReminder, setAlexaReminder, checklist, setChecklist } = useMissionDraft(mission);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const input = { title, description, difficulty, dueAt: dueAt ? new Date(dueAt) : null, checklist: checklist ?? [], alexaReminder };
      if (mission) await updateMission(mission.id, input); else await createMission(input);
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Prazo (opcional)<input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Dificuldade<DifficultySelect value={difficulty} onChange={setDifficulty} /></label>
      </div>
      <AlexaReminderField checked={alexaReminder} onChange={setAlexaReminder} disabled={!dueAt} disabledReason="Defina um prazo (data e horário) para usar o lembrete pela Alexa." />
      <ChecklistEditor items={checklist} onChange={setChecklist} />
      <ErrorNote message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostButton}>Cancelar</button>
        <button type="submit" disabled={saving} className={primaryButton}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{mission ? 'Salvar' : 'Criar missão'}</button>
      </div>
    </form>
  );
};
