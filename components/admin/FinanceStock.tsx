import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { isLowStock } from '../../services/stockCalculations.js';
import {
  adjustBalance, createMaterial, listMaterials, listMovements, listPendings, registerEntry, seedInitialMaterials, updateMaterial,
  type StockMaterial, type StockMovement, type StockPending,
} from '../../services/stockService';
import { cardClass, ghostBtn, primaryBtn } from './financeFormat';
import { blank, int, matchesMovementFilters, today, type StockFilters, type StockMode } from './adminPages/stockPageHelpers';
import { StockMaterialForm } from './adminPages/StockMaterialForm';
import { StockMaterialList } from './adminPages/StockMaterialList';
import { StockPendings } from './adminPages/StockPendings';
import { StockHistory } from './adminPages/StockHistory';

export const FinanceStock: React.FC = () => {
  const [materials, setMaterials] = useState<StockMaterial[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [pendings, setPendings] = useState<StockPending[]>([]);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<StockMode | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [filters, setFilters] = useState<StockFilters>({ materialId: '', type: '' as StockFilters['type'], from: '', to: '', order: '' });

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [m, mov, pend] = await Promise.all([listMaterials(), listMovements(), listPendings()]);
      setMaterials(m); setMovements(mov); setPendings(pend);
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar o estoque.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const low = (materials ?? []).filter(isLowStock);
  const visibleMovements = useMemo(() => movements.filter((m) => matchesMovementFilters(m, filters)), [movements, filters]);

  const open = (next: StockMode) => {
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

      {mode && <StockMaterialForm mode={mode} form={form} setForm={setForm} saving={saving} onSubmit={submit} onCancel={() => setMode(null)} />}

      <StockMaterialList materials={materials} saving={saving} onOpen={open}
        onHistory={(materialId) => { setFilters((f) => ({ ...f, materialId })); document.getElementById('stock-history')?.scrollIntoView({ behavior: 'smooth' }); }}
        onSeed={() => void run(async () => { await seedInitialMaterials(); }, 'Materiais iniciais cadastrados (consumo padrão e mínimo em 0: configure em Editar).')} />

      {pendings.length > 0 && <StockPendings pendings={pendings} />}

      <StockHistory materials={materials} movements={movements} visibleMovements={visibleMovements} filters={filters} setFilters={setFilters} />
    </div>
  );
};
