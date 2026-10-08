import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Zap } from 'lucide-react';
import { activityLogId } from '../../functions/activity-log.js';
import { claimFitXp, loadFitClaims, type FitXpType } from '../../services/fitDataService';

/** Quais XP do Fit já foram coletados (eventos do activityLog) e a ação de coletar. Cada coleta grava um evento único e abre a janelinha de ganho. */
export function useFitClaims() {
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setClaimed(await loadFitClaims()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o XP coletado.'); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const isClaimed = useCallback((type: FitXpType, refId: string) => claimed.has(activityLogId(type, refId)), [claimed]);
  const claim = useCallback(async (type: FitXpType, refId: string, xp: number, meta: Record<string, unknown> = {}) => {
    const id = activityLogId(type, refId);
    setBusy(id); setError(null);
    try { await claimFitXp(type, refId, xp, meta); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível coletar o XP.'); }
    finally { setBusy(null); }
  }, [reload]);

  return { isClaimed, claim, busy, error, reload };
}

/** Botão "Coletar +N XP"; depois de coletado vira "XP coletado". */
export const ClaimButton: React.FC<{ xp: number; claimed: boolean; busy: boolean; onClick: () => void }> = ({ xp, claimed, busy, onClick }) => {
  if (claimed) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300"><Check className="h-3.5 w-3.5" aria-hidden /> XP coletado</span>;
  if (xp <= 0) return <span className="text-xs text-white/35">sem XP</span>;
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/25 disabled:opacity-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Zap className="h-3.5 w-3.5" aria-hidden />} Coletar +{xp.toLocaleString('pt-BR')} XP
    </button>
  );
};
