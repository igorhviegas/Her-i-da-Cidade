import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Trash2, Upload } from 'lucide-react';
import { deleteFitRide, importFitFile, loadFitRides, type ImportResult, type StoredFitRide } from '../../services/fitRideService';
import { formatDuration, kmByDay, summarizeRides } from '../../services/fitRide.js';
import { rideXp } from '../../functions/xp.js';
import { dayKey } from '../../services/fitDaily.js';
import { DailyBars } from './FitCharts';
import { cardClass, ghostBtn, primaryBtn } from './financeFormat';
import { ClaimButton, type useFitClaims } from './FitXp';
import { RideImportBanners } from './adminPages/RideImportBanners';

const number = (n: number, decimals = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const when = (d: Date) => d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Pedaladas importadas de arquivos FIT (MyWhoosh). `dates` é o período da página ('AAAA-MM-DD' em ordem). */
export const FitRides: React.FC<{ uid: string; dates: string[]; claims: ReturnType<typeof useFitClaims> }> = ({ uid, dates, claims }) => {
  const [rides, setRides] = useState<StoredFitRide[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setRides(await loadFitRides(uid)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar as pedaladas.'); }
  }, [uid]);
  useEffect(() => { void load(); }, [load]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const out: ImportResult[] = [];
    for (const file of Array.from(files)) out.push(await importFitFile(uid, file)); // um por vez: poucos arquivos, e o resultado de cada um aparece
    setResults(out);
    await load();
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const remove = async (ride: StoredFitRide) => {
    if (!window.confirm(`Apagar a pedalada de ${when(ride.startedAt)}? Para trazê-la de volta é preciso importar o arquivo de novo.`)) return;
    try { await deleteFitRide(uid, ride.id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível apagar.'); }
  };

  const inRange = useMemo(() => (rides ?? []).filter((r) => dates.includes(dayKey(r.startedAt))), [rides, dates]);
  const summary = useMemo(() => summarizeRides(inRange), [inRange]);
  const km = useMemo(() => kmByDay(dates, inRange, dayKey), [dates, inRange]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight text-white">Ciclismo</h3>
          <p className="text-sm text-white/55">Treinos importados do arquivo .FIT do MyWhoosh (site → Perfil → Activity Files). Cada pedalada vale 50 XP por km; depois de importar, é só coletar.</p>
        </div>
        <div>
          <input ref={input} type="file" accept=".fit" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
          <button type="button" className={primaryBtn} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar FIT
          </button>
        </div>
      </div>

      <RideImportBanners results={results} />
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p>
        </div>
      )}

      {rides && rides.length === 0 && !error && (
        <div className={cardClass}><p className="text-sm text-white/60">Nenhum treino importado ainda. Baixe o .FIT no site do MyWhoosh e use "Importar FIT" (pode escolher vários de uma vez).</p></div>
      )}

      {rides && rides.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Treinos', String(summary.count)],
              ['Distância', `${number(summary.km, 1)} km`],
              ['Tempo em movimento', summary.movingSec ? formatDuration(summary.movingSec) : '—'],
              ['Velocidade média', summary.avgSpeedKmh === null ? '—' : `${number(summary.avgSpeedKmh, 1)} km/h`],
            ].map(([label, value]) => (
              <div key={label} className={cardClass}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">{value}</p>
              </div>
            ))}
          </div>

          <div className={cardClass}>
            <h4 className="mb-3 text-sm font-bold text-white">Distância pedalada por dia (km)</h4>
            <DailyBars days={dates} values={km} unit="km" decimals={1} label="Distância pedalada por dia" color="#f59e0b" />
          </div>

          <div className={`${cardClass} overflow-x-auto`}>
            <h4 className="mb-3 text-sm font-bold text-white">Treinos no período</h4>
            {inRange.length === 0 ? <p className="text-sm text-white/50">Nenhum treino neste período.</p> : (
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-white/40">
                  <tr><th className="pb-2 font-semibold">Início</th><th className="pb-2 font-semibold">Duração</th><th className="pb-2 font-semibold">Distância</th><th className="pb-2 font-semibold">Vel. média</th><th className="pb-2 font-semibold">Vel. máx.</th><th className="pb-2 font-semibold">Cadência</th><th className="pb-2 font-semibold">XP</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-white/5 tabular-nums text-white/85">
                  {inRange.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3">{when(r.startedAt)}</td>
                      <td className="py-2 pr-3">{formatDuration(r.durationSec)}</td>
                      <td className="py-2 pr-3">{number(r.distanceKm, 2)} km</td>
                      <td className="py-2 pr-3">{number(r.avgSpeedKmh, 1)} km/h</td>
                      <td className="py-2 pr-3">{number(r.maxSpeedKmh, 1)} km/h</td>
                      <td className="py-2 pr-3">{r.avgCadenceRpm ? `${r.avgCadenceRpm} rpm` : '—'}</td>
                      <td className="py-2 pr-3"><ClaimButton xp={rideXp(r.distanceKm)} claimed={claims.isClaimed('fit_ride', r.id)} busy={claims.busy !== null} onClick={() => void claims.claim('fit_ride', r.id, rideXp(r.distanceKm), { distanceKm: r.distanceKm })} /></td>
                      <td className="py-2 text-right"><button type="button" className={ghostBtn} onClick={() => void remove(r)} aria-label={`Apagar a pedalada de ${when(r.startedAt)}`}><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
};
