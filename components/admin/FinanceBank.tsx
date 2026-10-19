import React, { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { AlertCircle, EyeOff, Loader2, Tags, Upload } from 'lucide-react';
import { importBankStatement, renameBankCategory, saveBankSettings, setBankCategory, useBankRange, useBankSettings, type BankCategorySettings, type BankTransaction } from '../../services/bankService';
import { bankPeriod, bankSeries, bankTotals, parseStatement, UNCATEGORIZED, visibleItems, type BankPeriodId, type BankRange, type CategoryTotal } from '../../services/bankStatement.js';
import type { RevenueEntry } from '../../services/financeCalculations.js';
import { cardClass, formatMoney, ghostBtn, inputClass, labelClass, MONTH_NAMES, monthLabel, primaryBtn } from './financeFormat';
import { Kpi } from './adminPages/FinanceKpi';
import { Compass, type CompassItem } from './FinanceCharts';

type Filter = 'all' | 'uncategorized' | 'in' | 'out';
const FILTERS: [Filter, string][] = [['all', 'Todos'], ['uncategorized', 'Sem categoria'], ['in', 'Entradas'], ['out', 'Saídas']];
const br = (date: string) => date.split('-').reverse().join('/');
const pill = (on: boolean) => `whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition ${on ? 'border-blue-500/60 bg-blue-500/15 text-blue-200' : 'border-white/10 text-white/60 hover:text-white'}`;

function periodLabel(period: BankPeriodId, monthKey: string): string {
  return period === 'month' ? monthLabel(monthKey) : period === 'year' ? `Este ano (${new Date().getFullYear()})` : period === '12m' ? 'Últimos 12 meses' : 'Todo o período';
}

/** Um raio por dia, mês ou ano do período, com entradas ou saídas. */
function compassItems(series: ReturnType<typeof bankSeries>, unit: BankRange['unit'], metric: 'in' | 'out'): CompassItem[] {
  return series.map((r) => {
    const tick = unit === 'day' ? String(Number(r.key.slice(8))) : unit === 'month' ? MONTH_NAMES[Number(r.key.slice(5)) - 1].slice(0, 3) : r.key;
    const label = unit === 'day' ? `Dia ${Number(r.key.slice(8))}` : unit === 'month' ? monthLabel(r.key) : r.key;
    return { key: r.key, tick, label, value: r[metric], sub: `${r.count} lançamento${r.count === 1 ? '' : 's'} · saldo ${formatMoney(r.in - r.out)}` };
  });
}

/** O Inter pode exportar em UTF-8 ou Latin-1; tenta UTF-8 estrito primeiro. */
function decode(buffer: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { return new TextDecoder('windows-1252').decode(buffer); }
}

const CategoryBars: React.FC<{ title: string; rows: CategoryTotal[]; total: number; tone: string }> = ({ title, rows, total, tone }) => (
  <section className={cardClass}>
    <h3 className="mb-3 text-sm font-bold text-white">{title}</h3>
    {rows.length === 0 ? <p className="text-sm text-white/45">Nada no mês.</p> : (
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.category}>
            <div className="flex justify-between gap-3 text-xs"><span className="truncate text-white/80">{r.category}</span><span className="shrink-0 font-semibold tabular-nums text-white">{formatMoney(r.total)} <span className="text-white/45">{total ? Math.round((r.total / total) * 100) : 0}%</span></span></div>
            <div className="mt-1 h-1.5 rounded-full bg-white/5"><div className={`h-full rounded-full ${tone}`} style={{ width: `${total ? (r.total / total) * 100 : 0}%` }} /></div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const CategoryInput: React.FC<{ tx: BankTransaction; onSave: (category: string | null) => void }> = ({ tx, onSave }) => {
  const [value, setValue] = useState(tx.category ?? '');
  useEffect(() => setValue(tx.category ?? ''), [tx.category]);
  const commit = () => { const next = value.trim() || null; if (next !== tx.category) onSave(next); };
  return (
    <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      list={`bank-cat-${tx.kind}`} placeholder="Categoria" aria-label={`Categoria de ${tx.title || tx.description}`} maxLength={60}
      className={`${inputClass} mt-0 w-full py-1.5 text-xs min-[480px]:w-48 ${tx.category ? '' : 'border-amber-500/40'}`} />
  );
};

/** Listas de categorias de entrada e saída: adicionar, renomear, excluir e ocultar dos resultados. */
const CategoryManager: React.FC<{ settings: BankCategorySettings; onChanged: (message: string) => void; onError: (message: string) => void }> = ({ settings, onChanged, onError }) => {
  const [draft, setDraft] = useState({ in: '', out: '' });
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<string>) => {
    setBusy(true);
    try { onChanged(await task()); } catch (e) { onError(e instanceof Error ? e.message : 'Não foi possível salvar as categorias.'); } finally { setBusy(false); }
  };
  const add = (kind: 'in' | 'out') => {
    const name = draft[kind].trim().slice(0, 60);
    if (!name) return;
    void run(async () => {
      await saveBankSettings({ ...settings, [kind]: [...new Set([...settings[kind], name])] });
      setDraft((d) => ({ ...d, [kind]: '' }));
      return `Categoria "${name}" adicionada.`;
    });
  };
  const toggleHidden = (name: string) => void run(async () => {
    const hide = !settings.hidden.includes(name);
    await saveBankSettings({ ...settings, hidden: hide ? [...settings.hidden, name] : settings.hidden.filter((c) => c !== name) });
    return hide ? `"${name}" oculta: fica fora dos totais, da bússola, da lista, do Resumo e do Relatório.` : `"${name}" volta a aparecer.`;
  });
  const rename = (name: string) => {
    const next = window.prompt(`Novo nome para "${name}" (vale para todo o histórico):`, name)?.trim().slice(0, 60);
    if (!next || next === name) return;
    void run(async () => `${await renameBankCategory(name, next, settings)} lançamento(s) passaram de "${name}" para "${next}".`);
  };
  const remove = (name: string) => {
    if (!window.confirm(`Excluir a categoria "${name}"? Os lançamentos dela ficam sem categoria.`)) return;
    void run(async () => `"${name}" excluída; ${await renameBankCategory(name, null, settings)} lançamento(s) ficaram sem categoria.`);
  };
  return (
    <section className={`${cardClass} grid grid-cols-1 gap-6 lg:grid-cols-2`}>
      {(['in', 'out'] as const).map((kind) => (
        <div key={kind}>
          <h3 className="mb-2 text-sm font-bold text-white">Categorias de {kind === 'in' ? 'entrada' : 'saída'}</h3>
          <ul className="divide-y divide-white/5">
            {settings[kind].map((name) => {
              const hidden = settings.hidden.includes(name);
              return (
                <li key={name} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className={`min-w-0 flex-1 truncate ${hidden ? 'text-white/35 line-through' : 'text-white/85'}`}>{name}</span>
                  <label className="flex shrink-0 items-center gap-1 text-white/55"><input type="checkbox" checked={hidden} disabled={busy} onChange={() => toggleHidden(name)} />Ocultar</label>
                  <button type="button" disabled={busy} className="shrink-0 font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50" onClick={() => rename(name)}>Renomear</button>
                  <button type="button" disabled={busy} className="shrink-0 font-semibold text-red-400 hover:text-red-300 disabled:opacity-50" onClick={() => remove(name)}>Excluir</button>
                </li>
              );
            })}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(kind); }}>
            <input value={draft[kind]} onChange={(e) => setDraft((d) => ({ ...d, [kind]: e.target.value }))} maxLength={60} placeholder="Nova categoria" aria-label={`Nova categoria de ${kind === 'in' ? 'entrada' : 'saída'}`} className={`${inputClass} mt-0 py-1.5 text-xs`} />
            <button type="submit" disabled={busy || !draft[kind].trim()} className={`${primaryBtn} py-1.5 text-xs`}>Adicionar</button>
          </form>
        </div>
      ))}
    </section>
  );
};

