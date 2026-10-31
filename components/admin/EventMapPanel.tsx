import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import type { Order } from '../../types';
import { listOrders } from '../../services/ordersService';
import { geocodeEvents } from '../../services/eventQuoteService';
import { groupPlaces } from '../../services/eventMap.js';
import { toDate } from './orders/orderView';
import { ErrorNote, WarningNote, cardClass } from './missionsUi';

const QuoteMap = lazy(() => import('./QuoteMap'));

interface MapEvent { id: string; date: Date | null; time: string; name: string; location: string; geo?: Order['eventGeo']; upcoming: boolean }

const locationOf = (o: Order) => (o.eventForm?.location ?? '').trim().slice(0, 300);
const needsGeo = (o: Order) => locationOf(o).length >= 5 && o.eventGeo?.address !== locationOf(o);

const withGeo = (list: Order[] | null, results: { id: string; eventGeo: NonNullable<Order['eventGeo']> }[]) => {
  const byId = new Map(results.map((r) => [r.id, r.eventGeo]));
  return list?.map((o) => (byId.has(o.id) ? { ...o, eventGeo: byId.get(o.id) } : o)) ?? list;
};

const toEvent = (o: Order, todayStart: number): MapEvent => {
  const date = toDate(o.eventDate);
  return {
    id: o.id, date, time: o.eventForm?.eventTime ?? '', name: o.childName || o.eventForm?.formType || o.content || 'Evento',
    location: locationOf(o), geo: o.eventGeo, upcoming: date ? date.getTime() >= todayStart : o.status !== 'completed',
  };
};

/**
 * Calendário → Mapa: todos os pedidos de evento (com local) no mapa da RMBH e a lista abaixo.
 * Locais já visitados aparecem apagados; os com evento marcado, em laranja; o número = quantos eventos no mesmo local.
 * Pedidos ainda sem coordenadas são geocodificados uma vez no servidor (25 por chamada) e ficam gravados no pedido.
 */
export const EventMapPanel: React.FC = () => {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let list: Order[];
      try { list = (await listOrders()).filter((o) => o.eventForm); } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Não foi possível carregar os pedidos.'); return; }
      if (!alive) return;
      setOrders(list);
      const pending = list.filter(needsGeo).map((o) => o.id);
      try {
        for (let i = 0; i < pending.length && alive; i += 25) {
          setLocating(pending.length - i);
          const results = await geocodeEvents(pending.slice(i, i + 25));
          if (alive) setOrders((cur) => withGeo(cur, results));
        }
      } catch (e) {
        if (alive) setGeoError(`Alguns endereços ainda não foram localizados: ${e instanceof Error ? e.message : 'erro'}`);
      } finally {
        if (alive) setLocating(0);
      }
    })();
    return () => { alive = false; };
  }, []);

  const { upcoming, past, points } = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const events = (orders ?? []).map((o) => toEvent(o, todayStart));
    const time = (e: MapEvent) => e.date?.getTime() ?? 0;
    return {
      upcoming: events.filter((e) => e.upcoming).sort((a, b) => time(a) - time(b)),
      past: events.filter((e) => !e.upcoming).sort((a, b) => time(b) - time(a)),
      points: groupPlaces(events.map((e) => ({ lat: e.geo?.lat, lng: e.geo?.lng, label: e.name, upcoming: e.upcoming }))),
    };
  }, [orders]);

  const show = (e: MapEvent) => {
    if (e.geo?.lat === undefined || e.geo.lng === undefined) return;
    setFocus({ lat: e.geo.lat, lng: e.geo.lng });
    mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (error) return <ErrorNote message={error} />;
  if (!orders) return <div className="flex justify-center py-12 text-white/50"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">Mapa dos eventos</h2>
        <p className="text-xs text-white/50">
          <span className="text-orange-300">●</span> com evento marcado · <span className="text-slate-400">●</span> onde já estivemos · o número = eventos no mesmo local.
          {' '}{points.length} {points.length === 1 ? 'local' : 'locais'}.
        </p>
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

const EventList: React.FC<{ title: string; events: MapEvent[]; onShow: (e: MapEvent) => void; faded?: boolean }> = ({ title, events, onShow, faded }) => (
  <section className={cardClass} aria-label={title}>
    <h3 className="mb-3 text-sm font-bold text-white">{title}</h3>
    {events.length === 0 ? <p className="text-sm text-white/50">Nenhum evento.</p> : (
      <ul className="space-y-1.5">
        {events.map((e) => {
          const located = e.geo?.lat !== undefined;
          return (
            <li key={e.id}>
              <button type="button" onClick={() => onShow(e)} disabled={!located} className={`flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl border border-white/10 px-3 py-2 text-left enabled:hover:bg-white/5 ${faded ? 'opacity-70' : ''}`}>
                <span className="w-20 shrink-0 text-xs tabular-nums text-white/60">{e.date ? e.date.toLocaleDateString('pt-BR') : 'sem data'}</span>
                <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-orange-300">{e.time}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{e.name}</span>
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
