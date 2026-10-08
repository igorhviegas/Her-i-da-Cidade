import React, { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { subscribeCampaigns, subscribePlans, subscribeTemplates, type Templates } from '../../../services/instagramPlanningService';
import type { Campaign, Plan } from '../../../services/instagramPlanning.js';

/** Planejamentos, campanhas e modelos de etapas em tempo real. `error` = alguma leitura falhou (ex.: regras ainda não publicadas). */
export function useInstagramPlanning() {
  const [plans, setPlans] = useState<Plan[] | undefined>(undefined);
  const [campaigns, setCampaigns] = useState<Campaign[] | undefined>(undefined);
  const [templates, setTemplates] = useState<Templates>({});
  const [error, setError] = useState(false);
  useEffect(() => {
    const onError = () => setError(true);
    const stops = [subscribePlans(setPlans, onError), subscribeCampaigns(setCampaigns, onError), subscribeTemplates(setTemplates, onError)];
    return () => stops.forEach((stop) => stop());
  }, []);
  return { plans, campaigns, templates, error };
}

/** Janela central no desktop e "folha" colada embaixo no celular. Fecha com Esc ou clicando fora. */
export const Modal: React.FC<{ title: string; onClose: () => void; children: ReactNode }> = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0D1527] p-4 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const ErrorLine: React.FC<{ errors: string[] }> = ({ errors }) => (
  errors.length ? <ul role="alert" className="space-y-0.5 rounded-xl border border-red-500/30 bg-red-950/30 p-2.5 text-xs text-red-200">{errors.map((message) => <li key={message}>{message}</li>)}</ul> : null
);

const CHIP = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold';
/** Cores por origem do item no calendário: avulso = azul-céu, campanha = âmbar (roxo e verde/vermelho ficam para o Instagram). */
export const PLAN_TONE = 'bg-sky-500/20 text-sky-100 border border-sky-400/40';
export const STEP_TONE = 'bg-amber-500/20 text-amber-100 border border-amber-400/40';

export const CAMPAIGN_STATUS_TONE: Record<string, string> = {
  planning: 'bg-white/10 text-white/70', active: 'bg-blue-500/20 text-blue-200', completed: 'bg-emerald-500/20 text-emerald-200', archived: 'bg-white/5 text-white/40',
};
export const STEP_STATUS_TONE: Record<string, string> = { pending: 'bg-white/10 text-white/70', doing: 'bg-blue-500/20 text-blue-200', done: 'bg-emerald-500/20 text-emerald-200' };

export const Chip: React.FC<{ tone: string; children: ReactNode }> = ({ tone, children }) => <span className={`${CHIP} ${tone}`}>{children}</span>;