/** Extrato real da conta PJ no Inter, importado de arquivo (CSV ou OFX). Reimportar não duplica; categorias ficam lembradas. */
export const FinanceBank: React.FC<{ entries: RevenueEntry[]; monthKey: string }> = ({ entries, monthKey }) => {
  const [reload, setReload] = useState(0);
  const [period, setPeriod] = useState<BankPeriodId>('month');
  const [metric, setMetric] = useState<'in' | 'out'>('in');
  const [segment, setSegment] = useState<string | null>(null);
  const query = period === 'all' ? null : bankPeriod(period, monthKey);
  const bank = useBankRange(query?.from, query?.to, reload);
  const [patch, setPatch] = useState<Map<string, string | null>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const settings = useBankSettings();
  const [category, setCategory] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  useEffect(() => setPatch(new Map()), [bank]);
  useEffect(() => { setNotice(null); setSegment(null); }, [monthKey, period]);

  const items = useMemo(() => (bank.status === 'ready' ? bank.data.items.map((t) => (patch.has(t.id) ? { ...t, category: patch.get(t.id) ?? null } : t)) : null), [bank, patch]);
  const view = useMemo(() => {
    if (!items) return null;
    const range = bankPeriod(period, monthKey, new Date(), items);
    const [fromMonth, toMonth] = [range.from.slice(0, 7), range.to.slice(0, 7)];
    const shown = visibleItems(items, settings.hidden, category);
    return {
      range,
      totals: bankTotals(shown),
      series: bankSeries(shown, range),
      hiddenCount: items.length - visibleItems(items, settings.hidden).length,
      rows: shown.filter((t) => (!segment || t.date.startsWith(segment)) && (filter === 'all' || (filter === 'uncategorized' ? !t.category : t.kind === filter))).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
      system: entries.filter((e) => e.monthKey >= fromMonth && e.monthKey <= toMonth).reduce((s, e) => s + e.value, 0),
      // Lista salva + nomes já usados nos lançamentos carregados (digitados antes de existir a lista).
      used: { in: [...new Set([...settings.in, ...items.filter((t) => t.kind === 'in' && t.category).map((t) => t.category as string)])], out: [...new Set([...settings.out, ...items.filter((t) => t.kind === 'out' && t.category).map((t) => t.category as string)])] },
    };
  }, [items, period, monthKey, segment, filter, entries, settings, category]);
  const categoryOptions = [...new Set([...settings.in, ...settings.out])].filter((c) => !settings.hidden.includes(c));
  useEffect(() => { if (category && settings.hidden.includes(category)) setCategory(null); }, [category, settings.hidden]);
  const label = periodLabel(period, monthKey);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const text = decode(await file.arrayBuffer());
      const rows = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;
      const parsed = parseStatement(text, rows);
      if (!parsed.length) throw new Error('Nenhum lançamento encontrado. Use o extrato do Inter exportado em CSV ou OFX.');
      const r = await importBankStatement(parsed);
      setNotice(`${br(r.from)} a ${br(r.to)}: ${r.added} lançamento(s) novo(s)${r.auto ? ` (${r.auto} já categorizado(s) pelas regras)` : ''}, ${r.skipped} já importado(s) antes.`);
      setReload((n) => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao importar o extrato.'); } finally { setBusy(false); }
  };

  const saveCategory = async (tx: BankTransaction, category: string | null) => {
    setError(null);
    try {
      const ids = await setBankCategory(tx, category, items ?? [], settings);
      setPatch((prev) => { const next = new Map(prev); ids.forEach((id) => next.set(id, category)); return next; });
      if (ids.length > 1) setNotice(`"${category}" aplicada a ${ids.length} lançamentos iguais do período; os próximos iguais já entram categorizados.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar a categoria.'); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardClass} flex flex-wrap items-end gap-3`}>
        <div className="min-w-[220px] flex-1">
          <p className="text-sm font-bold text-white">Extrato real · Banco Inter</p>
          <p className="mt-1 text-xs text-white/50">No Inter: Extrato → Exportar → CSV (ou OFX; use sempre o mesmo formato). Pode importar o histórico inteiro e depois o arquivo do dia: o que já foi importado é ignorado.</p>
        </div>
        <label className={`${primaryBtn} h-[42px] cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Importar extrato
          <input type="file" accept=".csv,.ofx,text/csv" className="hidden" disabled={busy} onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>

      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Período">
        {(['month', 'year', '12m', 'all'] as const).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)} className={pill(period === p)}>{p === 'month' ? `Mês (${monthLabel(monthKey)})` : periodLabel(p, monthKey)}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className={`${labelClass} min-w-[200px] flex-1 min-[480px]:max-w-xs`}>Categoria
          <select value={category ?? ''} onChange={(e) => setCategory(e.target.value || null)} className={inputClass}>
            <option value="">Todas</option>
            <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" className={`${ghostBtn} h-[42px]`} aria-expanded={managing} onClick={() => setManaging((v) => !v)}><Tags className="h-4 w-4" />{managing ? 'Fechar categorias' : 'Gerenciar categorias'}</button>
        {settings.hidden.length > 0 && (
          <p className="flex items-center gap-1.5 pb-3 text-xs text-white/50"><EyeOff className="h-3.5 w-3.5" />Ocultas: {settings.hidden.join(', ')}{view && view.hiddenCount > 0 ? ` (${view.hiddenCount} lançamento${view.hiddenCount === 1 ? '' : 's'} fora dos resultados)` : ''}</p>
        )}
      </div>

      {managing && <CategoryManager settings={settings} onChanged={(m) => { setError(null); setNotice(m); setReload((n) => n + 1); }} onError={setError} />}

      {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</p>}
      {(error || bank.status === 'error') && <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300" role="alert"><AlertCircle className="h-4 w-4 shrink-0" />{error ?? 'Não foi possível carregar o extrato.'}</div>}
      {bank.status === 'loading' && <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>}

      {view && (
        <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
            <Kpi label="Entradas no banco" value={formatMoney(view.totals.totalIn)} tone="text-emerald-300" hint={`Faturamento do sistema: ${formatMoney(view.system)}`} />
            <Kpi label="Saídas no banco" value={formatMoney(view.totals.totalOut)} tone="text-red-300" />
            <Kpi label={period === 'month' ? 'Saldo do mês' : 'Saldo do período'} value={formatMoney(view.totals.balance)} tone={view.totals.balance >= 0 ? 'text-white' : 'text-red-300'} hint={view.totals.uncategorized ? `${view.totals.uncategorized} sem categoria` : undefined} />
          </div>

          <section className={cardClass}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">{metric === 'in' ? 'Entradas' : 'Saídas'} por {view.range.unit === 'day' ? 'dia' : view.range.unit === 'month' ? 'mês' : 'ano'} · {label}</h3>
              <div className="flex gap-1" role="tablist" aria-label="Valor da bússola">
                {(['in', 'out'] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${metric === m ? (m === 'in' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'text-white/60 hover:text-white'}`}>{m === 'in' ? 'Entradas' : 'Saídas'}</button>
                ))}
              </div>
            </div>
            <Compass items={compassItems(view.series, view.range.unit, metric)} selected={segment} onSelect={setSegment}
              total={metric === 'in' ? view.totals.totalIn : view.totals.totalOut} totalLabel={label} hint="toque em um raio para filtrar a lista"
              color={metric === 'in' ? '#10b981' : '#ef4444'} ariaLabel={`${metric === 'in' ? 'Entradas' : 'Saídas'} no banco · ${label}`}
              tickEvery={view.range.unit === 'day' ? 5 : view.series.length > 24 ? 3 : 1} />
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryBars title={`Entradas por categoria · ${label}`} rows={view.totals.byCategory.in} total={view.totals.totalIn} tone="bg-emerald-500/70" />
            <CategoryBars title={`Saídas por categoria · ${label}`} rows={view.totals.byCategory.out} total={view.totals.totalOut} tone="bg-red-500/70" />
          </div>

          {segment && (
            <p className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <span>Lista filtrada: <span className="font-semibold text-white">{compassItems(view.series, view.range.unit, metric).find((i) => i.key === segment)?.label}</span></span>
              <button type="button" className="font-semibold text-blue-400 hover:text-blue-300" onClick={() => setSegment(null)}>Limpar</button>
            </p>
          )}

          <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
            {FILTERS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={filter === id} type="button" onClick={() => setFilter(id)}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${filter === id ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{label}</button>
            ))}
          </div>

          <datalist id="bank-cat-in">{view.used.in.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="bank-cat-out">{view.used.out.map((c) => <option key={c} value={c} />)}</datalist>

          {view.rows.length === 0 ? (
            <div className={`${cardClass} text-center text-sm text-white/45`}>{view.totals.count === 0 ? `Nenhum lançamento do Inter em ${period === 'month' ? monthLabel(monthKey) : label.toLowerCase()}. Importe o extrato.` : 'Nada neste filtro.'}</div>
          ) : (
            <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
              {view.rows.map((t) => {
                const out = t.kind === 'out';
                return (
                  <div key={t.id} className={`flex flex-col gap-2 p-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between ${out ? 'bg-red-500/10' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white/45">{br(t.date)} · {out ? <span className="text-red-300/90">Saída</span> : <span className="text-emerald-300/80">Entrada</span>}</p>
                      <p className="truncate text-sm font-bold text-white">{t.description || t.title || 'Sem descrição'}</p>
                      {t.description && t.title && <p className="truncate text-xs text-white/55">{t.title}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-3 min-[480px]:justify-end">
                      <CategoryInput tx={t} onSave={(c) => void saveCategory(t, c)} />
                      <p className={`w-28 shrink-0 text-right text-sm font-extrabold ${out ? 'text-red-300' : 'text-emerald-300'}`}>{out ? '− ' : '+ '}{formatMoney(t.amount)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
