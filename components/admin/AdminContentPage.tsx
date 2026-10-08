import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import {
  createHomeSection,
  deleteHomeSection,
  setHomeSectionActive,
  updateHomeSection,
  updateHomeSectionOrder,
  updateHomeSeo,
} from '../../services/homeContentService';
import type { HomeSection, HomeSectionInput } from '../../types/homeContent';
import type { SectionDraft } from './adminPages/sectionDraft';
import { useHomeContentSync, useNowEvery30s } from './adminPages/useHomeContentSync';
import { SectionsList } from './adminPages/SectionsList';
import { SeoSection } from './adminPages/SeoSection';
import { SectionEditorModal } from './adminPages/SectionEditorModal';

function toDate(value: HomeSection['startAt']): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : value.toDate();
}

function toDraft(section?: HomeSection, order = 0): SectionDraft {
  return {
    internalName: section?.internalName || '',
    sectionType: section?.sectionType || 'text',
    title: section?.title || '',
    subtitle: section?.subtitle || '',
    description: section?.description || '',
    imageUrl: section?.imageUrl || '',
    buttonText: section?.buttonText || '',
    buttonUrl: section?.buttonUrl || '',
    active: section?.active ?? true,
    order: section?.order ?? order,
    startAt: toDate(section?.startAt),
    endAt: toDate(section?.endAt),
  };
}

export const AdminContentPage: React.FC = () => {
  const { sections, loading, initializing, error, seoTitle, setSeoTitle, seoDescription, setSeoDescription } = useHomeContentSync();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const now = useNowEvery30s();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SectionDraft | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [savingSeo, setSavingSeo] = useState(false);
  const orderedSections = useMemo(() => [...sections].sort((a, b) => a.order - b.order || a.internalName.localeCompare(b.internalName, 'pt-BR')), [sections]);

  const openNew = () => {
    const maxOrder = orderedSections.reduce((max, section) => Math.max(max, section.order), -1);
    setEditingId(null);
    setDraft(toDraft(undefined, maxOrder + 1));
    setFeedback(null);
  };

  const openEdit = (section: HomeSection) => {
    if (section.sectionType === 'testimonials') {
      setFeedback({ type: 'error', message: 'Os depoimentos são carregados da fonte atual e não são editados neste painel.' });
      return;
    }
    setEditingId(section.id);
    setDraft(toDraft(section));
    setFeedback(null);
  };

  const handleSaveSection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSavingSection(true);
    setFeedback(null);
    try {
      const normalized: HomeSectionInput = {
        ...draft,
        imageUrl: draft.imageUrl?.trim() || undefined,
        buttonText: draft.buttonText?.trim() || undefined,
        buttonUrl: draft.buttonUrl?.trim() || undefined,
        startAt: draft.startAt,
        endAt: draft.endAt,
      };
      if (editingId) await updateHomeSection(editingId, normalized);
      else await createHomeSection(normalized);
      setDraft(null);
      setEditingId(null);
      setFeedback({ type: 'success', message: 'Seção salva com sucesso.' });
    } catch (reason) {
      setFeedback({ type: 'error', message: reason?.message || 'Não foi possível salvar a seção.' });
    } finally {
      setSavingSection(false);
    }
  };

  const handleToggle = async (section: HomeSection) => {
    setFeedback(null);
    try {
      await setHomeSectionActive(section.id, !section.active);
    } catch (reason) {
      setFeedback({ type: 'error', message: reason?.message || 'Não foi possível alterar a visibilidade.' });
    }
  };

  const handleMove = async (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= orderedSections.length) return;
    const reordered = [...orderedSections];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setMovingId(orderedSections[index].id);
    setFeedback(null);
    try {
      await updateHomeSectionOrder(reordered.map((section) => section.id));
    } catch (reason) {
      setFeedback({ type: 'error', message: reason?.message || 'Não foi possível salvar a ordem.' });
    } finally {
      setMovingId(null);
    }
  };

  const handleDelete = async (section: HomeSection) => {
    if (!window.confirm(`Excluir a seção “${section.internalName}”? Esta ação remove somente esta seção.`)) return;
    setFeedback(null);
    try {
      await deleteHomeSection(section.id);
      setFeedback({ type: 'success', message: 'Seção excluída.' });
    } catch (reason) {
      setFeedback({ type: 'error', message: reason?.message || 'Não foi possível excluir a seção.' });
    }
  };

  const handleSaveSeo = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingSeo(true);
    setFeedback(null);
    try {
      await updateHomeSeo(seoTitle, seoDescription);
      setFeedback({ type: 'success', message: 'SEO da página inicial salvo.' });
    } catch (reason) {
      setFeedback({ type: 'error', message: reason?.message || 'Não foi possível salvar o SEO.' });
    } finally {
      setSavingSeo(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">HOME · CMS EDITORIAL</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Conteúdo do site</h1>
          <p className="mt-2 text-sm text-white/60">Edite textos e publique seções com layouts controlados.</p>
        </div>
        <button type="button" onClick={openNew} disabled={initializing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50">
          <Plus className="h-4 w-4" /> Nova seção
        </button>
      </header>

      {feedback && <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${feedback.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>
        {feedback.type === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}{feedback.message}
      </div>}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Falha ao sincronizar Firestore: {error}. O site público continua usando o conteúdo padrão.</div>}

      <SectionsList sections={orderedSections} loading={loading} now={now} movingId={movingId} onMove={handleMove} onToggle={handleToggle} onEdit={openEdit} onDelete={handleDelete} />

      <SeoSection seoTitle={seoTitle} seoDescription={seoDescription} savingSeo={savingSeo} initializing={initializing} onTitleChange={setSeoTitle} onDescriptionChange={setSeoDescription} onSubmit={handleSaveSeo} />

      {draft && (
        <SectionEditorModal draft={draft} setDraft={setDraft} editingId={editingId} feedback={feedback} savingSection={savingSection} onSubmit={handleSaveSection} onClose={() => setDraft(null)} />
      )}
    </div>
  );
};
