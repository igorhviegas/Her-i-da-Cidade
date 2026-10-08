import React from 'react';
import { Trash2, Info, RefreshCw } from 'lucide-react';
import type { Service } from '../../../types';

interface DeleteServiceModalProps {
  serviceToDelete: Service;
  isDeleting: boolean;
  setServiceToDelete: (service: Service | null) => void;
  handleConfirmDelete: () => void;
}

export const DeleteServiceModal: React.FC<DeleteServiceModalProps> = ({
  serviceToDelete,
  isDeleting,
  setServiceToDelete,
  handleConfirmDelete,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => !isDeleting && setServiceToDelete(null)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-[#0D1527] border border-red-500/30 rounded-2xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <Trash2 className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-white mb-2">
          Excluir Serviço Permanentemente?
        </h3>
        <p className="text-xs text-white/70 font-light leading-relaxed mb-4">
          Tem certeza que deseja excluir o serviço <strong className="text-white font-semibold">"{serviceToDelete.title}"</strong>? 
          O documento correspondente será removido da base do Firestore e deixará de existir no site público.
        </p>

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300 mb-6 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong>Dica:</strong> Em vez de excluir, você pode apenas <strong>Desativar</strong> o serviço para ocultá-lo do público sem perder suas informações.
          </span>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setServiceToDelete(null)}
            className="px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleConfirmDelete}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
          >
            {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Sim, Excluir Serviço</span>
          </button>
        </div>
      </div>
    </div>
  );
};
