import React from 'react';
import type { HomeSectionType } from '../../../types/homeContent';
import { editorFlags, type SectionDraft } from './sectionDraft';

const CREATE_TYPES: { value: HomeSectionType; label: string }[] = [
  { value: 'hero', label: 'Destaque (Hero)' },
  { value: 'text', label: 'Texto' },
  { value: 'promotional', label: 'Promocional' },
  { value: 'cta', label: 'Chamada para ação (CTA)' },
  { value: 'image-text', label: 'Imagem e texto' },
];

function toDateTimeLocal(value: Date | null): string {
  if (!value) return '';
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

interface SectionEditorFieldsProps {
  draft: SectionDraft;
  setDraft: (draft: SectionDraft) => void;
  editingId: string | null;
  feedback: { type: 'success' | 'error'; message: string } | null;
}

export const SectionEditorFields: React.FC<SectionEditorFieldsProps> = ({ draft, setDraft, editingId, feedback }) => {
  const { typeEditable, canEditImage, canEditButton, canEditButtonUrl } = editorFlags(draft, editingId);
  return (
      <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-7 sm:py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-xs font-semibold text-white/70">Nome interno<input required maxLength={100} value={draft.internalName} onChange={(event) => setDraft({ ...draft, internalName: event.target.value })} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white" /></label>
          {typeEditable ? <label className="min-w-0 text-xs font-semibold text-white/70">Tipo de seção<select value={draft.sectionType} onChange={(event) => setDraft({ ...draft, sectionType: event.target.value as HomeSectionType, imageUrl: '', buttonText: '', buttonUrl: '' })} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white">{CREATE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label> : <div className="min-w-0 text-xs font-semibold text-white/70">Tipo de seção<div className="mt-2 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white/60">{draft.sectionType}</div></div>}
        </div>
        <label className="block min-w-0 text-xs font-semibold text-white/70">Título<textarea required rows={2} maxLength={180} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-2 w-full min-w-0 resize-y rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white" /><span className="mt-1 block font-normal text-white/40">Quebras de linha são mantidas nos títulos.</span></label>
        <label className="block min-w-0 text-xs font-semibold text-white/70">Subtítulo ou chamada curta<input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white" /></label>
        <label className="block min-w-0 text-xs font-semibold text-white/70">Texto<textarea rows={5} maxLength={12000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-2 w-full min-w-0 resize-y rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm leading-relaxed text-white" /></label>
        {canEditImage && <label className="block min-w-0 text-xs font-semibold text-white/70">URL da imagem (HTTPS)<input type="url" value={draft.imageUrl || ''} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white" /></label>}
        {canEditButton && <div className="grid gap-4 sm:grid-cols-2"><label className="min-w-0 text-xs font-semibold text-white/70">Texto do botão<input value={draft.buttonText || ''} onChange={(event) => setDraft({ ...draft, buttonText: event.target.value })} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white" /></label>{canEditButtonUrl && <label className="min-w-0 text-xs font-semibold text-white/70">Link HTTPS ou rota interna<input type="text" placeholder="https://… ou /videos" value={draft.buttonUrl || ''} onChange={(event) => setDraft({ ...draft, buttonUrl: event.target.value })} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white" /></label>}</div>}
        <div className="grid gap-4 sm:grid-cols-2"><label className="min-w-0 text-xs font-semibold text-white/70">Início da publicação<input type="datetime-local" value={toDateTimeLocal(draft.startAt)} onChange={(event) => setDraft({ ...draft, startAt: event.target.value ? new Date(event.target.value) : null })} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white" /></label><label className="min-w-0 text-xs font-semibold text-white/70">Fim da publicação<input type="datetime-local" value={toDateTimeLocal(draft.endAt)} onChange={(event) => setDraft({ ...draft, endAt: event.target.value ? new Date(event.target.value) : null })} className="mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-sm text-white" /></label></div>
        <label className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-[#070B14] p-3 text-sm text-white"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="h-4 w-4 accent-blue-500" />Seção ativa</label>
        {feedback?.type === 'error' && <p className="text-sm text-red-300">{feedback.message}</p>}
      </div>
  );
};
