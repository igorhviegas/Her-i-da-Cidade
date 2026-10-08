import React from 'react';
import { Package } from 'lucide-react';
import { isLowStock } from '../../../services/stockCalculations.js';
import type { StockMaterial } from '../../../services/stockService';
import { cardClass, ghostBtn } from '../financeFormat';
import type { StockMode } from './stockPageHelpers';

interface StockMaterialListProps {
  materials: StockMaterial[];
  saving: boolean;
  onOpen: (next: StockMode) => void;
  onHistory: (materialId: string) => void;
  onSeed: () => void;
}

export const StockMaterialList: React.FC<StockMaterialListProps> = ({ materials, saving, onOpen, onHistory, onSeed }) => (
  materials.length === 0 ? (
    <div className={`${cardClass} text-center`}>
      <Package className="mx-auto h-8 w-8 text-white/20" />
      <p className="mt-3 text-sm text-white/45">Nenhum material cadastrado.</p>
      <button type="button" disabled={saving} className={`${ghostBtn} mt-3`} onClick={onSeed}>Cadastrar Teia, Moldura, Certificado, Medalha e Figurinhas</button>
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
            <button type="button" className={ghostBtn} onClick={() => onOpen({ kind: 'entry', material: m })}>Entrada</button>
            <button type="button" className={ghostBtn} onClick={() => onOpen({ kind: 'adjust', material: m })}>Ajustar saldo</button>
            <button type="button" className={ghostBtn} onClick={() => onOpen({ kind: 'edit', material: m })}>Editar</button>
            <button type="button" className={ghostBtn} onClick={() => onHistory(m.id)}>Histórico</button>
          </div>
        </div>
      ))}
    </div>
  )
);
