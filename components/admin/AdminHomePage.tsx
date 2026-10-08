import { logger } from '../../lib/logger.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarDays, Camera, ChevronDown, ChevronUp, RotateCcw, CheckCircle2, Circle, ClipboardList, Loader2, RefreshCw, Target, Wallet, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../lib/router';
import { subscribeCompletedOrders } from '../../services/financeService';
import { subscribeActiveOrders } from '../../services/ordersService';
import { listMissions, listOccurrencesSince, runClientSync, type Mission, type TaskOccurrence } from '../../services/missionsService';
import { getClientById } from '../../services/clientsService';
import { getServiceById } from '../../services/servicesService';
import { buildRevenueEntries, dailyRevenue, monthKeyOf } from '../../services/financeCalculations.js';
import { deliveriesToday, tasksToday } from '../../services/homeToday.js';
import { dateKey } from '../../functions/missions-core.js';
import { formatOrderReference } from '../../services/orderReference.js';
import type { Client, Order, Service } from '../../types';
import { formatMoney } from './financeFormat';
import { subscribeInstagramProfile, type InstagramProfile } from '../../services/instagramService';
import { DeltaText } from './AdminInstagramPage';
import { useCalendarEvents } from '../../services/calendarService';
import { eventsOnDay } from '../../services/calendarEvents.js';
import { DayAgenda } from './CalendarAgenda';
import { resolveNavOrder, shiftNavItem } from '../../services/adminNav.js';

type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/** Reavalia "hoje" a cada minuto (a página pode ficar aberta na virada do dia). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Troca o "agora" na virada do dia de Brasília (missões e pedidos) ou do dia local do navegador (Financeiro).
    const timer = window.setInterval(() => setNow((current) => {
      const next = new Date();
      return dateKey(current) === dateKey(next) && current.toDateString() === next.toDateString() ? current : next;
    }), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const Widget: React.FC<{
  title: string; subtitle: string; icon: React.ElementType; tone: string; onOpen: () => void; openLabel: string; children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, tone, onOpen, openLabel, children }) => (
  <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#0D1527] p-5 shadow-lg" aria-label={title}>
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-white/45">{subtitle}</p>
      </div>
      <div className={`shrink-0 rounded-xl p-2 ${tone}`}><Icon className="h-4 w-4" aria-hidden /></div>
    </header>
    <div className="flex-1">{children}</div>
    <button type="button" onClick={onOpen} className="mt-4 flex items-center gap-1 self-start text-xs font-semibold text-blue-400 transition-colors hover:text-blue-300">
      {openLabel}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </button>
  </section>
);

const Loading = () => <div className="flex items-center gap-2 py-6 text-xs text-white/50"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</div>;
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="py-6 text-sm text-white/45">{children}</p>;
const ErrorState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-start gap-2 py-4 text-xs text-red-300">
    <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden />Não foi possível carregar este widget.</span>
    {onRetry && <button type="button" onClick={onRetry} className="flex items-center gap-1 font-semibold text-red-200 hover:text-white"><RefreshCw className="h-3 w-3" aria-hidden />Tentar de novo</button>}
  </div>
);

// ------------------------------------------------------------------ Financeiro

const FinanceWidget: React.FC<{ now: Date; onOpen: () => void }> = ({ now, onOpen }) => {
  const [state, setState] = useState<Load<Order[]>>({ status: 'loading' });
  useEffect(() => subscribeCompletedOrders(
    (orders) => setState({ status: 'ready', data: orders }),
    () => setState({ status: 'error' }),
  ), []);

  const today = useMemo(() => {
    if (state.status !== 'ready') return null;
    // Mesma regra do módulo Financeiro: pedidos concluídos, agrupados pela data de conclusão.
    const days = dailyRevenue(buildRevenueEntries(state.data).entries, monthKeyOf(now));
    return days[now.getDate() - 1];
  }, [state, now]);

  return (
    <Widget title="Faturamento do dia" subtitle="Valor dos serviços concluídos hoje (pagos ou não). Não é dinheiro recebido." icon={Wallet} tone="bg-amber-500/10 text-amber-300" onOpen={onOpen} openLabel="Abrir Financeiro">
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorState />}
      {today && (
        <div className="py-2">
          <p className="text-3xl font-extrabold tabular-nums tracking-tight text-white">{formatMoney(today.total)}</p>
          <p className="mt-1 text-xs text-white/55">{today.count === 0 ? 'Nenhum serviço concluído hoje.' : `${today.count} ${today.count === 1 ? 'serviço concluído' : 'serviços concluídos'} hoje`}</p>
        </div>
      )}
    </Widget>
  );
};

// -------------------------------------------------------------------- Missões

/**
 * Uma sincronização por dia de Brasília e por sessão, compartilhada por todas as montagens do widget: a leitura das ocorrências
 * espera a mesma promessa (sem corrida com o sino do topo; runClientSync reaproveita a execução em andamento).
 */
