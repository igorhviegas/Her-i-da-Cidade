import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { AlertCircle, Loader2, Upload } from 'lucide-react';
import { listClients } from '../../services/clientsService';
import { importWalletOps, listWalletYear } from '../../services/manychatWalletService';
import { linkSpend, parseWalletRows, spendByDay, spendByMonth, spendByWeek, type WalletOp } from '../../services/manychatWallet.js';
import type { RevenueEntry } from '../../services/financeCalculations.js';
import type { Client } from '../../types';
import { cardClass, formatMoney, inputClass, labelClass, monthLabel, primaryBtn, shortMonthLabel } from './financeFormat';

const RATE_KEY = 'manychatUsdBrl';
const readRate = () => { try { return localStorage.getItem(RATE_KEY) || '5,50'; } catch { return '5,50'; } };
const pad = (n: number) => String(n).padStart(2, '0');

const Kpi: React.FC<{ label: string; value: string; hint?: string; tone?: string }> = ({ label, value, hint, tone = 'text-white' }) => (
  <div className={cardClass}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
    <p className={`mt-1 text-xl font-extrabold tabular-nums sm:text-2xl ${tone}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
  </div>
);

/** Barras simples (dias do mês ou meses do ano); o rótulo completo aparece no title e na legenda. */
const SpendBars: React.FC<{ items: { key: string; label: string; tick: string; value: number }[]; format: (n: number) => string; step?: number }> = ({ items, format, step = 1 }) => {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...items.map((i) => i.value), 0);
  if (max === 0) return <p className="py-10 text-center text-sm text-white/45">Sem gasto no período.</p>;
  const shown = items.find((i) => i.key === hover);
  return (
    <div>
      <p className="mb-3 h-4 text-xs text-white/50">{shown && <><span className="font-semibold text-white/80">{shown.label}</span> · {format(shown.value)}</>}</p>
      <div className="flex h-40 items-end gap-0.5 sm:gap-1">
        {items.map((i) => (
          <button key={i.key} type="button" title={`${i.label}: ${format(i.value)}`} aria-label={`${i.label}: ${format(i.value)}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            onMouseEnter={() => setHover(i.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i.key)} onBlur={() => setHover(null)} onClick={() => setHover(i.key)}>
            <span className="block w-full rounded-t bg-blue-500/60 transition-colors group-hover:bg-blue-400" style={{ height: `${Math.max((i.value / max) * 100, i.value > 0 ? 3 : 1)}%` }} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5 sm:gap-1">
        {items.map((i, idx) => <span key={i.key} className="min-w-0 flex-1 truncate text-center text-[9px] text-white/40">{idx % step === 0 ? i.tick : ''}</span>)}
      </div>
    </div>
  );
};

type ClientFilter = 'all' | 'sold' | 'nosale';

