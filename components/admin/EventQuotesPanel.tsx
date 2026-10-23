import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, ChevronLeft, ChevronRight, Copy, Loader2, MessageCircle, Save, Settings2 } from 'lucide-react';
import { dateKey } from '../../functions/missions-core.js';
import { daysBetween, eventsOnDay, shiftDate, visibleRange } from '../../services/calendarEvents.js';
import { useCalendarEvents, type CalendarEvent } from '../../services/calendarService';
import { EventScheduleCheck } from './EventScheduleCheck';
import { DEFAULT_QUOTE_CONFIG, PACKAGES, formatBrl, quoteMessage, type QuoteConfig } from '../../services/eventQuote.js';
import { FORM_PATH } from '../../services/eventSiteForm.js';
import { calculateEventQuote, saveEventQuote, type QuoteCalculation } from '../../services/eventQuoteService';
import { getEventFormConfig, getEventQuoteConfig, saveEventQuoteConfig } from '../../services/siteConfigService';
import type { EventPackage } from '../../services/eventQuote.js';
import { ErrorNote, cardClass, ghostButton, inputClass, labelClass, primaryButton } from './missionsUi';
import { fmt } from './ordersFlow/CalendarViews';

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Calendário → Orçamentos. Grade do mês com os compromissos da agenda (para ver se a data está livre) e o extra de cada data.
 * Clicou no dia: define o extra da data e calcula o orçamento (endereço → rota casa → evento no servidor → regras).
 * "Salvar e copiar" guarda o orçamento e copia a mensagem com o link do formulário já preenchido (pacote, data, endereço e valor).
 */
