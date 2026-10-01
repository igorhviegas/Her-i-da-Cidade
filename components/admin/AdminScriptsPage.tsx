import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle2, Loader2, Plus, Search } from 'lucide-react';
import { getCategories } from '../../services/categoriesService';
import { listContentScripts } from '../../services/contentScriptsService';
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

export const AdminScriptsPage: React.FC = () => {
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productionFilter, setProductionFilter] = useState<ScriptProductionStatus | ''>('');
  const [publicationFilter, setPublicationFilter] = useState<ScriptPublicationStatus | ''>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ContentScript | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listContentScripts(), getCategories().catch(() => [])])
      .then(([items, existingCategories]) => {
        if (!cancelled) {
          setScripts(items);
          setCategories(Array.from(new Set([
            ...existingCategories.map((item) => item.name.trim()).filter(Boolean),
            ...items.map((item) => item.category.trim()).filter(Boolean),
          ])).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
        }
      })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a biblioteca.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categoriesInLibrary = useMemo(() => Array.from(new Set(scripts.map((item) => item.category.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })), [scripts]);

  const filteredScripts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return scripts.filter((script) => {
      const matchesSearch = !term || script.title.toLocaleLowerCase('pt-BR').includes(term) || script.content.toLocaleLowerCase('pt-BR').includes(term);
      return matchesSearch && (!categoryFilter || script.category === categoryFilter) &&
        (!productionFilter || script.productionStatus === productionFilter) &&
        (!publicationFilter || script.publicationStatus === publicationFilter);
    });
  }, [scripts, search, categoryFilter, productionFilter, publicationFilter]);

  const openNew = () => { setEditingScript(null); setEditorOpen(true); };
  const openEdit = (script: ContentScript) => { setEditingScript(script); setEditorOpen(true); };
  const handleSaved = (saved: ContentScript) => {
    const now = new Date();
    const complete = { ...saved, createdAt: saved.createdAt || now, updatedAt: now };
    setScripts((current) => [complete, ...current.filter((item) => item.id !== complete.id)]
      .sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0)));
    if (complete.category && !categories.includes(complete.category)) setCategories((current) => [...current, complete.category].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    setEditorOpen(false);
    setSuccess(saved.createdAt ? 'Roteiro atualizado.' : 'Roteiro criado.');
    window.setTimeout(() => setSuccess(''), 4000);
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
          : !error && filteredScripts.length === 0 ? <p className="rounded-xl border border-white/10 bg-[#0D1527] p-5 text-center text-sm text-white/55">Nenhum roteiro corresponde aos filtros escolhidos.</p>
            : !error && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredScripts.map((script) => <button key={script.id} type="button" onClick={() => openEdit(script)} className="group rounded-2xl border border-white/10 bg-[#0D1527] p-4 text-left transition-colors hover:border-blue-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                <div className="flex items-start justify-between gap-3"><h3 className="line-clamp-2 text-base font-bold text-white">{script.title}</h3><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${productionStyles[script.productionStatus]}`}>{productionLabels[script.productionStatus]}</span></div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-white/50">{script.content}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3 text-[11px]">
                  {script.category ? <span className="rounded-full border border-blue-400/15 bg-blue-400/5 px-2.5 py-1 font-semibold text-blue-200/80">{script.category}</span> : <span className="text-white/35">Sem categoria</span>}
                  <span className={`rounded-full border px-2.5 py-1 font-semibold ${script.publicationStatus === 'published' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/5 text-white/55'}`}>{publicationLabels[script.publicationStatus]}</span>
                  <span className="ml-auto text-white/40">Atualizado {formatDate(script.updatedAt)}</span>
                </div>
              </button>)}
            </div>}

      {editorOpen && <ScriptEditorModal script={editingScript} categories={categories} onClose={() => setEditorOpen(false)} onSaved={handleSaved} />}
    </section>
  );
};
