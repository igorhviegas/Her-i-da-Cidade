import React, { useMemo, useState } from 'react';
import type { Client, Service } from '../../../types';
import type { RevenueEntry } from '../../../services/financeCalculations.js';
import { eventProfitability, presetRange, serviceProfitability, type Preset } from '../../../services/reports.js';
import { cardClass, formatDate, formatMoney } from '../financeFormat';
import { Kpi } from './FinanceKpi';
import type { Lookup } from './financePageHooks';
import { PresetChips } from './ReportsPresets';

const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);
const marginTone = (value: number) => (value < 0 ? 'text-red-300' : 'text-emerald-300');
const th = 'pb-2 text-right font-semibold';

interface Props { entries: RevenueEntry[]; costs: RevenueEntry[]; clients: Lookup<Client>; services: Lookup<Service> }

export const ReportsProfitability: React.FC<Props> = ({ entries, costs, clients, services }) => {
  const [preset, setPreset] = useState<Preset>('month');
  const range = useMemo(() => presetRange(preset), [preset]);
  const byService = useMemo(() => serviceProfitability(entries, costs, range), [entries, costs, range]);
  const events = useMemo(() => eventProfitability(entries, costs, range), [entries, costs, range]);
  const serviceName = (id?: string) => (id ? services.get(id)?.title || (services.has(id) ? 'Serviço removido' : 'Carregando…') : '—');
  const clientName = (id?: string) => (id ? clients.get(id)?.name || (clients.has(id) ? 'Cliente removido' : 'Carregando…') : '—');

  const revenue = byService.reduce((sum, r) => sum + r.revenue, 0);
  const cost = byService.reduce((sum, r) => sum + r.cost, 0);

  return (
    <div className="space-y-5">
      <PresetChips value={preset} onChange={setPreset} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Faturamento" value={formatMoney(revenue)} />
        <Kpi label="Custos registrados" value={formatMoney(cost)} tone="text-red-300" hint="Edição e despesas de eventos" />
        <Kpi label="Margem" value={formatMoney(revenue - cost)} tone={marginTone(revenue - cost)} />
        <Kpi label="Margem %" value={pct(revenue > 0 ? (revenue - cost) / revenue : null)} tone={marginTone(revenue - cost)} />
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <h3 className="mb-1 text-sm font-bold text-white">Por serviço</h3>
        <p className="mb-3 text-xs text-white/50">Só entram os custos registrados no sistema: custo de edição (Vídeo Personalizado) e despesas de eventos, que já incluem o deslocamento. Serviço sem custo registrado mostra margem de 100%. Aqui cada parcela conta no mês em que foi lançada: a entrada de um evento pode ter caído em outro mês, então veja "Por evento" para a margem do evento inteiro.</p>
        {byService.length === 0 ? <p className="text-sm text-white/45">Sem faturamento no período.</p> : (
          <table className="w-full min-w-[34rem] text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-white/45"><th className="pb-2 font-semibold">Serviço</th><th className={th}>Qtd</th><th className={th}>Faturamento</th><th className={th}>Custos</th><th className={th}>Margem</th><th className={th}>%</th><th className={th}>Por serviço</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {byService.map((r) => (
                <tr key={r.serviceId}>
                  <td className="py-2 pr-3 text-white">{serviceName(r.serviceId)}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{r.count}</td>
                  <td className="py-2 text-right tabular-nums text-white">{formatMoney(r.revenue)}</td>
                  <td className="py-2 text-right tabular-nums text-red-300/90">{r.cost > 0 ? formatMoney(r.cost) : '—'}</td>
                  <td className={`py-2 text-right tabular-nums ${marginTone(r.margin)}`}>{formatMoney(r.margin)}</td>
                  <td className="py-2 text-right tabular-nums text-white/60">{pct(r.marginPct)}</td>
                  <td className="py-2 text-right tabular-nums text-white/60">{r.marginPerOrder === null ? '—' : formatMoney(r.marginPerOrder)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <h3 className="mb-1 text-sm font-bold text-white">Por evento</h3>
        <p className="mb-3 text-xs text-white/50">Eventos concluídos no período. Receita e custo são do evento inteiro (entrada, 2ª parcela, ajustes e despesa).</p>
        {events.rows.length === 0 ? <p className="text-sm text-white/45">Nenhum evento concluído no período.</p> : (
          <>
            <table className="w-full min-w-[32rem] text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-white/45"><th className="pb-2 font-semibold">Evento</th><th className={th}>Receita</th><th className={th}>Custo</th><th className={th}>Margem</th><th className={th}>%</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {events.rows.map((r) => (
                  <tr key={r.orderId}>
                    <td className="py-2 pr-3"><span className="block text-white">{r.childName || clientName(r.clientId)}</span><span className="block text-xs text-white/45">{formatDate(r.date)} · {serviceName(r.serviceId)}</span></td>
                    <td className="py-2 text-right tabular-nums text-white">{formatMoney(r.revenue)}</td>
                    <td className="py-2 text-right tabular-nums text-red-300/90">{formatMoney(r.cost)}</td>
                    <td className={`py-2 text-right tabular-nums ${marginTone(r.margin)}`}>{formatMoney(r.margin)}</td>
                    <td className="py-2 text-right tabular-nums text-white/60">{pct(r.marginPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-white/55">{events.totals.count} evento(s): receita {formatMoney(events.totals.revenue)}, custo {formatMoney(events.totals.cost)}, margem {formatMoney(events.totals.margin)} ({pct(events.totals.marginPct)}).</p>
          </>
        )}
      </div>
    </div>
  );
};
