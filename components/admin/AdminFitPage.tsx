import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { loadFitDaily, type FitDailyRow } from '../../services/fitService';
import { average, dayKey, lastDays, movingAverage, series, summarize } from '../../services/fitDaily.js';
import { DailyBars, WeightLine, shortDay } from './FitCharts';
import { FitRides } from './FitRides';
import { cardClass, ghostBtn } from './financeFormat';

const RANGES = [7, 30, 90] as const;
const MAX_DAYS = RANGES[RANGES.length - 1];
const number = (n: number, decimals = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const Kpi: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className={cardClass}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
    <p className="mt-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">{value}</p>
    {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
  </div>
);

/** Fit: passos, distância e peso vindos do Apple Saúde (docs/fit.md). Somente leitura. */
export const AdminFitPage: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<FitDailyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try { setRows(await loadFitDaily(user.uid, MAX_DAYS)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados do Fit.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const days = useMemo(() => lastDays(rows ?? [], dayKey(new Date()), range), [rows, range]);
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
          <p className="text-sm text-white/55">Passos, distância e peso do Apple Saúde (iPhone), enviados pelo Health Auto Export.</p>
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

      {rows && rows.length === 0 && !error && (
        <div className={cardClass}>
          <p className="font-semibold text-white">Nenhum dado recebido ainda.</p>
          <p className="mt-1 text-sm text-white/60">Configure a automação REST API do Health Auto Export (passo a passo em docs/fit.md), com "Summarize Data" ligado, e rode uma vez.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Passos" value={summary.latestSteps ? number(summary.latestSteps.value) : '—'} hint={summary.latestSteps ? `${shortDay(summary.latestSteps.day)}${summary.latestSteps.day === view.dates[view.dates.length - 1] ? ' · hoje, parcial' : ''}` : 'sem registro'} />
            <Kpi label="Média de passos" value={summary.avgSteps === null ? '—' : number(summary.avgSteps)} hint={`por dia, ${summary.daysWithData} ${summary.daysWithData === 1 ? 'dia' : 'dias'} com dados`} />
            <Kpi label="Distância" value={summary.totalKm === null ? '—' : `${number(summary.totalKm, 1)} km`} hint={kmAverage === null ? 'caminhada/corrida' : `${number(kmAverage, 1)} km/dia em média`} />
            <Kpi label="Peso" value={summary.weight ? `${number(summary.weight.value, 1)} kg` : '—'}
              hint={summary.weight ? `${shortDay(summary.weight.day)}${summary.weight.change === null ? '' : ` · ${summary.weight.change > 0 ? '+' : ''}${number(summary.weight.change, 1)} kg no período`}` : 'sem pesagem no período'} />
          </div>

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
          <p className="text-xs text-white/40">Dia sem registro aparece apagado (não é zero). {lastSync && `Última sincronização: ${lastSync.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`}</p>
        </>
      )}

      {user && <FitRides uid={user.uid} dates={view.dates} />}
    </div>
  );
};
