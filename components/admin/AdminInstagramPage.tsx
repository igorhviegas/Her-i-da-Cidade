import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { subscribeInstagramDays, subscribeInstagramPosts, subscribeInstagramProfile, type InstagramProfile } from '../../services/instagramService';
import { currentPosts, filterByPeriod, sortPosts, totalFor, type InstagramPost } from '../../services/instagramMetrics.js';
import type { DailySummary } from '../../services/instagramDaily.js';
import { dateKey } from '../../functions/missions-core.js';
import { cardClass } from './financeFormat';
import { InstagramCalendar } from './InstagramCalendar';
import { InstagramCampaigns } from './instagramPlanning/InstagramCampaigns';
import { useInstagramPlanning } from './instagramPlanning/planningUi';
import { InstagramAlerts, InstagramHeader, InstagramHighlights, InstagramKpis, InstagramPostsList, useInstagramSync } from './adminPages/InstagramSections';
import { CaptionLab, InstagramAudit } from './adminPages/InstagramAudit';
import type { Period, SortKey } from './adminPages/instagramParts';

export { DeltaText } from './adminPages/instagramParts';

const PAGE_SIZE = 12;

export const AdminInstagramPage: React.FC = () => {
  const [profile, setProfile] = useState<InstagramProfile | null | undefined>(undefined);
  const [posts, setPosts] = useState<InstagramPost[] | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const { syncing, feedback, sync } = useInstagramSync();
  const [sort, setSort] = useState<SortKey>('recent');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [period, setPeriod] = useState<Period>('30d'); // período dos cards "Mais curtidas/visualizações/comentários"
  const [days, setDays] = useState<DailySummary[] | undefined>(undefined);
  const [daysError, setDaysError] = useState(false);
  const [view, setView] = useState<'analytics' | 'campaigns'>('analytics');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const planning = useInstagramPlanning();

  useEffect(() => {
    const onError = () => setLoadError(true);
    // Os saldos diários têm erro próprio: se falharem, o resto da página continua funcionando.
    const stops = [subscribeInstagramProfile(setProfile, onError), subscribeInstagramPosts(setPosts, onError), subscribeInstagramDays(setDays, () => setDaysError(true))];
    return () => stops.forEach((stop) => stop());
  }, []);

  // Só o conjunto da última sincronização entra nos indicadores, rankings e lista; documentos antigos ficam no banco.
  const current = useMemo(() => currentPosts(posts ?? [], profile?.syncedAt), [posts, profile?.syncedAt]);
  const sorted = useMemo(() => sortPosts(current, sort), [current, sort]);
  const totals = useMemo(() => ({ likes: totalFor(current, 'likes'), comments: totalFor(current, 'comments'), views: totalFor(current, 'views') }), [current]);
  const periodPosts = useMemo(() => filterByPeriod(current, period, Date.now()), [current, period]);

  const loading = profile === undefined || posts === undefined;
  const today = dateKey(new Date()); // dia em Brasília, recalculado a cada render

  const openCampaign = (id: string) => { setCampaignId(id); setView('campaigns'); };

  return (
    <div className="space-y-6">
      <InstagramHeader profile={profile} syncing={syncing} onSync={sync} />

      {feedback && <p role="status" className={`text-xs ${feedback.ok ? 'text-emerald-300' : 'text-red-300'}`}>{feedback.text}</p>}
      <InstagramAlerts profile={profile} />

      <div role="tablist" aria-label="Seções do Instagram" className="flex gap-1 border-b border-white/10">
        {([['analytics', 'Análises'], ['campaigns', 'Campanhas']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${view === id ? 'border-purple-400 text-white' : 'border-transparent text-white/50 hover:text-white/80'}`}>{label}</button>
        ))}
      </div>

      {view === 'campaigns' && (
        <InstagramCampaigns campaigns={planning.campaigns} templates={planning.templates} error={planning.error} today={today} selectedId={campaignId} onSelect={setCampaignId} />
      )}

      {view === 'analytics' && loadError && <p role="alert" className="flex items-center gap-2 text-sm text-red-300"><AlertCircle className="h-4 w-4" aria-hidden />Não foi possível carregar os dados do Instagram.</p>}
      {view === 'analytics' && loading && !loadError && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</p>}

      {view === 'analytics' && !loading && profile === null && (
        <p className={`${cardClass} text-sm text-white/60`}>Nenhum dado ainda. Configure a integração (docs/instagram.md) e clique em “Sincronizar agora”.</p>
      )}

      {view === 'analytics' && profile && posts && (
        <>
          <InstagramKpis profile={profile} totals={totals} current={current} today={today} />

          <InstagramHighlights period={period} onPeriod={setPeriod} periodPosts={periodPosts} />

          <InstagramCalendar posts={posts} days={days} daysError={daysError} today={today} plans={planning.plans} campaigns={planning.campaigns} planningError={planning.error} onOpenCampaign={openCampaign} />

          <InstagramAudit current={current} />

          <CaptionLab />

          <InstagramPostsList current={current} sorted={sorted} sort={sort} visible={visible} onSort={(next) => { setSort(next); setVisible(PAGE_SIZE); }} onMore={() => setVisible((v) => v + PAGE_SIZE)} />
        </>
      )}
    </div>
  );
};
