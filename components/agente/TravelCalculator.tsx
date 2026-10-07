import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, CalendarPlus, Copy, KeyRound, Loader2, MessageCircle, Pencil, Plus, Trash2, TriangleAlert, Undo2, X } from 'lucide-react';
import { calculateTravelRoute, fetchDayEvents, TravelRequestError, type TravelResult } from '../../services/travelService';
import {
  DEFAULT_EVENT_FEE, DEFAULT_KM_RATE, MAX_DAYS, MAX_EVENTS, formatBRL, formatDateKey, formatKm, legKey, nextDateKey, parseKm, summarizeTrip, travelWhatsAppText, whatsAppLink,
} from '../../services/travelCost.js';
import { moveItem } from '../../services/agentContent.js';

// Cálculo de deslocamento dos eventos (docs/deslocamento.md). Os endereços padrão ficam só no servidor: aqui aparecem como "padrão".
// Cada dia é uma viagem própria (parte do ponto de partida e volta ao destino); o cálculo soma os dias em um total só.
// Rascunho (código, dias, eventos, valores) fica no aparelho, como o resto da área do agente.

interface DayDraft {
  /** 'YYYY-MM-DD'; vai no texto do WhatsApp e define o dia da importação. */
  date: string;
  events: string[];
  /** Parada: padrão do servidor, sem parada ou outro endereço. */
  stopMode: 'default' | 'none' | 'custom';
  stopAddress: string;
  /** null = endereço padrão; string = outro endereço só neste dia. */
  start: string | null;
  end: string | null;
}
interface Draft { code: string; days: DayDraft[]; kmRate: string; eventFee: string }
const STORAGE_KEY = 'hdc.agente.deslocamento.v1';

/** Data de hoje no aparelho ('YYYY-MM-DD'). */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const emptyDay = (date: string): DayDraft => ({ date, events: [''], stopMode: 'default', stopAddress: '', start: null, end: null });
const emptyDraft = (): Draft => ({ code: '', days: [emptyDay(todayKey())], kmRate: String(DEFAULT_KM_RATE).replace('.', ','), eventFee: String(DEFAULT_EVENT_FEE) });

/** Lê o rascunho salvo. O formato antigo (um dia só, sem `days`) vira um dia com a data de hoje. */
function load(): Draft {
  const base = emptyDraft();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const days = Array.isArray(saved.days) && saved.days.length > 0 ? saved.days : Array.isArray(saved.events) ? [saved] : null;
    return {
      code: typeof saved.code === 'string' ? saved.code : '',
      kmRate: typeof saved.kmRate === 'string' ? saved.kmRate : base.kmRate,
      eventFee: typeof saved.eventFee === 'string' ? saved.eventFee : base.eventFee,
      days: days ? days.slice(0, MAX_DAYS).map((day: Partial<DayDraft>) => ({ ...emptyDay(typeof day.date === 'string' ? day.date : todayKey()), ...day, events: Array.isArray(day.events) && day.events.length > 0 ? day.events : [''] })) : base.days,
    };
  } catch { return base; }
}

const btn = 'touch-manipulation select-none active:scale-[0.98] transition-transform';
const field = 'h-14 w-full rounded-2xl border border-white/10 bg-[#0D1527] px-4 text-base text-white placeholder:text-white/35 focus:border-blue-400 focus:outline-none';
const card = 'rounded-2xl border border-white/10 bg-[#0D1527] px-4 py-4';
const heading = 'mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/40';
const smallBtn = `${btn} rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/70`;

