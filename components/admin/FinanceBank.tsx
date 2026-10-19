import React, { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { AlertCircle, Loader2, Upload } from 'lucide-react';
import { importBankStatement, setBankCategory, useBankMonth, type BankTransaction } from '../../services/bankService';
import { bankTotals, IN_CATEGORIES, OUT_CATEGORIES, parseStatement, type CategoryTotal } from '../../services/bankStatement.js';
import { monthTotals, type RevenueEntry } from '../../services/financeCalculations.js';
import { cardClass, formatMoney, inputClass, monthLabel, primaryBtn } from './financeFormat';
import { Kpi } from './adminPages/FinanceKpi';

type Filter = 'all' | 'uncategorized' | 'in' | 'out';
const FILTERS: [Filter, string][] = [['all', 'Todos'], ['uncategorized', 'Sem categoria'], ['in', 'Entradas'], ['out', 'Saídas']];
const br = (date: string) => date.split('-').reverse().join('/');

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

/** Extrato real da conta PJ no Inter, importado de arquivo (CSV ou OFX). Reimportar não duplica; categorias ficam lembradas. */
export const FinanceBank: React.FC<{ entries: RevenueEntry[]; monthKey: string }> = ({ entries, monthKey }) => {
  const [reload, setReload] = useState(0);
  const bank = useBankMonth(monthKey, reload);
  const [patch, setPatch] = useState<Map<string, string | null>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => setPatch(new Map()), [bank]);
  useEffect(() => setNotice(null), [monthKey]);

  const items = useMemo(() => (bank.status === 'ready' ? bank.data.items.map((t) => (patch.has(t.id) ? { ...t, category: patch.get(t.id) ?? null } : t)) : null), [bank, patch]);
  const view = useMemo(() => items && ({
    totals: bankTotals(items),
    rows: items.filter((t) => filter === 'all' || (filter === 'uncategorized' ? !t.category : t.kind === filter)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    system: monthTotals(entries, monthKey).total,
    used: { in: [...new Set([...IN_CATEGORIES, ...items.filter((t) => t.kind === 'in' && t.category).map((t) => t.category as string)])], out: [...new Set([...OUT_CATEGORIES, ...items.filter((t) => t.kind === 'out' && t.category).map((t) => t.category as string)])] },
  }), [items, filter, entries, monthKey]);

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
      const ids = await setBankCategory(tx, category, items ?? []);
      setPatch((prev) => { const next = new Map(prev); ids.forEach((id) => next.set(id, category)); return next; });
      if (ids.length > 1) setNotice(`"${category}" aplicada a ${ids.length} lançamentos iguais deste mês; os próximos iguais já entram categorizados.`);
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

      {notice && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{notice}</p>}
      {(error || bank.status === 'error') && <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300" role="alert"><AlertCircle className="h-4 w-4 shrink-0" />{error ?? 'Não foi possível carregar o extrato.'}</div>}
      {bank.status === 'loading' && <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>}

      {view && (
        <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
            <Kpi label="Entradas no banco" value={formatMoney(view.totals.totalIn)} tone="text-emerald-300" hint={`Faturamento do sistema: ${formatMoney(view.system)}`} />
            <Kpi label="Saídas no banco" value={formatMoney(view.totals.totalOut)} tone="text-red-300" />
            <Kpi label="Saldo do mês" value={formatMoney(view.totals.balance)} tone={view.totals.balance >= 0 ? 'text-white' : 'text-red-300'} hint={view.totals.uncategorized ? `${view.totals.uncategorized} sem categoria` : undefined} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryBars title={`Entradas por categoria · ${monthLabel(monthKey)}`} rows={view.totals.byCategory.in} total={view.totals.totalIn} tone="bg-emerald-500/70" />
            <CategoryBars title={`Saídas por categoria · ${monthLabel(monthKey)}`} rows={view.totals.byCategory.out} total={view.totals.totalOut} tone="bg-red-500/70" />
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
            {FILTERS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={filter === id} type="button" onClick={() => setFilter(id)}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${filter === id ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{label}</button>
            ))}
          </div>

          <datalist id="bank-cat-in">{view.used.in.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="bank-cat-out">{view.used.out.map((c) => <option key={c} value={c} />)}</datalist>

          {view.rows.length === 0 ? (
            <div className={`${cardClass} text-center text-sm text-white/45`}>{view.totals.count === 0 ? `Nenhum lançamento do Inter em ${monthLabel(monthKey)}. Importe o extrato.` : 'Nada neste filtro.'}</div>
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