let syncDay: string | null = null;
let syncPromise: Promise<unknown> = Promise.resolve();
function syncFor(day: string): Promise<unknown> {
  if (syncDay !== day) { syncDay = day; syncPromise = runClientSync().catch(() => undefined); }
  return syncPromise;
}

const TasksWidget: React.FC<{ now: Date; onOpen: () => void }> = ({ now, onOpen }) => {
  const [state, setState] = useState<Load<{ occurrences: TaskOccurrence[]; missions: Mission[] }>>({ status: 'loading' });
  const today = dateKey(now);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      await syncFor(today);
      const [occurrences, missions] = await Promise.all([listOccurrencesSince(today), listMissions()]);
      // Defensivo: uma missão nunca aparece duas vezes, mesmo que as consultas de pendentes e histórico se sobreponham.
      const unique = [...new Map([...missions.pending, ...missions.history].map((mission) => [mission.id, mission])).values()];
      if (alive.current) setState({ status: 'ready', data: { occurrences, missions: unique } });
    } catch (error) {
      logger.error('[AdminHomePage] tarefas de hoje indisponíveis', error);
      if (alive.current) setState({ status: 'error' });
    }
  }, [today]);
  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => (state.status === 'ready' ? tasksToday(state.data.occurrences, state.data.missions, now) : null), [state, now]);

  return (
    <Widget title="Tarefas de hoje" subtitle="Tarefas recorrentes e missões com prazo para hoje." icon={Target} tone="bg-violet-500/10 text-violet-300" onOpen={onOpen} openLabel="Abrir Missões">
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorState onRetry={() => void load()} />}
      {summary && (summary.items.length === 0 ? <Empty>Nada previsto para hoje.</Empty> : (
        <>
          <p className="mb-3 text-xs text-white/55">
            <span className="font-semibold text-emerald-300">{summary.completed} {summary.completed === 1 ? 'concluída' : 'concluídas'}</span>
            {' · '}<span className="font-semibold text-white/80">{summary.pending} {summary.pending === 1 ? 'pendente' : 'pendentes'}</span>
            {summary.missed > 0 && <>{' · '}<span className="font-semibold text-red-300">{summary.missed} {summary.missed === 1 ? 'perdida' : 'perdidas'}</span></>}
          </p>
          <ul className="space-y-1.5">
            {summary.items.slice(0, 6).map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                {item.status === 'completed' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Concluída" />
                  : item.status === 'missed' ? <XCircle className="h-4 w-4 shrink-0 text-red-400" aria-label="Perdida" />
                  : <Circle className="h-4 w-4 shrink-0 text-white/35" aria-label="Pendente" />}
                <span className={`min-w-0 flex-1 truncate ${item.status === 'completed' ? 'text-white/40 line-through' : 'text-white/85'}`}>{item.title}</span>
                {item.time && <span className="shrink-0 text-[11px] tabular-nums text-white/40">{item.time}</span>}
              </li>
            ))}
          </ul>
          {summary.items.length > 6 && <p className="mt-2 text-[11px] text-white/40">+ {summary.items.length - 6} no módulo Missões</p>}
        </>
      ))}
    </Widget>
  );
};

// --------------------------------------------------------------------- Pedidos

// Etapas do Kanban (mesmos nomes de AdminOrdersPage). Só "Entregar" está pronto; as anteriores ainda precisam de atenção.
const STAGE_LABELS: Record<string, string> = { scheduled: 'Agendado', recording: 'Gravar', editing: 'Editar', delivery: 'Pronto para entregar' };

