import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Copy, KeyRound, Loader2, MessageCircle, Pencil, Plus, TriangleAlert, Undo2, X } from 'lucide-react';
import { calculateTravelRoute, fetchDayEvents, TravelRequestError, type TravelResult } from '../../services/travelService';
import { DEFAULT_EVENT_FEE, DEFAULT_KM_RATE, MAX_EVENTS, applyKmOverrides, formatBRL, formatDateKey, formatKm, parseKm, travelWhatsAppText, whatsAppLink } from '../../services/travelCost.js';
import { moveItem } from '../../services/agentContent.js';

// Cálculo de deslocamento dos eventos (docs/deslocamento.md). Os endereços padrão ficam só no servidor: aqui aparecem como "padrão".
// Rascunho (código, eventos, valores) fica no aparelho, como o resto da área do agente.

interface Draft {
  code: string;
  events: string[];
  /** Parada: padrão do servidor, sem parada ou outro endereço. */
  stopMode: 'default' | 'none' | 'custom';
  stopAddress: string;
  /** null = endereço padrão; string = outro endereço só neste cálculo. */
  start: string | null;
  end: string | null;
  kmRate: string;
  eventFee: string;
}
const STORAGE_KEY = 'hdc.agente.deslocamento.v1';
const EMPTY: Draft = { code: '', events: [''], stopMode: 'default', stopAddress: '', start: null, end: null, kmRate: String(DEFAULT_KM_RATE).replace('.', ','), eventFee: String(DEFAULT_EVENT_FEE) };

function load(): Draft {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }; } catch { return EMPTY; }
}

/** Data de hoje no aparelho ('YYYY-MM-DD'), padrão da data do texto do WhatsApp. */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const btn = 'touch-manipulation select-none active:scale-[0.98] transition-transform';
const field = 'h-14 w-full rounded-2xl border border-white/10 bg-[#0D1527] px-4 text-base text-white placeholder:text-white/35 focus:border-blue-400 focus:outline-none';
const card = 'rounded-2xl border border-white/10 bg-[#0D1527] px-4 py-4';
const heading = 'mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/40';
const smallBtn = `${btn} rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/70`;

