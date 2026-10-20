import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../../../lib/router';
import { listContentScripts } from '../../../services/contentScriptsService';
import { sortByPublishDate } from '../../../services/scriptSchedule.js';
import { matchesProject } from '../../../services/scriptProjects.js';
import type { ContentScript, ScriptProductionStatus, ScriptPublicationStatus } from '../../../types';
import { logScriptOperationError } from './scriptsHelpers';

/** Carrega a biblioteca de roteiros. */
export const useScriptsData = () => {
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    listContentScripts()
      .then((items) => { if (!cancelled) setScripts(items); })
      .catch((loadError) => {
        logScriptOperationError('listar documentos da coleção contentScripts', loadError);
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a biblioteca.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { scripts, setScripts, loading, error };
};

/** Busca e filtros da biblioteca. projectFilter: '' = todos, 'none' = sem projeto, senão o id do projeto. */
export const useScriptFilters = (scripts: ContentScript[], projectIds: Set<string>) => {
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [productionFilter, setProductionFilter] = useState<ScriptProductionStatus | ''>('');
  const [publicationFilter, setPublicationFilter] = useState<ScriptPublicationStatus | ''>('');

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    // Ordem por data de publicação (real ou prevista), sem data no final; em Publicados, os mais recentes primeiro.
    return sortByPublishDate(scripts.filter((script) => {
      const matchesSearch = !term || script.title.toLocaleLowerCase('pt-BR').includes(term) || script.content.toLocaleLowerCase('pt-BR').includes(term);
      return matchesSearch && matchesProject(script.projectId, projectFilter, projectIds) &&
        (!productionFilter || script.productionStatus === productionFilter) &&
        (!publicationFilter || script.publicationStatus === publicationFilter);
    }), publicationFilter === 'published');
  }, [scripts, search, projectFilter, projectIds, productionFilter, publicationFilter]);

  return { search, setSearch, projectFilter, setProjectFilter, productionFilter, setProductionFilter, publicationFilter, setPublicationFilter, filtered };
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

/** ?scriptId= abre o roteiro direto no editor (links da Caixinha de Perguntas e da visão geral do Espaço Criativo); depois limpa o parâmetro. */
export const useScriptLink = (scripts: ContentScript[], ready: boolean, openEdit: (script: ContentScript) => void, onMissing: () => void) => {
  const { path, search, navigate } = useRouter();
  const scriptId = new URLSearchParams(search).get('scriptId');
  useEffect(() => {
    if (!ready || !scriptId) return;
    const linked = scripts.find((item) => item.id === scriptId);
    if (linked) openEdit(linked); else onMissing();
    navigate(path, { replace: true });
  }, [ready, scriptId]); // eslint-disable-line react-hooks/exhaustive-deps -- roda uma vez por link; scripts/callbacks mudam a cada render
};