const AddressChoice: React.FC<{ label: string; value: string | null; onChange: (value: string | null) => void }> = ({ label, value, onChange }) => (
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

const STOP_CHOICES: [DayDraft['stopMode'], string][] = [['default', 'Padrão'], ['none', 'Sem parada'], ['custom', 'Outra']];

/** Formulário de um dia: data, partida, parada, eventos (digitados ou importados) e destino final. */
const DayForm: React.FC<{
  index: number; day: DayDraft; many: boolean; code: string;
  onChange: (changes: Partial<DayDraft>) => void; onRemove: () => void; onError: (error: unknown) => void;
}> = ({ index, day, many, code, onChange, onRemove, onError }) => {
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const edit = (changes: Partial<DayDraft>) => { setNotice(''); onChange(changes); };
  const setEvent = (i: number, value: string) => edit({ events: day.events.map((e, n) => (n === i ? value : e)) });

  /** Preenche os eventos com os cadastrados na data deste dia (ordem de horário). Só traz horário, local e tipo. */
  const importEvents = async () => {
    setImporting(true); setNotice('');
    try {
      const found = await fetchDayEvents(code, day.date);
      const label = formatDateKey(day.date);
      if (found.length === 0) { setNotice(`Nenhum evento cadastrado em ${label}.`); return; }
      if (day.events.some((e) => e.trim()) && !window.confirm(`Substituir os eventos digitados pelos ${found.length} cadastrados em ${label}?`)) return;
      const used = found.slice(0, MAX_EVENTS);
      onChange({ events: used.map((event) => event.location) });
      setNotice(`${used.length === 1 ? '1 evento importado' : `${used.length} eventos importados`} de ${label}, em ordem de horário: ${used.map((event) => `${event.time}${event.formType ? ` ${event.formType}` : ''}`).join(' · ')}.${found.length > used.length ? ` Havia ${found.length}; o limite é ${MAX_EVENTS} por dia.` : ''} Confira a ordem e os endereços.`);
    } catch (e) { onError(e); } finally { setImporting(false); }
  };

  return (
    <div className={`${card} space-y-4`}>
      {many && (
        <div className="flex items-center justify-between">
          <p className="text-lg font-black">Dia {index + 1}</p>
          <button onClick={onRemove} aria-label={`Remover dia ${index + 1}`} className={`${btn} flex h-10 items-center gap-1.5 rounded-xl border border-red-400/30 px-3 text-xs font-bold text-red-300`}><Trash2 className="h-4 w-4" />Remover dia</button>
        </div>
      )}

      <div>
        <label className="block"><span className={heading}>Data dos eventos{many ? ` (dia ${index + 1})` : ''}</span><input type="date" value={day.date} onChange={(e) => edit({ date: e.target.value })} className={field} /></label>
        <button disabled={!day.date || importing} onClick={importEvents} className={`${btn} mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-600/15 text-sm font-bold text-blue-100 disabled:opacity-40`}>
          {importing ? <><Loader2 className="h-4 w-4 animate-spin" />Buscando...</> : <><CalendarDays className="h-4 w-4" />Importar eventos do dia</>}
        </button>
        {notice && <p role="status" className="mt-2 rounded-xl bg-white/5 px-3 py-2.5 text-[13px] leading-snug text-white/70">{notice}</p>}
      </div>

      <AddressChoice label="Ponto de partida" value={day.start} onChange={(start) => edit({ start })} />

      <div>
        <span className={heading}>Parada (ida e volta)</span>
        <div className="flex gap-2" role="group" aria-label="Parada">
          {STOP_CHOICES.map(([mode, label]) => (
            <button key={mode} onClick={() => edit({ stopMode: mode })} aria-pressed={day.stopMode === mode} className={`${btn} h-12 flex-1 rounded-xl border text-sm font-bold ${day.stopMode === mode ? 'border-blue-400 bg-blue-600/25 text-white' : 'border-white/10 text-white/60'}`}>{label}</button>
          ))}
        </div>
        {day.stopMode === 'custom' && <input value={day.stopAddress} onChange={(e) => edit({ stopAddress: e.target.value })} placeholder="Rua, número, bairro e cidade" aria-label="Endereço da parada" className={`${field} mt-2`} />}
      </div>

      <div>
        <span className={heading}>Eventos (na ordem do trajeto)</span>
        <ol className="space-y-2">
          {day.events.map((address, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input value={address} onChange={(e) => setEvent(i, e.target.value)} placeholder={`Evento ${i + 1}: rua, número, bairro e cidade`} aria-label={`Endereço do evento ${i + 1}${many ? ` do dia ${index + 1}` : ''}`} className={`${field} min-w-0 flex-1`} />
              <div className="flex shrink-0 flex-col">
                <button disabled={i === 0} onClick={() => edit({ events: moveItem(day.events, i, -1) })} aria-label={`Subir evento ${i + 1}`} className={`${btn} flex h-7 w-9 items-center justify-center rounded-t-lg bg-white/10 disabled:opacity-25`}><ArrowUp className="h-4 w-4" /></button>
                <button disabled={i === day.events.length - 1} onClick={() => edit({ events: moveItem(day.events, i, 1) })} aria-label={`Descer evento ${i + 1}`} className={`${btn} flex h-7 w-9 items-center justify-center rounded-b-lg bg-white/10 disabled:opacity-25`}><ArrowDown className="h-4 w-4" /></button>
              </div>
              <button disabled={day.events.length === 1} onClick={() => edit({ events: day.events.filter((_, n) => n !== i) })} aria-label={`Remover evento ${i + 1}`} className={`${btn} flex h-12 w-10 shrink-0 items-center justify-center rounded-xl text-white/50 disabled:opacity-25`}><X className="h-5 w-5" /></button>
            </li>
          ))}
        </ol>
        <button disabled={day.events.length >= MAX_EVENTS} onClick={() => edit({ events: [...day.events, ''] })} className={`${btn} mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-sm font-bold text-white/70 disabled:opacity-30`}><Plus className="h-4 w-4" />Adicionar evento</button>
      </div>

      <AddressChoice label="Destino final" value={day.end} onChange={(end) => edit({ end })} />
    </div>
  );
};

export const TravelCalculator: React.FC = () => {
  const [draft, setDraft] = useState<Draft>(load);
  const [result, setResult] = useState<TravelResult | null>(null);
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  // Km corrigidos à mão (legKey -> km) e o trecho em edição.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* sem armazenamento: vale só nesta sessão */ } }, [draft]);

  /** Resumo (soma dos dias) com os ajustes de km aplicados e o texto correspondente. */
  const summary = useMemo(() => (result ? summarizeTrip(result, overrides) : null), [result, overrides]);
  const text = useMemo(() => (summary ? travelWhatsAppText(summary) : ''), [summary]);

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

  const saveKm = () => {
    if (!editing) return;
    const km = parseKm(editing.value);
    if (km === null) return;
    setOverrides((o) => ({ ...o, [editing.key]: km }));
    setEditing(null);
  };
  const restoreKm = (key: string) => setOverrides((o) => { const { [key]: _removed, ...rest } = o; return rest; });
  const ready = draft.days.every((day) => day.events.every((e) => e.trim()) && (day.stopMode !== 'custom' || day.stopAddress.trim())
    && (day.start === null || day.start.trim()) && (day.end === null || day.end.trim()));

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
        <button disabled={!codeInput.trim()} onClick={() => { change((d) => ({ ...d, code: codeInput.trim() })); setCodeInput(''); }} className={`${btn} h-14 w-full rounded-2xl bg-blue-600 text-base font-bold disabled:opacity-40`}>Salvar código</button>
      </div>
    );
  }

  const dayLabel = (date: string, i: number) => formatDateKey(date) || `dia ${i + 1}`;

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

      <button disabled={!ready || busy} onClick={calculate} className={`${btn} flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-lg font-black uppercase tracking-wide shadow-lg shadow-blue-600/30 disabled:opacity-40`}>
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" />Calculando...</> : many ? `Calcular ${draft.days.length} dias` : 'Calcular'}
      </button>

      {result && summary && (
        <>
          {summary.days.map((day, d) => (
            <div key={d} className={card}>
              <span className={heading}>{many ? `Dia ${dayLabel(day.date, d)} · trechos usados` : 'Trechos usados'}</span>
              <ul className="divide-y divide-white/10">
                {day.legs.map((leg, i) => {
                  const key = legKey(d, i);
                  return (
                    <li key={key} className="py-2.5 text-[15px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0">{leg.from} → {leg.to}</span>
                        {editing?.key === key ? (
                          <span className="flex shrink-0 items-center gap-1.5">
                            <input
                              autoFocus value={editing.value} inputMode="decimal" aria-label={`Km do trecho ${leg.from} para ${leg.to}`}
                              onChange={(e) => setEditing({ key, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveKm(); if (e.key === 'Escape') setEditing(null); }}
                              className="h-11 w-20 rounded-xl border border-blue-400 bg-[#070B14] px-3 text-right text-base font-bold text-white focus:outline-none"
                            />
                            <button onClick={saveKm} disabled={parseKm(editing.value) === null} className={`${btn} h-11 rounded-xl bg-blue-600 px-3 text-sm font-bold disabled:opacity-40`}>OK</button>
                            <button onClick={() => setEditing(null)} aria-label="Cancelar ajuste" className={`${btn} flex h-11 w-9 items-center justify-center rounded-xl text-white/50`}><X className="h-4 w-4" /></button>
                          </span>
                        ) : (
                          <button onClick={() => setEditing({ key, value: String(leg.km).replace('.', ',') })} aria-label={`Ajustar km de ${leg.from} para ${leg.to}${many ? ` no dia ${d + 1}` : ''}`} className={`${btn} flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-bold tabular-nums ${leg.adjusted ? 'bg-amber-400/15 text-amber-200' : 'text-white'}`}>
                            {formatKm(leg.km)}<Pencil className="h-3.5 w-3.5 text-white/40" />
                          </button>
                        )}
                      </div>
                      {leg.adjusted && editing?.key !== key && (
                        <p className="mt-1 flex items-center justify-end gap-2 text-xs text-amber-200">
                          Ajustado (mapa: {formatKm(result.days[d].legs[i].km)})
                          <button onClick={() => restoreKm(key)} className={`${btn} inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 font-semibold text-white/70`}><Undo2 className="h-3 w-3" />Restaurar</button>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 border-t border-white/10 pt-3 text-right text-lg font-black tabular-nums">{many ? 'Subtotal' : 'Total'}: {formatKm(day.totalKm)}</p>
              {d === summary.days.length - 1 && <p className="mt-1 text-xs text-white/40">Se o trajeto real foi outro, toque no km do trecho para corrigir. O texto do WhatsApp avisa que foi ajustado.</p>}
            </div>
          ))}

          {result.days.some((day) => day.resolved.length > 0) && (
            <div className={card}>
              <span className={heading}>Endereços entendidos pelo mapa</span>
              <div className="space-y-4">
                {result.days.map((day, d) => day.resolved.length > 0 && (
                  <div key={d}>
                    {many && <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-300">Dia {dayLabel(day.date, d)}</p>}
                    <ul className="space-y-3">
                      {day.resolved.map((point) => (
                        <li key={point.label} className="text-[15px]">
                          <p className="font-bold">{point.label}{!point.precise && <span className="ml-2 text-amber-300">⚠ confira</span>}</p>
                          <p className="text-white/70">{point.address}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
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
              {many && <p className="text-white/60">{summary.days.length} dias · {summary.eventCount} eventos · {formatKm(summary.totalKm)} no total</p>}
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
        <button onClick={() => { if (window.confirm('Limpar os dias e eventos para um novo cálculo?')) change((d) => ({ ...emptyDraft(), code: d.code, kmRate: d.kmRate, eventFee: d.eventFee })); }} className={smallBtn}>Novo cálculo</button>
        <button onClick={() => change((d) => ({ ...d, code: '' }))} className={smallBtn}>Trocar código</button>
      </div>
    </div>
  );
};
