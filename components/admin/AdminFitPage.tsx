import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { loadFitDaily, type FitDailyRow } from '../../services/fitService';
import { loadWeights, type WeightEntry } from '../../services/fitDataService';
import { stepsXp } from '../../functions/xp.js';
import { average, dayKey, lastDays, movingAverage, series, summarize } from '../../services/fitDaily.js';
import { DailyBars, WeightLine } from './FitCharts';
import { FitRides } from './FitRides';
import { useFitClaims } from './FitXp';
import { FitKpiGrid, FitStepsXp } from './adminPages/FitPageParts';
import { cardClass, ghostBtn } from './financeFormat';

const RANGES = [7, 30, 90] as const;
const MAX_DAYS = RANGES[RANGES.length - 1];
/** Fit: passos, distância e peso (Apple Saúde pelo Atalho do iPhone + peso manual), pedaladas do MyWhoosh e coleta de XP (docs/fit.md). */
export const AdminFitPage: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<FitDailyRow[] | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const claims = useFitClaims();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const [daily, manual] = await Promise.all([loadFitDaily(user.uid, MAX_DAYS), loadWeights(user.uid, 400)]);
      setRows(daily); setWeights(manual);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados do Fit.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  // Peso manual vale mais que o do atalho no mesmo dia (você corrigiu à mão); dia só com peso manual também entra.
  const merged = useMemo(() => {
    const byDay = new Map<string, FitDailyRow>((rows ?? []).map((r) => [r.day, { ...r }]));
    for (const w of weights) byDay.set(w.day, { ...(byDay.get(w.day) ?? ({ day: w.day } as FitDailyRow)), weightKg: w.kg });
    return [...byDay.values()];
  }, [rows, weights]);
  const today = dayKey(new Date());
  const days = useMemo(() => lastDays(merged, today, range), [merged, today, range]);

  // XP dos passos: só de dias já fechados (o de hoje ainda muda). Cada dia é coletado uma vez.
  const pendingSteps = useMemo(() => (rows ?? []).filter((r) => r.day < today && stepsXp(r.steps) > 0 && !claims.isClaimed('fit_steps', r.day)).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 14), [rows, today, claims]);
  const pendingTotal = pendingSteps.reduce((sum, r) => sum + stepsXp(r.steps), 0);
  const claimAllSteps = async () => { for (const r of pendingSteps) await claims.claim('fit_steps', r.day, stepsXp(r.steps), { steps: r.steps }); };
  const view = useMemo(() => {
    const weights = series(days, 'weightKg');
    return { dates: days.map((d) => d.day), steps: series(days, 'steps'), km: series(days, 'walkRunKm'), weights, trend: movingAverage(weights, 7), summary: summarize(days) };
  }, [days]);
  const lastSync = useMemo(() => (rows ?? []).reduce<Date | null>((latest, r) => (r.updatedAt && (!latest || r.updatedAt > latest) ? r.updatedAt : latest), null), [rows]);
  const { summary } = view;
  const kmAverage = average(view.km);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Fit</h2>
          <p className="text-sm text-white/55">Passos, distância e peso do Apple Saúde (enviados pelo Atalho do iPhone), peso manual e pedaladas do MyWhoosh.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5" role="group" aria-label="Período">
            {RANGES.map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${range === r ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{r} dias</button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className={ghostBtn} aria-label="Atualizar">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p>{error}</p>
            <p className="mt-1 text-xs text-red-200/70">Se for permissão, publique o firestore.rules atualizado (regra de users/&#123;uid&#125;/fitDaily).</p>
          </div>
        </div>
      )}

      {rows && merged.length === 0 && !error && (
        <div className={cardClass}>
          <p className="font-semibold text-white">Nenhum dado recebido ainda.</p>
          <p className="mt-1 text-sm text-white/60">Monte o Atalho do iPhone que envia passos, distância e peso (passo a passo em docs/fit.md) e rode uma vez, ou registre o peso na aba Check-ins.</p>
        </div>
      )}

      {rows && merged.length > 0 && (
        <>
          <FitKpiGrid summary={summary} dates={view.dates} kmAverage={kmAverage} />

          <section className={cardClass}>
            <h3 className="mb-3 text-sm font-bold text-white">Passos por dia</h3>
            <DailyBars days={view.dates} values={view.steps} unit="passos" label="Passos por dia" />
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={cardClass}>
              <h3 className="mb-3 text-sm font-bold text-white">Distância caminhada/corrida (km)</h3>
              <DailyBars days={view.dates} values={view.km} unit="km" decimals={1} label="Distância por dia" color="#10b981" />
            </section>
            <section className={cardClass}>
              <h3 className="mb-1 text-sm font-bold text-white">Peso</h3>
              <p className="mb-3 text-xs text-white/50"><span className="text-blue-400">●</span> pesagem · <span className="text-amber-400">━</span> média móvel (7 dias)</p>
              <WeightLine days={view.dates} values={view.weights} average={view.trend} />
            </section>
          </div>
          <FitStepsXp pendingSteps={pendingSteps} pendingTotal={pendingTotal} claims={claims} onClaimAll={() => void claimAllSteps()} />
          <p className="text-xs text-white/40">Dia sem registro aparece apagado (não é zero). {lastSync && `Última sincronização: ${lastSync.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`}</p>
        </>
      )}

      {user && <FitRides uid={user.uid} dates={view.dates} claims={claims} />}
    </div>
  );
};
