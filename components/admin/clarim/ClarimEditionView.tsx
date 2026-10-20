import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  consentIssues, editionTitle, newPage, PAGE_STATUS_LABEL, pageIssues, pageStatus, TEMPLATES, templateLabel, type ClarimTemplate,
} from '../../../services/clarim.js';
import { createPage, deleteEdition, deletePage, listPages, savePageOrder, updateEdition, type ClarimEdition, type StoredPage } from '../../../services/clarimService';
import { cardClass, ErrorNote, ghostButton, primaryButton, WarningNote } from '../missionsUi';
import { ClarimPageEditor } from './ClarimPageEditor';
import { useClarimSources, weekEvents, weekVideos } from './useClarimData';

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);
const STATUS_CHIP = { approved: 'bg-emerald-500/15 text-emerald-200', pending: 'bg-amber-500/15 text-amber-200', review: 'bg-blue-500/15 text-blue-200' };

interface Props { edition: ClarimEdition; onBack: () => void; onChange: (edition: ClarimEdition) => void; onDeleted: () => void }

/** Uma edição: páginas opcionais e repetíveis, cada uma com seu estado. A edição nunca trava por causa de uma página. */
export const ClarimEditionView: React.FC<Props> = ({ edition, onBack, onChange, onDeleted }) => {
  const period = { start: edition.periodStart, end: edition.periodEnd };
  const { sources, warnings } = useClarimSources();
  const [pages, setPages] = useState<StoredPage[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(() => {
    listPages(edition.id).then(setPages).catch((e) => setError(errorText(e, 'Não foi possível carregar as páginas.')));
  }, [edition.id]);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, action: () => Promise<void>, fallback: string) => {
    setBusy(key);
    setError('');
    try { await action(); } catch (e) { setError(errorText(e, fallback)); } finally { setBusy(null); setConfirm(null); }
  };

  const editing = pages?.find((p) => p.id === editingId);
  if (editing && pages) {
    return (
      <ClarimPageEditor
        edition={edition}
        page={editing}
        pages={pages}
        sources={sources}
        onBack={() => setEditingId(null)}
        onSaved={(saved) => setPages((list) => list?.map((p) => (p.id === saved.id ? saved : p)) ?? null)}
      />
    );
  }

  const events = weekEvents(sources, period);
  const eligibleEvents = events.filter((e) => e.eligible).length;
  const hint = (id: ClarimTemplate) => {
    if (!sources) return '';
    if (id === 'events') return events.length ? `${eligibleEvents} de ${events.length} festas com autorização de imagem` : 'Nenhuma festa no período';
    if (id === 'performance' || id === 'cover') { const n = weekVideos(sources, period).length; return n ? `${n} vídeos com visualizações na semana` : 'Sem visualizações registradas na semana'; }
    return '';
  };

  const add = (template: ClarimTemplate) => run('add', async () => {
    const created = await createPage(edition.id, newPage(template, pages?.length ?? 0));
    setPages((list) => [...(list ?? []), created]);
    setAdding(false);
    setEditingId(created.id);
  }, 'Não foi possível adicionar a página.');

  const move = (index: number, delta: -1 | 1) => run(`move-${index}`, async () => {
    if (!pages) return;
    const next = [...pages];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    const ordered = next.map((p, order) => ({ ...p, order }));
    await savePageOrder(edition.id, ordered);
    setPages(ordered);
  }, 'Não foi possível mudar a ordem.');

  const remove = (page: StoredPage) => run(`del-${page.id}`, async () => {
    await deletePage(edition.id, page);
    setPages((list) => list?.filter((p) => p.id !== page.id) ?? null);
  }, 'Não foi possível excluir a página.');

  const togglePublished = () => run('publish', async () => { onChange(await updateEdition(edition, { published: edition.status !== 'published' })); }, 'Não foi possível atualizar a edição.');
  const removeEdition = () => run('delete-edition', async () => { await deleteEdition(edition); onDeleted(); }, 'Não foi possível excluir a edição.');

  const issuesOf = (p: StoredPage) => [...pageIssues(p), ...(sources ? consentIssues(p, sources.orders, period) : [])];
  const approved = pages?.filter((p) => pageStatus(p, issuesOf(p)) === 'approved').length ?? 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <button type="button" className={ghostButton} onClick={onBack}><ArrowLeft className="h-4 w-4" />Edições</button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/50">Edição nº {edition.number} · {pages ? `${approved} de ${pages.length} páginas aprovadas` : 'carregando'}</p>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{editionTitle(period)}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={edition.status === 'published' ? ghostButton : primaryButton} disabled={busy === 'publish'} onClick={togglePublished}>
            {busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {edition.status === 'published' ? `Publicada em ${edition.publishedAt?.toLocaleDateString('pt-BR') ?? ''} · desfazer` : 'Marcar como publicada nos Stories'}
          </button>
        </div>
      </div>

      {warnings.map((w) => <WarningNote key={w} message={w} />)}
      <ErrorNote message={error || null} />

      {pages === null && !error && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando páginas…</p>}
      {pages?.length === 0 && <div className={`${cardClass} text-sm text-white/60`}>A edição ainda não tem páginas. Adicione só as que fazem sentido nesta semana.</div>}

      {!!pages?.length && (
        <ol className="grid gap-2">
          {pages.map((p, i) => {
            const status = pageStatus(p, issuesOf(p));
            return (
              <li key={p.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditingId(p.id)}>
                  <span className="block text-xs font-semibold text-white/50">Página {i + 1}</span>
                  <span className="block truncate text-sm font-bold text-white">{templateLabel(p.template)}{p.fields.headline ? ` · ${p.fields.headline}` : ''}</span>
                </button>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CHIP[status]}`}>{PAGE_STATUS_LABEL[status]}</span>
                <span className="flex gap-1">
                  <button type="button" className={ghostButton} aria-label={`Subir a página ${i + 1}`} disabled={i === 0 || !!busy} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" className={ghostButton} aria-label={`Descer a página ${i + 1}`} disabled={i === pages.length - 1 || !!busy} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                  {confirm === p.id
                    ? <button type="button" className={`${ghostButton} text-red-300`} disabled={!!busy} onClick={() => remove(p)}>Confirmar exclusão</button>
                    : <button type="button" className={ghostButton} aria-label={`Excluir a página ${i + 1}`} onClick={() => setConfirm(p.id)}><Trash2 className="h-4 w-4" /></button>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {adding ? (
        <section className={`${cardClass} space-y-3`} aria-labelledby="clarim-add">
          <h3 id="clarim-add" className="text-sm font-bold text-white">Adicionar página</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <button type="button" disabled={!!busy} onClick={() => add(t.id)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-blue-500/40 disabled:opacity-50">
                  <span className="block text-sm font-bold text-white">{t.label}</span>
                  <span className="block text-xs text-white/50">{t.description}</span>
                  {hint(t.id) && <span className="mt-1 block text-[11px] font-semibold text-blue-300">{hint(t.id)}</span>}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={ghostButton} onClick={() => setAdding(false)}>Cancelar</button>
        </section>
      ) : (
        <button type="button" className={primaryButton} disabled={pages === null} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Adicionar página</button>
      )}

      <div className="border-t border-white/10 pt-4">
        {confirm === 'edition'
          ? <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">Excluir a edição, as páginas e as fotos enviadas? Não dá para desfazer.
            <button type="button" className={`${ghostButton} text-red-300`} disabled={!!busy} onClick={removeEdition}>{busy === 'delete-edition' && <Loader2 className="h-4 w-4 animate-spin" />}Excluir edição</button>
            <button type="button" className={ghostButton} onClick={() => setConfirm(null)}>Cancelar</button></div>
          : <button type="button" className={`${ghostButton} text-red-300`} onClick={() => setConfirm('edition')}><Trash2 className="h-4 w-4" />Excluir edição</button>}
      </div>
    </div>
  );
};
