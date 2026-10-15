import React from 'react';
import { AlertTriangle, ArrowUpRight, Copy, GripVertical, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { scriptPublishTime } from '../../../services/scriptSchedule.js';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../../types';
import { productionOptions } from './scriptEditorHelpers';
import { SortableArea, SortableGroup, SortableItem } from './ScriptSortable';
import { formatDate, productionLabels, productionStyles, publicationLabels, publishedStyle } from './scriptsHelpers';

interface ScriptFiltersBarProps {
  search: string;
  setSearch: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  productionFilter: ScriptProductionStatus | '';
  setProductionFilter: (value: ScriptProductionStatus | '') => void;
  publicationFilter: ScriptPublicationStatus | '';
  setPublicationFilter: (value: ScriptPublicationStatus | '') => void;
  categoriesInLibrary: string[];
}

export const ScriptFiltersBar: React.FC<ScriptFiltersBarProps> = ({ search, setSearch, categoryFilter, setCategoryFilter, productionFilter, setProductionFilter, publicationFilter, setPublicationFilter, categoriesInLibrary }) => (
  <div className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-[#0D1527] p-3 sm:grid-cols-2 xl:grid-cols-4">
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
    <div role="group" aria-label="Filtrar por status de publicação" className="flex gap-1 rounded-xl border border-white/10 bg-[#070B14] p-1">
      {([['', 'Todos'], ['unpublished', 'Não publicados'], ['published', 'Publicados']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPublicationFilter(value)} aria-pressed={publicationFilter === value} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${publicationFilter === value ? 'bg-blue-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>{label}</button>)}
    </div>
  </div>
);

interface ScriptRowProps {
  script: ContentScript;
  scriptActionId: string | null;
  sendingScriptId: string | null;
  openEdit: (script: ContentScript) => void;
  openNewChild: (parentScriptId: string) => void;
  onDuplicate: (script: ContentScript) => void;
  onDelete: (script: ContentScript) => void;
  onSendToRecording: (script: ContentScript) => void;
  onOpenOrder: (orderId: string) => void;
  /** Mostra a alça de arrastar (só na ordem manual). */
  draggable?: boolean;
}

export const ScriptRow: React.FC<ScriptRowProps> = ({ script, scriptActionId, sendingScriptId, openEdit, openNewChild, onDuplicate, onDelete, onSendToRecording, onOpenOrder, draggable }) => (
  <article>
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#0D1527] px-3 py-2.5 transition-colors hover:border-blue-400/35 sm:flex-row sm:items-center sm:justify-between">
      {draggable && <GripVertical aria-hidden className="hidden h-4 w-4 shrink-0 cursor-grab text-white/30 sm:block" />}
      <button type="button" onClick={() => openEdit(script)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
        <span className="block truncate text-sm font-bold text-white">{script.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
          {script.category ? <span className="max-w-44 truncate rounded-full border border-blue-400/15 bg-blue-400/5 px-2 py-0.5 font-semibold text-blue-200/80">{script.category}</span> : <span className="text-white/35">Sem categoria</span>}
          <span className={`rounded-full border px-2 py-0.5 font-bold ${productionStyles[script.productionStatus]}`}>{productionLabels[script.productionStatus]}</span>
          <span className={`rounded-full border px-2 py-0.5 font-semibold ${script.publicationStatus === 'published' ? publishedStyle : 'border-white/10 bg-white/5 text-white/55'}`}>{publicationLabels[script.publicationStatus]}</span>
          <PublishDateBadge script={script} />
          <span className="text-white/40">Atualizado {formatDate(script.updatedAt)}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1 border-t border-white/[0.07] pt-1.5 sm:border-0 sm:pt-0">
        <button type="button" onClick={() => openEdit(script)} className="min-h-10 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white/55 sm:min-h-0 transition-colors hover:bg-white/5 hover:text-white">Editar</button>
        <button type="button" onClick={() => openNewChild(script.id)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-blue-200/75 sm:min-h-0 transition-colors hover:bg-blue-500/10 hover:text-blue-200"><Plus className="h-3.5 w-3.5" /> Filho</button>
        <button type="button" onClick={() => onDuplicate(script)} disabled={scriptActionId !== null} aria-label={`Duplicar roteiro ${script.title}`} title="Duplicar roteiro" className="min-h-10 min-w-10 rounded-lg p-1.5 text-white/45 sm:min-h-0 sm:min-w-0 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40">{scriptActionId === script.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}</button>
        <button type="button" onClick={() => onDelete(script)} disabled={scriptActionId !== null} aria-label={`Excluir roteiro ${script.title}`} title="Excluir roteiro" className="min-h-10 min-w-10 rounded-lg p-1.5 text-red-200/55 sm:min-h-0 sm:min-w-0 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
        {script.orderId ? <button type="button" onClick={() => onOpenOrder(script.orderId)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-emerald-200/80 sm:min-h-0 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"><ArrowUpRight className="h-3.5 w-3.5" /> Produção</button>
          : script.productionStatus === 'ready' ? <button type="button" onClick={() => onSendToRecording(script)} disabled={sendingScriptId !== null} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-blue-600/15 px-2.5 py-1.5 text-[11px] font-bold text-blue-200 transition-colors hover:bg-blue-600/25 disabled:opacity-50 sm:min-h-0">{sendingScriptId === script.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{sendingScriptId === script.id ? 'Enviando…' : 'Enviar para gravação'}</button> : null}
      </div>
    </div>
  </article>
);

/** Data de publicação (real ou prevista) ou o aviso de roteiro sem data de lançamento. */
const PublishDateBadge: React.FC<{ script: ContentScript }> = ({ script }) => {
  const time = scriptPublishTime(script);
  if (time === null) return <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 font-bold text-rose-200"><AlertTriangle className="h-3 w-3" />Sem data de lançamento</span>;
  return <span className="font-semibold text-white/70">{script.publicationStatus === 'published' && script.publishedAt ? 'Publicado em' : 'Previsto para'} {formatDate(new Date(time))}</span>;
};

/** Card do Kanban; o card fica verde quando o roteiro já foi publicado. */
export const ScriptKanbanCard: React.FC<{ script: ContentScript; openEdit: (script: ContentScript) => void }> = ({ script, openEdit }) => (
  <button type="button" onClick={() => openEdit(script)} className={`block w-full rounded-xl border p-3 text-left transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${script.publicationStatus === 'published' ? publishedStyle : productionStyles[script.productionStatus]}`}>
    <span className="block text-sm font-bold text-white">{script.title}</span>
    <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
      {script.publicationStatus === 'published' && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 font-bold">Publicado</span>}
      {script.category && <span className="max-w-40 truncate text-white/55">{script.category}</span>}
      <PublishDateBadge script={script} />
    </span>
  </button>
);

/** Kanban por status de produção, com arrastar para reordenar dentro da coluna e "+" para novo rascunho. */
export const ScriptKanban: React.FC<{ scripts: ContentScript[]; openEdit: (script: ContentScript) => void; onNew: () => void; onMove: (draggedId: string, targetId: string) => void }> = ({ scripts, openEdit, onNew, onMove }) => (
  <SortableArea onMove={onMove} renderOverlay={(id) => { const script = scripts.find((item) => item.id === id); return script ? <ScriptKanbanCard script={script} openEdit={openEdit} /> : null; }}>
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      <div className="grid min-w-max grid-cols-4 gap-3 lg:min-w-0">
        {productionOptions.map(([status, label]) => {
          const items = scripts.filter((script) => script.productionStatus === status);
          return (
            <section key={status} aria-label={label} className="w-[min(72vw,270px)] lg:w-auto lg:min-w-0">
              <header className={`mb-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${productionStyles[status]}`}>
                <h3 className="text-xs font-extrabold uppercase tracking-[0.12em]">{label}</h3>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">{items.length}</span>
                  {status === 'draft' && <button type="button" onClick={onNew} aria-label="Novo roteiro" title="Novo roteiro" className="rounded-lg bg-blue-600 p-1 text-white shadow shadow-blue-600/20 transition-colors hover:bg-blue-500"><Plus className="h-3.5 w-3.5" /></button>}
                </span>
              </header>
              <SortableGroup id={status} ids={items.map((script) => script.id)}>
                <div className="space-y-2.5">
                  {items.map((script) => <SortableItem key={script.id} id={script.id}><ScriptKanbanCard script={script} openEdit={openEdit} /></SortableItem>)}
                  {items.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/30">Nenhum roteiro neste status</p>}
                </div>
              </SortableGroup>
            </section>
          );
        })}
      </div>
    </div>
  </SortableArea>
);
