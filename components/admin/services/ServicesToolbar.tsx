import React from 'react';
import { Sparkles, Plus, Search, Check, X, AlertTriangle } from 'lucide-react';
import type { Service } from '../../../types';

export type ServiceFeedback = { type: 'success' | 'error'; message: string } | null;
export type ServiceStatusFilter = 'all' | 'active' | 'inactive';

interface ServicesToolbarProps {
  services: Service[];
  activeCount: number;
  inactiveCount: number;
  feedback: ServiceFeedback;
  setFeedback: (feedback: ServiceFeedback) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterStatus: ServiceStatusFilter;
  setFilterStatus: (value: ServiceStatusFilter) => void;
  handleOpenCreateModal: () => void;
}

export const ServicesToolbar: React.FC<ServicesToolbarProps> = ({
  services,
  activeCount,
  inactiveCount,
  feedback,
  setFeedback,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  handleOpenCreateModal,
}) => {
  return (
    <>
      {/* 1. CABEÇALHO DA SEÇÃO COM AÇÕES */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0D1527] border border-white/10 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Gerenciamento de Serviços
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-white/60 font-light max-w-xl">
            Edite nomes, preços, descrições, imagens e reordene os serviços exibidos no site público em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo serviço</span>
          </button>
        </div>
      </div>

      {/* 2. NOTIFICAÇÃO / FEEDBACK BANNER */}
      {feedback && (
        <div 
          className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top-2 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'bg-red-500/15 border-red-500/40 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)}
            className="p-1 text-white/50 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. BARRA DE BUSCA E FILTROS */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0D1527] border border-white/10 p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar serviços por nome, categoria ou preço..."
            className="w-full pl-10 pr-10 py-2 bg-[#070B14] border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros de Status */}
        <div className="flex items-center gap-1.5 p-1 bg-[#070B14] border border-white/10 rounded-xl shrink-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Todos ({services.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400/80 hover:text-emerald-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Ativos ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterStatus === 'inactive'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Inativos ({inactiveCount})
          </button>
        </div>
      </div>
    </>
  );
};
