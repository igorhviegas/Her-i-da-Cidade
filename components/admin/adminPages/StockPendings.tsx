import React from 'react';
import type { StockPending } from '../../../services/stockService';
import { cardClass } from '../financeFormat';

export const StockPendings: React.FC<{ pendings: StockPending[] }> = ({ pendings }) => (
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
);
