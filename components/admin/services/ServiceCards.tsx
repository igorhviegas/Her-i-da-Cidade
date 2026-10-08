import React from 'react';
import { ChevronUp, ChevronDown, Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import type { Service } from '../../../types';

interface ServiceCardsProps {
  filteredServices: Service[];
  handleQuickOrderChange: (service: Service, delta: number) => void;
  handleToggleStatus: (service: Service) => void;
  handleOpenEditModal: (service: Service) => void;
  setServiceToDelete: (service: Service) => void;
}

export const ServiceCards: React.FC<ServiceCardsProps> = ({
  filteredServices,
  handleQuickOrderChange,
  handleToggleStatus,
  handleOpenEditModal,
  setServiceToDelete,
}) => {
  return (
    <div className="lg:hidden space-y-4">
      {filteredServices.map((service) => {
        const isActive = service.active !== false;
        return (
          <div
            key={service.id}
            className={`bg-[#0D1527] border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg transition-all ${
              !isActive ? 'opacity-75 bg-[#090E1B]' : ''
            }`}
          >
            {/* Topo do card com miniatura e dados principais */}
            <div className="flex items-start gap-3.5">
              <div className="w-16 h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                {service.imageUrl ? (
                  <img
                    src={service.imageUrl}
                    alt={service.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-base font-bold text-white tracking-tight leading-snug">
                    {service.title}
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-white/70 border border-white/10">
                    {service.category}
                  </span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {service.price}
                  </span>
                </div>

                <p className="text-xs text-white/60 font-light line-clamp-2 pt-1">
                  {service.description}
                </p>
              </div>
            </div>

            {/* Barra de controle inferior: Ordem, Status e Botões de Ação */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
              {/* Controle de Ordem */}
              <div className="flex items-center gap-1.5 bg-[#070B14] border border-white/10 px-2 py-1 rounded-xl">
                <span className="text-[11px] text-white/40 font-medium">Ordem:</span>
                <button
                  onClick={() => handleQuickOrderChange(service, -1)}
                  className="p-0.5 text-white/60 hover:text-white"
                  title="Diminuir ordem"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold text-blue-400 px-1">
                  {service.order ?? 0}
                </span>
                <button
                  onClick={() => handleQuickOrderChange(service, 1)}
                  className="p-0.5 text-white/60 hover:text-white"
                  title="Aumentar ordem"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Botão de Toggle Status */}
              <button
                onClick={() => handleToggleStatus(service)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  isActive
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/5 border-white/15 text-white/50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-white/40'}`} />
                <span>{isActive ? 'Ativo' : 'Inativo'}</span>
              </button>

              {/* Ações Editar e Excluir */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEditModal(service)}
                  className="p-2 text-white/80 bg-white/5 hover:bg-blue-600 rounded-xl border border-white/5 transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setServiceToDelete(service)}
                  className="p-2 text-red-400 bg-red-500/10 hover:bg-red-600 rounded-xl border border-red-500/20 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
