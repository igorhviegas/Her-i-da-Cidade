import React, { FormEvent, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Loader2, Save, Video, X } from 'lucide-react';
import { createContentScript, updateContentScript } from '../../services/contentScriptsService';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../types';

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

const productionOptions: Array<[ScriptProductionStatus, string]> = [
  ['draft', 'Rascunho'],
  ['ready', 'Pronto para gravar'],
  ['in_production', 'Em produção'],
  ['produced', 'Produzido'],
];
const publicationOptions: Array<[ScriptPublicationStatus, string]> = [
  ['unpublished', 'Não publicado'],
  ['published', 'Publicado'],
];
const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
const labelClass = 'block text-xs font-semibold text-white/70';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') return (value as { toDate?: () => Date }).toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateInput(value: unknown): string {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value: unknown): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—';
}

function dateFromInput(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function todayInput(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export const ScriptEditorModal: React.FC<ScriptEditorModalProps> = ({ script, initialParentScriptId, scripts, categories, onClose, onSaved, onSendToRecording, onOpenOrder }) => {
  const [persistedScript, setPersistedScript] = useState(script);
  const [title, setTitle] = useState(script?.title || '');
  const [category, setCategory] = useState(script?.category || '');
  const [parentScriptId, setParentScriptId] = useState(script?.parentScriptId || initialParentScriptId || '');
  const [content, setContent] = useState(script?.content || '');
  const [notes, setNotes] = useState(script?.notes || '');
  const [productionStatus, setProductionStatus] = useState<ScriptProductionStatus>(script?.productionStatus || 'draft');
  const [publicationStatus, setPublicationStatus] = useState<ScriptPublicationStatus>(script?.publicationStatus || 'unpublished');
  const [publishedDate, setPublishedDate] = useState(dateInput(script?.publishedAt));
  const [saving, setSaving] = useState(false);
  const [sendingToProduction, setSendingToProduction] = useState(false);
  const [linkedOrderId, setLinkedOrderId] = useState(script?.orderId || '');
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
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-300">Biblioteca permanente</p><h2 id="script-editor-title" className="mt-1 text-lg font-bold text-white">{script ? 'Editar roteiro' : 'Novo roteiro'}</h2>{script && <p className="mt-1 text-[11px] text-white/40">Criado em {formatDate(script.createdAt)} · Atualizado em {formatDate(script.updatedAt)}</p>}</div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar editor" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
        </header>
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
          <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row">
              {productionStatus === 'ready' && !linkedOrderId && <button type="button" onClick={() => void handleSendToRecording()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-100 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50">{sendingToProduction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}{sendingToProduction ? 'Enviando…' : 'Enviar para produção'}</button>}
              <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/5 disabled:opacity-40">Cancelar</button>
            </div>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Salvando…' : 'Salvar roteiro'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
};
