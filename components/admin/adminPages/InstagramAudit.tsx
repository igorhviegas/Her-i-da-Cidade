import React, { useMemo, useState } from 'react';
import { auditPosts, FEED_CUT, lintCaption, MIN_POSTS, type AuditGroup, type AuditItem, type CheckStatus } from '../../../services/instagramAudit.js';
import type { InstagramPost } from '../../../services/instagramMetrics.js';
import { cardClass, inputClass } from '../financeFormat';
import { fmt, KIND_LABEL, Thumb } from './instagramParts';

const METRIC_LABEL = { views: 'visualizações', likes: 'curtidas' } as const;
const ASK_LABEL: Record<string, string> = { with: 'Legenda com pedido (CTA)', without: 'Legenda sem pedido' };
const STATUS_TONE: Record<CheckStatus, string> = { PASS: 'text-emerald-300', WARN: 'text-amber-300', FAIL: 'text-red-300' };
const STATUS_LABEL: Record<CheckStatus, string> = { PASS: 'OK', WARN: 'Atenção', FAIL: 'Corrigir' };

const times = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`;

const Ranking: React.FC<{ title: string; items: AuditItem[]; metric: 'views' | 'likes' }> = ({ title, items, metric }) => (
  <div>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</p>
    <ul className="space-y-2">
      {items.map(({ post, multiple }) => (
        <li key={post.id}>
          <a href={post.permalink ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3">
            <Thumb post={post} className="h-10 w-10" />
            <span className="w-12 shrink-0 text-sm font-extrabold tabular-nums text-white">{times(multiple)}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-white/60">{KIND_LABEL[post.kind]} · {fmt(post[metric])} · {post.caption || 'Sem legenda'}</span>
          </a>
        </li>
      ))}
    </ul>
  </div>
);

const Groups: React.FC<{ title: string; groups: AuditGroup[]; label: (key: string) => string }> = ({ title, groups, label }) => (
  <div>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">{title}</p>
    <ul className="space-y-1 text-xs text-white/70">
      {groups.map((g) => (
        <li key={g.key} className="flex justify-between gap-3 tabular-nums">
          <span>{label(g.key)} <span className="text-white/40">({g.n})</span></span>
          <span className="font-semibold text-white">{times(g.multiple)}{g.small && <span className="font-normal text-amber-300"> · amostra pequena</span>}</span>
        </li>
      ))}
    </ul>
  </div>
);

/** Cada publicação contra a mediana da própria conta; só afirma padrão com publicações suficientes. */
export const InstagramAudit: React.FC<{ current: InstagramPost[] }> = ({ current }) => {
  const audit = useMemo(() => auditPosts(current), [current]);
  return (
    <section className={cardClass} aria-label="Auditoria de conteúdo">
      <h3 className="text-sm font-bold text-white">Auditoria de conteúdo</h3>
      {!audit.enough ? (
        <p className="mt-2 text-sm text-white/50">Poucas publicações com {METRIC_LABEL[audit.metric]} ({audit.n}) para apontar padrão: são necessárias pelo menos {MIN_POSTS}.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-white/50">Múltiplo = {METRIC_LABEL[audit.metric]} da publicação ÷ mediana da conta ({fmt(audit.median)}). Sem alcance, compartilhamentos nem retenção na API: leia como indício, não como causa.</p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <Ranking title="Mais acima da mediana" items={audit.top} metric={audit.metric} />
            <Ranking title="Mais abaixo da mediana" items={audit.bottom} metric={audit.metric} />
            <Groups title="Por tipo (mediana dos múltiplos)" groups={audit.groups.kind} label={(key) => KIND_LABEL[key] ?? key} />
            <Groups title="Pedido na legenda" groups={audit.groups.ask} label={(key) => ASK_LABEL[key] ?? key} />
          </div>
        </>
      )}
    </section>
  );
};

/** Campo de teste: mostra o que o feed exibe antes do "… mais" e as verificações da legenda. */
export const CaptionLab: React.FC = () => {
  const [text, setText] = useState('');
  const lint = useMemo(() => lintCaption(text), [text]);
  return (
    <section className={cardClass} aria-label="Testar legenda">
      <h3 className="text-sm font-bold text-white">Testar legenda</h3>
      <label className="mt-2 block text-xs font-semibold text-white/70">Legenda
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Cole ou escreva a legenda" className={inputClass} />
      </label>
      {text.trim() && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">O que o feed mostra (≈{FEED_CUT} caracteres)</p>
            <p className="mt-1 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-[#070B14] p-3 text-sm text-white/85">{lint.visible}{lint.truncated && <span className="text-white/40"> … mais</span>}</p>
          </div>
          <ul className="space-y-1 text-xs">
            {lint.checks.map((c) => (
              <li key={c.label} className="flex gap-2"><span className={`w-16 shrink-0 font-semibold ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span><span className="text-white/70"><span className="font-semibold text-white/85">{c.label}:</span> {c.detail}</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
