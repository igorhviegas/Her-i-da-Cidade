import React, { useEffect, useState } from 'react';
import { CalendarPlus, Loader2, TriangleAlert } from 'lucide-react';
import { calculateTravelRoute, TravelRequestError, type TravelResult } from '../../services/travelService';
import { MAX_DAYS, nextDateKey } from '../../services/travelCost.js';
import { CodeGate, DayForm } from '../publicSite/agente/TravelDayForm';
import { TravelResultView } from '../publicSite/agente/TravelResultView';
import { STORAGE_KEY, btn, card, emptyDay, emptyDraft, field, heading, isReady, load, smallBtn, todayKey, type DayDraft, type Draft } from '../publicSite/agente/travelShared';
import { useCopyText, useKmEditing, useTripSummary } from '../publicSite/agente/travelHooks';

// Cálculo de deslocamento dos eventos (docs/deslocamento.md). Os endereços padrão ficam só no servidor: aqui aparecem como "padrão".
// Cada dia é uma viagem própria (parte do ponto de partida e volta ao destino); o cálculo soma os dias em um total só.
// Rascunho (código, dias, eventos, valores) fica no aparelho, como o resto da área do agente.

export const TravelCalculator: React.FC = () => {
  const [draft, setDraft] = useState<Draft>(load);
  const [result, setResult] = useState<TravelResult | null>(null);
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { overrides, setOverrides, editing, setEditing, saveKm, restoreKm } = useKmEditing();

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* sem armazenamento: vale só nesta sessão */ } }, [draft]);

  const { summary, text } = useTripSummary(result, overrides);
  const { copied, copy } = useCopyText(text);

  /** Qualquer alteração invalida o resultado anterior (o valor mostrado sempre corresponde ao que está na tela). */
  const change = (update: (d: Draft) => Draft) => { setDraft(update); setResult(null); setAcked(false); setError(''); setOverrides({}); setEditing(null); };
  const changeDay = (index: number, changes: Partial<DayDraft>) => change((d) => ({ ...d, days: d.days.map((day, i) => (i === index ? { ...day, ...changes } : day)) }));
  const many = draft.days.length > 1;

  const addDay = () => change((d) => ({ ...d, days: [...d.days, emptyDay(nextDateKey(d.days[d.days.length - 1].date) || todayKey())] }));
  const removeDay = (index: number) => {
    const day = draft.days[index];
    if (day.events.some((e) => e.trim()) && !window.confirm(`Remover o dia ${index + 1} e os eventos dele?`)) return;
    change((d) => ({ ...d, days: d.days.filter((_, i) => i !== index) }));
  };

  /** Erro de uma chamada ao servidor; código recusado volta para a tela do código. */
  const fail = (e: unknown, fallback: string) => {
    if (e instanceof TravelRequestError && e.unauthorized) setDraft((d) => ({ ...d, code: '' }));
    setError(e instanceof Error ? e.message : fallback);
  };

  const calculate = async () => {
    setBusy(true); setError(''); setResult(null); setAcked(false); setOverrides({}); setEditing(null);
    try {
      setResult(await calculateTravelRoute(draft.code, {
        days: draft.days.map((day) => ({
          date: day.date,
          events: day.events,
          ...(day.start !== null ? { start: day.start } : {}),
          ...(day.end !== null ? { end: day.end } : {}),
          stop: day.stopMode === 'none' ? null : day.stopMode === 'custom' ? day.stopAddress : undefined,
        })),
        kmRate: draft.kmRate,
        eventFee: draft.eventFee,
      }));
    } catch (e) { fail(e, 'Não foi possível calcular agora.'); } finally { setBusy(false); }
  };

  if (!draft.code) return <CodeGate error={error} onSave={(code) => change((d) => ({ ...d, code }))} />;

  return (
    <div className="space-y-4">
      {draft.days.map((day, i) => (
        <DayForm key={i} index={i} day={day} many={many} code={draft.code} onChange={(changes) => changeDay(i, changes)} onRemove={() => removeDay(i)} onError={(e) => fail(e, 'Não foi possível consultar os eventos agora.')} />
      ))}

      <button disabled={draft.days.length >= MAX_DAYS} onClick={addDay} className={`${btn} flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-400/50 bg-blue-600/10 text-sm font-bold text-blue-100 disabled:opacity-30`}>
        <CalendarPlus className="h-5 w-5" />Adicionar outro dia (soma no total)
      </button>

      <div className={card}>
        <div className="grid grid-cols-2 gap-3">
          <label><span className={heading}>Valor por km (R$)</span><input value={draft.kmRate} onChange={(e) => change((d) => ({ ...d, kmRate: e.target.value }))} inputMode="decimal" className={field} /></label>
          <label><span className={heading}>Cachê por evento (R$)</span><input value={draft.eventFee} onChange={(e) => change((d) => ({ ...d, eventFee: e.target.value }))} inputMode="decimal" className={field} /></label>
        </div>
      </div>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/50 bg-red-600/20 px-4 py-3 text-[15px] font-semibold text-red-100"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}

      <button disabled={!isReady(draft.days) || busy} onClick={calculate} className={`${btn} flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-lg font-black uppercase tracking-wide shadow-lg shadow-blue-600/30 disabled:opacity-40`}>
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" />Calculando...</> : many ? `Calcular ${draft.days.length} dias` : 'Calcular'}
      </button>


      {result && summary && (
        <TravelResultView
          result={result} summary={summary} text={text} many={many} editor={{ editing, setEditing, saveKm, restoreKm }}
          acked={acked} onAck={() => setAcked(true)} copied={copied} onCopy={copy}
        />
      )}

      <div className="flex justify-center gap-3 pt-2">
        <button onClick={() => { if (window.confirm('Limpar os dias e eventos para um novo cálculo?')) change((d) => ({ ...emptyDraft(), code: d.code, kmRate: d.kmRate, eventFee: d.eventFee })); }} className={smallBtn}>Novo cálculo</button>
        <button onClick={() => change((d) => ({ ...d, code: '' }))} className={smallBtn}>Trocar código</button>
      </div>
    </div>
  );
};
