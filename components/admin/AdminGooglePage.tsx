import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, RefreshCw, Star } from 'lucide-react';
import { subscribeGoogleDays, subscribeGoogleProfile, subscribeGoogleReviews, syncGoogleNow, type GoogleDay, type GoogleProfile, type GoogleReview } from '../../services/googleBusinessService';
import { formatDateTime } from '../../services/instagramMetrics.js';
import { cardClass, ghostBtn, primaryBtn } from './financeFormat';

const REVIEWS_URL = 'https://business.google.com/reviews';
const PAGE_SIZE = 15;
type Filter = 'all' | 'unanswered' | 'low';
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'Todas' }, { id: 'unanswered', label: 'Sem resposta' }, { id: 'low', label: '3 estrelas ou menos' }];

const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('pt-BR'));
const sum = (days: GoogleDay[], key: 'impressions' | 'calls' | 'website' | 'directions') => days.reduce((total, d) => total + d[key], 0);

/** Só o conjunto da última sincronização entra na lista; documentos antigos (avaliações removidas) ficam no banco. */
export function currentReviews(reviews: GoogleReview[], syncedAt?: string) {
  return reviews.filter((r) => r.syncedAt === syncedAt).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function useGoogleSync() {
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const sync = async () => {
    setSyncing(true); setFeedback(null);
    try {
      const { status, afterFailure, metricsError } = await syncGoogleNow();
      if (status === 'cooldown') setFeedback({ ok: false, text: afterFailure ? 'A última tentativa falhou há menos de 1 minuto. Aguarde para tentar de novo.' : 'Sincronizado há menos de 1 minuto. Aguarde para sincronizar de novo.' });
      else setFeedback({ ok: !metricsError, text: metricsError ? 'Avaliações atualizadas, mas o desempenho não pôde ser lido agora.' : 'Sincronização concluída.' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Falha na sincronização.' });
    } finally { setSyncing(false); }
  };
  return { syncing, feedback, sync };
}

const Kpi: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className={cardClass}>
    <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
    <p className="mt-1 text-2xl font-extrabold text-white">{value}</p>
    {hint && <p className="mt-1 text-[11px] text-white/40">{hint}</p>}
  </div>
);

const Stars: React.FC<{ n: number }> = ({ n }) => (
  <span aria-label={`${n} de 5 estrelas`} className="inline-flex">
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} aria-hidden />)}
  </span>
);

const DailyChart: React.FC<{ days: GoogleDay[] }> = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => d.calls + d.website + d.directions));
  return (
    <div className={cardClass}>
      <h3 className="text-sm font-bold text-white">Ações dos clientes por dia (ligar, site e rota)</h3>
      <div className="mt-3 flex h-28 items-end gap-1" role="img" aria-label="Ligações, cliques no site e pedidos de rota por dia, nos últimos 30 dias">
        {days.map((d) => {
          const total = d.calls + d.website + d.directions;
          return <div key={d.date} title={`${d.date}: ${total} (ligações ${d.calls}, site ${d.website}, rotas ${d.directions})`} className="flex-1 rounded-t bg-blue-500/70" style={{ height: `${Math.max(4, (total / max) * 100)}%` }} />;
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/40">O Google fecha cada dia com atraso: o último dia pode estar incompleto.</p>
    </div>
  );
};

const ReviewItem: React.FC<{ review: GoogleReview }> = ({ review }) => (
  <li className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-bold text-white">{review.reviewer}</p>
      <div className="flex items-center gap-2"><Stars n={review.rating} /><span className="text-[11px] text-white/40">{review.createdAt ? new Date(review.createdAt).toLocaleDateString('pt-BR') : ''}</span></div>
    </div>
    {review.comment ? <p className="mt-1.5 text-sm text-white/75">{review.comment}</p> : <p className="mt-1.5 text-xs italic text-white/35">Só a nota, sem texto.</p>}
    {review.reply
      ? <p className="mt-2 rounded-lg bg-white/5 p-2 text-xs text-white/60"><span className="font-semibold text-white/80">Sua resposta: </span>{review.reply}</p>
      : <span className="mt-2 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Sem resposta</span>}
  </li>
);

const ReviewsList: React.FC<{ reviews: GoogleReview[] }> = ({ reviews }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = useMemo(() => reviews.filter((r) => (filter === 'unanswered' ? !r.replied : filter === 'low' ? r.rating <= 3 : true)), [reviews, filter]);
  return (
    <section className={cardClass} aria-label="Avaliações">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filtro de avaliações" className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ id, label }) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => { setFilter(id); setVisible(PAGE_SIZE); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <a href={REVIEWS_URL} target="_blank" rel="noopener noreferrer" className={`${ghostBtn} text-xs`}>Responder no Google<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
      </div>
      <ul className="mt-3 space-y-2.5">{shown.slice(0, visible).map((r) => <ReviewItem key={r.id} review={r} />)}</ul>
      {shown.length === 0 && <p className="mt-3 text-sm text-white/50">Nenhuma avaliação neste filtro.</p>}
      {shown.length > visible && <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className={`${ghostBtn} mt-3`}>Ver mais</button>}
    </section>
  );
};

const Summary: React.FC<{ profile: GoogleProfile; days: GoogleDay[] | undefined }> = ({ profile, days }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Kpi label="Nota" value={profile.rating === null ? '—' : profile.rating.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} hint={`${num(profile.total)} avaliações`} />
    <Kpi label="Sem resposta" value={num(profile.unanswered)} hint={`entre as ${num(profile.loaded)} carregadas`} />
    <Kpi label="Ligações (30 dias)" value={days ? num(sum(days, 'calls')) : '—'} />
    <Kpi label="Cliques no site (30 dias)" value={days ? num(sum(days, 'website')) : '—'} hint={days ? `${num(sum(days, 'directions'))} pedidos de rota · ${num(sum(days, 'impressions'))} visualizações` : undefined} />
  </div>
);

export const AdminGooglePage: React.FC = () => {
  const [profile, setProfile] = useState<GoogleProfile | null | undefined>(undefined);
  const [reviews, setReviews] = useState<GoogleReview[] | undefined>(undefined);
  const [days, setDays] = useState<GoogleDay[] | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const { syncing, feedback, sync } = useGoogleSync();

  useEffect(() => {
    const onError = () => setLoadError(true);
    const stops = [subscribeGoogleProfile(setProfile, onError), subscribeGoogleReviews(setReviews, onError), subscribeGoogleDays(setDays, onError)];
    return () => stops.forEach((stop) => stop());
  }, []);

  const current = useMemo(() => currentReviews(reviews ?? [], profile?.syncedAt), [reviews, profile?.syncedAt]);
  const loading = profile === undefined || reviews === undefined;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Google · Perfil da Empresa</h2>
          <p className="text-xs text-white/50">Última sincronização bem-sucedida: {profile?.syncedAt ? formatDateTime(profile.syncedAt) : '—'}</p>
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
      {loadError && <p role="alert" className="flex items-center gap-2 text-sm text-red-300"><AlertCircle className="h-4 w-4" aria-hidden />Não foi possível carregar os dados do Google.</p>}
      {loading && !loadError && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</p>}
      {!loading && profile === null && <p className={`${cardClass} text-sm text-white/60`}>Nenhum dado ainda. Configure a integração (docs/google-business.md) e clique em “Sincronizar agora”.</p>}

      {profile && (
        <>
          <Summary profile={profile} days={days} />
          {days && days.length > 0 && <DailyChart days={days} />}
          <ReviewsList reviews={current} />
        </>
      )}
    </div>
  );
};
