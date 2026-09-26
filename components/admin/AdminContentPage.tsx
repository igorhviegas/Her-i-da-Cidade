import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Eye, EyeOff, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SEO_DESCRIPTION,
  HOME_SEO_TITLE,
  createHomeSection,
  deleteHomeSection,
  ensureHomeContentDefaults,
  setHomeSectionActive,
  subscribeToHomeContent,
  updateHomeSection,
  updateHomeSectionOrder,
  updateHomeSeo,
} from '../../services/homeContentService';
import type { HomeSection, HomeSectionInput, HomeSectionType } from '../../types/homeContent';

type SectionDraft = Omit<HomeSectionInput, 'startAt' | 'endAt'> & { startAt: Date | null; endAt: Date | null };
const SYSTEM_SECTION_IDS = new Set(DEFAULT_HOME_SECTIONS.map((section) => section.id));
const CREATE_TYPES: { value: HomeSectionType; label: string }[] = [
  { value: 'hero', label: 'Destaque (Hero)' },
  { value: 'text', label: 'Texto' },
  { value: 'promotional', label: 'Promocional' },
  { value: 'cta', label: 'Chamada para ação (CTA)' },
  { value: 'image-text', label: 'Imagem e texto' },
];

function toDate(value: HomeSection['startAt']): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : value.toDate();
}

