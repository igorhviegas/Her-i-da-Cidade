import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Copy, HeartHandshake, Loader2, MessageCircle, Plus, Search, Ticket } from 'lucide-react';
import { addDays, dateKey } from '../../../functions/missions-core.js';
import {
  COLLAB_COMMISSION, EXPIRING_DAYS, FORM_PATH, GRANT_SERVICES, STATUSES, WARNING_LABELS, brDate, commissionSales, couponBoard, couponState, money,
  quotaUsage, statusLabel, weekLabel, weekStartOf, weeklyCommissions, weeklyReportMessage, whatsappLink,
} from '../../../services/collab.js';
import type { CollabGrant, CollabPartner, CollabPayout, CollabStatus } from '../../../services/collab.js';
import {
  deletePartner, grantService, listCollabOrders, listPartners, listPayouts, loadLimits, markWeekPaid, removeGrant, resolveCouponWarning, saveLimits, savePartner,
  type PartnerInput,
} from '../../../services/collabService';
import type { Order } from '../../../types';
import { PartnerModal, fieldClass } from './PartnerModal';

type Tab = 'partners' | 'coupons' | 'commissions' | 'quotas';
const TABS: Array<[Tab, string]> = [['partners', 'Parceiras'], ['coupons', 'Cupons'], ['commissions', 'Comissões'], ['quotas', 'Vagas']];
const cardClass = 'rounded-2xl border border-white/10 bg-white/5 p-4';
const chip = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold';
const STATUS_TONE: Partial<Record<CollabStatus, string>> = { published: 'bg-emerald-500/15 text-emerald-200', cancelled: 'bg-red-500/15 text-red-200', closed: 'bg-white/10 text-white/60', review: 'bg-amber-500/15 text-amber-200' };
const serviceName = (id: string) => GRANT_SERVICES.find((s) => s.serviceId === id)?.label ?? (id === '6' ? 'Serviço presencial' : `Serviço ${id}`);
const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);
const asDate = (value: unknown) => (value instanceof Date ? value : typeof (value as { toDate?: () => Date })?.toDate === 'function' ? (value as { toDate: () => Date }).toDate() : null);

