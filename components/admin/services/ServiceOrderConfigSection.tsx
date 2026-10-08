import React from 'react';
import type { OrderStatus, ProductionType } from '../../../types';
import { defaultInitialStatus } from '../../../services/orderInitialStatus.js';
import type { ServiceFormData } from './serviceForm';

interface ServiceOrderConfigSectionProps {
  formData: ServiceFormData;
  orderConfigError: string;
  onChange: (patch: Partial<ServiceFormData>) => void;
}

export const ServiceOrderConfigSection: React.FC<ServiceOrderConfigSectionProps> = ({
  formData,
  orderConfigError,
  onChange,
}) => {
  return (
    <section className="space-y-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Configuração de Pedido</h4>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-white/45">
            Defina como pedidos deste serviço serão iniciados na Central do Herói. Serviços antigos sem configuração continuam funcionando normalmente.
          </p>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-xs font-semibold text-white/80">
          <input
            type="checkbox"
            checked={formData.generateOrder}
            onChange={(event) => {
              onChange({ generateOrder: event.target.checked });
            }}
            className="h-4 w-4 accent-blue-500"
          />
          Gerar pedido no CRM
        </label>
      </div>
      <p className="-mt-2 text-[11px] text-white/40">Quando ativado, uma compra deste serviço poderá gerar um pedido na Central do Herói.</p>

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${!formData.generateOrder ? 'opacity-45' : ''}`}>
        <label className="block text-xs font-semibold text-white/70">
          Tipo de produção
          <select
            value={formData.productionType}
            disabled={!formData.generateOrder}
            onChange={(event) => {
              const productionType = event.target.value as ProductionType | '';
              onChange({ productionType, initialStatus: formData.initialStatus || defaultInitialStatus(productionType) });
            }}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60 disabled:cursor-not-allowed"
          >
            <option value="">Selecione</option>
            <option value="scheduled">Agendado</option>
            <option value="recording">Gravação</option>
            <option value="editing">Edição</option>
            <option value="immediate">Imediato</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-white/70">
          Status inicial
          <select
            value={formData.initialStatus}
            disabled={!formData.generateOrder}
            onChange={(event) => {
              onChange({ initialStatus: event.target.value as OrderStatus | '' });
            }}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60 disabled:cursor-not-allowed"
          >
            <option value="">Selecione</option>
            <option value="scheduled">Agendado</option>
            <option value="recording">Gravar</option>
            <option value="editing">Editar</option>
            <option value="delivery">Entregar</option>
            <option value="completed">Concluído</option>
          </select>
        </label>
        <label className="flex min-h-12 items-center gap-2.5 rounded-xl border border-white/10 bg-[#070B14] px-3 text-xs font-semibold text-white/75 sm:col-span-2">
          <input
            type="checkbox"
            checked={formData.autoComplete}
            disabled={!formData.generateOrder}
            onChange={(event) => {
              onChange({ autoComplete: event.target.checked });
            }}
            className="h-4 w-4 accent-blue-500"
          />
          Concluir automaticamente
          <span className="ml-auto text-[10px] font-normal text-white/35">Usado principalmente em serviços imediatos</span>
        </label>
        <label className="block text-xs font-semibold text-white/70 sm:max-w-xs">
          Prazo de entrega (dias corridos)
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={formData.defaultDeliveryDays}
            disabled={!formData.generateOrder}
            onChange={(event) => {
              onChange({ defaultDeliveryDays: event.target.value });
            }}
            placeholder="Sem prazo"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:cursor-not-allowed"
          />
        </label>
      </div>
      {orderConfigError && <p role="alert" className="text-xs text-red-300">{orderConfigError}</p>}
    </section>
  );
};
