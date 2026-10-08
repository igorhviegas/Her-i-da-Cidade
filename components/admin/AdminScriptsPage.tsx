import React, { useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { createContentScript, deleteContentScript } from '../../services/contentScriptsService';
import { sendScriptToRecording } from '../../services/scriptProductionService';
import { useRouter } from '../../lib/router';
import type { ContentScript } from '../../types';
import { ScriptEditorModal } from './ScriptEditorModal';
import { ScriptFiltersBar, ScriptRow } from './ordersFlow/ScriptLibraryParts';
import { logScriptOperationError, toDate } from './ordersFlow/scriptsHelpers';
import { useScriptEditorState, useScriptFilters, useScriptsData } from './ordersFlow/useScriptLibrary';

export const AdminScriptsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { scripts, setScripts, categories, setCategories, loading, error, categoryLoadError } = useScriptsData();
  const [success, setSuccess] = useState('');
  const { search, setSearch, categoryFilter, setCategoryFilter, productionFilter, setProductionFilter, publicationFilter, setPublicationFilter, categoriesInLibrary, hierarchyRows } = useScriptFilters(scripts);
  const { editorOpen, setEditorOpen, editingScript, setEditingScript, initialParentScriptId, openNew, openNewChild, openEdit } = useScriptEditorState();
  const [sendingScriptId, setSendingScriptId] = useState<string | null>(null);
  const [scriptActionId, setScriptActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

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

      <ScriptFiltersBar search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} productionFilter={productionFilter} setProductionFilter={setProductionFilter} publicationFilter={publicationFilter} setPublicationFilter={setPublicationFilter} categoriesInLibrary={categoriesInLibrary} />

      {loading ? <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-white/55"><Loader2 className="h-5 w-5 animate-spin text-blue-400" />Carregando roteiros…</div>
        : !error && scripts.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-[#0D1527]/60 px-5 py-14 text-center"><BookOpen className="mx-auto h-8 w-8 text-white/30" /><p className="mt-3 text-base font-semibold text-white">Sua biblioteca começa aqui.</p><p className="mt-1 text-sm text-white/45">Crie roteiros que continuarão disponíveis mesmo depois de produzidos ou publicados.</p></div>
          : !error && hierarchyRows.length === 0 ? <p className="rounded-xl border border-white/10 bg-[#0D1527] p-5 text-center text-sm text-white/55">Nenhum roteiro corresponde aos filtros escolhidos.</p>
            : !error && <div className="space-y-3">
              {hierarchyRows.map(({ script, depth }) => <ScriptRow key={script.id} script={script} depth={depth} scriptActionId={scriptActionId} sendingScriptId={sendingScriptId} openEdit={openEdit} openNewChild={openNewChild} onDuplicate={(item) => void handleDuplicateScript(item)} onDelete={(item) => void handleDeleteScript(item)} onSendToRecording={(item) => void handleSendToRecording(item)} onOpenOrder={(orderId) => navigate(`/admin/pedidos?orderId=${encodeURIComponent(orderId)}`)} />)}
            </div>}

      {editorOpen && <ScriptEditorModal script={editingScript} initialParentScriptId={initialParentScriptId} scripts={scripts} categories={categories} onClose={() => setEditorOpen(false)} onSaved={handleSaved} onSendToRecording={(script) => handleSendToRecording(script, false)} onOpenOrder={(orderId) => { setEditorOpen(false); navigate(`/admin/pedidos?orderId=${encodeURIComponent(orderId)}`); }} />}
    </section>
  );
};
