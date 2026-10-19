import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, BookOpen, Lightbulb, Loader2 } from 'lucide-react';
import { useRouter } from '../../../lib/router';
import { listContentScripts } from '../../../services/contentScriptsService';
import type { ContentScript } from '../../../types';
import { formatDate, productionLabels, productionStyles } from '../ordersFlow/scriptsHelpers';
import { CREATIVE_TOOLS } from './creativeTools';

const SCRIPTS_PATH = CREATIVE_TOOLS.find((tool) => tool.id === 'scripts')?.path ?? '/admin/espaco-criativo/roteiros';

/** Roteiros editados por último (a lista já vem ordenada por atualização). */
const RecentScripts: React.FC = () => {
  const { navigate } = useRouter();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; scripts: ContentScript[] }>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    listContentScripts().then((scripts) => { if (!cancelled) setState({ status: 'ready', scripts: scripts.slice(0, 5) }); }).catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, []);
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0D1527] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white"><BookOpen className="h-4 w-4 text-blue-300" />Roteiros recentes</h3>
        <button type="button" onClick={() => navigate(SCRIPTS_PATH)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/10">Ver todos<ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
      {state.status === 'loading' && <p className="flex items-center gap-2 py-4 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>}
      {state.status === 'error' && <p role="alert" className="flex items-center gap-2 py-4 text-sm text-red-200"><AlertCircle className="h-4 w-4" />Não foi possível carregar os roteiros.</p>}
      {state.status === 'ready' && (state.scripts.length === 0
        ? <p className="py-4 text-sm text-white/45">Nenhum roteiro ainda.</p>
        : <ul className="mt-2 divide-y divide-white/[0.06]">
          {state.scripts.map((script) => (
            <li key={script.id}>
              <button type="button" onClick={() => navigate(`${SCRIPTS_PATH}?scriptId=${encodeURIComponent(script.id)}`)} className="flex min-h-12 w-full items-center gap-3 py-2 text-left hover:bg-white/[0.03]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{script.title}</span>
                  <span className="text-[11px] text-white/40">Atualizado {formatDate(script.updatedAt)}</span>
                </span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${productionStyles[script.productionStatus]}`}>{productionLabels[script.productionStatus]}</span>
              </button>
            </li>
          ))}
        </ul>)}
    </section>
  );
};

/** Página inicial do Espaço Criativo: atalhos para as ferramentas (de creativeTools) e roteiros recentes. */
export const AdminCreativePage: React.FC = () => {
  const { navigate } = useRouter();
  return (
    <section className="space-y-5 animate-in fade-in duration-200">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Central do Herói</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Espaço Criativo</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/50">Tudo o que vira conteúdo do Herói da Cidade em um só lugar: ideias, perguntas, projetos e roteiros.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CREATIVE_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button key={tool.id} type="button" onClick={() => navigate(tool.path)} className="group flex min-h-32 flex-col rounded-2xl border border-white/10 bg-[#0D1527] p-4 text-left transition-colors hover:border-blue-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300"><Icon className="h-5 w-5" /></span>
              <span className="mt-3 flex items-center gap-1.5 text-base font-bold text-white">{tool.label}<ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-300" /></span>
              <span className="mt-1 text-sm text-white/50">{tool.description}</span>
            </button>
          );
        })}
        <div className="flex min-h-32 flex-col rounded-2xl border border-dashed border-white/15 p-4 sm:p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/40"><Lightbulb className="h-5 w-5" /></span>
          <span className="mt-3 text-base font-bold text-white/70">Projetos e ideias</span>
          <span className="mt-1 text-sm text-white/40">Espaço reservado para as próximas ferramentas: banco de ideias, projetos especiais, calendário editorial…</span>
        </div>
      </div>
      <RecentScripts />
    </section>
  );
};
