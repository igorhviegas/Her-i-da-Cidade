import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { subscribeInstagramDays, subscribeInstagramPosts, subscribeInstagramProfile, type InstagramProfile } from '../../services/instagramService';
import { currentPosts, filterByPeriod, sortPosts, totalFor, type InstagramPost } from '../../services/instagramMetrics.js';
import type { DailySummary } from '../../services/instagramDaily.js';
import { dateKey } from '../../functions/missions-core.js';
import { cardClass } from './financeFormat';
import { InstagramCalendar } from './InstagramCalendar';
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

  return (
    <div className="space-y-6">
      <InstagramHeader profile={profile} syncing={syncing} onSync={sync} />

      {feedback && <p role="status" className={`text-xs ${feedback.ok ? 'text-emerald-300' : 'text-red-300'}`}>{feedback.text}</p>}
      <InstagramAlerts profile={profile} />

      {loadError && <p role="alert" className="flex items-center gap-2 text-sm text-red-300"><AlertCircle className="h-4 w-4" aria-hidden />Não foi possível carregar os dados do Instagram.</p>}
      {loading && !loadError && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</p>}

      {!loading && profile === null && (
        <p className={`${cardClass} text-sm text-white/60`}>Nenhum dado ainda. Configure a integração (docs/instagram.md) e clique em “Sincronizar agora”.</p>
      )}

      {profile && posts && (
        <>
          <InstagramKpis profile={profile} totals={totals} current={current} today={today} />

          <InstagramHighlights period={period} onPeriod={setPeriod} periodPosts={periodPosts} />

          <InstagramCalendar posts={posts} days={days} daysError={daysError} today={today} />

          <InstagramAudit current={current} />

          <CaptionLab />

          <InstagramPostsList current={current} sorted={sorted} sort={sort} visible={visible} onSort={(next) => { setSort(next); setVisible(PAGE_SIZE); }} onMore={() => setVisible((v) => v + PAGE_SIZE)} />
        </>
      )}
    </div>
  );
};