const DeliveriesWidget: React.FC<{ now: Date; onOpenOrder: (id: string) => void; onOpen: () => void }> = ({ now, onOpenOrder, onOpen }) => {
  const [state, setState] = useState<Load<Order[]>>({ status: 'loading' });
  const [names, setNames] = useState<{ clients: Map<string, Client | null>; services: Map<string, Service | null> }>({ clients: new Map(), services: new Map() });
  useEffect(() => subscribeActiveOrders(
    (orders) => setState({ status: 'ready', data: orders }),
    () => setState({ status: 'error' }),
  ), []);

  const rows = useMemo<{ order: Order; attention: boolean }[]>(() => (state.status === 'ready' ? deliveriesToday(state.data, now) : []), [state, now]);
  const lookupKey = rows.map(({ order }) => `${order.clientId}|${order.serviceId}`).join();
  useEffect(() => {
    // Só busca nome/serviço dos pedidos de hoje que ainda não foram buscados.
    const missingClients: string[] = Array.from(new Set<string>(rows.map(({ order }) => order.clientId))).filter((id) => !!id && !names.clients.has(id));
    const missingServices: string[] = Array.from(new Set<string>(rows.map(({ order }) => order.serviceId))).filter((id) => !!id && !names.services.has(id));
    if (!missingClients.length && !missingServices.length) return;
    let cancelled = false;
    void Promise.all([
      Promise.all(missingClients.map((id) => getClientById(id).catch(() => null))),
      Promise.all(missingServices.map((id) => getServiceById(id).catch(() => null))),
    ]).then(([clients, services]) => {
      if (cancelled) return;
      setNames((current) => ({
        clients: new Map([...current.clients, ...missingClients.map((id, i) => [id, clients[i]] as const)]),
        services: new Map([...current.services, ...missingServices.map((id, i) => [id, services[i]] as const)]),
      }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey]);

  const attentionCount = rows.filter((row) => row.attention).length;
  const reference = (order: Order): string => formatOrderReference(order, state.status === 'ready' ? state.data : []);

  return (
    <Widget title="Entregas de hoje" subtitle="Pedidos em andamento com prazo de entrega ao cliente hoje. Em amarelo: ainda não estão em Entregar." icon={ClipboardList} tone="bg-emerald-500/10 text-emerald-300" onOpen={onOpen} openLabel="Abrir Pedidos">
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorState />}
      {state.status === 'ready' && (rows.length === 0 ? <Empty>Nenhuma entrega prevista para hoje.</Empty> : (
        <>
          <p className="mb-3 text-xs text-white/55">
            {rows.length} {rows.length === 1 ? 'entrega' : 'entregas'}
            {attentionCount > 0 && <> · <span className="font-semibold text-amber-300">{attentionCount} {attentionCount === 1 ? 'precisa de atenção' : 'precisam de atenção'}</span></>}
          </p>
          <ul className="space-y-2">
            {rows.slice(0, 5).map(({ order, attention }) => {
              const client = names.clients.get(order.clientId);
              const service = names.services.get(order.serviceId);
              return (
                <li key={order.id}>
                  <button type="button" onClick={() => onOpenOrder(order.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-white/5 ${attention ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10'}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-white">{client?.name ?? 'Cliente'}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${attention ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
                        {STAGE_LABELS[order.status] ?? order.status}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/50">{service?.title ?? 'Serviço'} · Pedido {reference(order)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {rows.length > 5 && <p className="mt-2 text-[11px] text-white/40">+ {rows.length - 5} no Kanban</p>}
        </>
      ))}
    </Widget>
  );
};

// ------------------------------------------------------------------- Instagram

/** Só visualiza o que a sincronização já calculou e gravou (instagramMeta/profile); nenhuma chamada à Meta e nenhuma regra de saldo aqui. */
const InstagramWidget: React.FC<{ now: Date; onOpen: () => void }> = ({ now, onOpen }) => {
  const [state, setState] = useState<Load<InstagramProfile | null>>({ status: 'loading' });
  useEffect(() => subscribeInstagramProfile(
    (profile) => setState({ status: 'ready', data: profile }),
    () => setState({ status: 'error' }),
  ), []);
  const profile = state.status === 'ready' ? state.data : null;

  return (
    <Widget title="Instagram" subtitle="Seguidores do perfil e o saldo do dia (desde a 1ª sincronização de hoje)." icon={Camera} tone="bg-pink-500/10 text-pink-300" onOpen={onOpen} openLabel="Abrir Instagram">
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorState />}
      {state.status === 'ready' && !profile && <Empty>Nenhum dado ainda. Sincronize em Instagram.</Empty>}
      {profile && (
        <div className="py-2">
          {profile.username && <p className="text-sm font-semibold text-white/80">@{profile.username}</p>}
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-white">
            {profile.followers == null ? 'Indisponível' : new Intl.NumberFormat('pt-BR').format(profile.followers)}
            {profile.followers != null && <span className="ml-2 text-sm font-semibold text-white/50">seguidores</span>}
          </p>
          <DeltaText daily={profile.daily} metric="followers" today={dateKey(now)} className="mt-1" />
        </div>
      )}
    </Widget>
  );
};

// ------------------------------------------------------------------ Compromissos

/** Compromissos do dia do Google Agenda (mesma lógica do destaque do Calendário; cache de 2 min evita chamadas a cada visita). */
const AppointmentsWidget: React.FC<{ now: Date; onOpen: (query?: string) => void }> = ({ now, onOpen }) => {
  const today = dateKey(now);
  const { state, reload } = useCalendarEvents(today, today);
  const count = state.status === 'ready' ? eventsOnDay(state.events, today).length : null;
  return (
    <Widget title="Compromissos de hoje" subtitle={count === null ? 'Eventos do Google Agenda para hoje.' : `${count} ${count === 1 ? 'compromisso' : 'compromissos'} no Google Agenda hoje.`} icon={CalendarDays} tone="bg-orange-500/10 text-orange-300" onOpen={() => onOpen()} openLabel="Abrir Calendário">
      <DayAgenda state={state} dayKey={today} emptyText="Nenhum compromisso para hoje" limit={5} onRetry={reload}
        onOpen={(event) => onOpen(`date=${today}&event=${encodeURIComponent(event.id)}`)} />
    </Widget>
  );
};

// ------------------------------------------------------------------------ página

const WIDGET_IDS = ['appointments', 'finance', 'tasks', 'instagram', 'deliveries'] as const;
type WidgetId = (typeof WIDGET_IDS)[number];

/** Ordem dos widgets por administrador (uid), salva neste navegador; ids desconhecidos são ignorados e widgets novos entram no fim. */
function useWidgetOrder(uid: string | undefined) {
  const key = `hdc.admin.homeWidgets.${uid ?? 'anon'}`;
  const read = (): unknown => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
  const [saved, setSaved] = useState<unknown>(read);
  useEffect(() => { setSaved(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(() => resolveNavOrder(WIDGET_IDS, saved) as WidgetId[], [saved]);
  const persist = (next: WidgetId[] | null) => {
    setSaved(next);
    try { if (next) localStorage.setItem(key, JSON.stringify(next)); else localStorage.removeItem(key); } catch { /* vale só nesta sessão */ }
  };
  return { order, customized: saved != null, setOrder: persist };
}

export const AdminHomePage: React.FC<{ onNavigate: (tab: 'finance' | 'missions' | 'orders' | 'instagram' | 'calendar') => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const now = useNow();
  const { order, customized, setOrder } = useWidgetOrder(user?.uid);
  const [editing, setEditing] = useState(false);
  const name = user?.displayName || user?.email?.split('@')[0] || 'Administrador';
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(now);

  const widgets: Record<WidgetId, { label: string; node: React.ReactNode }> = {
    appointments: { label: 'Compromissos', node: <AppointmentsWidget now={now} onOpen={(query) => (query ? navigate(`/admin/calendario?${query}`) : onNavigate('calendar'))} /> },
    finance: { label: 'Faturamento', node: <FinanceWidget now={now} onOpen={() => onNavigate('finance')} /> },
    tasks: { label: 'Tarefas', node: <TasksWidget now={now} onOpen={() => onNavigate('missions')} /> },
    instagram: { label: 'Instagram', node: <InstagramWidget now={now} onOpen={() => onNavigate('instagram')} /> },
    deliveries: { label: 'Entregas', node: <DeliveriesWidget now={now} onOpen={() => onNavigate('orders')} onOpenOrder={(id) => navigate(`/admin/pedidos?orderId=${encodeURIComponent(id)}`)} /> },
  };
  const arrow = 'flex h-7 w-7 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Principal</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Olá, {name}!</h2>
          <p className="mt-1 text-sm capitalize text-white/50">{dateLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editing && customized && (
            <button type="button" onClick={() => setOrder(null)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-white/50 hover:bg-white/5 hover:text-white/80"><RotateCcw className="h-3 w-3" aria-hidden />Restaurar padrão</button>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} aria-pressed={editing}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${editing ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
            {editing ? 'Concluir' : 'Reorganizar'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {order.map((id, index) => (
          <div key={id} className={`relative ${editing ? 'rounded-2xl ring-2 ring-blue-500/50' : ''}`}>
            {widgets[id].node}
            {editing && (
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between rounded-t-2xl bg-blue-600/90 px-3 py-1" role="group" aria-label={`Mover ${widgets[id].label}`}>
                <span className="text-[11px] font-bold text-white">{widgets[id].label}</span>
                <span className="flex gap-1">
                  <button type="button" className={arrow} disabled={index === 0} aria-label={`Mover ${widgets[id].label} para antes`} onClick={() => setOrder(shiftNavItem(order, id, -1) as WidgetId[])}><ChevronUp className="h-4 w-4" aria-hidden /></button>
                  <button type="button" className={arrow} disabled={index === order.length - 1} aria-label={`Mover ${widgets[id].label} para depois`} onClick={() => setOrder(shiftNavItem(order, id, 1) as WidgetId[])}><ChevronDown className="h-4 w-4" aria-hidden /></button>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
