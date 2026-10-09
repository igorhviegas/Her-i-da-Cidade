import React, { useMemo } from 'react';
import type { Client } from '../../../types';
import type { RevenueEntry } from '../../../services/financeCalculations.js';
import { clientRetention, type ClientRetentionRow } from '../../../services/reports.js';
import { cardClass, formatDate, formatMoney } from '../financeFormat';
import { Kpi } from './FinanceKpi';
import type { Lookup } from './financePageHooks';

const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);
/** Mediana de dias entre pedidos em linguagem corrida (o negócio tem ciclo anual: aniversário). */
const gapLabel = (days: number | null) => (days === null ? '—' : days < 60 ? `${Math.round(days)} dias` : `${(days / 30.4).toFixed(1).replace('.', ',')} meses`);

export const ReportsClients: React.FC<{ entries: RevenueEntry[]; clients: Lookup<Client> }> = ({ entries, clients }) => {
  const report = useMemo(() => clientRetention(entries), [entries]);
  const name = (id: string) => clients.get(id)?.name || (clients.has(id) ? 'Cliente removido' : 'Carregando…');
  const phone = (id: string) => clients.get(id)?.whatsapp || '';

  if (report.clients === 0) return <p className={`${cardClass} text-sm text-white/50`}>Ainda não há clientes com serviços concluídos.</p>;

  const list = (rows: ClientRetentionRow[], empty: string, lastLabel: string) => (rows.length === 0 ? <p className="text-sm text-white/45">{empty}</p> : (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-[11px] uppercase tracking-wider text-white/45"><th className="pb-2 font-semibold">Cliente</th><th className="pb-2 text-right font-semibold">Pedidos</th><th className="pb-2 text-right font-semibold">Total</th><th className="pb-2 text-right font-semibold">{lastLabel}</th></tr></thead>
      <tbody className="divide-y divide-white/5">
        {rows.map((r) => (
          <tr key={r.clientId}>
            <td className="py-2 pr-3"><span className="block text-white">{name(r.clientId)}</span>{phone(r.clientId) && <span className="block text-xs text-white/45">{phone(r.clientId)}</span>}</td>
            <td className="py-2 text-right tabular-nums text-white/70">{r.orders}</td>
            <td className="py-2 text-right tabular-nums text-white">{formatMoney(r.revenue)}</td>
            <td className="py-2 text-right text-xs text-white/55">{formatDate(r.lastDate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Clientes" value={String(report.clients)} hint="Com serviço concluído" />
        <Kpi label="Voltaram" value={pct(report.returnRate)} hint={`${report.returning} com 2 ou mais pedidos`} tone="text-emerald-300" />
        <Kpi label="Valor por cliente" value={report.avgLtv === null ? '—' : formatMoney(report.avgLtv)} hint="Faturamento médio (LTV)" />
        <Kpi label="Pedidos por cliente" value={report.avgOrders === null ? '—' : report.avgOrders.toFixed(2).replace('.', ',')} />
        <Kpi label="Entre um pedido e outro" value={gapLabel(report.medianGapDays)} hint="Mediana de quem voltou" />
      </div>
      <div className={cardClass}>
        <h3 className="mb-1 text-sm font-bold text-white">Hora de reativar</h3>
        <p className="mb-3 text-xs text-white/50">Clientes cuja última compra foi há 10 a 14 meses: perto do próximo aniversário. Maior valor primeiro.</p>
        {list(report.winback, 'Ninguém na janela de 10 a 14 meses agora.', 'Última compra')}
      </div>
      <div className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-white">Melhores clientes</h3>
        {list(report.top, 'Sem clientes.', 'Última compra')}
      </div>
    </div>
  );
};
