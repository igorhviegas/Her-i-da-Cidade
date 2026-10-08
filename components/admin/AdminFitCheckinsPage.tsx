import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { deleteCheckin, deleteWeight, loadCheckins, loadWeights, saveCheckin, saveWeight, type WeightEntry } from '../../services/fitDataService';
import { CHECKIN_KINDS, mondayOf, normalizeCheckin, normalizeWeight, weeklyCounts, type Checkin, type CheckinKind } from '../../services/fitCheckin.js';
import { dayKey } from '../../services/fitDaily.js';
import { checkinXp } from '../../functions/xp.js';
import { DailyBars } from './FitCharts';
import { ClaimButton, useFitClaims } from './FitXp';
import { CheckinStatCards } from './adminPages/CheckinStatCards';
import { cardClass, ghostBtn, inputClass, labelClass, primaryBtn } from './financeFormat';

const number = (n: number, decimals = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const prettyDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const KIND_STYLE: Record<CheckinKind, string> = { gym: 'bg-blue-500/20 text-blue-200', functional: 'bg-emerald-500/20 text-emerald-200' };

/** Check-ins de academia e funcional (um por tipo e dia, com XP) e peso manual. Dados em users/{uid}/... (docs/fit.md). */
export const AdminFitCheckinsPage: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const claims = useFitClaims();
  const today = dayKey(new Date());
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ kind: 'gym' as CheckinKind, day: today, durationMin: '', note: '' });
  const [weightForm, setWeightForm] = useState({ day: today, kg: '' });

  const load = useCallback(async () => {
    if (!uid) return;
    try { const [c, w] = await Promise.all([loadCheckins(uid), loadWeights(uid, 60)]); setCheckins(c); setWeights(w); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados do Fit.'); }
  }, [uid]);
  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await action(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };

  const submitCheckin = (e: React.FormEvent) => {
    e.preventDefault();
    const result = normalizeCheckin(form);
    if ('error' in result) { setError(result.error); return; }
    void run(async () => { await saveCheckin(uid, result.value); setForm((f) => ({ ...f, durationMin: '', note: '' })); });
  };
  const submitWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const result = normalizeWeight(weightForm);
    if ('error' in result) { setError(result.error); return; }
    void run(async () => { await saveWeight(uid, result.value); setWeightForm((f) => ({ ...f, kg: '' })); });
  };

  const stats = useMemo(() => {
    const list = checkins ?? [];
    const week = mondayOf(today); const month = today.slice(0, 7);
    return {
      week: list.filter((c) => c.day >= week && c.day <= today).length,
      month: list.filter((c) => c.day.startsWith(month)),
      weekly: weeklyCounts(list, today, 8),
    };
  }, [checkins, today]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">Check-ins e peso</h2>
        <p className="text-sm text-white/55">Registre a academia e o funcional (um por tipo e dia, {checkinXp()} XP cada) e o seu peso.</p>
      </div>

      {(error || claims.error) && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error ?? claims.error}</p>
        </div>
      )}

      <CheckinStatCards week={stats.week} month={stats.month} />

      <form onSubmit={submitCheckin} className={`${cardClass} space-y-3`}>
        <h3 className="text-sm font-bold text-white">Registrar check-in</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>Tipo
            <select className={inputClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CheckinKind })}>
              {(Object.keys(CHECKIN_KINDS) as CheckinKind[]).map((k) => <option key={k} value={k}>{CHECKIN_KINDS[k]}</option>)}
            </select>
          </label>
          <label className={labelClass}>Data
            <input type="date" className={inputClass} value={form.day} max={today} onChange={(e) => setForm({ ...form, day: e.target.value })} required />
          </label>
          <label className={labelClass}>Duração (min, opcional)
            <input type="text" inputMode="numeric" className={inputClass} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} placeholder="ex.: 60" />
          </label>
          <label className={labelClass}>Observação (opcional)
            <input type="text" className={inputClass} value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ex.: aula de terça" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryBtn} disabled={busy || !uid}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Registrar check-in</button>
          <p className="text-xs text-white/45">Registrar de novo no mesmo dia e tipo corrige o registro. O treino feito na aba Treinos também vira check-in de academia.</p>
        </div>
      </form>

      <section className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-white">Treinos por semana (últimas 8)</h3>
        <DailyBars days={stats.weekly.map((w) => w.weekStart)} values={stats.weekly.map((w) => w.total)} unit="treinos" label="Treinos por semana" color="#8b5cf6" />
        <p className="mt-2 text-[11px] text-white/40">Cada barra é uma semana (segunda a domingo), identificada pela segunda-feira.</p>
      </section>

      <section className={`${cardClass} overflow-x-auto`}>
        <h3 className="mb-3 text-sm font-bold text-white">Últimos check-ins</h3>
        {checkins === null ? <p className="text-sm text-white/50">Carregando…</p> : checkins.length === 0 ? <p className="text-sm text-white/50">Nenhum check-in ainda.</p> : (
          <ul className="min-w-[32rem] divide-y divide-white/5">
            {checkins.slice(0, 30).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-white/90">
                    <span className="capitalize tabular-nums">{prettyDay(c.day)}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${KIND_STYLE[c.kind]}`}>{CHECKIN_KINDS[c.kind]}</span>
                    {c.durationMin ? <span className="text-xs text-white/50">{c.durationMin} min</span> : null}
                    {c.workoutName ? <span className="text-xs text-white/50">{c.workoutName}{c.exercisesTotal ? ` · ${c.exercisesDone ?? 0}/${c.exercisesTotal} exercícios` : ''}</span> : null}
                  </p>
                  {c.note && <p className="mt-0.5 truncate text-xs text-white/45">{c.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <ClaimButton xp={checkinXp()} claimed={claims.isClaimed('fit_checkin', c.id)} busy={claims.busy !== null} onClick={() => void claims.claim('fit_checkin', c.id, checkinXp(), { kind: c.kind, day: c.day })} />
                  <button type="button" className={ghostBtn} aria-label={`Apagar o check-in de ${prettyDay(c.day)}`}
                    onClick={() => { if (window.confirm('Apagar este check-in? O XP já coletado não é desfeito.')) void run(() => deleteCheckin(uid, c.id)); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${cardClass} space-y-4`}>
        <div>
          <h3 className="text-sm font-bold text-white">Peso</h3>
          <p className="text-xs text-white/50">O peso manual vale mais que o enviado pelo atalho no mesmo dia e aparece no gráfico da aba Fit.</p>
        </div>
        <form onSubmit={submitWeight} className="flex flex-wrap items-end gap-3">
          <label className={labelClass}>Data
            <input type="date" className={inputClass} value={weightForm.day} max={today} onChange={(e) => setWeightForm({ ...weightForm, day: e.target.value })} required />
          </label>
          <label className={labelClass}>Peso (kg)
            <input type="text" inputMode="decimal" className={inputClass} value={weightForm.kg} onChange={(e) => setWeightForm({ ...weightForm, kg: e.target.value })} placeholder="ex.: 72,5" required />
          </label>
          <button type="submit" className={primaryBtn} disabled={busy || !uid}>Salvar peso</button>
        </form>
        {weights.length > 0 && (
          <>
            <p className="text-sm text-white/70">Último: <span className="font-bold tabular-nums text-white">{number(weights[0].kg, 1)} kg</span> em {prettyDay(weights[0].day)}</p>
            <ul className="divide-y divide-white/5">
              {weights.slice(0, 15).map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="capitalize tabular-nums text-white/85">{prettyDay(w.day)} · {number(w.kg, 1)} kg</span>
                  <button type="button" className={ghostBtn} aria-label={`Apagar o peso de ${prettyDay(w.day)}`} onClick={() => void run(() => deleteWeight(uid, w.day))}><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};
