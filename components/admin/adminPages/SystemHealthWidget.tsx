import React, { useEffect, useMemo, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { subscribeInstagramProfile, type InstagramProfile } from '../../../services/instagramService';
import { subscribeSystemStatus } from '../../../services/systemStatusService';
import { buildHealth, type HealthLevel, type SystemStatusDoc } from '../../../services/systemHealth.js';

const DOT: Record<HealthLevel, string> = { ok: 'bg-emerald-400', warn: 'bg-amber-400', error: 'bg-red-500', unknown: 'bg-white/25' };
const BADGE: Record<HealthLevel, { label: string; className: string }> = {
  ok: { label: 'Tudo certo', className: 'bg-emerald-500/15 text-emerald-300' },
  warn: { label: 'Atenção', className: 'bg-amber-500/15 text-amber-200' },
  error: { label: 'Problema', className: 'bg-red-500/15 text-red-300' },
  unknown: { label: 'Sem dados', className: 'bg-white/10 text-white/60' },
};

/** Testa se /api/reviews responde com avaliações (a resposta fica em cache de 24 h na Vercel; é só um sinal de vida). */
async function checkReviews(): Promise<boolean> {
  try {
    const response = await fetch('/api/reviews');
    if (!response.ok) return false;
    const body = await response.json();
    return Array.isArray(body?.reviews);
  } catch {
    return false;
  }
}

/** Cartão "Saúde do sistema" da Principal: rotina diária, Instagram, token, backup e avaliações, com cor e há quanto tempo. */
export const SystemHealthWidget: React.FC<{ now: Date }> = ({ now }) => {
  const [status, setStatus] = useState<Record<string, SystemStatusDoc> | null>(null);
  const [instagram, setInstagram] = useState<InstagramProfile | null>(null);
  const [reviewsOk, setReviewsOk] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const stopStatus = subscribeSystemStatus((value) => { setStatus(value); setFailed(false); }, () => setFailed(true));
    const stopInstagram = subscribeInstagramProfile(setInstagram, () => undefined);
    void checkReviews().then((ok) => { if (alive) setReviewsOk(ok); });
    return () => { alive = false; stopStatus(); stopInstagram(); };
  }, []);

  const health = useMemo(
    () => buildHealth({ status: status ?? {}, instagram, reviewsOk, now: now.getTime() }),
    [status, instagram, reviewsOk, now],
  );
  // Sem ler o registro das rotinas o cartão não sabe se elas rodaram: nunca mostra "Tudo certo" nem "Sem dados" nesse caso.
  const badge = BADGE[failed && (health.overall === 'ok' || health.overall === 'unknown') ? 'warn' : health.overall];

  return (
    <section className="flex flex-col rounded-2xl border border-white/10 bg-[#0D1527] p-5 shadow-lg" aria-label="Saúde do sistema">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Saúde do sistema</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-white/45">Rotinas agendadas, Instagram, backup e avaliações.</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}><HeartPulse className="mr-1 inline h-3 w-3" aria-hidden />{badge.label}</span>
      </header>
      {failed && <p className="mb-3 text-xs text-red-300">Não foi possível ler o registro das rotinas.</p>}
      <ul className="space-y-2.5">
        {health.rows.map((row) => (
          <li key={row.id} className="flex items-start gap-3 text-sm">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[row.level]}`} role="img" aria-label={BADGE[row.level].label} />
            <span className="min-w-0">
              <span className="block font-semibold text-white">{row.label}</span>
              <span className="block text-xs text-white/55">{row.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
