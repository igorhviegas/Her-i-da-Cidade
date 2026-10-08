import React from 'react';
import { AlertTriangle, RefreshCw, Layers, Plus } from 'lucide-react';
import type { ServiceStatusFilter } from './ServicesToolbar';

export const ServicesError: React.FC<{ error: string; refetch: () => void }> = ({ error, refetch }) => {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
      <h3 className="text-base font-bold text-white mb-1">Não foi possível carregar os serviços</h3>
      <p className="text-xs text-white/60 mb-4 font-light max-w-md mx-auto">{error}</p>
      <button
        onClick={() => refetch()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Tentar novamente</span>
      </button>
    </div>
  );
};

export const ServicesLoading: React.FC = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="bg-[#0D1527] border border-white/10 rounded-2xl p-4 animate-pulse flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="w-1/3 h-4 bg-white/10 rounded" />
            <div className="w-1/4 h-3 bg-white/5 rounded" />
          </div>
          <div className="w-20 h-6 bg-white/10 rounded-full" />
        </div>
      ))}
    </div>
  );
};

interface ServicesEmptyProps {
  searchTerm: string;
  filterStatus: ServiceStatusFilter;
  setSearchTerm: (value: string) => void;
  setFilterStatus: (value: ServiceStatusFilter) => void;
  handleOpenCreateModal: () => void;
}

export const ServicesEmpty: React.FC<ServicesEmptyProps> = ({
  searchTerm,
  filterStatus,
  setSearchTerm,
  setFilterStatus,
  handleOpenCreateModal,
}) => {
  return (
    <div className="bg-[#0D1527] border border-white/10 rounded-2xl p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 mx-auto mb-4">
        <Layers className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1">
        {searchTerm || filterStatus !== 'all' ? 'Nenhum serviço corresponde ao filtro' : 'Você ainda não possui serviços cadastrados'}
      </h3>
      <p className="text-xs text-white/60 font-light max-w-sm mx-auto mb-6">
        {searchTerm || filterStatus !== 'all'
          ? 'Tente ajustar os termos da pesquisa ou alterar os filtros de status.'
          : 'Clique no botão abaixo para adicionar seu primeiro serviço ao catálogo.'}
      </p>
      {searchTerm || filterStatus !== 'all' ? (
        <button
          onClick={() => {
            setSearchTerm('');
            setFilterStatus('all');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
        >
          <span>Limpar filtros de busca</span>
        </button>
      ) : (
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Criar primeiro serviço</span>
        </button>
      )}
    </div>
  );
};
