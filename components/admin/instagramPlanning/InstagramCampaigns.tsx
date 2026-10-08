import React, { useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import type { Templates } from '../../../services/instagramPlanningService';
import { campaignProgress, campaignStatusLabel, categoryLabel, daysUntil, fullDate, type Campaign } from '../../../services/instagramPlanning.js';
import { cardClass, ghostBtn, primaryBtn } from '../financeFormat';
import { CampaignDetail } from './CampaignDetail';
import { CampaignForm } from './CampaignForm';
import { CAMPAIGN_STATUS_TONE, Chip } from './planningUi';

const launchHint = (today: string, launchDate: string) => {
  const days = daysUntil(today, launchDate);
  if (days === null) return '';
  return days === 0 ? 'hoje' : days > 0 ? `em ${days} ${days === 1 ? 'dia' : 'dias'}` : `há ${-days} ${days === -1 ? 'dia' : 'dias'}`;
};

/** Aba "Campanhas": lista, criação/edição e acompanhamento das etapas. */
export const InstagramCampaigns: React.FC<{ campaigns: Campaign[] | undefined; templates: Templates; error: boolean; today: string; selectedId: string | null; onSelect: (id: string | null) => void }> = ({ campaigns, templates, error, today, selectedId, onSelect }) => {
  const [form, setForm] = useState<{ initial: Campaign | null } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [flash, setFlash] = useState('');

  const visible = useMemo(() => (campaigns ?? [])
    .filter((c) => showArchived || c.status !== 'archived')
    .sort((a, b) => a.launchDate.localeCompare(b.launchDate)), [campaigns, showArchived]);
  const archivedCount = (campaigns ?? []).filter((c) => c.status === 'archived').length;
  const selected = campaigns?.find((c) => c.id === selectedId) ?? null;

  const saved = (message: string) => { setForm(null); setFlash(message); };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="flex items-center gap-2 text-sm text-red-300"><AlertCircle className="h-4 w-4" aria-hidden />Não foi possível carregar as campanhas. Confira se as regras do Firestore foram publicadas.</p>}
      {campaigns === undefined && !error && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando campanhas…</p>}
      {flash && <p role="status" className="text-xs text-emerald-300">{flash}</p>}

      {campaigns && selected && <CampaignDetail campaign={selected} today={today} onBack={() => onSelect(null)} onEdit={() => setForm({ initial: selected })} />}
      {campaigns && selectedId && !selected && <p className={`${cardClass} text-sm text-white/60`}>Esta campanha não existe mais. <button type="button" className="font-semibold text-blue-400" onClick={() => onSelect(null)}>Voltar à lista</button></p>}

      {campaigns && !selectedId && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-white/50">Planeje cada campanha como um checklist com prazos em relação ao lançamento.</p>
            <div className="flex gap-2">
              {archivedCount > 0 && <button type="button" onClick={() => setShowArchived((v) => !v)} className={ghostBtn}>{showArchived ? 'Ocultar arquivadas' : `Mostrar arquivadas (${archivedCount})`}</button>}
              <button type="button" onClick={() => setForm({ initial: null })} className={primaryBtn}><Plus className="h-4 w-4" aria-hidden />Nova campanha</button>
            </div>
          </div>
          {visible.length === 0 ? <p className={`${cardClass} text-sm text-white/50`}>Nenhuma campanha ainda. Clique em “Nova campanha” para começar.</p> : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {visible.map((campaign) => {
                const progress = campaignProgress(campaign);
                return (
                  <li key={campaign.id}>
                    <button type="button" onClick={() => { setFlash(''); onSelect(campaign.id); }} className={`${cardClass} block w-full text-left transition hover:border-white/25`}>
                      <p className="text-sm font-bold text-white">{campaign.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                        <Chip tone="bg-purple-500/20 text-purple-200">{categoryLabel(campaign.category)}</Chip>
                        <Chip tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? CAMPAIGN_STATUS_TONE.planning}>{campaignStatusLabel(campaign.status)}</Chip>
                      </p>
                      <p className="mt-2 text-xs text-white/70">Lançamento <strong className="text-amber-200">{fullDate(campaign.launchDate)}</strong> <span className="text-white/45">({launchHint(today, campaign.launchDate)})</span></p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
                      <p className="mt-1 text-[11px] text-white/45">{progress.done} de {progress.total} etapas</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {form && <CampaignForm initial={form.initial} templates={templates} today={today} onClose={() => setForm(null)} onSaved={saved} />}
    </div>
  );
};
