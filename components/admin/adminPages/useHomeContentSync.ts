import { useEffect, useState } from 'react';
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SEO_DESCRIPTION,
  HOME_SEO_TITLE,
  ensureHomeContentDefaults,
  subscribeToHomeContent,
} from '../../../services/homeContentService';
import type { HomeSection } from '../../../types/homeContent';

/** Carrega os padrões e assina o conteúdo da home (seções + SEO) no Firestore. */
export function useHomeContentSync() {
  const [sections, setSections] = useState<HomeSection[]>(DEFAULT_HOME_SECTIONS);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seoTitle, setSeoTitle] = useState(HOME_SEO_TITLE);
  const [seoDescription, setSeoDescription] = useState(HOME_SEO_DESCRIPTION);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    ensureHomeContentDefaults()
      .then(() => {
        if (cancelled) return;
        unsubscribe = subscribeToHomeContent((content) => {
          setSections(content.sections);
          setSeoTitle(content.seoTitle);
          setSeoDescription(content.seoDescription);
          setLoading(false);
          setError(null);
        }, (reason) => {
          setError(reason.message || 'Não foi possível carregar o conteúdo da home.');
          setLoading(false);
        });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : 'Não foi possível inicializar o conteúdo da home.');
        setLoading(false);
      })
      .finally(() => setInitializing(false));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);


  return { sections, loading, initializing, error, seoTitle, setSeoTitle, seoDescription, setSeoDescription };
}

/** Relógio que se atualiza a cada 30 s (status Agendada/Encerrada das seções). */
export function useNowEvery30s(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