export const EventQuotesPanel: React.FC = () => {
  const today = dateKey(new Date());
  const [selected, setSelected] = useState(today);
  const [config, setConfig] = useState<QuoteConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [showRules, setShowRules] = useState(false);
  // Nomes e itens dos pacotes como estão na aba Formulário (a mensagem do orçamento usa os mesmos textos do site).
  const [packages, setPackages] = useState<EventPackage[]>(PACKAGES);
  const range = useMemo(() => visibleRange('month', selected), [selected]);
  const { state } = useCalendarEvents(range.from, range.to);
  const events = state.status === 'ready' ? state.events : [];

  useEffect(() => { getEventFormConfig().then((form) => setPackages(form.packages), () => undefined); }, []);
  useEffect(() => { getEventQuoteConfig().then(setConfig, (e) => setConfigError(e instanceof Error ? e.message : 'Não foi possível carregar as regras.')); }, []);

  const persist = async (next: QuoteConfig) => {
    setConfigError('');
    try { await saveEventQuoteConfig(next); setConfig(next); } catch (e) { setConfigError(e instanceof Error ? e.message : 'Não foi possível salvar.'); throw e; }
  };

  return (
    <div className="space-y-4">
      {configError && <ErrorNote message={configError} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setSelected(shiftDate('month', selected, -1))} className={ghostButton} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setSelected(today)} className={ghostButton}>Hoje</button>
          <button type="button" onClick={() => setSelected(shiftDate('month', selected, 1))} className={ghostButton} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
          <h3 className="ml-2 text-base font-bold capitalize text-white">{fmt(selected, { month: 'long', year: 'numeric' })}</h3>
        </div>
        <button type="button" onClick={() => setShowRules((v) => !v)} aria-expanded={showRules} className={ghostButton}><Settings2 className="h-3.5 w-3.5" />Regras de preço</button>
      </div>

      {showRules && config && <RulesForm config={config} onSave={persist} />}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
        <div className="grid grid-cols-7 border-b border-white/10 text-center text-[11px] font-semibold uppercase tracking-wider text-white/45">
          {WEEKDAY_SHORT.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {daysBetween(range.from, range.to).map((key) => {
            const count = eventsOnDay(events, key).length;
            const extra = config?.dateExtras[key];
            const past = key < today;
            return (
              <button key={key} type="button" onClick={() => setSelected(key)} aria-pressed={key === selected}
                aria-label={`${fmt(key, { day: 'numeric', month: 'long' })}: ${count} compromissos${extra ? `, extra de ${formatBrl(extra)}` : ''}`}
                className={`flex min-h-[4.25rem] flex-col items-start gap-1 border-b border-r border-white/5 p-1.5 text-left transition-colors hover:bg-white/5 sm:min-h-[5.5rem] ${key === selected ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-400/60' : ''} ${key.startsWith(selected.slice(0, 7)) ? '' : 'opacity-40'} ${past ? 'opacity-50' : ''}`}>
                <span className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-xs font-semibold ${key === today ? 'bg-blue-600 text-white' : 'text-white/70'}`}>{Number(key.slice(8))}</span>
                {count > 0 && <span className="rounded bg-orange-500/20 px-1 text-[10px] font-semibold text-orange-200">{count} na agenda</span>}
                {extra ? <span className="rounded bg-emerald-500/20 px-1 text-[10px] font-semibold text-emerald-200">+{formatBrl(extra)}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {state.status === 'error' && <p className="text-xs text-amber-200">Agenda indisponível agora ({state.message}); o orçamento funciona mesmo assim.</p>}

      {config && <DayQuote key={selected} date={selected} config={config} packages={packages} onSaveConfig={persist} dayEvents={eventsOnDay(events, selected)} />}
    </div>
  );
};

const DayQuote: React.FC<{ date: string; config: QuoteConfig; packages: EventPackage[]; dayEvents: CalendarEvent[]; onSaveConfig: (next: QuoteConfig) => Promise<void> }> = ({ date, config, packages, dayEvents, onSaveConfig }) => {
  const busy = dayEvents.map((e) => `${e.startTime ?? 'dia todo'} · ${e.title}`);
  const [extra, setExtra] = useState(config.dateExtras[date] ? String(config.dateExtras[date]) : '');
  const [packageId, setPackageId] = useState('aniversario');
  const [address, setAddress] = useState('');
  const [companyBase, setCompanyBase] = useState('');
  const [result, setResult] = useState<QuoteCalculation | null>(null);
  const [checked, setChecked] = useState(false);
  const [finalValue, setFinalValue] = useState('');
  const [busyAction, setBusyAction] = useState<'' | 'extra' | 'calc' | 'save'>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const reset = () => { setResult(null); setCopied(''); setChecked(false); };

  const saveExtra = async () => {
    setBusyAction('extra');
    const value = Number(extra.replace(',', '.'));
    const { [date]: _previous, ...others } = config.dateExtras;
    const dateExtras = value > 0 ? { ...others, [date]: value } : others;
    try { await onSaveConfig({ ...config, dateExtras }); reset(); } catch { /* erro mostrado no topo */ }
    setBusyAction('');
  };

  const calculate = async () => {
    setError(''); reset(); setBusyAction('calc');
    try {
      const calc = await calculateEventQuote({ address, date, packageId, companyBase });
      setResult(calc);
      setChecked(calc.address.precise);
      setFinalValue(String(calc.quote.total));
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível calcular.'); }
    setBusyAction('');
  };

  const saveAndCopy = async () => {
    if (!result) return;
    const total = Number(finalValue.replace(',', '.'));
    if (!(total > 0)) { setError('Informe o valor a enviar.'); return; }
    setError(''); setBusyAction('save');
    try {
      const id = await saveEventQuote({ packageId, date, location: result.address.formatted || address, total, km: result.quote.km, city: result.address.city });
      const link = `${window.location.origin}${FORM_PATH}?orcamento=${id}`;
      const text = quoteMessage({ packageId, date, total, link, pack: packages.find((p) => p.id === packageId) });
      await navigator.clipboard.writeText(text).catch(() => undefined);
      setCopied(text);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o orçamento.'); }
    setBusyAction('');
  };

  const q = result?.quote;
  const rows: [string, number][] = q ? [
    [`Cachê da empresa (pacote${q.dateExtra ? ' + extra da data' : ''}${q.tier ? ' + faixa de distância' : ''})`, q.companyFee],
    ['Cachê do agente', q.agentFee],
    [`Deslocamento (${q.km.toLocaleString('pt-BR')} km × ${config.kmMultiplier})`, q.travel],
  ] : [];

  return (
    <section className={`${cardClass} space-y-4`} aria-label="Orçamento do dia">
      <h3 className="text-sm font-bold capitalize text-white">{fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      {busy.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-orange-400/20 bg-orange-500/5 p-3 text-xs text-orange-100">
          {busy.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className={`${labelClass} w-40`}>Extra desta data (R$)<input inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} className={inputClass} placeholder="0" /></label>
        <button type="button" onClick={saveExtra} disabled={busyAction !== ''} className={ghostButton}>{busyAction === 'extra' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Salvar extra</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Pacote
          <select value={packageId} onChange={(e) => { setPackageId(e.target.value); reset(); }} className={inputClass}>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        {packageId === 'vip' && <label className={labelClass}>Cachê da empresa (R$, pelo tempo)<input inputMode="decimal" value={companyBase} onChange={(e) => { setCompanyBase(e.target.value); reset(); }} className={inputClass} /></label>}
        <label className={`${labelClass} sm:col-span-2`}>Endereço que o cliente passou
          <input value={address} onChange={(e) => { setAddress(e.target.value); reset(); }} className={inputClass} placeholder="Rua, número, bairro, cidade" />
        </label>
      </div>
      <EventScheduleCheck dayEvents={dayEvents} address={address} />
      <button type="button" onClick={calculate} disabled={busyAction !== '' || address.trim().length < 5} className={primaryButton}>
        {busyAction === 'calc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}Calcular
      </button>
      {error && <ErrorNote message={error} />}

      {q && result && (
        <div className="space-y-3">
          <p className="text-xs text-white/60">Endereço entendido: <strong className="text-white/85">{result.address.formatted}</strong>{result.address.city ? ` · ${result.address.city}` : ''}</p>
          {!result.address.precise && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
              <span><AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden />O Google não achou o número exato. Conferi o endereço acima e quero usar este valor.</span>
            </label>
          )}
          {checked && (
            <>
              <table className="w-full text-xs text-white/75">
                <tbody>
                  {rows.map(([label, value]) => <tr key={label} className="border-b border-white/5"><td className="py-1.5 pr-2">{label}</td><td className="py-1.5 text-right tabular-nums">{formatBrl(value)}</td></tr>)}
                  <tr className="border-b border-white/5"><td className="py-1.5">Soma</td><td className="py-1.5 text-right tabular-nums">{formatBrl(q.subtotal)}</td></tr>
                  <tr className="border-b border-white/5"><td className="py-1.5">Arredondado (47/97)</td><td className="py-1.5 text-right tabular-nums">{formatBrl(q.rounded)}</td></tr>
                  {q.minimum > 0 && <tr className="border-b border-white/5"><td className="py-1.5">Mínimo de {q.minimumCity}</td><td className="py-1.5 text-right tabular-nums">{formatBrl(q.minimum)}</td></tr>}
                  <tr><td className="py-2 font-bold text-white">Total</td><td className="py-2 text-right text-base font-extrabold tabular-nums text-emerald-300">{formatBrl(q.total)}</td></tr>
                </tbody>
              </table>
              <div className="flex flex-wrap items-end gap-2">
                <label className={`${labelClass} w-40`}>Valor a enviar (R$)<input inputMode="decimal" value={finalValue} onChange={(e) => { setFinalValue(e.target.value); setCopied(''); }} className={inputClass} /></label>
                <button type="button" onClick={saveAndCopy} disabled={busyAction !== ''} className={primaryButton}>
                  {busyAction === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}Salvar e copiar mensagem
                </button>
              </div>
            </>
          )}
          {copied && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-emerald-300">Mensagem copiada. O link abre o formulário já com pacote, data, endereço e valor.</p>
              <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-[#070B14] p-3 text-xs text-white/80">{copied}</pre>
              <a href={`https://wa.me/?text=${encodeURIComponent(copied)}`} target="_blank" rel="noopener noreferrer" className={ghostButton}><MessageCircle className="h-3.5 w-3.5" />Abrir no WhatsApp</a>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

/** "Cidade = valor" por linha ↔ tabela de mínimos. */
const toLines = (table: Record<string, number>) => Object.entries(table).map(([city, value]) => `${city} = ${value}`).join('\n');
const fromLines = (text: string) => Object.fromEntries(text.split('\n').map((line) => line.split('=')).filter((p) => p.length === 2 && p[0].trim() && Number(p[1]) > 0).map(([city, value]) => [city.trim(), Number(value)]));

const RulesForm: React.FC<{ config: QuoteConfig; onSave: (next: QuoteConfig) => Promise<void> }> = ({ config, onSave }) => {
  const [draft, setDraft] = useState(() => ({
    aniversario: String(config.bases.aniversario), visita: String(config.bases.visita), agentFee: String(config.agentFee), kmMultiplier: String(config.kmMultiplier),
    tierKm: String(config.tierKm), tierFee: String(config.tierFee),
    minimums: Object.fromEntries(PACKAGES.map(({ id }) => [id, toLines(config.minimums[id] ?? {})])) as Record<string, string>,
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const field = (key: keyof typeof draft, label: string) => (
    <label className={labelClass}>{label}<input inputMode="decimal" value={draft[key] as string} onChange={(e) => { setDraft({ ...draft, [key]: e.target.value }); setSaved(false); }} className={inputClass} /></label>
  );
  const n = (value: string) => Number(value.replace(',', '.'));
  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        ...config, bases: { aniversario: n(draft.aniversario), visita: n(draft.visita) }, agentFee: n(draft.agentFee), kmMultiplier: n(draft.kmMultiplier),
        tierKm: n(draft.tierKm), tierFee: n(draft.tierFee), minimums: Object.fromEntries(PACKAGES.map(({ id }) => [id, fromLines(draft.minimums[id] ?? '')])),
      });
      setSaved(true);
    } catch { /* erro mostrado no topo */ }
    setSaving(false);
  };
  return (
    <section className={`${cardClass} space-y-3`} aria-label="Regras de preço">
      <p className="text-xs text-white/55">Total = cachê da empresa (pacote + extra da data + faixa de distância) + cachê do agente + km de ida × multiplicador. Arredonda para terminar em 47/97 e respeita o mínimo da cidade.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {field('aniversario', 'Aniversário Espetacular (R$)')}
        {field('visita', 'Visita Espetacular (R$)')}
        {field('agentFee', 'Cachê do agente (R$)')}
        {field('kmMultiplier', 'Multiplicador por km de ida')}
        {field('tierKm', 'Faixa de distância (km)')}
        {field('tierFee', 'Valor por faixa (R$)')}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PACKAGES.map((p) => (
          <label key={p.id} className={labelClass}>Mínimo por cidade · {p.title}
            <textarea rows={3} value={draft.minimums[p.id]} onChange={(e) => { setDraft({ ...draft, minimums: { ...draft.minimums, [p.id]: e.target.value } }); setSaved(false); }} className={inputClass} placeholder="Cidade = valor" />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving} className={primaryButton}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar regras</button>
        <button type="button" onClick={() => setDraft({ ...draft, ...{ aniversario: '450', visita: '300', agentFee: '115', kmMultiplier: '4', tierKm: '15', tierFee: '50' }, minimums: Object.fromEntries(PACKAGES.map(({ id }) => [id, toLines(DEFAULT_QUOTE_CONFIG.minimums[id] ?? {})])) })} className={ghostButton}>Restaurar padrão</button>
        {saved && <span className="text-xs text-emerald-300">Salvo.</span>}
      </div>
    </section>
  );
};