/** Mamães em Collab: fichas das criadoras, validade dos cupons, comissões da semana (relatório + pagamento manual) e vagas de serviços. */
export const AdminCollabPage: React.FC = () => {
  const today = dateKey(new Date());
  const [tab, setTab] = useState<Tab>('partners');
  const [partners, setPartners] = useState<CollabPartner[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<CollabPayout[]>([]);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<CollabPartner | 'new' | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    setLoading(true); setLoadError('');
    Promise.all([listPartners(), listCollabOrders(), listPayouts(), loadLimits()])
      .then(([p, o, pay, lim]) => { setPartners(p); setOrders(o); setPayouts(pay); setLimits(lim); })
      .catch((error) => setLoadError(errorText(error, 'Não foi possível carregar as Collabs.')))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const partnersById = useMemo(() => new Map(partners.map((p) => [p.id, p])), [partners]);
  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const usage = useMemo(() => quotaUsage(partners, limits), [partners, limits]);
  const remaining = useMemo(() => Object.fromEntries(usage.map((u) => [u.serviceId, u.remaining])), [usage]);
  const warnings = useMemo(() => orders.filter((o) => o.collab?.warning && !o.collab.reviewed), [orders]);
  const ok = (text: string) => setFlash({ ok: true, text });
  const fail = (error: unknown, fallback: string) => setFlash({ ok: false, text: errorText(error, fallback) });

  const save = async (input: PartnerInput) => {
    const current = editing === 'new' ? null : editing;
    const saved = await savePartner(current?.id ?? null, input);
    setPartners((list) => [...list.filter((p) => p.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    setEditing(null);
    ok(current ? 'Ficha atualizada.' : 'Parceira cadastrada.');
  };
  const remove = async (partner: CollabPartner) => {
    if (!window.confirm(`Excluir a ficha de ${partner.name}? Pedidos e comissões já gravados continuam como estão.`)) return;
    try { await deletePartner(partner.id); setPartners((list) => list.filter((p) => p.id !== partner.id)); setEditing(null); ok('Ficha excluída.'); } catch (e) { fail(e, 'Não foi possível excluir.'); }
  };
  const updateGrants = (partner: CollabPartner, grants: CollabGrant[]) => {
    const next = { ...partner, grants };
    setPartners((list) => list.map((p) => (p.id === partner.id ? next : p)));
    setEditing((current) => (current && current !== 'new' && current.id === partner.id ? next : current));
  };
  const grant = async (partner: CollabPartner, serviceId: string) => {
    const created = await grantService(partner, serviceId);
    updateGrants(partner, [...partner.grants, created]);
    setOrders(await listCollabOrders());
    ok(`${serviceName(serviceId)} concedido: o pedido está no Kanban.`);
  };
  const ungrant = async (partner: CollabPartner, item: CollabGrant) => {
    await removeGrant(partner.id, item);
    updateGrants(partner, partner.grants.filter((g) => g !== item));
  };
  const resolve = async (order: Order, partnerId: string | null, commission: number) => {
    setBusy(order.id);
    try {
      await resolveCouponWarning(order.id, partnerId, commission);
      setOrders((list) => list.map((o) => (o.id === order.id && o.collab ? { ...o, collab: { ...o.collab, partnerId, commission, reviewed: true } } : o)));
      ok('Aviso resolvido.');
    } catch (e) { fail(e, 'Não foi possível resolver o aviso.'); }
    setBusy('');
  };
  const copyLink = async () => {
    const url = `${window.location.origin}${FORM_PATH}`;
    try { await navigator.clipboard.writeText(url); ok(`Link copiado: ${url}`); } catch { window.prompt('Copie o link do formulário:', url); }
  };

  return (
    <section className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">CRM</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white"><HeartHandshake className="h-6 w-6 text-pink-300" />Mamães em Collab</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">Criadoras parceiras, cupons de {money(5)} por 30 dias depois do Reel e comissão de {money(COLLAB_COMMISSION)} por venda concluída.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white/80 hover:bg-white/5"><Copy className="h-4 w-4" />Link do formulário</button>
          <button type="button" onClick={() => setEditing('new')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"><Plus className="h-4 w-4" />Nova parceira</button>
        </div>
      </div>

      {flash && <p role={flash.ok ? 'status' : 'alert'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${flash.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100' : 'border-red-500/25 bg-red-500/10 text-red-200'}`}>{flash.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{flash.text}</span></p>}
      {loadError && <p role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">{loadError}<button type="button" onClick={load} className="font-bold underline">Tentar de novo</button></p>}
      {loading && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>}

      {warnings.length > 0 && <WarningsCard warnings={warnings} partners={partners} busy={busy} onResolve={(order, partnerId, commission) => void resolve(order, partnerId, commission)} />}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === id ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{label}</button>
        ))}
      </div>

      {!loading && tab === 'partners' && <PartnersTab partners={partners} today={today} onOpen={setEditing} />}
      {!loading && tab === 'coupons' && <CouponsTab partners={partners} orders={orders} today={today} onOpen={setEditing} />}
      {!loading && tab === 'commissions' && (
        <CommissionsTab orders={orders} payouts={payouts} partnersById={partnersById} today={today}
          onPaid={async (partnerId, weekKey, orderIds, amount) => {
            try { await markWeekPaid(partnerId, weekKey, orderIds, amount); setPayouts(await listPayouts()); ok(`Pagamento de ${money(amount)} registrado.`); } catch (e) { fail(e, 'Não foi possível registrar o pagamento.'); }
          }} />
      )}
      {!loading && tab === 'quotas' && (
        <QuotasTab usage={usage} onSave={async (next) => {
          try { await saveLimits(next); setLimits(next); ok('Vagas atualizadas.'); } catch (e) { fail(e, 'Não foi possível salvar as vagas.'); }
        }} />
      )}

      {editing && (
        <PartnerModal partner={editing === 'new' ? null : editing} others={partners.filter((p) => editing === 'new' || p.id !== editing.id)} ordersById={ordersById}
          remaining={remaining} today={today} onClose={() => setEditing(null)} onSave={save} onDelete={(p) => void remove(p)} onGrant={grant} onRemoveGrant={ungrant} />
      )}
    </section>
  );
};

const CouponChip: React.FC<{ partner: CollabPartner; today: string }> = ({ partner, today }) => {
  const c = couponState(partner, today);
  if (c.state === 'none') return null;
  const tone = c.state === 'expired' ? 'bg-white/10 text-white/50' : c.state === 'waiting' ? 'bg-blue-500/15 text-blue-200' : (c.daysLeft ?? 0) <= EXPIRING_DAYS ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/15 text-emerald-200';
  const text = c.state === 'waiting' ? 'aguardando Reel' : c.state === 'expired' ? 'vencido' : c.daysLeft === 0 ? 'vence hoje' : `${c.daysLeft} dia(s)`;
  return <span className={`${chip} ${tone}`}><Ticket className="mr-1 h-3 w-3" />{partner.couponCode} · {text}</span>;
};

const PartnersTab: React.FC<{ partners: CollabPartner[]; today: string; onOpen: (p: CollabPartner) => void }> = ({ partners, today, onOpen }) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const term = search.trim().toLowerCase().replace(/^@/, '');
  const visible = partners.filter((p) => (!status || p.status === status) && (!term || `${p.name} ${p.instagram} ${p.city} ${p.couponCode}`.toLowerCase().includes(term)));
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, @, cidade ou cupom" className={`${fieldClass} mt-0 pl-9`} /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status" className={`${fieldClass} mt-0 sm:w-56`}>
          <option value="">Todos os status</option>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label} ({partners.filter((p) => p.status === value).length})</option>)}
        </select>
      </div>
      {visible.length === 0 && <p className={`${cardClass} text-sm text-white/50`}>{partners.length ? 'Nenhuma parceira com esse filtro.' : 'Nenhuma parceira ainda. Cadastre uma ou envie o link do formulário.'}</p>}
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {visible.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen(p)} className={`${cardClass} w-full text-left transition hover:border-blue-500/40 hover:bg-white/[0.07]`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-bold text-white">{p.name}</p><p className="truncate text-xs text-white/50">{p.instagram ? `@${p.instagram}` : 'sem @'}{p.city ? ` · ${p.city}` : ''}</p></div>
                <span className={`${chip} shrink-0 ${STATUS_TONE[p.status] ?? 'bg-blue-500/15 text-blue-200'}`}>{statusLabel(p.status)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CouponChip partner={p} today={today} />
                {p.grants.length > 0 && <span className={`${chip} bg-white/10 text-white/70`}>{p.grants.length} benefício(s)</span>}
                {p.theme && <span className={`${chip} bg-white/10 text-white/70`}>{p.theme}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CouponsTab: React.FC<{ partners: CollabPartner[]; orders: Order[]; today: string; onOpen: (p: CollabPartner) => void }> = ({ partners, orders, today, onOpen }) => {
  const rows = couponBoard(partners, today);
  const uses = (partnerId: string) => orders.filter((o) => o.collab?.partnerId === partnerId).length;
  if (!rows.length) return <p className={`${cardClass} text-sm text-white/50`}>Nenhum cupom cadastrado. O código vai na ficha da parceira e é o mesmo do campo CUPOM no ManyChat.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/45">Validade: 30 dias depois da publicação do Reel (o último dia conta). Em amarelo, os que vencem em até {EXPIRING_DAYS} dias.</p>
      <ul className="space-y-2">
        {rows.map(({ partner, state, until, daysLeft }) => (
          <li key={partner.id}>
            <button type="button" onClick={() => onOpen(partner)} className={`${cardClass} flex w-full flex-wrap items-center justify-between gap-3 text-left hover:bg-white/[0.07] ${state === 'active' && (daysLeft ?? 0) <= EXPIRING_DAYS ? 'border-amber-500/40' : ''}`}>
              <div className="min-w-0">
                <p className="font-mono text-base font-bold text-white">{partner.couponCode}</p>
                <p className="truncate text-xs text-white/55">{partner.name} · {uses(partner.id)} uso(s)</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-extrabold tabular-nums ${state === 'expired' ? 'text-white/40' : state === 'waiting' ? 'text-blue-200' : (daysLeft ?? 0) <= EXPIRING_DAYS ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {state === 'waiting' ? 'Aguardando Reel' : state === 'expired' ? 'Vencido' : daysLeft === 0 ? 'Vence hoje' : `${daysLeft} dia(s)`}
                </p>
                <p className="text-[11px] text-white/45">{state === 'waiting' ? 'começa na publicação do Reel' : `${state === 'expired' ? 'venceu em' : 'até'} ${brDate(until)}`}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CommissionsTab: React.FC<{
  orders: Order[]; payouts: CollabPayout[]; partnersById: Map<string, CollabPartner>; today: string;
  onPaid: (partnerId: string, weekKey: string, orderIds: string[], amount: number) => Promise<void>;
}> = ({ orders, payouts, partnersById, today, onPaid }) => {
  const thisWeek = weekStartOf(today);
  const [weekKey, setWeekKey] = useState(addDays(thisWeek, -7)); // a semana fechada mais recente
  const [paying, setPaying] = useState('');
  const sales = useMemo(() => commissionSales(orders), [orders]);
  const groups = weeklyCommissions(sales, payouts, weekKey);
  const paidIds = new Set(payouts.flatMap((p) => p.orderIds ?? []));
  const openWeeks = Array.from(new Set<string>(sales.filter((s) => !paidIds.has(s.orderId)).map((s) => s.weekKey))).sort();
  const pay = async (partnerId: string, orderIds: string[], amount: number) => {
    if (paying || !window.confirm(`Registrar o pagamento de ${money(amount)}? Faça o Pix antes ou logo depois.`)) return;
    setPaying(partnerId);
    await onPaid(partnerId, weekKey, orderIds, amount);
    setPaying('');
  };
  return (
    <div className="space-y-3">
      <div className={`${cardClass} flex items-center justify-between gap-2`}>
        <button type="button" onClick={() => setWeekKey(addDays(weekKey, -7))} aria-label="Semana anterior" className="flex h-11 w-11 items-center justify-center rounded-xl text-white/70 hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-center"><p className="text-sm font-bold text-white">Semana de {weekLabel(weekKey)}</p><p className="text-[11px] text-white/45">{weekKey === thisWeek ? 'semana atual (ainda aberta)' : 'segunda a domingo, pela data de conclusão'}</p></div>
        <button type="button" onClick={() => setWeekKey(addDays(weekKey, 7))} disabled={weekKey >= thisWeek} aria-label="Próxima semana" className="flex h-11 w-11 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
      </div>
      {openWeeks.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-amber-200"><AlertTriangle className="h-3.5 w-3.5" />Semanas com comissão a pagar:
          {openWeeks.map((key) => <button key={key} type="button" onClick={() => setWeekKey(key)} className="rounded-full bg-amber-500/15 px-2 py-0.5 font-bold hover:bg-amber-500/25">{weekLabel(key)}</button>)}
        </p>
      )}
      {groups.length === 0 && <p className={`${cardClass} text-sm text-white/50`}>Nenhuma venda com cupom concluída nesta semana.</p>}
      {groups.map((g) => {
        const partner = partnersById.get(g.partnerId);
        const name = partner?.name ?? 'Parceira excluída';
        const all = [...g.paid, ...g.pending];
        const message = weeklyReportMessage({ name, code: all[0]?.code ?? '', weekKey, sales: all, serviceName });
        const link = partner?.whatsappNormalized ? whatsappLink(partner.whatsappNormalized, message) : null;
        return (
          <div key={g.partnerId} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-bold text-white">{name}</p><p className="text-xs text-white/50">Cupom {all[0]?.code} · {all.length} venda(s)</p></div>
              <div className="text-right">
                {g.pendingTotal > 0 && <p className="text-lg font-extrabold tabular-nums text-amber-300">{money(g.pendingTotal)} a pagar</p>}
                {g.paidTotal > 0 && <p className="text-xs font-semibold text-emerald-300">{money(g.paidTotal)} pago</p>}
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {all.map((s) => <li key={s.orderId} className="flex justify-between gap-2 text-white/75"><span className="min-w-0 truncate">{brDate(s.day)} · {serviceName(s.serviceId)}</span><span className={`shrink-0 tabular-nums ${g.paid.includes(s) ? 'text-emerald-300' : ''}`}>{money(s.commission)}</span></li>)}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"><MessageCircle className="h-4 w-4" />Enviar relatório</a>
                : <span className="text-xs text-white/45">Sem WhatsApp na ficha para enviar o relatório.</span>}
              {g.pending.length > 0 && (
                <button type="button" onClick={() => void pay(g.partnerId, g.pending.map((s) => s.orderId), g.pendingTotal)} disabled={!!paying} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold text-white hover:bg-white/5 disabled:opacity-50">
                  {paying === g.partnerId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Marcar {money(g.pendingTotal)} como pago
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const QuotasTab: React.FC<{ usage: ReturnType<typeof quotaUsage<CollabPartner>>; onSave: (limits: Record<string, number>) => Promise<void> }> = ({ usage, onSave }) => {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(usage.map((u) => [u.serviceId, String(u.limit)])));
  const [saving, setSaving] = useState(false);
  const changed = usage.some((u) => draft[u.serviceId] !== String(u.limit));
  const save = async () => {
    const next = Object.fromEntries(usage.map((u) => [u.serviceId, Math.max(0, Math.floor(Number(draft[u.serviceId]) || 0))]));
    setSaving(true); await onSave(next); setSaving(false);
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">Total de unidades de cada serviço para o projeto (não é o número de criadoras: uma pode receber mais de uma).</p>
      <ul className="space-y-2">
        {usage.map((u) => (
          <li key={u.serviceId} className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><p className="font-bold text-white">{u.label}</p><p className={`text-xs ${u.remaining <= 0 ? 'text-red-300' : 'text-white/55'}`}>{u.granted} concedida(s) · {u.remaining} restante(s)</p></div>
              <label className="flex items-center gap-2 text-xs text-white/60">Limite
                <input type="number" min={0} step={1} inputMode="numeric" value={draft[u.serviceId] ?? ''} onChange={(e) => setDraft({ ...draft, [u.serviceId]: e.target.value })} className="w-20 rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-center text-base text-white outline-none focus:border-blue-500/60 sm:text-sm" />
              </label>
            </div>
            {u.holders.length > 0 && <p className="mt-2 text-xs text-white/50">{u.holders.map(({ partner, grant }) => `${partner.name} (${brDate(grant.at)})`).join(' · ')}</p>}
          </li>
        ))}
      </ul>
      {changed && <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar limites</button>}
    </div>
  );
};

const WarningsCard: React.FC<{ warnings: Order[]; partners: CollabPartner[]; busy: string; onResolve: (order: Order, partnerId: string | null, commission: number) => void }> = ({ warnings, partners, busy, onResolve }) => {
  const [pick, setPick] = useState<Record<string, string>>({});
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-100"><AlertTriangle className="h-4 w-4" />Avisos de cupom ({warnings.length})</p>
      <ul className="mt-3 space-y-2">
        {warnings.map((order) => {
          const collab = order.collab;
          const warning = collab?.warning;
          if (!collab || !warning) return null;
          const day = asDate(order.paidAt) ?? asDate(order.createdAt);
          const disabled = busy === order.id;
          return (
            <li key={order.id} className="rounded-xl bg-black/20 p-3 text-sm">
              <p className="text-white"><strong className="font-mono">{collab.code}</strong> · {serviceName(order.serviceId)}{day ? ` · ${day.toLocaleDateString('pt-BR')}` : ''}</p>
              <p className="text-xs text-amber-100/80">{WARNING_LABELS[warning]}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {warning === 'unknown' && (
                  <>
                    <select value={pick[order.id] ?? ''} onChange={(e) => setPick({ ...pick, [order.id]: e.target.value })} aria-label="Parceira" className={`${fieldClass} mt-0 min-w-0 flex-1 sm:max-w-xs`}>
                      <option value="">Vincular a…</option>{partners.filter((p) => p.couponCode).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.couponCode})</option>)}
                    </select>
                    <button type="button" disabled={disabled || !pick[order.id]} onClick={() => onResolve(order, pick[order.id], COLLAB_COMMISSION)} className="min-h-10 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-40">Vincular com comissão</button>
                  </>
                )}
                {['expired', 'not_started', 'cancelled'].includes(warning) && <button type="button" disabled={disabled} onClick={() => onResolve(order, collab.partnerId, collab.commission)} className="min-h-10 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-40">Manter comissão</button>}
                {warning === 'event'
                  ? <button type="button" disabled={disabled} onClick={() => onResolve(order, collab.partnerId, 0)} className="min-h-10 rounded-lg border border-white/15 px-3 text-xs font-bold text-white disabled:opacity-40">Ciente</button>
                  : <button type="button" disabled={disabled} onClick={() => onResolve(order, collab.partnerId, 0)} className="min-h-10 rounded-lg border border-white/15 px-3 text-xs font-bold text-white disabled:opacity-40">Sem comissão</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
