import React, { useState } from 'react';
import { ExternalLink, Flag } from 'lucide-react';
import { KartPilotsTab } from './adminPages/KartPilotsTab';
import { KartRacesTab } from './adminPages/KartRacesTab';
import { KartVideosTab } from './adminPages/KartVideosTab';
import type { Run } from './adminPages/agentShared';

type Feedback = { type: 'success' | 'error'; message: string } | null;
const TABS = [['races', 'Corridas'], ['pilots', 'Pilotos'], ['videos', 'Vídeos']] as const;

export const AdminKartPage: React.FC = () => {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('races');
  const [feedback, setFeedback] = useState<Feedback>(null);

  /** Executa uma gravação e mostra o resultado; devolve se deu certo. */
  const run: Run = async (fn, ok) => {
    setFeedback(null);
    try { await fn(); if (ok) setFeedback({ type: 'success', message: ok }); return true; }
    catch (err) { setFeedback({ type: 'error', message: err instanceof Error && err.message ? err.message : 'Não foi possível salvar. Verifique suas permissões de administrador.' }); return false; }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-white/10 pb-6">
        <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"><Flag className="h-8 w-8 text-red-400" />Kart</h1>
        <p className="mt-1 text-sm font-light text-white/60">Campeonato Viegas Kart, publicado em <code className="font-mono text-blue-400">/kart</code>: resultados das corridas, pilotos inscritos e vídeos.</p>
        <a href="/kart" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">Abrir o campeonato <ExternalLink className="h-3 w-3" /></a>
      </div>

      <div className="flex gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}>{label}</button>
        ))}
      </div>

      {feedback && (
        <div role="status" className={`rounded-xl border p-3 text-sm font-medium ${feedback.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{feedback.message}</div>
      )}

      {tab === 'races' ? <KartRacesTab run={run} /> : tab === 'pilots' ? <KartPilotsTab run={run} /> : <KartVideosTab run={run} />}
    </div>
  );
};
