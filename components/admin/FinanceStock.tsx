import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Package, Plus } from 'lucide-react';
import { MOVEMENT_LABELS, MOVEMENT_TYPES, isLowStock } from '../../services/stockCalculations.js';
import { toDate } from '../../services/financeCalculations.js';
import {
  adjustBalance, createMaterial, listMaterials, listMovements, listPendings, registerEntry, seedInitialMaterials, updateMaterial,
  type MovementType, type StockMaterial, type StockMovement, type StockPending,
} from '../../services/stockService';
import { cardClass, ghostBtn, inputClass, labelClass, primaryBtn } from './financeFormat';

type Mode = { kind: 'new' } | { kind: 'edit' | 'entry' | 'adjust'; material: StockMaterial };
const blank = { name: '', category: 'Eventos presenciais', unit: 'unidade', defaultPerEvent: '0', minLevel: '0', initialBalance: '0', description: '', active: true, quantity: '', newBalance: '', note: '', date: '' };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayStart = (v: string) => new Date(`${v}T00:00:00`);
const dayEnd = (v: string) => new Date(`${v}T23:59:59.999`);
const fmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const int = (v: string) => (v.trim() === '' ? NaN : Number(v));

export const FinanceStock: React.FC = () => {
  const [materials, setMaterials] = useState<StockMaterial[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [pendings, setPendings] = useState<StockPending[]>([]);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [filters, setFilters] = useState({ materialId: '', type: '' as '' | MovementType, from: '', to: '', order: '' });

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [m, mov, pend] = await Promise.all([listMaterials(), listMovements(), listPendings()]);
      setMaterials(m); setMovements(mov); setPendings(pend);
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar o estoque.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const low = (materials ?? []).filter(isLowStock);
  const visibleMovements = useMemo(() => movements.filter((m) => {
    const at = toDate(m.date);
    return (!filters.materialId || m.materialId === filters.materialId) && (!filters.type || m.type === filters.type)
      && (!filters.order || (m.orderId ?? '').toLowerCase().includes(filters.order.trim().toLowerCase()))
      && (!filters.from || (at && at >= dayStart(filters.from))) && (!filters.to || (at && at <= dayEnd(filters.to)));
  }), [movements, filters]);

  const open = (next: Mode) => {
    setFeedback(null); setMode(next);
    const material = next.kind === 'new' ? null : next.material;
    setForm({
      ...blank, date: today(),
      ...(material ? { name: material.name, category: material.category, unit: material.unit, defaultPerEvent: String(material.defaultPerEvent), minLevel: String(material.minLevel), description: material.description ?? '', active: material.active !== false, newBalance: String(material.balance) } : {}),
    });
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (saving) return;
    setSaving(true); setFeedback(null);
    try { await action(); await load(); setMode(null); setFeedback({ ok: true, text: success }); }
    catch (e) { setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível salvar.' }); }
    finally { setSaving(false); }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    const base = { name: form.name, category: form.category, unit: form.unit, defaultPerEvent: int(form.defaultPerEvent), minLevel: int(form.minLevel), active: form.active, description: form.description };
    if (mode.kind === 'new') return run(() => createMaterial({ ...base, initialBalance: int(form.initialBalance) }), 'Material cadastrado.');
    const { material } = mode;
    if (mode.kind === 'edit') return run(() => updateMaterial(material.id, base), 'Material atualizado.');
    const date = form.date ? new Date(`${form.date}T12:00:00`) : new Date();
    if (mode.kind === 'entry') return run(() => registerEntry({ materialId: material.id, quantity: int(form.quantity), date, note: form.note }), 'Entrada registrada.');
    return run(() => adjustBalance({ materialId: material.id, newBalance: int(form.newBalance), note: form.note, date }), 'Ajuste registrado.');
  };

  const showMaterialFields = mode?.kind === 'new' || mode?.kind === 'edit';
  const set = (patch: Partial<typeof blank>) => setForm((f) => ({ ...f, ...patch }));

  if (loadError) return <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300"><AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{loadError}</span><button type="button" className={ghostBtn} onClick={() => void load()}>Tentar novamente</button></div>;
  if (!materials) return <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando estoque…</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className={cardClass}><p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Materiais cadastrados</p><p className="mt-1 text-2xl font-extrabold text-white">{materials.length}</p></div>
        <div className={cardClass}><p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Estoque baixo</p><p className={`mt-1 text-2xl font-extrabold ${low.length ? 'text-amber-300' : 'text-white'}`}>{low.length}</p></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/50">Materiais consumíveis dos eventos presenciais. Não fazem parte do patrimônio nem do faturamento.</p>
        <button type="button" className={primaryBtn} onClick={() => open({ kind: 'new' })}><Plus className="h-4 w-4" />Novo material</button>
      </div>

      {feedback && <p role="status" className={`rounded-xl border p-3 text-xs font-medium ${feedback.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{feedback.text}</p>}

      {mode && (
        <form onSubmit={submit} className={`${cardClass} space-y-3`}>
          <h3 className="text-sm font-bold text-white">{mode.kind === 'new' ? 'Novo material' : mode.kind === 'edit' ? `Editar ${mode.material.name}` : mode.kind === 'entry' ? `Entrada de ${mode.material.name}` : `Ajustar saldo de ${mode.material.name}`}</h3>
          {showMaterialFields && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Nome *<input required value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Categoria *<input required value={form.category} onChange={(e) => set({ category: e.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Unidade de medida *<input required value={form.unit} onChange={(e) => set({ unit: e.target.value })} className={inputClass} placeholder="unidade, pacote…" /></label>
              <label className={labelClass}>Consumo padrão por evento *<input required type="number" inputMode="numeric" min="0" step="1" value={form.defaultPerEvent} onChange={(e) => set({ defaultPerEvent: e.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Limite mínimo de reposição *<input required type="number" inputMode="numeric" min="0" step="1" value={form.minLevel} onChange={(e) => set({ minLevel: e.target.value })} className={inputClass} /></label>
              {mode.kind === 'new' && <label className={labelClass}>Saldo inicial<input type="number" inputMode="numeric" min="0" step="1" value={form.initialBalance} onChange={(e) => set({ initialBalance: e.target.value })} className={inputClass} /></label>}
              <label className={`${labelClass} sm:col-span-2`}>Descrição<input value={form.description} onChange={(e) => set({ description: e.target.value })} className={inputClass} placeholder="Opcional" /></label>
              <label className="flex items-center gap-2 text-xs font-semibold text-white/70"><input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />Ativo (aparece no consumo dos eventos)</label>
            </div>
          )}
          {mode.kind === 'entry' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>Quantidade *<input required type="number" inputMode="numeric" min="1" step="1" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Data *<input required type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Observação<input value={form.note} onChange={(e) => set({ note: e.target.value })} className={inputClass} placeholder="Ex.: compra na loja X" /></label>
            </div>
          )}
          {mode.kind === 'adjust' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>Saldo contado * <span className="font-normal text-white/40">(atual: {mode.material.balance})</span><input required type="number" inputMode="numeric" min="0" step="1" value={form.newBalance} onChange={(e) => set({ newBalance: e.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Data *<input required type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Motivo *<input required value={form.note} onChange={(e) => set({ note: e.target.value })} className={inputClass} placeholder="Ex.: contagem do inventário" /></label>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" disabled={saving} className={ghostBtn} onClick={() => setMode(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {materials.length === 0 ? (
        <div className={`${cardClass} text-center`}>
          <Package className="mx-auto h-8 w-8 text-white/20" />
          <p className="mt-3 text-sm text-white/45">Nenhum material cadastrado.</p>
          <button type="button" disabled={saving} className={`${ghostBtn} mt-3`} onClick={() => void run(async () => { await seedInitialMaterials(); }, 'Materiais iniciais cadastrados (consumo padrão e mínimo em 0: configure em Editar).')}>Cadastrar Teia, Moldura, Certificado, Medalha e Figurinhas</button>
        </div>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
          {materials.map((m) => (
            <div key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{m.name}
                    {isLowStock(m) && <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Estoque baixo</span>}
                    {m.active === false && <span className="ml-2 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/55">Inativo</span>}
                  </p>
                  <p className="text-xs text-white/50">{m.category}{m.description ? ` · ${m.description}` : ''}</p>
                  <p className="mt-1 text-[11px] text-white/45">Padrão por evento: {m.defaultPerEvent} · Mínimo: {m.minLevel}</p>
                </div>
                <div className="shrink-0 text-right"><p className="text-[10px] uppercase text-white/40">Saldo</p><p className={`text-xl font-extrabold tabular-nums ${isLowStock(m) ? 'text-amber-300' : 'text-white'}`}>{m.balance} <span className="text-xs font-medium text-white/45">{m.unit}</span></p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={ghostBtn} onClick={() => open({ kind: 'entry', material: m })}>Entrada</button>
                <button type="button" className={ghostBtn} onClick={() => open({ kind: 'adjust', material: m })}>Ajustar saldo</button>
                <button type="button" className={ghostBtn} onClick={() => open({ kind: 'edit', material: m })}>Editar</button>
                <button type="button" className={ghostBtn} onClick={() => { setFilters((f) => ({ ...f, materialId: m.id })); document.getElementById('stock-history')?.scrollIntoView({ behavior: 'smooth' }); }}>Histórico</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendings.length > 0 && (
        <section className={`${cardClass} space-y-3`}>
          <h3 className="text-sm font-bold text-white">Pendências de estoque <span className="ml-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">{pendings.filter((p) => p.status === 'open').length} abertas</span></h3>
          <p className="text-[11px] text-white/45">Quantidades que faltaram em conclusões excepcionais de eventos. Não são movimentações: o saldo nunca fica negativo. Se o pedido for reaberto, a pendência é anulada e permanece aqui como histórico.</p>
          <ul className="divide-y divide-white/5">
            {[...pendings].sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || String(a.orderId).localeCompare(b.orderId)).map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{p.materialName}</p><p className="text-[11px] text-white/45">Pedido {p.orderId} · ciclo {p.cycle} · necessário {p.required}, baixado {p.fulfilled}</p></div>
                <div className="shrink-0 text-right"><p className={`text-sm font-extrabold tabular-nums ${p.status === 'open' ? 'text-amber-300' : 'text-white/35 line-through'}`}>faltaram {p.missing}</p><p className="text-[10px] text-white/40">{p.status === 'open' ? 'aberta' : 'anulada (reaberto)'}</p></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="stock-history" className={`${cardClass} space-y-3`}>
        <h3 className="text-sm font-bold text-white">Histórico de movimentações</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <label className={labelClass}>Material<select value={filters.materialId} onChange={(e) => setFilters({ ...filters, materialId: e.target.value })} className={inputClass}><option value="">Todos</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className={labelClass}>Tipo<select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as '' | MovementType })} className={inputClass}><option value="">Todos</option>{MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_LABELS[t as MovementType]}</option>)}</select></label>
          <label className={labelClass}>De<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Até<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={inputClass} /></label>
          <label className={`${labelClass} col-span-2 lg:col-span-1`}>Pedido (id)<input value={filters.order} onChange={(e) => setFilters({ ...filters, order: e.target.value })} className={inputClass} placeholder="Código do pedido" /></label>
        </div>
        {visibleMovements.length === 0 ? <p className="py-6 text-center text-sm text-white/45">{movements.length === 0 ? 'Nenhuma movimentação registrada.' : 'Nenhuma movimentação para os filtros.'}</p> : (
          <ul className="divide-y divide-white/5">
            {visibleMovements.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{m.materialName} · {MOVEMENT_LABELS[m.type]}</p>
                  <p className="text-[11px] text-white/45">{(() => { const d = toDate(m.date); return d ? fmt.format(d) : '—'; })()}{m.orderId ? ` · pedido ${m.orderId}` : ''}{m.createdBy ? ` · ${m.createdBy}` : ''}</p>
                  {m.note && <p className="text-[11px] text-white/55">{m.note}</p>}
                  {m.shortfall ? <p className="text-[11px] font-semibold text-amber-300">Estoque insuficiente: pedido {m.requested}, baixado {m.quantity}, pendência {m.shortfall}</p> : null}
                  <p className="truncate font-mono text-[10px] text-white/30">{m.id}</p>
                </div>
                <div className="shrink-0 text-right"><p className={`text-sm font-extrabold tabular-nums ${m.delta > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{m.delta > 0 ? '+' : ''}{m.delta}</p><p className="text-[10px] text-white/40">saldo {m.balanceAfter}</p></div>
              </li>
            ))}
          </ul>
        )}
        {movements.length >= 500 && <p className="text-[11px] text-white/40">Exibindo as 500 movimentações mais recentes.</p>}
      </section>
    </div>
  );
};
