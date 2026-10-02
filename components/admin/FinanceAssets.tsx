import React, { useMemo, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { patrimonySummary, toDate, type Asset } from '../../services/financeCalculations.js';
import { createAsset, setAssetStatus, updateAsset, type AssetStatus } from '../../services/financeService';
import { cardClass, formatDate, formatMoney, ghostBtn, inputClass, labelClass, primaryBtn } from './financeFormat';

const CATEGORIES = ['Trajes', 'Som e áudio', 'Equipamentos de produção', 'Acessórios', 'Outros'];
const STATUS_LABELS: Record<AssetStatus, string> = { active: 'Ativo', sold: 'Vendido', discarded: 'Descartado' };
const STATUS_STYLES: Record<AssetStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', sold: 'bg-blue-500/15 text-blue-300 border-blue-500/30', discarded: 'bg-white/10 text-white/55 border-white/15',
};
const parseAmount = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));
const toInputDate = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
const fromInputDate = (v: string) => (v ? new Date(`${v}T12:00:00`) : new Date(NaN));
const emptyForm = { name: '', category: CATEGORIES[0], acquisitionDate: '', acquisitionValue: '', currentValue: '', description: '' };

export const FinanceAssets: React.FC<{ assets: Asset[]; onChanged: () => Promise<void> | void }> = ({ assets, onChanged }) => {
  const [editing, setEditing] = useState<Asset | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | AssetStatus>('active');
  const [historyId, setHistoryId] = useState<string | null>(null);

  const summary = patrimonySummary(assets);
  const categories = useMemo(() => [...new Set([...CATEGORIES, ...assets.map((a) => a.category)])], [assets]);
  const visible = assets.filter((a) => (!categoryFilter || a.category === categoryFilter) && (!statusFilter || a.status === statusFilter));

  const run = async (action: () => Promise<void>, success: string) => {
    setSaving(true); setFeedback(null);
    try { await action(); await onChanged(); setEditing(null); setFeedback({ ok: true, text: success }); }
    catch (e) { setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível salvar.' }); }
    finally { setSaving(false); }
  };

  const openForm = (asset: Asset | 'new') => {
    setFeedback(null); setEditing(asset);
    setForm(asset === 'new' ? emptyForm : {
      name: asset.name, category: asset.category, description: asset.description ?? '', acquisitionDate: toInputDate(toDate(asset.acquisitionDate)),
      acquisitionValue: String(asset.acquisitionValue), currentValue: String(asset.currentValue),
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = { name: form.name, category: form.category, description: form.description, acquisitionDate: fromInputDate(form.acquisitionDate), acquisitionValue: parseAmount(form.acquisitionValue), currentValue: parseAmount(form.currentValue) };
    if (editing === 'new') return run(() => createAsset(input), 'Item cadastrado.');
    if (editing) return run(() => updateAsset(editing, input), 'Item atualizado.');
  };

  const changeStatus = (asset: Asset, status: AssetStatus) => {
    const verb = status === 'sold' ? 'vendido' : status === 'discarded' ? 'descartado' : 'ativo';
    if (status !== 'active' && !window.confirm(`Marcar "${asset.name}" como ${verb}? Ele deixa de compor o patrimônio atual, mas o registro é mantido.`)) return;
    return run(() => setAssetStatus(asset.id, status), `Item marcado como ${verb}.`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={cardClass}><p className="text-xs font-semibold uppercase tracking-wider text-white/50">Patrimônio atual (ativos)</p><p className="mt-1 text-2xl font-extrabold text-white">{formatMoney(summary.currentTotal)}</p></div>
        <div className={cardClass}><p className="text-xs font-semibold uppercase tracking-wider text-white/50">Itens ativos</p><p className="mt-1 text-2xl font-extrabold text-white">{summary.activeCount}</p></div>
        <div className={cardClass}><p className="text-xs font-semibold uppercase tracking-wider text-white/50">Valor de aquisição (ativos)</p><p className="mt-1 text-2xl font-extrabold text-white/80">{formatMoney(summary.acquisitionTotal)}</p></div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className={`${labelClass} w-40`}>Categoria<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}><option value="">Todas</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className={`${labelClass} w-40`}>Situação<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | AssetStatus)} className={inputClass}><option value="">Todas</option>{(Object.keys(STATUS_LABELS) as AssetStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
        <button type="button" className={`${primaryBtn} ml-auto`} onClick={() => openForm('new')}><Plus className="h-4 w-4" />Novo item</button>
      </div>

      {feedback && <p role="status" className={`rounded-xl border p-3 text-xs font-medium ${feedback.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{feedback.text}</p>}

      {editing && (
        <form onSubmit={submit} className={`${cardClass} space-y-3`}>
          <h3 className="text-sm font-bold text-white">{editing === 'new' ? 'Novo item do patrimônio' : `Editar ${editing.name}`}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Nome do item *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}>Categoria *<input required list="asset-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} /></label>
            <datalist id="asset-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            <label className={labelClass}>Data de aquisição *<input required type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}>Valor de aquisição *<input required type="number" inputMode="decimal" min="0" step="0.01" value={form.acquisitionValue} onChange={(e) => setForm({ ...form, acquisitionValue: e.target.value })} className={inputClass} placeholder="0,00" /></label>
            <label className={labelClass}>Valor atual estimado *<input required type="number" inputMode="decimal" min="0" step="0.01" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} className={inputClass} placeholder="0,00" /></label>
            <label className={labelClass}>Descrição<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Opcional" /></label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" disabled={saving} className={ghostBtn} onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {visible.length === 0 ? (
        <div className={`${cardClass} text-center`}><Package className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 text-sm text-white/45">{assets.length === 0 ? 'Nenhum item cadastrado no patrimônio.' : 'Nenhum item para os filtros selecionados.'}</p></div>
      ) : (
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
          {visible.map((asset) => {
            const acquired = toDate(asset.acquisitionDate);
            return (
              <div key={asset.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{asset.name} <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[asset.status]}`}>{STATUS_LABELS[asset.status]}</span></p>
                    <p className="text-xs text-white/50">{asset.category}{asset.description ? ` · ${asset.description}` : ''}</p>
                    <p className="mt-1 text-[11px] text-white/45">Adquirido em {acquired ? formatDate(acquired) : '—'} por {formatMoney(asset.acquisitionValue)}</p>
                  </div>
                  <div className="shrink-0 text-right"><p className="text-[10px] uppercase text-white/40">Valor atual</p><p className="text-sm font-extrabold text-white">{formatMoney(asset.currentValue)}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={ghostBtn} onClick={() => openForm(asset)}>Editar / atualizar valor</button>
                  <button type="button" className={ghostBtn} onClick={() => setHistoryId(historyId === asset.id ? null : asset.id)}>Histórico</button>
                  {asset.status === 'active' ? (
                    <>
                      <button type="button" className={ghostBtn} disabled={saving} onClick={() => changeStatus(asset, 'sold')}>Marcar vendido</button>
                      <button type="button" className={`${ghostBtn} hover:!text-red-300`} disabled={saving} onClick={() => changeStatus(asset, 'discarded')}>Descartar</button>
                    </>
                  ) : <button type="button" className={ghostBtn} disabled={saving} onClick={() => changeStatus(asset, 'active')}>Reativar</button>}
                </div>
                {historyId === asset.id && (
                  <ul className="mt-3 space-y-1 rounded-xl bg-black/20 p-3 text-xs text-white/60">
                    <li>Aquisição: {acquired ? formatDate(acquired) : '—'} · {formatMoney(asset.acquisitionValue)}</li>
                    {(asset.valueHistory ?? []).map((h, i) => <li key={i}>Valor estimado em {formatDate(new Date(h.at))}: {formatMoney(h.value)}</li>)}
                    {asset.status !== 'active' && toDate(asset.statusChangedAt) && <li>{STATUS_LABELS[asset.status]} em {formatDate(toDate(asset.statusChangedAt)!)}</li>}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
