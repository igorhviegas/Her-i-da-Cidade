import React from 'react';
import { ArrowUpRight, Copy, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../../types';
import { formatDate, productionLabels, productionStyles, publicationLabels } from './scriptsHelpers';

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
);

interface ScriptRowProps {
  script: ContentScript;
  depth: number;
  scriptActionId: string | null;
  sendingScriptId: string | null;
  openEdit: (script: ContentScript) => void;
  openNewChild: (parentScriptId: string) => void;
  onDuplicate: (script: ContentScript) => void;
  onDelete: (script: ContentScript) => void;
  onSendToRecording: (script: ContentScript) => void;
  onOpenOrder: (orderId: string) => void;
}

export const ScriptRow: React.FC<ScriptRowProps> = ({ script, depth, scriptActionId, sendingScriptId, openEdit, openNewChild, onDuplicate, onDelete, onSendToRecording, onOpenOrder }) => (
  <article style={{ marginLeft: `${Math.min(depth, 5) * 22}px` }} className={`${depth ? 'border-l border-blue-400/20 pl-3 sm:pl-5' : ''}`}>
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
        <button type="button" onClick={() => onDuplicate(script)} disabled={scriptActionId !== null} aria-label={`Duplicar roteiro ${script.title}`} title="Duplicar roteiro" className="rounded-lg p-1.5 text-white/45 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40">{scriptActionId === script.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}</button>
        <button type="button" onClick={() => onDelete(script)} disabled={scriptActionId !== null} aria-label={`Excluir roteiro ${script.title}`} title="Excluir roteiro" className="rounded-lg p-1.5 text-red-200/55 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
        {script.orderId ? <button type="button" onClick={() => onOpenOrder(script.orderId)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-emerald-200/80 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"><ArrowUpRight className="h-3.5 w-3.5" /> Produção</button>
          : script.productionStatus === 'ready' ? <button type="button" onClick={() => onSendToRecording(script)} disabled={sendingScriptId !== null} className="inline-flex items-center gap-1 rounded-lg bg-blue-600/15 px-2.5 py-1.5 text-[11px] font-bold text-blue-200 transition-colors hover:bg-blue-600/25 disabled:opacity-50">{sendingScriptId === script.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{sendingScriptId === script.id ? 'Enviando…' : 'Enviar para gravação'}</button> : null}
      </div>
    </div>
  </article>
);
