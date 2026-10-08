import { logger } from '../../lib/logger.js';
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, BookOpen, CheckCircle2, Copy, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { getCategories } from '../../services/categoriesService';
import { createContentScript, deleteContentScript, listContentScripts } from '../../services/contentScriptsService';
import { sendScriptToRecording } from '../../services/scriptProductionService';
import { useRouter } from '../../lib/router';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../types';
import { ScriptEditorModal } from './ScriptEditorModal';

const productionLabels: Record<ScriptProductionStatus, string> = {
  draft: 'Rascunho', ready: 'Pronto para gravar', in_production: 'Em produção', produced: 'Produzido',
};
const publicationLabels: Record<ScriptPublicationStatus, string> = {
  unpublished: 'Não publicado', published: 'Publicado',
};
const productionStyles: Record<ScriptProductionStatus, string> = {
  draft: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
  ready: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
  in_production: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  produced: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as any)?.toDate === 'function') return (value as any).toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: unknown): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date) : '—';
}

function logScriptOperationError(operation: string, error: unknown): void {
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`[AdminScriptsPage] Falha na operação: ${operation}`, { error, stack });
}

export const AdminScriptsPage: React.FC = () => {
  const { navigate } = useRouter();
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryLoadError, setCategoryLoadError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productionFilter, setProductionFilter] = useState<ScriptProductionStatus | ''>('');
  const [publicationFilter, setPublicationFilter] = useState<ScriptPublicationStatus | ''>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ContentScript | null>(null);
  const [initialParentScriptId, setInitialParentScriptId] = useState<string | undefined>();
  const [sendingScriptId, setSendingScriptId] = useState<string | null>(null);
  const [scriptActionId, setScriptActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const categoriesPromise = getCategories().catch((categoryError) => {
      logScriptOperationError('carregar categorias da coleção categories', categoryError);
      if (!cancelled) setCategoryLoadError(categoryError instanceof Error ? categoryError.message : String(categoryError));
      return [];
    });
    Promise.all([listContentScripts(), categoriesPromise])
      .then(([items, existingCategories]) => {
        if (!cancelled) {
          setScripts(items);
          setCategories(Array.from(new Set([
            ...existingCategories.map((item) => item.name.trim()).filter(Boolean),
            ...items.map((item) => item.category.trim()).filter(Boolean),
          ])).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
        }
      })
      .catch((loadError) => {
        logScriptOperationError('listar documentos da coleção contentScripts', loadError);
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a biblioteca.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categoriesInLibrary = useMemo(() => Array.from(new Set<string>(scripts.map((item) => item.category.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })), [scripts]);

  const hierarchyRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const matches = scripts.filter((script) => {
      const matchesSearch = !term || script.title.toLocaleLowerCase('pt-BR').includes(term) || script.content.toLocaleLowerCase('pt-BR').includes(term);
      return matchesSearch && (!categoryFilter || script.category === categoryFilter) &&
        (!productionFilter || script.productionStatus === productionFilter) &&
        (!publicationFilter || script.publicationStatus === publicationFilter);
    });
    const scriptsById = new Map<string, ContentScript>(scripts.map((script) => [script.id, script] as const));
    const visible = new Set(matches.map((script) => script.id));
    // Inclui os pais como contexto quando um resultado da busca é filho.
    matches.forEach((script) => {
      let parentId = script.parentScriptId;
      const visited = new Set<string>();
      while (parentId && !visited.has(parentId)) {
        visible.add(parentId);
        visited.add(parentId);
        parentId = scriptsById.get(parentId)?.parentScriptId;
      }
    });
    const children = new Map<string, ContentScript[]>();
    scripts.forEach((script) => {
      if (!script.parentScriptId || !scriptsById.has(script.parentScriptId) || script.parentScriptId === script.id) return;
      children.set(script.parentScriptId, [...(children.get(script.parentScriptId) || []), script]);
    });
    const rows: Array<{ script: ContentScript; depth: number }> = [];
    const emitted = new Set<string>();
    const append = (script: ContentScript, depth: number, ancestors: Set<string>) => {
      if (!visible.has(script.id) || ancestors.has(script.id) || emitted.has(script.id)) return;
      emitted.add(script.id);
      rows.push({ script, depth });
      const nextAncestors = new Set(ancestors).add(script.id);
      (children.get(script.id) || []).forEach((child) => append(child, depth + 1, nextAncestors));
    };
    const roots = scripts.filter((script) => !script.parentScriptId || !scriptsById.has(script.parentScriptId) || script.parentScriptId === script.id);
    roots.forEach((script) => append(script, 0, new Set()));
    // Fallback para documentos legados com ciclos, para nunca ocultar roteiros.
    scripts.filter((script) => visible.has(script.id) && !emitted.has(script.id)).forEach((script) => append(script, 0, new Set()));
    return rows;
  }, [scripts, search, categoryFilter, productionFilter, publicationFilter]);

  const openNew = () => { setEditingScript(null); setInitialParentScriptId(undefined); setEditorOpen(true); };
  const openNewChild = (parentScriptId: string) => { setEditingScript(null); setInitialParentScriptId(parentScriptId); setEditorOpen(true); };
  const openEdit = (script: ContentScript) => { setEditingScript(script); setInitialParentScriptId(undefined); setEditorOpen(true); };
  const handleSendToRecording = async (script: ContentScript, showPageError = true): Promise<ContentScript> => {
    if (sendingScriptId) throw new Error('Aguarde o envio da produção em andamento.');
    setSendingScriptId(script.id);
    setActionError('');
    try {
      const order = await sendScriptToRecording(script.id);
      const updatedScript = { ...script, productionStatus: 'in_production' as const, orderId: order.id, updatedAt: new Date() };
      setScripts((current) => current.map((item) => item.id === script.id ? updatedScript : item));
      setEditingScript((current) => current?.id === script.id ? updatedScript : current);
      setSuccess('Pedido de gravação criado e vinculado ao roteiro.');
      window.setTimeout(() => setSuccess(''), 4000);
      return updatedScript;
    } catch (sendError) {
      logScriptOperationError(`enviar roteiro ${script.id} para gravação`, sendError);
      if (showPageError) setActionError(sendError instanceof Error ? sendError.message : 'Não foi possível enviar o roteiro para gravação.');
      throw sendError;
    } finally {
      setSendingScriptId(null);
    }
  };
  const handleSaved = (saved: ContentScript, closeEditor = true) => {
    const now = new Date();
    const complete = { ...saved, createdAt: saved.createdAt || now, updatedAt: now };
    setScripts((current) => [complete, ...current.filter((item) => item.id !== complete.id)]
      .sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0)));
    setEditingScript((current) => current?.id === complete.id ? complete : current);
    if (complete.category && !categories.includes(complete.category)) setCategories((current) => [...current, complete.category].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    if (closeEditor) {
      setEditorOpen(false);
      setSuccess(saved.createdAt ? 'Roteiro atualizado.' : 'Roteiro criado.');
      window.setTimeout(() => setSuccess(''), 4000);
    }
  };
  const handleDuplicateScript = async (script: ContentScript) => {
    if (scriptActionId) return;
    if (!window.confirm(`Duplicar o roteiro “${script.title}”? A cópia começará como Rascunho e Não publicado.`)) return;
    setScriptActionId(script.id);
    setActionError('');
    try {
      const duplicate = await createContentScript({
        title: `${script.title} (cópia)`.slice(0, 180),
        content: script.content,
        category: script.category,
        notes: script.notes,
        productionStatus: 'draft',
        publicationStatus: 'unpublished',
        parentScriptId: script.parentScriptId || null,
      });
      handleSaved(duplicate);
    } catch (duplicateError) {
      logScriptOperationError(`duplicar roteiro ${script.id}`, duplicateError);
      setActionError(duplicateError instanceof Error ? duplicateError.message : 'Não foi possível duplicar o roteiro.');
    } finally {
      setScriptActionId(null);
    }
  };
  const handleDeleteScript = async (script: ContentScript) => {
    if (scriptActionId) return;
    if (!window.confirm(`Excluir definitivamente o roteiro “${script.title}”? Roteiros filhos e pedidos não serão excluídos.`)) return;
    setScriptActionId(script.id);
    setActionError('');
    try {
      await deleteContentScript(script.id);
      setScripts((current) => current.filter((item) => item.id !== script.id));
      setSuccess('Roteiro excluído. Nenhum pedido ou outro roteiro foi removido.');
      window.setTimeout(() => setSuccess(''), 4000);
    } catch (deleteError) {
      logScriptOperationError(`excluir roteiro ${script.id}`, deleteError);
      setActionError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir o roteiro.');
    } finally {
      setScriptActionId(null);
    }
  };

  return (
    <section className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Central do Herói</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Biblioteca de Roteiros</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">Materiais permanentes para produzir vídeos, consultar referências e desenvolver novas ideias.</p>
        </div>
        <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition-colors hover:bg-blue-500"><Plus className="h-4 w-4" /> Novo roteiro</button>
      </div>

      {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{success}</div>}
      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />Não foi possível carregar a biblioteca. {error}</div>}
      {categoryLoadError && <div role="alert" className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200"><AlertCircle className="h-4 w-4 shrink-0" />Falha ao carregar categorias; a biblioteca segue usando as categorias dos roteiros. {categoryLoadError}</div>}
      {actionError && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{actionError}</div>}

      <div className="grid gap-2 rounded-2xl border border-white/10 bg-[#0D1527] p-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título ou conteúdo" aria-label="Buscar roteiros por título ou conteúdo" className="w-full rounded-xl border border-white/10 bg-[#070B14] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-blue-500/60" />
        </label>
        <select aria-label="Filtrar por categoria" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60">
          <option value="">Todas as categorias</option>{categoriesInLibrary.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Filtrar por status de produção" value={productionFilter} onChange={(event) => setProductionFilter(event.target.value as ScriptProductionStatus | '')} className="rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60">
          <option value="">Todos os status de produção</option>{Object.entries(productionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filtrar por status de publicação" value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value as ScriptPublicationStatus | '')} className="rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60">
          <option value="">Todos os status de publicação</option>{Object.entries(publicationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {loading ? <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-white/55"><Loader2 className="h-5 w-5 animate-spin text-blue-400" />Carregando roteiros…</div>
        : !error && scripts.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-[#0D1527]/60 px-5 py-14 text-center"><BookOpen className="mx-auto h-8 w-8 text-white/30" /><p className="mt-3 text-base font-semibold text-white">Sua biblioteca começa aqui.</p><p className="mt-1 text-sm text-white/45">Crie roteiros que continuarão disponíveis mesmo depois de produzidos ou publicados.</p></div>
          : !error && hierarchyRows.length === 0 ? <p className="rounded-xl border border-white/10 bg-[#0D1527] p-5 text-center text-sm text-white/55">Nenhum roteiro corresponde aos filtros escolhidos.</p>
            : !error && <div className="space-y-3">
              {hierarchyRows.map(({ script, depth }) => <article key={script.id} style={{ marginLeft: `${Math.min(depth, 5) * 22}px` }} className={`${depth ? 'border-l border-blue-400/20 pl-3 sm:pl-5' : ''}`}>
                <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#0D1527] px-3 py-2.5 transition-colors hover:border-blue-400/35 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={() => openEdit(script)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                    <span className="block truncate text-sm font-bold text-white">{script.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {script.category ? <span className="max-w-44 truncate rounded-full border border-blue-400/15 bg-blue-400/5 px-2 py-0.5 font-semibold text-blue-200/80">{script.category}</span> : <span className="text-white/35">Sem categoria</span>}
                      <span className={`rounded-full border px-2 py-0.5 font-bold ${productionStyles[script.productionStatus]}`}>{productionLabels[script.productionStatus]}</span>
                      <span className={`rounded-full border px-2 py-0.5 font-semibold ${script.publicationStatus === 'published' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/5 text-white/55'}`}>{publicationLabels[script.publicationStatus]}</span>
                      <span className="text-white/40">Atualizado {formatDate(script.updatedAt)}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 border-t border-white/[0.07] pt-1.5 sm:border-0 sm:pt-0">
                    <button type="button" onClick={() => openEdit(script)} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white/55 transition-colors hover:bg-white/5 hover:text-white">Editar</button>
                    <button type="button" onClick={() => openNewChild(script.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-blue-200/75 transition-colors hover:bg-blue-500/10 hover:text-blue-200"><Plus className="h-3.5 w-3.5" /> Filho</button>
                    <button type="button" onClick={() => void handleDuplicateScript(script)} disabled={scriptActionId !== null} aria-label={`Duplicar roteiro ${script.title}`} title="Duplicar roteiro" className="rounded-lg p-1.5 text-white/45 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40">{scriptActionId === script.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}</button>
                    <button type="button" onClick={() => void handleDeleteScript(script)} disabled={scriptActionId !== null} aria-label={`Excluir roteiro ${script.title}`} title="Excluir roteiro" className="rounded-lg p-1.5 text-red-200/55 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                    {script.orderId ? <button type="button" onClick={() => navigate(`/admin/pedidos?orderId=${encodeURIComponent(script.orderId!)}`)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-emerald-200/80 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"><ArrowUpRight className="h-3.5 w-3.5" /> Produção</button>
                      : script.productionStatus === 'ready' ? <button type="button" onClick={() => void handleSendToRecording(script)} disabled={sendingScriptId !== null} className="inline-flex items-center gap-1 rounded-lg bg-blue-600/15 px-2.5 py-1.5 text-[11px] font-bold text-blue-200 transition-colors hover:bg-blue-600/25 disabled:opacity-50">{sendingScriptId === script.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{sendingScriptId === script.id ? 'Enviando…' : 'Enviar para gravação'}</button> : null}
                  </div>
                </div>
              </article>)}
            </div>}

      {editorOpen && <ScriptEditorModal script={editingScript} initialParentScriptId={initialParentScriptId} scripts={scripts} categories={categories} onClose={() => setEditorOpen(false)} onSaved={handleSaved} onSendToRecording={(script) => handleSendToRecording(script, false)} onOpenOrder={(orderId) => { setEditorOpen(false); navigate(`/admin/pedidos?orderId=${encodeURIComponent(orderId)}`); }} />}
    </section>
  );
};
