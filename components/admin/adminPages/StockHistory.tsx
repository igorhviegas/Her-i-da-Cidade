import React from 'react';
import { MOVEMENT_LABELS, MOVEMENT_TYPES } from '../../../services/stockCalculations.js';
import { toDate } from '../../../services/financeCalculations.js';
import type { MovementType, StockMaterial, StockMovement } from '../../../services/stockService';
import { cardClass, inputClass, labelClass } from '../financeFormat';
import type { StockFilters } from './stockPageHelpers';

const fmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

interface StockHistoryProps {
  materials: StockMaterial[];
  movements: StockMovement[];
  visibleMovements: StockMovement[];
  filters: StockFilters;
  setFilters: (filters: StockFilters) => void;
}

export const StockHistory: React.FC<StockHistoryProps> = ({ materials, movements, visibleMovements, filters, setFilters }) => (
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
);
