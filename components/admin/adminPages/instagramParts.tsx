import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { InstagramProfile } from '../../../services/instagramService';
import { PERIODS, type InstagramPost, type MetricKey } from '../../../services/instagramMetrics.js';
import { describeDelta } from '../../../services/instagramDaily.js';
import { cardClass } from '../financeFormat';

export type SortKey = MetricKey | 'recent';
export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'likes', label: 'Mais curtidas' }, { id: 'views', label: 'Mais visualizações' },
  { id: 'comments', label: 'Mais comentários' }, { id: 'recent', label: 'Mais recentes' },
];
export const KIND_LABEL: Record<string, string> = { image: 'Imagem', video: 'Vídeo', reel: 'Reel', carousel: 'Carrossel', other: 'Outro' };
export type Period = (typeof PERIODS)[number]['id'];

const num = new Intl.NumberFormat('pt-BR');
export const fmt = (value: number | null | undefined) => (value == null ? 'Indisponível' : num.format(value));

const DELTA_TONE = { up: 'text-emerald-300', down: 'text-red-300', zero: 'text-white/50', pending: 'text-white/40', unavailable: 'text-white/40' } as const;

/** Saldo do dia (texto vindo de describeDelta; sem regra de negócio aqui). */
export const DeltaText: React.FC<{ daily: InstagramProfile['daily']; metric: 'followers' | 'likes' | 'views'; today: string; className?: string }> = ({ daily, metric, today, className = '' }) => {
  const delta = describeDelta(daily, metric, today);
  return <p className={`text-xs font-semibold ${DELTA_TONE[delta.kind]} ${className}`}>{delta.text}{delta.since && <span className="font-normal text-white/40"> · desde {delta.since}</span>}</p>;
};

export const Kpi: React.FC<{ label: string; value: string; hint?: string; delta?: React.ReactNode }> = ({ label, value, hint, delta }) => (
  <div className={cardClass}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
    <p className="mt-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">{value}</p>
    {delta && <div className="mt-1">{delta}</div>}
    {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
  </div>
);

// URLs de miniatura da Meta são temporárias: se falharem ao carregar, mostra o placeholder.
export const Thumb: React.FC<{ post: InstagramPost; className: string }> = ({ post, className }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [post.thumbnailUrl]);
  return post.thumbnailUrl && !broken
    ? <img src={post.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`${className} shrink-0 rounded-lg object-cover`} />
    : <div className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/30`}><ImageIcon className="h-5 w-5" aria-hidden /></div>;
};

export const Highlight: React.FC<{ title: string; post: InstagramPost | null; metric: MetricKey; empty: string }> = ({ title, post, metric, empty }) => (
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
    ) : <p className="mt-2 text-sm text-white/45">{empty}</p>}
  </div>
);
