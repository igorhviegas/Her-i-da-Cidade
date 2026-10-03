import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { subscribeInstagramPosts, subscribeInstagramProfile, syncInstagramNow, type InstagramProfile } from '../../services/instagramService';
import { currentPosts, formatDateTime as fmtDateTime, sortPosts, topPost, totalFor, type InstagramPost, type MetricKey } from '../../services/instagramMetrics.js';
import { cardClass, ghostBtn, primaryBtn } from './financeFormat';

type SortKey = MetricKey | 'recent';
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'likes', label: 'Mais curtidas' }, { id: 'views', label: 'Mais visualizações' },
  { id: 'comments', label: 'Mais comentários' }, { id: 'recent', label: 'Mais recentes' },
];
const KIND_LABEL: Record<string, string> = { image: 'Imagem', video: 'Vídeo', reel: 'Reel', carousel: 'Carrossel', other: 'Outro' };
const PAGE_SIZE = 12;

const num = new Intl.NumberFormat('pt-BR');
const fmt = (value: number | null | undefined) => (value == null ? 'Indisponível' : num.format(value));

const Kpi: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className={cardClass}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
    <p className="mt-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">{value}</p>
    {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
  </div>
);

// URLs de miniatura da Meta são temporárias: se falharem ao carregar, mostra o placeholder.
const Thumb: React.FC<{ post: InstagramPost; className: string }> = ({ post, className }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [post.thumbnailUrl]);
  return post.thumbnailUrl && !broken
    ? <img src={post.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`${className} shrink-0 rounded-lg object-cover`} />
    : <div className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/30`}><ImageIcon className="h-5 w-5" aria-hidden /></div>;
};

const Highlight: React.FC<{ title: string; post: InstagramPost | null; metric: MetricKey }> = ({ title, post, metric }) => (
  <div className={cardClass}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</p>
    {post ? (
      <a href={post.permalink ?? undefined} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-3">
        <Thumb post={post} className="h-14 w-14" />
        <div className="min-w-0">
          <p className="text-lg font-extrabold tabular-nums text-white">{fmt(post[metric])}</p>
          <p className="truncate text-xs text-white/55">{post.caption || KIND_LABEL[post.kind]}</p>
        </div>
      </a>
    ) : <p className="mt-2 text-sm text-white/45">Sem dados disponíveis</p>}
  </div>
);

export const AdminInstagramPage: React.FC = () => {
  const [profile, setProfile] = useState<InstagramProfile | null | undefined>(undefined);
  const [posts, setPosts] = useState<InstagramPost[] | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [sort, setSort] = useState<SortKey>('recent');
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    const onError = () => setLoadError(true);
    const stops = [subscribeInstagramProfile(setProfile, onError), subscribeInstagramPosts(setPosts, onError)];
    return () => stops.forEach((stop) => stop());
  }, []);

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

  // Só o conjunto da última sincronização entra nos indicadores, rankings e lista; documentos antigos ficam no banco.
  const current = useMemo(() => currentPosts(posts ?? [], profile?.syncedAt), [posts, profile?.syncedAt]);
  const sorted = useMemo(() => sortPosts(current, sort), [current, sort]);
  const totals = useMemo(() => ({ likes: totalFor(current, 'likes'), comments: totalFor(current, 'comments'), views: totalFor(current, 'views') }), [current]);
  const tokenDays = profile?.tokenExpiresAt ? Math.floor((Date.parse(profile.tokenExpiresAt) - Date.now()) / 86_400_000) : null;

  const scope = (key: MetricKey) => `Soma de ${totals[key].counted} de ${current.length} publicações da última sincronização (não é o total histórico).`;
  const loading = profile === undefined || posts === undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Instagram{profile?.username ? ` · @${profile.username}` : ''}</h2>
          <p className="text-xs text-white/50">Última sincronização bem-sucedida: {fmtDateTime(profile?.syncedAt)}{profile?.lastError && ` · Última tentativa (falhou): ${fmtDateTime(profile.lastAttemptAt)}`}</p>
        </div>
        <button type="button" onClick={sync} disabled={syncing} className={primaryBtn}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}Sincronizar agora
        </button>
      </header>

      {feedback && <p role="status" className={`text-xs ${feedback.ok ? 'text-emerald-300' : 'text-red-300'}`}>{feedback.text}</p>}
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

      {loadError && <p role="alert" className="flex items-center gap-2 text-sm text-red-300"><AlertCircle className="h-4 w-4" aria-hidden />Não foi possível carregar os dados do Instagram.</p>}
      {loading && !loadError && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</p>}

      {!loading && profile === null && (
        <p className={`${cardClass} text-sm text-white/60`}>Nenhum dado ainda. Configure a integração (docs/instagram.md) e clique em “Sincronizar agora”.</p>
      )}

      {profile && posts && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Seguidores" value={fmt(profile.followers)} />
            <Kpi label="Publicações" value={fmt(profile.mediaCount)} hint={`${current.length} na última sincronização`} />
            <Kpi label="Curtidas" value={fmt(totals.likes.counted ? totals.likes.total : null)} hint={scope('likes')} />
            <Kpi label="Comentários" value={fmt(totals.comments.counted ? totals.comments.total : null)} hint={scope('comments')} />
            <Kpi label="Visualizações" value={fmt(totals.views.counted ? totals.views.total : null)} hint={scope('views')} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Highlight title="Mais curtidas" post={topPost(current, 'likes')} metric="likes" />
            <Highlight title="Mais visualizações" post={topPost(current, 'views')} metric="views" />
            <Highlight title="Mais comentários" post={topPost(current, 'comments')} metric="comments" />
          </div>

          <section className={cardClass} aria-label="Publicações">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">Publicações</h3>
              <label className="flex items-center gap-2 text-xs text-white/60">Ordenar por
                <select value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setVisible(PAGE_SIZE); }} className="rounded-lg border border-white/10 bg-[#070B14] px-2 py-1.5 text-xs text-white">
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
            {visible < sorted.length && <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className={`${ghostBtn} mt-3`}>Mostrar mais</button>}
          </section>
        </>
      )}
    </div>
  );
};
