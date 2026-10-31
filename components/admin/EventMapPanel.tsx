import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Loader2, MapPin } from 'lucide-react';
import type { Order } from '../../types';
import { listOrders } from '../../services/ordersService';
import { geocodeEvents } from '../../services/eventQuoteService';
import { listEventHistory, saveHistoryEvent, type HistoryEvent } from '../../services/eventHistoryService';
import { readPdfText } from '../../services/pdfImportBrowser';
import { parseGoogleEventForm } from '../../services/eventFormImport.js';
import { eventKey, groupPlaces } from '../../services/eventMap.js';
import { dateKey } from '../../functions/missions-core.js';
import { toDate } from './orders/orderView';
import { ErrorNote, WarningNote, cardClass, ghostButton } from './missionsUi';

const QuoteMap = lazy(() => import('./QuoteMap'));

type Source = 'orders' | 'history';
/** Um evento na aba: pedido do CRM ou evento antigo importado do PDF do Google (eventHistory). */
interface MapEvent { source: Source; id: string; date: Date | null; time: string; name: string; location: string; geo?: Order['eventGeo']; completed: boolean }

const fromOrder = (o: Order): MapEvent => ({
  source: 'orders', id: o.id, date: toDate(o.eventDate), time: o.eventForm?.eventTime ?? '', name: o.childName || o.eventForm?.formType || o.content || 'Evento',
  location: (o.eventForm?.location ?? '').trim().slice(0, 300), geo: o.eventGeo, completed: o.status === 'completed',
});

const fromHistory = (h: HistoryEvent): MapEvent => {
  const [y, m, d] = h.eventDate.split('-').map(Number);
  return { source: 'history', id: h.id, date: y ? new Date(y, m - 1, d) : null, time: h.eventTime, name: h.childName || 'Evento', location: h.location.trim().slice(0, 300), geo: h.eventGeo, completed: true };
};

const needsGeo = (e: MapEvent) => e.location.length >= 5 && e.geo?.address !== e.location;
const keyOf = (e: MapEvent) => (e.date ? eventKey(dateKey(e.date), e.name) : '');

/**
 * Calendário → Mapa: pedidos de evento (com local) e eventos antigos importados dos PDFs do Google, no mapa da RMBH e na lista abaixo.
 * Locais já visitados aparecem apagados; os com evento marcado, em laranja; o número = quantos eventos no mesmo local.
 * Endereços ainda sem coordenadas são geocodificados uma vez no servidor (25 por chamada) e ficam gravados no documento.
 */
export const EventMapPanel: React.FC = () => {
  const [events, setEvents] = useState<MapEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  /** Geocodifica no servidor os eventos sem coordenadas (ou com local alterado) e atualiza a tela. */
  const locate = async (list: MapEvent[]) => {
    const pending = list.filter(needsGeo);
    try {
      for (const source of ['orders', 'history'] as const) {
        const ids = pending.filter((e) => e.source === source).map((e) => e.id);
        for (let i = 0; i < ids.length && alive.current; i += 25) {
          setLocating(ids.length - i);
          const byId = new Map((await geocodeEvents(ids.slice(i, i + 25), source)).map((r) => [r.id, r.eventGeo]));
          if (alive.current) setEvents((cur) => cur?.map((e) => (e.source === source && byId.has(e.id) ? { ...e, geo: byId.get(e.id) } : e)) ?? cur);
        }
      }
    } catch (e) {
      if (alive.current) setGeoError(`Alguns endereços ainda não foram localizados: ${e instanceof Error ? e.message : 'erro'}`);
    } finally {
      if (alive.current) setLocating(0);
    }
  };

  useEffect(() => {
    alive.current = true;
    (async () => {
      let list: MapEvent[];
      try {
        const [orders, history] = await Promise.all([listOrders(), listEventHistory()]);
        list = [...orders.filter((o) => o.eventForm).map(fromOrder), ...history.map(fromHistory)];
      } catch (e) {
        if (alive.current) setError(e instanceof Error ? e.message : 'Não foi possível carregar os eventos.');
        return;
      }
      if (!alive.current) return;
      setEvents(list);
      await locate(list);
    })();
    return () => { alive.current = false; };
  }, []);

  const { upcoming, past, points } = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const isUpcoming = (e: MapEvent) => (e.date ? e.date.getTime() >= todayStart : !e.completed);
    const all = events ?? [];
    const time = (e: MapEvent) => e.date?.getTime() ?? 0;
    return {
      upcoming: all.filter(isUpcoming).sort((a, b) => time(a) - time(b)),
      past: all.filter((e) => !isUpcoming(e)).sort((a, b) => time(b) - time(a)),
      points: groupPlaces(all.map((e) => ({ lat: e.geo?.lat, lng: e.geo?.lng, label: e.name, upcoming: isUpcoming(e) }))),
    };
  }, [events]);

  const show = (e: MapEvent) => {
    if (e.geo?.lat === undefined || e.geo.lng === undefined) return;
    setFocus({ lat: e.geo.lat, lng: e.geo.lng });
    mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const imported = async (added: MapEvent[]) => {
    setEvents((cur) => [...(cur ?? []).filter((e) => !added.some((a) => a.source === e.source && a.id === e.id)), ...added]);
    await locate(added);
  };

  if (error) return <ErrorNote message={error} />;
  if (!events) return <div className="flex justify-center py-12 text-white/50"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Mapa dos eventos</h2>
          <p className="text-xs text-white/50">
            <span className="text-orange-300">●</span> com evento marcado · <span className="text-slate-400">●</span> onde já estivemos · o número = eventos no mesmo local.
            {' '}{points.length} {points.length === 1 ? 'local' : 'locais'}.
          </p>
        </div>
        <ImportButton existing={events} onImported={imported} />
      </div>
      {locating > 0 && <p className="flex items-center gap-2 text-xs text-white/60"><Loader2 className="h-3.5 w-3.5 animate-spin" />Localizando {locating} {locating === 1 ? 'endereço' : 'endereços'} (só na primeira vez)…</p>}
      <WarningNote message={geoError} />
      <div ref={mapBox}>
        <Suspense fallback={<div className="h-[520px] animate-pulse rounded-xl bg-white/5" />}>
          <QuoteMap points={points} paths={[]} height={520} focus={focus} />
        </Suspense>
      </div>
      <EventList title={`Próximos (${upcoming.length})`} events={upcoming} onShow={show} />
      <EventList title={`Já realizados (${past.length})`} events={past} onShow={show} faded />
    </div>
  );
};