export const TravelCalculator: React.FC = () => {
  const [draft, setDraft] = useState<Draft>(load);
  const [result, setResult] = useState<TravelResult | null>(null);
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  // Data do texto do WhatsApp (hoje por padrão; não é lembrada, para nunca sair a data de um dia antigo sem querer).
  const [date, setDate] = useState(todayKey);
  // Km corrigidos à mão (índice do trecho -> km) e o trecho em edição.
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<{ index: number; value: string } | null>(null);
  // Importação dos eventos cadastrados no dia (resultado em `notice`).
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* sem armazenamento: vale só nesta sessão */ } }, [draft]);

  /** Resumo com os ajustes de km aplicados e o texto correspondente (recalculados a cada ajuste ou mudança de data). */
  const summary = useMemo(() => (result ? applyKmOverrides(result.summary, overrides) : null), [result, overrides]);
  const text = useMemo(() => (summary ? travelWhatsAppText(summary, { date }) : ''), [summary, date]);

  /** Qualquer alteração invalida o resultado anterior (o valor mostrado sempre corresponde ao que está na tela). */
  const patch = (changes: Partial<Draft>) => { setDraft((d) => ({ ...d, ...changes })); setResult(null); setAcked(false); setError(''); setOverrides({}); setEditing(null); setNotice(''); };

  const saveKm = () => {
    if (!editing) return;
    const km = parseKm(editing.value);
    if (km === null) return;
    setOverrides((o) => ({ ...o, [editing.index]: km }));
    setEditing(null);
  };
  const restoreKm = (index: number) => setOverrides((o) => { const { [index]: _removed, ...rest } = o; return rest; });
  const setEvent = (i: number, value: string) => patch({ events: draft.events.map((e, n) => (n === i ? value : e)) });
  const ready = draft.events.length > 0 && draft.events.every((e) => e.trim()) && (draft.stopMode !== 'custom' || draft.stopAddress.trim())
    && (draft.start === null || draft.start.trim()) && (draft.end === null || draft.end.trim());

  const calculate = async () => {
    setBusy(true); setError(''); setResult(null); setAcked(false); setOverrides({}); setEditing(null);
    try {
      setResult(await calculateTravelRoute(draft.code, {
        events: draft.events,
        ...(draft.start !== null ? { start: draft.start } : {}),
        ...(draft.end !== null ? { end: draft.end } : {}),
        stop: draft.stopMode === 'none' ? null : draft.stopMode === 'custom' ? draft.stopAddress : undefined,
        kmRate: draft.kmRate,
        eventFee: draft.eventFee,
      }));
    } catch (e) {
      if (e instanceof TravelRequestError && e.unauthorized) setDraft((d) => ({ ...d, code: '' })); // código recusado: pede de novo
      setError(e instanceof Error ? e.message : 'Não foi possível calcular agora.');
    } finally { setBusy(false); }
  };

  /** Preenche os eventos com os cadastrados na data escolhida (ordem de horário). Só traz horário, local e tipo. */
  const importEvents = async () => {
    setImporting(true); setError(''); setNotice('');
    try {
      const found = await fetchDayEvents(draft.code, date);
      const day = formatDateKey(date);
      if (found.length === 0) { setNotice(`Nenhum evento cadastrado em ${day}.`); return; }
      if (draft.events.some((e) => e.trim()) && !window.confirm(`Substituir os eventos digitados pelos ${found.length} cadastrados em ${day}?`)) return;
      const used = found.slice(0, MAX_EVENTS);
      patch({ events: used.map((event) => event.location) });
      setNotice(`${used.length === 1 ? '1 evento importado' : `${used.length} eventos importados`} de ${day}, em ordem de horário: ${used.map((event) => `${event.time}${event.formType ? ` ${event.formType}` : ''}`).join(' · ')}.${found.length > used.length ? ` Havia ${found.length}; o limite é ${MAX_EVENTS} por cálculo.` : ''} Confira a ordem e os endereços.`);
    } catch (e) {
      if (e instanceof TravelRequestError && e.unauthorized) setDraft((d) => ({ ...d, code: '' }));
      setError(e instanceof Error ? e.message : 'Não foi possível consultar os eventos agora.');
    } finally { setImporting(false); }
  };

  const copy = async () => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem área de transferência: o texto está visível abaixo */ }
  };

  if (!draft.code) {
    return (
      <div className={`${card} space-y-3`}>
        <p className="flex items-center gap-2 text-lg font-bold"><KeyRound className="h-5 w-5 text-blue-300" />Código de acesso</p>
        <p className="text-sm text-white/60">Digite o código do cálculo de deslocamento. Ele fica salvo neste aparelho.</p>
        {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
        <input type="password" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Código" aria-label="Código de acesso" autoComplete="off" className={field} />
        <button disabled={!codeInput.trim()} onClick={() => { patch({ code: codeInput.trim() }); setCodeInput(''); }} className={`${btn} h-14 w-full rounded-2xl bg-blue-600 text-base font-bold disabled:opacity-40`}>Salvar código</button>
      </div>
    );
  }

  const addressChoice = (label: string, value: string | null, onChange: (v: string | null) => void) => (
    <div>
      <span className={heading}>{label}</span>
      {value === null ? (
        <div className="flex items-center gap-2">
          <p className={`${card} flex-1 py-3.5 text-[15px] text-white/70`}>Endereço padrão</p>
          <button onClick={() => onChange('')} className={smallBtn}>Usar outro</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Rua, número, bairro e cidade" aria-label={label} className={field} />
          <button onClick={() => onChange(null)} className={smallBtn}>Voltar ao padrão</button>
        </div>
      )}
    </div>
  );

  const stopChoices: [Draft['stopMode'], string][] = [['default', 'Padrão'], ['none', 'Sem parada'], ['custom', 'Outra']];

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-4`}>
        {addressChoice('Ponto de partida', draft.start, (start) => patch({ start }))}

        <div>
          <span className={heading}>Parada (ida e volta)</span>
          <div className="flex gap-2" role="group" aria-label="Parada">
            {stopChoices.map(([mode, label]) => (
              <button key={mode} onClick={() => patch({ stopMode: mode })} aria-pressed={draft.stopMode === mode} className={`${btn} h-12 flex-1 rounded-xl border text-sm font-bold ${draft.stopMode === mode ? 'border-blue-400 bg-blue-600/25 text-white' : 'border-white/10 text-white/60'}`}>{label}</button>
            ))}
          </div>
          {draft.stopMode === 'custom' && <input value={draft.stopAddress} onChange={(e) => patch({ stopAddress: e.target.value })} placeholder="Rua, número, bairro e cidade" aria-label="Endereço da parada" className={`${field} mt-2`} />}
        </div>

        <div>
          <label className="block"><span className={heading}>Data dos eventos (importação e início do texto)</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>
          <button disabled={!date || importing} onClick={importEvents} className={`${btn} mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-600/15 text-sm font-bold text-blue-100 disabled:opacity-40`}>
            {importing ? <><Loader2 className="h-4 w-4 animate-spin" />Buscando...</> : <><CalendarDays className="h-4 w-4" />Importar eventos do dia</>}
          </button>
          {notice && <p role="status" className="mt-2 rounded-xl bg-white/5 px-3 py-2.5 text-[13px] leading-snug text-white/70">{notice}</p>}
        </div>

        <div>
          <span className={heading}>Eventos (na ordem do trajeto)</span>
          <ol className="space-y-2">
            {draft.events.map((address, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <input value={address} onChange={(e) => setEvent(i, e.target.value)} placeholder={`Evento ${i + 1}: rua, número, bairro e cidade`} aria-label={`Endereço do evento ${i + 1}`} className={`${field} min-w-0 flex-1`} />
                <div className="flex shrink-0 flex-col">
                  <button disabled={i === 0} onClick={() => patch({ events: moveItem(draft.events, i, -1) })} aria-label={`Subir evento ${i + 1}`} className={`${btn} flex h-7 w-9 items-center justify-center rounded-t-lg bg-white/10 disabled:opacity-25`}><ArrowUp className="h-4 w-4" /></button>
                  <button disabled={i === draft.events.length - 1} onClick={() => patch({ events: moveItem(draft.events, i, 1) })} aria-label={`Descer evento ${i + 1}`} className={`${btn} flex h-7 w-9 items-center justify-center rounded-b-lg bg-white/10 disabled:opacity-25`}><ArrowDown className="h-4 w-4" /></button>
                </div>
                <button disabled={draft.events.length === 1} onClick={() => patch({ events: draft.events.filter((_, n) => n !== i) })} aria-label={`Remover evento ${i + 1}`} className={`${btn} flex h-12 w-10 shrink-0 items-center justify-center rounded-xl text-white/50 disabled:opacity-25`}><X className="h-5 w-5" /></button>
              </li>
            ))}
          </ol>
          <button disabled={draft.events.length >= MAX_EVENTS} onClick={() => patch({ events: [...draft.events, ''] })} className={`${btn} mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-sm font-bold text-white/70 disabled:opacity-30`}><Plus className="h-4 w-4" />Adicionar evento</button>
        </div>

        {addressChoice('Destino final', draft.end, (end) => patch({ end }))}

        <div className="grid grid-cols-2 gap-3">
          <label><span className={heading}>Valor por km (R$)</span><input value={draft.kmRate} onChange={(e) => patch({ kmRate: e.target.value })} inputMode="decimal" className={field} /></label>
          <label><span className={heading}>Cachê por evento (R$)</span><input value={draft.eventFee} onChange={(e) => patch({ eventFee: e.target.value })} inputMode="decimal" className={field} /></label>
        </div>
      </div>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/50 bg-red-600/20 px-4 py-3 text-[15px] font-semibold text-red-100"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}

      <button disabled={!ready || busy} onClick={calculate} className={`${btn} flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-lg font-black uppercase tracking-wide shadow-lg shadow-blue-600/30 disabled:opacity-40`}>
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" />Calculando...</> : 'Calcular'}
      </button>

      {result && summary && (
        <>
          <div className={card}>
            <span className={heading}>Trechos usados</span>
            <ul className="divide-y divide-white/10">
              {summary.legs.map((leg, i) => (
                <li key={i} className="py-2.5 text-[15px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">{leg.from} → {leg.to}</span>
                    {editing?.index === i ? (
                      <span className="flex shrink-0 items-center gap-1.5">
                        <input
                          autoFocus value={editing.value} inputMode="decimal" aria-label={`Km do trecho ${leg.from} para ${leg.to}`}
                          onChange={(e) => setEditing({ index: i, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveKm(); if (e.key === 'Escape') setEditing(null); }}
                          className="h-11 w-20 rounded-xl border border-blue-400 bg-[#070B14] px-3 text-right text-base font-bold text-white focus:outline-none"
                        />
                        <button onClick={saveKm} disabled={parseKm(editing.value) === null} className={`${btn} h-11 rounded-xl bg-blue-600 px-3 text-sm font-bold disabled:opacity-40`}>OK</button>
                        <button onClick={() => setEditing(null)} aria-label="Cancelar ajuste" className={`${btn} flex h-11 w-9 items-center justify-center rounded-xl text-white/50`}><X className="h-4 w-4" /></button>
                      </span>
                    ) : (
                      <button onClick={() => setEditing({ index: i, value: String(leg.km).replace('.', ',') })} aria-label={`Ajustar km de ${leg.from} para ${leg.to}`} className={`${btn} flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-bold tabular-nums ${leg.adjusted ? 'bg-amber-400/15 text-amber-200' : 'text-white'}`}>
                        {formatKm(leg.km)}<Pencil className="h-3.5 w-3.5 text-white/40" />
                      </button>
                    )}
                  </div>
                  {leg.adjusted && editing?.index !== i && (
                    <p className="mt-1 flex items-center justify-end gap-2 text-xs text-amber-200">
                      Ajustado (mapa: {formatKm(result.summary.legs[i].km)})
                      <button onClick={() => restoreKm(i)} className={`${btn} inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 font-semibold text-white/70`}><Undo2 className="h-3 w-3" />Restaurar</button>
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-white/10 pt-3 text-right text-lg font-black tabular-nums">Total: {formatKm(summary.totalKm)}</p>
            <p className="mt-1 text-xs text-white/40">Se o trajeto real foi outro, toque no km do trecho para corrigir. O texto do WhatsApp avisa que foi ajustado.</p>
          </div>

          {result.resolved.length > 0 && (
            <div className={card}>
              <span className={heading}>Endereços entendidos pelo mapa</span>
              <ul className="space-y-3">
                {result.resolved.map((point) => (
                  <li key={point.label} className="text-[15px]">
                    <p className="font-bold">{point.label}{!point.precise && <span className="ml-2 text-amber-300">⚠ confira</span>}</p>
                    <p className="text-white/70">{point.address}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-white/40">Se algum estiver diferente do evento, corrija o endereço (inclua bairro e cidade) e calcule de novo.</p>
            </div>
          )}

          {result.needsConfirmation && !acked ? (
            <div role="alert" className="space-y-3 rounded-2xl border-2 border-amber-400 bg-amber-500/15 px-4 py-4">
              <p className="flex items-start gap-3 text-[15px] font-bold text-amber-100"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />O mapa não achou o número exato de algum endereço. A distância pode estar aproximada.</p>
              <button onClick={() => setAcked(true)} className={`${btn} h-12 w-full rounded-xl bg-amber-400 text-sm font-black uppercase text-black`}>Conferi, mostrar valor</button>
            </div>
          ) : (
            <div className={`${card} space-y-1 text-[15px]`}>
              <p>Deslocamento: {formatKm(summary.totalKm)} × {formatBRL(summary.kmRate)} = <b>{formatBRL(summary.travelCost)}</b></p>
              <p>Cachês: {summary.eventCount} × {formatBRL(summary.eventFee)} = <b>{formatBRL(summary.feesTotal)}</b></p>
              <p className="pt-2 text-xl font-black text-emerald-300">TOTAL A RECEBER: {formatBRL(summary.total)}</p>
              <div className="flex gap-2 pt-3">
                <button onClick={copy} className={`${btn} flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-bold`}><Copy className="h-5 w-5" />{copied ? 'Copiado!' : 'Copiar texto'}</button>
                {result.whatsappBase && <a href={whatsAppLink(result.whatsappBase, text)} target="_blank" rel="noopener noreferrer" className={`${btn} flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-sm font-black text-[#04210F]`}><MessageCircle className="h-5 w-5" />WhatsApp</a>}
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#070B14] p-3 font-sans text-sm text-white/70">{text}</pre>
            </div>
          )}
          <p className="px-1 text-center text-xs text-white/40">Calculado em {new Date(result.calculatedAt).toLocaleString('pt-BR')}. O mapa pode sugerir um trajeto diferente do seu aplicativo; confira os trechos.</p>
        </>
      )}

      <div className="flex justify-center gap-3 pt-2">
        <button onClick={() => { if (window.confirm('Limpar os eventos para um novo cálculo?')) { patch({ events: [''], stopMode: 'default', stopAddress: '', start: null, end: null }); setDate(todayKey()); } }} className={smallBtn}>Novo cálculo</button>
        <button onClick={() => patch({ code: '' })} className={smallBtn}>Trocar código</button>
      </div>
    </div>
  );
};
