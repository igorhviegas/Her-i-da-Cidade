import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Route, XCircle } from 'lucide-react';
import type { CalendarEvent } from '../../services/calendarService';
import { calculateSchedule, type ScheduleLegs } from '../../services/eventQuoteService';
import { DEFAULT_BUFFERS, PACKAGE_MINUTES, formatTime, parseTime, planDay, type ScheduleStop } from '../../services/eventSchedule.js';
import { ErrorNote, inputClass, labelClass, primaryButton } from './missionsUi';
import type { RoutePath } from '../../functions/travel-route.js';
import type { MapPoint } from './QuoteMap';

interface Stop extends ScheduleStop { address: string; precise?: boolean }

const NEW_LABEL = 'Novo evento';
const num = (text: string, fallback: number) => { const n = Number(text); return Number.isFinite(n) && n >= 0 && n <= 240 ? n : fallback; };

/**
 * Viabilidade de encaixar um evento no dia: casa → eventos da agenda (com endereço) + o novo → casa → casa do Vitor.
 * Cada evento seguinte precisa de: fim do anterior + organização + trajeto + chegada antecipada ≤ início (docs/deslocamento.md).
 */
export const EventScheduleCheck: React.FC<{ dayEvents: CalendarEvent[]; address: string; packageId: string; onMap?: (map: { points: MapPoint[]; paths: RoutePath[] } | null) => void }> = ({ dayEvents, address, packageId, onMap }) => {
  const candidates = useMemo(() => dayEvents.filter((e) => e.startTime && e.endTime && e.startKey === e.endKey && !e.transparent), [dayEvents]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState(String(PACKAGE_MINUTES[packageId] ?? 60));
  useEffect(() => { setDuration(String(PACKAGE_MINUTES[packageId] ?? 60)); setCalc(null); }, [packageId]);
  const [buffers, setBuffers] = useState({ first: String(DEFAULT_BUFFERS.first), next: String(DEFAULT_BUFFERS.next), after: String(DEFAULT_BUFFERS.after) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [calc, setCalc] = useState<{ stops: Stop[]; legs: ScheduleLegs } | null>(null);

  const reset = () => setCalc(null);
  // Trajeto do dia no mapa do orçamento (o evento novo fica destacado); some quando o cálculo é refeito.
  useEffect(() => {
    const map = calc?.legs.map;
    onMap?.(map ? { paths: map.paths, points: map.places.map((p) => ({ ...p, kind: p.kind === 'stop' && p.label === NEW_LABEL ? 'new' : p.kind })) } : null);
  }, [calc, onMap]);
  const startMin = parseTime(start);
  const minutes = Number(duration);
  const endMin = startMin !== null && minutes > 0 ? startMin + minutes : null;
  const newReady = startMin !== null && endMin !== null && endMin !== null && address.trim().length >= 5;

  const run = async () => {
    if (startMin === null || endMin === null) return;
    setBusy(true); setError(''); reset();
    const stops: Stop[] = [
      ...candidates.filter((e) => e.location.trim() && !skipped.has(e.id)).map((e) => ({ label: e.title, start: parseTime(e.startTime ?? '') ?? 0, end: parseTime(e.endTime ?? '') ?? 0, address: e.location.trim() })),
      { label: NEW_LABEL, start: startMin, end: endMin, address: address.trim() },
    ].sort((a, b) => a.start - b.start);
    try {
      setCalc({ stops, legs: await calculateSchedule(stops.map(({ label, address: a }) => ({ label, address: a }))) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível calcular os horários.'); }
    setBusy(false);
  };

  const plan = useMemo(() => {
    if (!calc) return null;
    return planDay(calc.stops, calc.legs.legs, { first: num(buffers.first, DEFAULT_BUFFERS.first), next: num(buffers.next, DEFAULT_BUFFERS.next), after: num(buffers.after, DEFAULT_BUFFERS.after) });
  }, [calc, buffers]);

  const toggle = (id: string) => { setSkipped((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); reset(); };
  const buffer = (key: keyof typeof buffers, label: string) => (
    <label className={labelClass}>{label}<input inputMode="numeric" value={buffers[key]} onChange={(e) => setBuffers({ ...buffers, [key]: e.target.value })} className={inputClass} /></label>
  );

  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-3" aria-label="Viabilidade de horários">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/60"><Route className="h-3.5 w-3.5" />Dá para encaixar neste dia?</h4>

      {candidates.length > 0 && (
        <ul className="space-y-1 text-xs text-white/75">
          {candidates.map((e) => (
            <li key={e.id}>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={!!e.location.trim() && !skipped.has(e.id)} disabled={!e.location.trim()} onChange={() => toggle(e.id)} className="mt-0.5" />
                <span>{e.startTime}–{e.endTime} · {e.title}{e.location.trim() ? '' : ' (sem endereço: fora do cálculo)'}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className={labelClass}>Início do novo<input type="time" value={start} onChange={(e) => { setStart(e.target.value); reset(); }} className={inputClass} /></label>
        <label className={labelClass}>Duração (min)<input inputMode="numeric" value={duration} onChange={(e) => { setDuration(e.target.value); reset(); }} className={inputClass} /></label>
        {buffer('first', 'Chegar antes (1º)')}
        {buffer('next', 'Chegar antes (demais)')}
        {buffer('after', 'Organizar após')}
      </div>
      <button type="button" onClick={run} disabled={busy || !newReady} className={primaryButton}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}Verificar horários
      </button>
      {!address.trim() && <p className="text-xs text-white/45">Preencha o endereço do evento acima: ele é o destino do novo evento.</p>}
      {error && <ErrorNote message={error} />}

      {calc && plan && (
        <div className="space-y-2 text-xs text-white/80">
          <p className={`flex items-center gap-1.5 text-sm font-bold ${plan.feasible ? 'text-emerald-300' : 'text-red-300'}`}>
            {plan.feasible ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{plan.feasible ? 'Dá para encaixar' : 'Não dá para encaixar'}
          </p>
          {calc.legs.resolved.some((r) => !r.precise) && (
            <p className="flex items-start gap-1.5 text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Algum endereço foi entendido de forma aproximada pelo Google; confira: {calc.legs.resolved.filter((r) => !r.precise).map((r) => `${r.label} → ${r.address}`).join(' · ')}</p>
          )}
          <ol className="space-y-2">
            {plan.rows.map((row, i) => (
              <li key={i} className={`rounded-lg border p-2 ${row.ok ? 'border-white/10' : 'border-red-400/40 bg-red-500/10'}`}>
                <p className="font-semibold text-white">{formatTime(row.start)}–{formatTime(row.end)} · {row.label}</p>
                <p>{i === 0 ? 'Sair de casa' : 'Sair do evento anterior'} às <strong>{formatTime(row.leaveAt)}</strong> · {row.travel} min de trajeto
                  {row.slack !== null && (row.ok ? ` · sobra ${row.slack} min` : ` · faltam ${-row.slack} min`)}</p>
              </li>
            ))}
          </ol>
          <p>Chegada em casa (você): <strong className="text-white">{formatTime(plan.homeAt)}</strong></p>
          {plan.vitorAt !== null && <p>Chegada do Vitor (depois de passar na sua casa): <strong className="text-white">{formatTime(plan.vitorAt)}</strong></p>}
          <p className="text-white/45">Tempos do Google sem trânsito em tempo real.</p>
        </div>
      )}
    </div>
  );
};