/** Lê um PDF: evento novo (já gravado), já existente como pedido, ou não reconhecido. */
async function importPdf(file: File, orderKeys: Set<string>): Promise<{ added: MapEvent } | { duplicated: string } | { failed: string }> {
  try {
    const parsed = parseGoogleEventForm(await readPdfText(file));
    if (!parsed?.eventDate || !parsed.childName) return { failed: file.name };
    const event: HistoryEvent = { id: eventKey(parsed.eventDate, parsed.childName), childName: parsed.childName, eventDate: parsed.eventDate, eventTime: parsed.eventTime, location: parsed.location };
    if (orderKeys.has(event.id)) return { duplicated: parsed.childName };
    await saveHistoryEvent(event);
    return { added: fromHistory(event) };
  } catch {
    return { failed: file.name };
  }
}

/**
 * Importa PDFs do "Formulário da Missão" (Google Forms) para o histórico. Lê no navegador (nada do PDF vai ao servidor),
 * grava nome, data, horário e endereço em eventHistory. Pula o que já existe como pedido (mesma data + nome); reimportar o mesmo PDF sobrescreve.
 */
const ImportButton: React.FC<{ existing: MapEvent[]; onImported: (added: MapEvent[]) => Promise<void> }> = ({ existing, onImported }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<{ ok: boolean; text: string } | null>(null);

  const handleFiles = async (files: File[]) => {
    const orderKeys = new Set<string>(existing.filter((e) => e.source === 'orders').map(keyOf));
    const added: MapEvent[] = [];
    const duplicated: string[] = [];
    const failed: string[] = [];
    setReport(null);
    for (const [i, file] of files.entries()) {
      setBusy(`Lendo ${i + 1} de ${files.length}…`);
      const result = await importPdf(file, orderKeys);
      if ('added' in result) added.push(result.added);
      else if ('duplicated' in result) duplicated.push(result.duplicated);
      else failed.push(result.failed);
    }
    setBusy(null);
    const parts = [`${added.length} ${added.length === 1 ? 'evento importado' : 'eventos importados'}`];
    if (duplicated.length) parts.push(`${duplicated.length} já ${duplicated.length === 1 ? 'era pedido' : 'eram pedidos'} no CRM`);
    if (failed.length) parts.push(`não reconhecidos (sem data ou nome): ${failed.join(', ')}`);
    setReport({ ok: failed.length === 0, text: `${parts.join(' · ')}.` });
    if (added.length) await onImported(added);
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) void handleFiles(files); }} />
      <button type="button" onClick={() => input.current?.click()} disabled={Boolean(busy)} className={ghostButton} title="PDFs do Formulário da Missão (Google Forms); pode escolher vários">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}{busy ?? 'Importar PDFs do Google'}
      </button>
      {report && <p className={`max-w-xs text-right text-[11px] ${report.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{report.text}</p>}
    </div>
  );
};

const EventList: React.FC<{ title: string; events: MapEvent[]; onShow: (e: MapEvent) => void; faded?: boolean }> = ({ title, events, onShow, faded }) => (
  <section className={cardClass} aria-label={title}>
    <h3 className="mb-3 text-sm font-bold text-white">{title}</h3>
    {events.length === 0 ? <p className="text-sm text-white/50">Nenhum evento.</p> : (
      <ul className="space-y-1.5">
        {events.map((e) => {
          const located = e.geo?.lat !== undefined;
          return (
            <li key={`${e.source}:${e.id}`}>
              <button type="button" onClick={() => onShow(e)} disabled={!located} className={`flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl border border-white/10 px-3 py-2 text-left enabled:hover:bg-white/5 ${faded ? 'opacity-70' : ''}`}>
                <span className="w-20 shrink-0 text-xs tabular-nums text-white/60">{e.date ? e.date.toLocaleDateString('pt-BR') : 'sem data'}</span>
                <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-orange-300">{e.time}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                  {e.name}{e.source === 'history' && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/50">Google</span>}
                </span>
                <span className="flex w-full min-w-0 items-center gap-1 text-xs text-white/50 sm:w-auto sm:max-w-[45%]">
                  <MapPin className={`h-3 w-3 shrink-0 ${located ? 'text-blue-300' : 'text-white/30'}`} aria-hidden />
                  <span className="truncate">{e.location || 'sem local'}{e.geo?.failed ? ' (não encontrado no mapa)' : ''}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
