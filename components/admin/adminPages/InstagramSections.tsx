import React, { useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { syncInstagramNow, type InstagramProfile } from '../../../services/instagramService';
import { formatDateTime as fmtDateTime, PERIODS, topPost, type InstagramPost, type MetricKey } from '../../../services/instagramMetrics.js';
import { cardClass, ghostBtn, primaryBtn } from '../financeFormat';
import { DeltaText, fmt, Highlight, KIND_LABEL, Kpi, SORTS, Thumb, type Period, type SortKey } from './instagramParts';

/** Sincronização manual: estado de "sincronizando", mensagem de retorno e a ação. */
export function useInstagramSync() {
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const sync = async () => {
    setSyncing(true); setFeedback(null);
    try {
      const { status, afterFailure } = await syncInstagramNow();
      setFeedback(
        status === 'running' ? { ok: false, text: 'Já existe uma sincronização em andamento. Aguarde alguns instantes.' }
        : status === 'cooldown' ? { ok: false, text: afterFailure ? 'A última tentativa falhou há menos de 1 minuto. Aguarde para tentar de novo.' : 'Sincronizado há menos de 1 minuto. Aguarde para sincronizar de novo.' }
        : { ok: true, text: 'Sincronização concluída.' },
      );
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Falha na sincronização.' });
    } finally { setSyncing(false); }
  };

  return { syncing, feedback, sync };
}

interface HeaderProps {
  profile: InstagramProfile | null | undefined;
  syncing: boolean;
  onSync: () => void;
}

export const InstagramHeader: React.FC<HeaderProps> = ({ profile, syncing, onSync }) => (
  <header className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 className="text-xl font-bold text-white">Instagram{profile?.username ? ` · @${profile.username}` : ''}</h2>
      <p className="text-xs text-white/50">Última sincronização bem-sucedida: {fmtDateTime(profile?.syncedAt)}{profile?.lastError && ` · Última tentativa (falhou): ${fmtDateTime(profile.lastAttemptAt)}`}</p>
    </div>
    <button type="button" onClick={onSync} disabled={syncing} className={primaryBtn}>
      {syncing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}Sincronizar agora
    </button>
  </header>
);

export const InstagramAlerts: React.FC<{ profile: InstagramProfile | null | undefined }> = ({ profile }) => {
  const tokenDays = profile?.tokenExpiresAt ? Math.floor((Date.parse(profile.tokenExpiresAt) - Date.now()) / 86_400_000) : null;
  return (
    <>
      {profile?.lastError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{profile.lastError.message} Os dados abaixo são da última sincronização bem-sucedida.
        </p>
      )}
      {profile?.warning && !profile.lastError && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{profile.warning.message}
        </p>
      )}
      {tokenDays !== null && tokenDays < 14 && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{tokenDays < 0 ? 'O token do Instagram expirou.' : `O token do Instagram expira em ${tokenDays} dia(s).`} Gere um novo e atualize INSTAGRAM_ACCESS_TOKEN.
        </p>
      )}
    </>
  );
};

type Totals = Record<'likes' | 'comments' | 'views', { total: number; counted: number }>;

interface KpisProps {
  profile: InstagramProfile;
  totals: Totals;
  current: InstagramPost[];
  today: string;
}

export const InstagramKpis: React.FC<KpisProps> = ({ profile, totals, current, today }) => {
  const scope = (key: MetricKey) => `Soma de ${totals[key].counted} de ${current.length} publicações da última sincronização (não é o total histórico).`;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi label="Seguidores" value={fmt(profile.followers)} delta={<DeltaText daily={profile.daily} metric="followers" today={today} />} />
      <Kpi label="Publicações" value={fmt(profile.mediaCount)} hint={`${current.length} na última sincronização`} />
      <Kpi label="Curtidas" value={fmt(totals.likes.counted ? totals.likes.total : null)} delta={<DeltaText daily={profile.daily} metric="likes" today={today} />} hint={scope('likes')} />
      <Kpi label="Comentários" value={fmt(totals.comments.counted ? totals.comments.total : null)} hint={scope('comments')} />
      <Kpi label="Visualizações" value={fmt(totals.views.counted ? totals.views.total : null)} delta={<DeltaText daily={profile.daily} metric="views" today={today} />} hint={scope('views')} />
    </div>
  );
};

interface HighlightsProps {
  period: Period;
  onPeriod: (period: Period) => void;
  periodPosts: InstagramPost[];
}

export const InstagramHighlights: React.FC<HighlightsProps> = ({ period, onPeriod, periodPosts }) => (
  <div>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-white/50">Destaques entre as publicações feitas no período</p>
      <div role="group" aria-label="Período dos destaques" className="flex gap-1">
        {PERIODS.map((option) => (
          <button key={option.id} type="button" aria-pressed={period === option.id} onClick={() => onPeriod(option.id)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${period === option.id ? 'border-purple-400/60 bg-purple-500/30 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {([['Mais curtidas', 'likes'], ['Mais visualizações', 'views'], ['Mais comentários', 'comments']] as const).map(([title, metric]) => (
        <Highlight key={metric} title={title} post={topPost(periodPosts, metric)} metric={metric} empty={periodPosts.length ? 'Sem dados disponíveis' : 'Nenhuma publicação no período'} />
      ))}
    </div>
  </div>
);

interface PostsListProps {
  current: InstagramPost[];
  sorted: InstagramPost[];
  sort: SortKey;
  visible: number;
  onSort: (sort: SortKey) => void;
  onMore: () => void;
}

export const InstagramPostsList: React.FC<PostsListProps> = ({ current, sorted, sort, visible, onSort, onMore }) => (
  <section className={cardClass} aria-label="Publicações">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-white">Publicações</h3>
      <label className="flex items-center gap-2 text-xs text-white/60">Ordenar por
        <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} className="rounded-lg border border-white/10 bg-[#070B14] px-2 py-1.5 text-xs text-white">
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
    </div>
    {current.length === 0 ? <p className="py-6 text-sm text-white/45">Nenhuma publicação sincronizada.</p> : (
      <ul className="divide-y divide-white/5">
        {sorted.slice(0, visible).map((post) => (
          <li key={post.id} className="flex gap-3 py-3">
            <Thumb post={post} className="h-16 w-16" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm text-white/85">{post.caption || <span className="text-white/40">Sem legenda</span>}</p>
              <p className="mt-1 text-[11px] text-white/45">{KIND_LABEL[post.kind]} · {fmtDateTime(post.publishedAt)}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 text-xs tabular-nums text-white/70">
                <span>Curtidas: {fmt(post.likes)}</span><span>Comentários: {fmt(post.comments)}</span><span>Visualizações: {fmt(post.views)}{post.viewsStale && post.views != null && <span className="text-amber-300"> (desatualizado)</span>}</span>
              </p>
            </div>
            {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" aria-label="Abrir no Instagram" className="self-start text-white/40 hover:text-white"><ExternalLink className="h-4 w-4" /></a>}
          </li>
        ))}
      </ul>
    )}
    {visible < sorted.length && <button type="button" onClick={onMore} className={`${ghostBtn} mt-3`}>Mostrar mais</button>}
  </section>
);
