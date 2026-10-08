import React from 'react';
import { Loader2, X } from 'lucide-react';
import type { SectionDraft } from './sectionDraft';
import { SectionEditorFields } from './SectionEditorFields';

interface SectionEditorModalProps {
  draft: SectionDraft;
  setDraft: (draft: SectionDraft) => void;
  editingId: string | null;
  feedback: { type: 'success' | 'error'; message: string } | null;
  savingSection: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}

export const SectionEditorModal: React.FC<SectionEditorModalProps> = ({ draft, setDraft, editingId, feedback, savingSection, onSubmit, onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/75 p-2 sm:p-4" role="presentation">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-section-editor-title"
      className="flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527] shadow-2xl"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-7">
        <div>
          <h2 id="home-section-editor-title" className="text-xl font-bold text-white">{editingId ? 'Editar seção' : 'Nova seção'}</h2>
          <p className="mt-1 text-xs text-white/50">Os campos são exibidos em layouts controlados pelo site.</p>
        </div>
        <button type="button" aria-label="Fechar" onClick={onClose} className="shrink-0 rounded-lg p-2 text-white/60 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <SectionEditorFields draft={draft} setDraft={setDraft} editingId={editingId} feedback={feedback} />

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/10 bg-[#0D1527] px-4 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/10 px-5 text-sm text-white/70 hover:bg-white/5">Cancelar</button>
          <button type="submit" disabled={savingSection} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{savingSection && <Loader2 className="h-4 w-4 animate-spin" />}Salvar seção</button>
        </div>
      </form>
    </div>
  </div>
);
