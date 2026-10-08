import React from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';

interface OrdersToolbarProps {
  search: string;
  setSearch: (value: string) => void;
  refreshing: boolean;
  loading: boolean;
  handleRefresh: () => Promise<void>;
  setCreateOpen: (open: boolean) => void;
}

export const OrdersToolbar: React.FC<OrdersToolbarProps> = ({ search, setSearch, refreshing, loading, handleRefresh, setCreateOpen }) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Central do Herói</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Pedidos</h2>
        <p className="mt-1 text-sm text-white/50">Acompanhe cada pedido por etapa de produção.</p>
      </div>
      <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <label className="relative block sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente ou serviço"
            aria-label="Buscar pedidos por cliente ou serviço"
            className="w-full rounded-xl border border-white/10 bg-[#0D1527] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-blue-500/60"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || loading}
          aria-label="Atualizar pedidos"
          title="Atualizar pedidos"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D1527] px-3.5 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60 sm:min-h-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="sm:hidden">{refreshing ? 'Atualizando…' : 'Atualizar'}</span>
        </button>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition-colors hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" /> Novo Pedido
        </button>
      </div>
    </div>
  );
};
