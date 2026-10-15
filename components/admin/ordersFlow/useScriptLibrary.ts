import { useEffect, useMemo, useState } from 'react';
import { getCategories } from '../../../services/categoriesService';
import { listContentScripts } from '../../../services/contentScriptsService';
import { sortByPublishDate } from '../../../services/scriptSchedule.js';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../../types';
import { logScriptOperationError } from './scriptsHelpers';

/** Carrega a biblioteca de roteiros e as categorias (as dos roteiros entram junto com as da coleção). */
export const useScriptsData = () => {
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryLoadError, setCategoryLoadError] = useState('');

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

  return { scripts, setScripts, categories, setCategories, loading, error, categoryLoadError };
};

/** Busca e filtros da biblioteca. */
export const useScriptFilters = (scripts: ContentScript[]) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productionFilter, setProductionFilter] = useState<ScriptProductionStatus | ''>('');
  const [publicationFilter, setPublicationFilter] = useState<ScriptPublicationStatus | ''>('');

  const categoriesInLibrary = useMemo(() => Array.from(new Set<string>(scripts.map((item) => item.category.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })), [scripts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    // Ordem por data de publicação (real ou prevista), sem data no final; em Publicados, os mais recentes primeiro.
    return sortByPublishDate(scripts.filter((script) => {
      const matchesSearch = !term || script.title.toLocaleLowerCase('pt-BR').includes(term) || script.content.toLocaleLowerCase('pt-BR').includes(term);
      return matchesSearch && (!categoryFilter || script.category === categoryFilter) &&
        (!productionFilter || script.productionStatus === productionFilter) &&
        (!publicationFilter || script.publicationStatus === publicationFilter);
    }), publicationFilter === 'published');
  }, [scripts, search, categoryFilter, productionFilter, publicationFilter]);

  return { search, setSearch, categoryFilter, setCategoryFilter, productionFilter, setProductionFilter, publicationFilter, setPublicationFilter, categoriesInLibrary, filtered };
};

/** Estado do editor de roteiro (novo, novo filho ou edição). */
export const useScriptEditorState = () => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ContentScript | null>(null);
  const [initialParentScriptId, setInitialParentScriptId] = useState<string | undefined>();

  const openNew = () => { setEditingScript(null); setInitialParentScriptId(undefined); setEditorOpen(true); };
  const openNewChild = (parentScriptId: string) => { setEditingScript(null); setInitialParentScriptId(parentScriptId); setEditorOpen(true); };
  const openEdit = (script: ContentScript) => { setEditingScript(script); setInitialParentScriptId(undefined); setEditorOpen(true); };

  return { editorOpen, setEditorOpen, editingScript, setEditingScript, initialParentScriptId, openNew, openNewChild, openEdit };
};
