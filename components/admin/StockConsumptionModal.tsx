import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Minus, Plus, ShieldAlert, X } from 'lucide-react';
import { listMaterials, type ConsumptionLine, type StockMaterial } from '../../services/stockService';

interface Props {
  title: string;
  /** Administradores (role admin/superadmin) podem concluir com estoque insuficiente, mediante confirmação explícita. */
  canOverride: boolean;
  /** Conclui o pedido e baixa o estoque; deve lançar erro (inclusive StockError) em caso de falha. */
  onConfirm: (lines: ConsumptionLine[], options: { allowShortage: boolean }) => Promise<void>;
  onClose: () => void;
}

interface MaterialRowsProps {
  rows: StockMaterial[];
  quantities: Record<string, number>;
  submitting: boolean;
  setQuantity: (id: string, value: number) => void;
}

const MaterialRows: React.FC<MaterialRowsProps> = ({ rows, quantities, submitting, setQuantity }) => (
  <>
    {rows.length === 0 && <p className="rounded-xl bg-white/5 p-3 text-xs text-white/55">Nenhum material com consumo padrão. Adicione abaixo, se algum foi usado.</p>}
    <ul className="space-y-2">
      {rows.map((m) => {
        const quantity = quantities[m.id] ?? 0;
        const short = quantity > (m.balance ?? 0);
        return (
          <li key={m.id} className={`rounded-xl border p-3 ${short ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-white/5'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{m.name}</p>
                <p className="text-[11px] text-white/45">Padrão {m.defaultPerEvent} · Em estoque {m.balance} {m.unit}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setQuantity(m.id, quantity - 1)} disabled={submitting || quantity <= 0} aria-label={`Diminuir ${m.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                <input type="number" inputMode="numeric" min={0} step={1} value={quantity} onChange={(e) => setQuantity(m.id, Number(e.target.value))} disabled={submitting} aria-label={`Quantidade de ${m.name}`} className="h-10 w-14 rounded-lg border border-white/10 bg-[#070B14] text-center text-sm font-bold text-white outline-none focus:border-blue-500/60" />
                <button type="button" onClick={() => setQuantity(m.id, quantity + 1)} disabled={submitting} aria-label={`Aumentar ${m.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
            {short && <p className="mt-2 text-xs font-semibold text-amber-300">Estoque insuficiente: necessário {quantity}, disponível {m.balance}, faltam {quantity - (m.balance ?? 0)}.</p>}
          </li>
        );
      })}
    </ul>
  </>
);

interface AddMaterialProps {
  optional: StockMaterial[];
  submitting: boolean;
  onAdd: (id: string) => void;
}

const AddMaterialSelect: React.FC<AddMaterialProps> = ({ optional, submitting, onAdd }) => (
  <>
    {optional.length > 0 && (
      <label className="block text-xs font-semibold text-white/60">Adicionar outro material
        <select value="" onChange={(e) => { if (e.target.value) onAdd(e.target.value); }} disabled={submitting}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none">
          <option value="">Selecionar…</option>
          {optional.map((m) => <option key={m.id} value={m.id}>{m.name} (estoque {m.balance})</option>)}
        </select>
      </label>
    )}
  </>
);

interface ShortageNoticeProps {
  shortages: StockMaterial[];
  quantities: Record<string, number>;
  exceptional: boolean;
  canOverride: boolean;
  acknowledged: boolean;
  submitting: boolean;
  setAcknowledged: (value: boolean) => void;
}

const ShortageNotice: React.FC<ShortageNoticeProps> = ({ shortages, quantities, exceptional, canOverride, acknowledged, submitting, setAcknowledged }) => (
  <>
    {exceptional && !canOverride && (
      <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Não é possível concluir com estoque insuficiente. Reduza a quantidade, registre uma entrada no Financeiro → Estoque ou peça a um administrador (a conclusão excepcional é restrita a administradores).</p>
    )}

    {exceptional && canOverride && (
      <div role="alert" className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-200"><ShieldAlert className="h-4 w-4 shrink-0" />Conclusão excepcional (somente administradores)</p>
        <p>Há materiais em falta. Se continuar, o evento será concluído, será baixado <strong>apenas o que existe em estoque</strong> (o saldo nunca fica negativo) e o restante ficará registrado como <strong>pendência de estoque</strong>.</p>
        <ul className="space-y-1 rounded-lg bg-black/20 p-2">
          {shortages.map((m) => {
            const need = quantities[m.id] ?? 0;
            return <li key={m.id}>{m.name}: necessário {need} · disponível {m.balance} · <strong>baixa {m.balance}</strong> · pendência {need - (m.balance ?? 0)}</li>;
          })}
        </ul>
        <label className="flex items-start gap-2 font-semibold"><input type="checkbox" className="mt-0.5" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} disabled={submitting} />
          <span>Entendo e confirmo a conclusão com pendências de estoque.</span></label>
      </div>
    )}
  </>
);

interface ConfirmFooterProps {
  submitting: boolean;
  exceptional: boolean;
  canOverride: boolean;
  acknowledged: boolean;
  asException: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmFooter: React.FC<ConfirmFooterProps> = ({ submitting, exceptional, canOverride, acknowledged, asException, onClose, onConfirm }) => (
  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
    <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 disabled:opacity-50">Cancelar</button>
    <button type="button" onClick={onConfirm} disabled={submitting || (exceptional && !(canOverride && acknowledged))}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${asException ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? 'Concluindo…' : asException ? 'Concluir com pendências de estoque' : 'Concluir evento e baixar estoque'}
    </button>
  </div>
);

const MaterialsStatus: React.FC<{ materials: StockMaterial[] | null; loadError: string }> = ({ materials, loadError }) => (
  <>
    {loadError && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{loadError}</p>}
    {!materials && !loadError && <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando estoque…</div>}
  </>
);

/** Conferência de materiais na conclusão de eventos presenciais: já vem com o padrão cadastrado; basta confirmar. */
export const StockConsumptionModal: React.FC<Props> = ({ title, canOverride, onConfirm, onClose }) => {
  const [materials, setMaterials] = useState<StockMaterial[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [added, setAdded] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMaterials()
      .then((items) => {
        if (cancelled) return;
        const active = items.filter((m) => m.active !== false);
        setMaterials(active);
        setQuantities(Object.fromEntries(active.map((m) => [m.id, m.defaultPerEvent ?? 0])));
      })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Não foi possível carregar o estoque.'); });
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => (materials ?? []).filter((m) => (m.defaultPerEvent ?? 0) > 0 || added.includes(m.id)), [materials, added]);
  const optional = (materials ?? []).filter((m) => !rows.includes(m));
  const shortages = rows.filter((m) => (quantities[m.id] ?? 0) > (m.balance ?? 0));
  const exceptional = shortages.length > 0;
  const asException = exceptional && canOverride; // editor nunca vê a ação excepcional

  // Mudar as quantidades invalida a ciência da pendência: ela precisa ser dada sobre o resumo atual.
  const setQuantity = (id: string, value: number) => { setAcknowledged(false); setQuantities((current) => ({ ...current, [id]: Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0) })); };
  const addMaterial = (id: string) => { setAdded((c) => [...c, id]); setQuantity(id, 1); };

  const confirm = async () => {
    if (submitting || (exceptional && !(canOverride && acknowledged))) return;
    setSubmitting(true); setError('');
    try {
      await onConfirm(rows.map((m) => ({ materialId: m.id, quantity: quantities[m.id] ?? 0 })), { allowShortage: exceptional });
    } catch (e) {
      const denied = (e as { code?: string })?.code === 'permission-denied';
      setError(denied ? 'Sem permissão para concluir com pendências de estoque. Peça a um administrador.' : e instanceof Error ? e.message : 'Não foi possível concluir o evento.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Materiais consumidos no evento">
      <div className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-[#0D1527] p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-white">Materiais consumidos</h2>
            <p className="truncate text-xs text-white/55">{title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Fechar" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        <MaterialsStatus materials={materials} loadError={loadError} />

        {materials && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-white/55">Já preenchido com o consumo padrão. Ajuste só o que for diferente (ex.: duas crianças, teia extra) e confirme.</p>
            <MaterialRows rows={rows} quantities={quantities} submitting={submitting} setQuantity={setQuantity} />
            <AddMaterialSelect optional={optional} submitting={submitting} onAdd={addMaterial} />
            <ShortageNotice shortages={shortages} quantities={quantities} exceptional={exceptional} canOverride={canOverride} acknowledged={acknowledged} submitting={submitting} setAcknowledged={setAcknowledged} />
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
            <ConfirmFooter submitting={submitting} exceptional={exceptional} canOverride={canOverride} acknowledged={acknowledged} asException={asException} onClose={onClose} onConfirm={() => void confirm()} />
          </div>
        )}
      </div>
    </div>
  );
};
