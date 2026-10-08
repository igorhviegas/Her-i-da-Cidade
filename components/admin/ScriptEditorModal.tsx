import React, { FormEvent, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import { createContentScript, updateContentScript } from '../../services/contentScriptsService';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../types';
import { ScriptEditorFooter, ScriptEditorHeader } from './ordersFlow/ScriptEditorParts';
import { dateFromInput, inputClass, labelClass, productionOptions, publicationOptions, todayInput } from './ordersFlow/scriptEditorHelpers';
import { useScriptStatuses, useScriptTexts } from './ordersFlow/useScriptDraft';

interface ScriptEditorModalProps {
  script: ContentScript | null;
  initialParentScriptId?: string;
  scripts: ContentScript[];
  categories: string[];
  onClose: () => void;
  onSaved: (script: ContentScript, closeEditor?: boolean) => void;
  onSendToRecording: (script: ContentScript) => Promise<ContentScript>;
  onOpenOrder: (orderId: string) => void;
}

export const ScriptEditorModal: React.FC<ScriptEditorModalProps> = ({ script, initialParentScriptId, scripts, categories, onClose, onSaved, onSendToRecording, onOpenOrder }) => {
  const [persistedScript, setPersistedScript] = useState(script);
  const { title, setTitle, category, setCategory, parentScriptId, setParentScriptId, content, setContent, notes, setNotes } = useScriptTexts(script, initialParentScriptId);
  const { productionStatus, setProductionStatus, publicationStatus, setPublicationStatus, publishedDate, setPublishedDate, linkedOrderId, setLinkedOrderId } = useScriptStatuses(script);
  const [saving, setSaving] = useState(false);
  const [sendingToProduction, setSendingToProduction] = useState(false);
  const operationLock = useRef(false);
  const [error, setError] = useState('');

  const persistScript = async (): Promise<ContentScript> => {
    const input = {
      title,
      category,
      content,
      notes,
      productionStatus,
      publicationStatus,
      publishedAt: dateFromInput(publishedDate),
      parentScriptId: parentScriptId || null,
    };
    if (persistedScript) {
      await updateContentScript(persistedScript.id, input);
      const saved = { ...persistedScript, ...input, publishedAt: input.publishedAt || undefined, parentScriptId: input.parentScriptId || undefined };
      setPersistedScript(saved);
      return saved;
    }
    const created = await createContentScript(input);
    setPersistedScript(created);
    return created;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (operationLock.current) return;
    operationLock.current = true;
    setError('');
    setSaving(true);
    try {
      const saved = await persistScript();
      onSaved(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o roteiro.');
    } finally {
      operationLock.current = false;
      setSaving(false);
    }
  };

  const handleSendToRecording = async () => {
    if (operationLock.current || saving || productionStatus !== 'ready' || linkedOrderId) return;
    operationLock.current = true;
    setError('');
    setSaving(true);
    setSendingToProduction(true);
    try {
      const saved = await persistScript();
      onSaved(saved, false);
      const linked = await onSendToRecording(saved);
      setLinkedOrderId(linked.orderId || '');
      setProductionStatus(linked.productionStatus);
      setPersistedScript(linked);
      onSaved(linked, false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Não foi possível enviar o roteiro para produção.');
    } finally {
      operationLock.current = false;
      setSendingToProduction(false);
      setSaving(false);
    }
  };

  const parentOptions = scripts.filter((candidate) => {
    if (candidate.id === script?.id) return false;
    let current = candidate;
    const visited = new Set<string>();
    while (current.parentScriptId && !visited.has(current.id)) {
      if (current.parentScriptId === script?.id) return false;
      visited.add(current.id);
      const parent = scripts.find((item) => item.id === current.parentScriptId);
      if (!parent) break;
      current = parent;
    }
    return true;
  }).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="script-editor-title" className="my-auto flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
        <ScriptEditorHeader script={script} saving={saving} onClose={onClose} />
        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
          <div className="space-y-5 p-5 sm:p-6">
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
            {linkedOrderId && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs text-emerald-100"><span>Produção vinculada ao pedido {linkedOrderId}</span><button type="button" onClick={() => onOpenOrder(linkedOrderId)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold hover:bg-emerald-500/10"><ArrowUpRight className="h-3.5 w-3.5" />Abrir pedido</button></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Título *<input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} disabled={saving} className={inputClass} placeholder="Ex.: Chupeta — versão para cliente" /></label>
              <label className={labelClass}>Categoria / assunto
                <input list="script-categories" value={category} onChange={(event) => setCategory(event.target.value)} disabled={saving} className={inputClass} placeholder="Escolha ou digite um assunto" />
                <datalist id="script-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist>
                <span className="mt-1 block text-[10px] font-normal text-white/40">Reaproveite o mesmo assunto em vários roteiros.</span>
              </label>
            </div>
            <label className={labelClass}>Roteiro pai
              <select value={parentScriptId} onChange={(event) => setParentScriptId(event.target.value)} disabled={saving} className={inputClass}>
                <option value="">Nenhum — roteiro principal</option>
                {parentOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <span className="mt-1 block text-[10px] font-normal text-white/40">O roteiro continua independente; esta opção apenas organiza a relação na biblioteca.</span>
            </label>
            <label className={labelClass}>Conteúdo do roteiro *<textarea required value={content} onChange={(event) => setContent(event.target.value)} disabled={saving} rows={18} className={`${inputClass} min-h-[20rem] resize-y leading-6`} placeholder="Escreva ou cole o roteiro completo…" /></label>
            <label className={labelClass}>Observações e anotações<textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} rows={4} className={`${inputClass} resize-y`} placeholder="Referências, ideias para versões futuras, observações de produção…" /></label>
            <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
              <label className={labelClass}>Status de produção<select value={productionStatus} onChange={(event) => setProductionStatus(event.target.value as ScriptProductionStatus)} disabled={saving} className={inputClass}>{productionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className={labelClass}>Status de publicação<select value={publicationStatus} onChange={(event) => { const next = event.target.value as ScriptPublicationStatus; setPublicationStatus(next); if (next === 'published' && !publishedDate) setPublishedDate(todayInput()); }} disabled={saving} className={inputClass}>{publicationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className={labelClass}>Data de publicação<input type="date" value={publishedDate} onChange={(event) => setPublishedDate(event.target.value)} disabled={saving} className={inputClass} /></label>
            </div>
          </div>
          <ScriptEditorFooter saving={saving} sendingToProduction={sendingToProduction} showSendToRecording={productionStatus === 'ready' && !linkedOrderId} onClose={onClose} onSendToRecording={() => void handleSendToRecording()} />
        </form>
      </section>
    </div>
  );
};