export const FinanceManychat: React.FC<{ entries: RevenueEntry[]; monthKey: string; serviceName: (id: string) => string }> = ({ entries, monthKey, serviceName }) => {
  const year = monthKey.slice(0, 4);
  const [ops, setOps] = useState<WalletOp[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(readRate);
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [showAll, setShowAll] = useState(false);

  const usdBrl = Number(rate.replace(',', '.')) || 0;
  const brl = useCallback((usd: number) => formatMoney(usd * usdBrl), [usdBrl]);
  const setRateSaved = (value: string) => { setRate(value); try { localStorage.setItem(RATE_KEY, value); } catch { /* sem armazenamento: vale só nesta sessão */ } };

  const load = useCallback(async () => {
    setError(null);
    try { setOps(await listWalletYear(year)); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o gasto do ManyChat.'); }
  }, [year]);
  useEffect(() => { setOps(null); void load(); }, [load]);
  useEffect(() => { void listClients().then(setClients).catch(() => setClients([])); }, []);

  const importCsv = (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setNotice(null);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true, transformHeader: (h) => h.replace(/^﻿/, '').trim(),
      complete: async (result) => {
        try {
          const parsed = parseWalletRows(result.data);
          if (!parsed.length) throw new Error('Nenhuma cobrança encontrada. Use o CSV "Wallet operations" exportado do ManyChat.');
          await importWalletOps(parsed);
          const days = parsed.map((o) => o.day).sort();
          setNotice(`${parsed.length} cobranças lidas (${days[0].split('-').reverse().join('/')} a ${days[days.length - 1].split('-').reverse().join('/')}). Reimportar o mesmo período não duplica.`);
          await load();
        } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao importar o CSV.'); } finally { setBusy(false); }
      },
      error: (e) => { setError(e.message); setBusy(false); },
    });
  };

  const view = useMemo(() => {
    if (!ops) return null;
    const days = spendByDay(ops, monthKey);
    const month = ops.filter((o) => o.day.startsWith(monthKey));
    const total = month.reduce((s, o) => s + o.cost, 0);
    const top = days.reduce((best, d) => (d.total > best.total ? d : best), days[0]);
    return { days, weeks: spendByWeek(ops, monthKey), months: spendByMonth(ops, year), total, count: month.length, top, link: linkSpend({ ops, monthKey, entries, clients }) };
  }, [ops, monthKey, year, entries, clients]);

  const rows = useMemo(() => (view?.link.rows ?? []).filter((r) => filter === 'all' || (filter === 'sold') === (r.orders.length > 0)), [view, filter]);
  const shownRows = showAll ? rows : rows.slice(0, 30);

  return (
    <div className="space-y-6">
      <div className={`${cardClass} flex flex-wrap items-end gap-3`}>
        <div className="min-w-[240px] flex-1">
          <p className="text-sm font-bold text-white">Gasto com mensagens pagas da API (carteira do ManyChat)</p>
          <p className="mt-1 text-xs text-white/50">Só acompanhamento: não entra nas despesas. No ManyChat: Settings → Billing → Wallet → Usage History → exportar CSV e importar aqui.</p>
        </div>
        <label className={`${labelClass} w-32`}>US$ 1 = R$
          <input value={rate} onChange={(e) => setRateSaved(e.target.value)} inputMode="decimal" className={inputClass} />
        </label>
        <label className={`${primaryBtn} h-[42px] cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Importar CSV
          <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(e) => { importCsv(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>

      {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</p>}
      {error && <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300" role="alert"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {!view && !error && <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>}

      {view && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={`Gasto · ${monthLabel(monthKey).split(' ')[0]}`} value={brl(view.total)} hint={`US$ ${view.total.toFixed(2)}`} tone="text-red-300" />
            <Kpi label="Mensagens cobradas" value={String(view.count)} hint={view.count ? `${brl(view.total / view.count)} por mensagem` : undefined} />
            <Kpi label="Maior dia" value={view.top.total > 0 ? brl(view.top.total) : '—'} hint={view.top.total > 0 ? `dia ${view.top.day} · ${view.top.count} mensagens` : undefined} tone="text-amber-300" />
            <Kpi label="Em quem fechou / sem venda" value={`${brl(view.link.spendSold)} / ${brl(view.link.spendNoSale)}`} hint="cliente cadastrado com pedido no mês × demais contatos" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className={cardClass}>
              <h3 className="mb-3 text-sm font-bold text-white">Por dia · {monthLabel(monthKey)}</h3>
              <SpendBars step={5} format={brl} items={view.days.map((d) => ({ key: `${monthKey}-${pad(d.day)}`, label: `${pad(d.day)}/${monthKey.slice(5)} · ${d.count} msg`, tick: String(d.day), value: d.total }))} />
            </section>
            <section className={cardClass}>
              <h3 className="mb-3 text-sm font-bold text-white">Por semana (seg–dom) · {monthLabel(monthKey)}</h3>
              <ul className="divide-y divide-white/5 text-sm">
                {view.weeks.map((w) => (
                  <li key={w.from} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-white/70">{pad(w.from)} a {pad(w.to)}/{monthKey.slice(5)}</span>
                    <span className="text-xs text-white/45">{w.count} msg</span>
                    <span className="w-24 text-right font-bold tabular-nums text-white">{brl(w.total)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={cardClass}>
            <h3 className="mb-3 text-sm font-bold text-white">Por mês · {year}</h3>
            <SpendBars format={brl} items={view.months.map((m) => ({ key: m.monthKey, label: shortMonthLabel(m.monthKey), tick: shortMonthLabel(m.monthKey).slice(0, 3), value: m.total }))} />
          </section>

          <section className={cardClass}>
            <h3 className="mb-1 text-sm font-bold text-white">Custo do chat por tipo de serviço · {monthLabel(monthKey)}</h3>
            <p className="mb-3 text-xs text-white/50">Consumo do WhatsApp de cada cliente cadastrado, dividido entre os pedidos dele no mês.</p>
            {view.link.services.length === 0 ? <p className="py-6 text-center text-sm text-white/45">Nenhuma venda no mês.</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-white/45"><tr><th className="py-2">Serviço</th><th className="text-right">Vendas</th><th className="text-right">Faturamento</th><th className="text-right">Gasto no chat</th><th className="text-right">Por venda</th><th className="text-right">% do fat.</th></tr></thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {view.link.services.map((s) => (
                    <tr key={s.serviceId}>
                      <td className="py-2 font-semibold text-white">{serviceName(s.serviceId)}</td>
                      <td className="text-right tabular-nums">{s.orders}</td>
                      <td className="text-right tabular-nums">{formatMoney(s.revenue)}</td>
                      <td className="text-right tabular-nums text-red-300">{brl(s.spend)}</td>
                      <td className="text-right tabular-nums">{brl(s.spend / s.orders)}</td>
                      <td className="text-right tabular-nums">{s.revenue > 0 ? `${((s.spend * usdBrl / s.revenue) * 100).toFixed(1).replace('.', ',')}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </section>

          <section className={cardClass}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">Consumo por cliente · {monthLabel(monthKey)}</h3>
              <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
                {([['all', 'Todos'], ['sold', 'Fecharam'], ['nosale', 'Sem venda']] as const).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => { setFilter(id); setShowAll(false); }}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${filter === id ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{label}</button>
                ))}
              </div>
            </div>
            {rows.length === 0 ? <p className="py-6 text-center text-sm text-white/45">Nenhum consumo neste filtro.</p> : (
              <div className="divide-y divide-white/5">
                {shownRows.map((r) => (
                  <div key={r.phone} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{r.client?.name || <span className="text-white/55">Sem cadastro · {r.phone || 'sem número'}</span>}</p>
                      <p className="truncate text-xs text-white/55">
                        {r.orders.length ? r.orders.map((o) => `${serviceName(o.serviceId)} ${formatMoney(o.value)}`).join(' · ') : <span className="text-amber-300/80">sem venda no mês</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold tabular-nums text-red-300">− {brl(r.total)}</p>
                      <p className="text-[11px] text-white/45">{r.count} msg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {rows.length > 30 && <button type="button" className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Mostrar menos' : `Mostrar todos (${rows.length})`}</button>}
          </section>
        </>
      )}
    </div>
  );
};