function toDateTimeLocal(value: Date | null): string {
  if (!value) return '';
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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

function dateValue(value: HomeSection['startAt']): number | null {
  if (!value) return null;
  return value instanceof Date ? value.getTime() : value.toMillis();
}

function statusLabel(section: HomeSection, now: number): string {
  if (!section.active) return 'Inativa';
  const start = dateValue(section.startAt);
  const end = dateValue(section.endAt);
  if (start !== null && now < start) return 'Agendada';
  if (end !== null && now > end) return 'Encerrada';
  return 'Ativa';
}

function isCustomType(type: HomeSectionType): boolean {
  return ['text', 'promotional', 'cta', 'image-text'].includes(type);
}

export const AdminContentPage: React.FC = () => {
  const [sections, setSections] = useState<HomeSection[]>(DEFAULT_HOME_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SectionDraft | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [seoTitle, setSeoTitle] = useState(HOME_SEO_TITLE);
  const [seoDescription, setSeoDescription] = useState(HOME_SEO_DESCRIPTION);
  const [savingSeo, setSavingSeo] = useState(false);
  const orderedSections = useMemo(() => [...sections].sort((a, b) => a.order - b.order || a.internalName.localeCompare(b.internalName, 'pt-BR')), [sections]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    ensureHomeContentDefaults()
      .then(() => {
        if (cancelled) return;
        unsubscribe = subscribeToHomeContent((content) => {
          setSections(content.sections);
          setSeoTitle(content.seoTitle);
          setSeoDescription(content.seoDescription);
          setLoading(false);
          setError(null);
        }, (reason) => {
          setError(reason.message || 'Não foi possível carregar o conteúdo da home.');
          setLoading(false);
        });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : 'Não foi possível inicializar o conteúdo da home.');
        setLoading(false);
      })
      .finally(() => setInitializing(false));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
    } catch (reason: any) {
      setFeedback({ type: 'error', message: reason?.message || 'Não foi possível salvar a seção.' });
    } finally {
      setSavingSection(false);
    }
  };

  const handleToggle = async (section: HomeSection) => {
    setFeedback(null);
    try {
      await setHomeSectionActive(section.id, !section.active);
    } catch (reason: any) {
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
    } catch (reason: any) {
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
    } catch (reason: any) {
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
    } catch (reason: any) {
      setFeedback({ type: 'error', message: reason?.message || 'Não foi possível salvar o SEO.' });
    } finally {
      setSavingSeo(false);
    }
  };

  const sectionType = draft?.sectionType || 'text';
  const typeEditable = !editingId || !SYSTEM_SECTION_IDS.has(editingId);
  const canEditImage = sectionType === 'image-text' || sectionType === 'promotional' || editingId === 'home-about';
  const canEditButton = isCustomType(sectionType) || editingId === 'home-video-teaser' || editingId === 'home-about';
  const canEditButtonUrl = isCustomType(sectionType);

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

      <section className="rounded-2xl border border-white/10 bg-[#0D1527] p-4 shadow-xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-white">Seções da página inicial</h2><p className="mt-1 text-xs text-white/50">Use os controles para ordenar. Datas e status determinam a publicação.</p></div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-blue-400" />}
        </div>
        <div className="space-y-3">
          {orderedSections.map((section, index) => {
            const status = statusLabel(section, now);
            const locked = section.sectionType === 'testimonials';
            return <article key={section.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#080F1D] p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 sm:flex-col">
                <button type="button" aria-label="Mover seção para cima" disabled={index === 0 || movingId !== null} onClick={() => handleMove(index, -1)} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Mover seção para baixo" disabled={index === orderedSections.length - 1 || movingId !== null} onClick={() => handleMove(index, 1)} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-white">{section.internalName}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status === 'Ativa' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : status === 'Agendada' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-white/5 text-white/50'}`}>{status}</span>
                </div>
                <p className="mt-1 truncate text-xs text-white/45">{section.title.replace(/\s+/g, ' ')} · {section.sectionType} · ordem {section.order + 1}</p>
                {locked && <p className="mt-1 text-xs text-white/40">Conteúdo automático; apenas ordem e visibilidade são administráveis.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleToggle(section)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/70 hover:bg-white/5">
                  {section.active ? <><EyeOff className="h-4 w-4" /> Desativar</> : <><Eye className="h-4 w-4" /> Ativar</>}
                </button>
                {!locked && <button type="button" onClick={() => openEdit(section)} className="min-h-10 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15">Editar</button>}
                <button type="button" onClick={() => handleDelete(section)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-500/20 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Excluir</button>
              </div>
            </article>;
          })}
          {!loading && orderedSections.length === 0 && <p className="rounded-xl border border-white/10 p-6 text-sm text-white/50">Nenhuma seção cadastrada. Crie uma nova seção para publicar conteúdo na home.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0D1527] p-4 shadow-xl sm:p-6">
        <div className="mb-5"><h2 className="text-lg font-bold text-white">SEO da página inicial</h2><p className="mt-1 text-xs text-white/50">Canonical, robots, sitemap e dados estruturados continuam controlados pelo código.</p></div>
        <form onSubmit={handleSaveSeo} className="space-y-4">
          <div><label htmlFor="home-seo-title" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">SEO Title</label><input id="home-seo-title" value={seoTitle} maxLength={70} onChange={(event) => setSeoTitle(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#070B14] px-4 py-3 text-sm text-white outline-none focus:border-blue-500" /><p className="mt-1 text-right text-xs text-white/40">{seoTitle.length}/70</p></div>
          <div><label htmlFor="home-seo-description" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">Meta Description</label><textarea id="home-seo-description" value={seoDescription} maxLength={200} rows={3} onChange={(event) => setSeoDescription(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-[#070B14] px-4 py-3 text-sm leading-relaxed text-white outline-none focus:border-blue-500" /><p className="mt-1 text-right text-xs text-white/40">{seoDescription.length}/200</p></div>
          <button type="submit" disabled={savingSeo || initializing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{savingSeo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar SEO</button>
        </form>
      </section>

      {draft && (
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
              <button type="button" aria-label="Fechar" onClick={() => setDraft(null)} className="shrink-0 rounded-lg p-2 text-white/60 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="flex min-h-0 flex-1 flex-col">
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

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/10 bg-[#0D1527] px-4 py-4 sm:flex-row sm:justify-end sm:px-7">
                <button type="button" onClick={() => setDraft(null)} className="min-h-11 rounded-xl border border-white/10 px-5 text-sm text-white/70 hover:bg-white/5">Cancelar</button>
                <button type="submit" disabled={savingSection} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{savingSection && <Loader2 className="h-4 w-4 animate-spin" />}Salvar seção</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
