import React from 'react';
import { ChevronUp, ChevronDown, Image as ImageIcon, Tag, Pencil, Trash2 } from 'lucide-react';
import type { Service } from '../../../types';

interface ServicesTableProps {
  filteredServices: Service[];
  handleQuickOrderChange: (service: Service, delta: number) => void;
  handleToggleStatus: (service: Service) => void;
  handleOpenEditModal: (service: Service) => void;
  setServiceToDelete: (service: Service) => void;
}

export const ServicesTable: React.FC<ServicesTableProps> = ({
  filteredServices,
  handleQuickOrderChange,
  handleToggleStatus,
  handleOpenEditModal,
  setServiceToDelete,
}) => {
  return (
    <div className="hidden lg:block bg-[#0D1527] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            <th className="py-3.5 px-4 w-16 text-center">Ordem</th>
            <th className="py-3.5 px-4 w-20">Imagem</th>
            <th className="py-3.5 px-4">Nome & Descrição</th>
            <th className="py-3.5 px-4 w-36">Categoria</th>
            <th className="py-3.5 px-4 w-36">Preço</th>
            <th className="py-3.5 px-4 w-32 text-center">Status</th>
            <th className="py-3.5 px-4 w-32 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-sm">
          {filteredServices.map((service) => {
            const isActive = service.active !== false;
            return (
              <tr 
                key={service.id} 
                className={`hover:bg-white/[0.02] transition-colors ${!isActive ? 'opacity-70 bg-black/20' : ''}`}
              >
                {/* Ordem com botões rápidos */}
                <td className="py-4 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <button
                      onClick={() => handleQuickOrderChange(service, -1)}
                      title="Mover para cima"
                      className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono font-bold text-sm text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded-md">
                      {service.order ?? 0}
                    </span>
                    <button
                      onClick={() => handleQuickOrderChange(service, 1)}
                      title="Mover para baixo"
                      className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>

                {/* Imagem */}
                <td className="py-4 px-4">
                  <div className="w-14 h-20 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 relative group">
                    {service.imageUrl ? (
                      <img
                        src={service.imageUrl}
                        alt={service.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </td>

                {/* Nome e Descrição */}
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base tracking-tight">
                        {service.title}
                      </span>
                      {!isActive && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-white/10 text-white/50 rounded-full">
                          Oculto no site
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 font-light line-clamp-2 leading-relaxed max-w-xl">
                      {service.description}
                    </p>
                    <div className="text-[10px] text-white/30 font-mono">
                      ID: {service.id}
                    </div>
                  </div>
                </td>

                {/* Categoria */}
                <td className="py-4 px-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-white/80 border border-white/10">
                    <Tag className="w-3 h-3 text-blue-400" />
                    {service.category}
                  </span>
                </td>

                {/* Preço (String livre) */}
                <td className="py-4 px-4">
                  <span className="inline-flex items-center gap-1 font-bold text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    {service.price}
                  </span>
                </td>

                {/* Status Toggle */}
                <td className="py-4 px-4 text-center">
                  <button
                    onClick={() => handleToggleStatus(service)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                        : 'bg-white/5 border-white/15 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
                    <span>{isActive ? 'Ativo' : 'Inativo'}</span>
                  </button>
                </td>

                {/* Ações */}
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(service)}
                      title="Editar serviço"
                      className="p-2 text-white/70 hover:text-white bg-white/5 hover:bg-blue-600 rounded-xl transition-colors border border-white/5"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setServiceToDelete(service)}
                      title="Excluir serviço"
                      className="p-2 text-red-400 hover:text-red-200 bg-red-500/10 hover:bg-red-600 rounded-xl transition-colors border border-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
