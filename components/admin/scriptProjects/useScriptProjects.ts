import { useCallback, useEffect, useMemo, useState } from 'react';
import { listProjects } from '../../../services/scriptProjectsService';
import type { ScriptProject } from '../../../services/scriptProjects.js';

/** Projetos de roteiro carregados do Firestore (cria os padrões na primeira vez). */
export const useScriptProjects = () => {
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    listProjects().then(setProjects).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os projetos.')).finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  return { projects, setProjects, projectsById, loading, error, reload };
};
