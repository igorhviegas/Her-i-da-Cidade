import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { RANKING_PERIODS, serviceRanking, type RankingPeriod, type RevenueEntry } from '../../services/financeCalculations.js';
import { cardClass, formatMoney } from './financeFormat';

const PERIOD_LABELS: Record<RankingPeriod, string> = { all: 'Geral', '30d': '30 dias', '7d': '7 dias', month: 'Este mês' };
const MEDAL = ['text-amber-300', 'text-slate-200', 'text-orange-300'];

const Ranking: React.FC<{ title: string; by: 'count' | 'revenue'; entries: RevenueEntry[]; nameOf: (serviceId: string) => string }> = ({ title, by, entries, nameOf }) => {
  const [period, setPeriod] = useState<RankingPeriod>('all');
  // Calculado sobre os pedidos já carregados pelo Financeiro (nenhuma leitura extra).
  const rows = useMemo(() => serviceRanking(entries, period, by, new Date()), [entries, period, by]);
  return (
    <section className={cardClass} aria-label={title}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Trophy className="h-4 w-4 text-amber-300" />{title}</h3>
      <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Período">
        {RANKING_PERIODS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}
            className={`flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition sm:text-xs ${period === p ? 'bg-blue-600 text-white' : 'text-white/55 hover:text-white'}`}>{PERIOD_LABELS[p]}</button>
        ))}
      </div>
      {rows.length === 0 ? <p className="py-8 text-center text-sm text-white/45">Nenhum pedido concluído em "{PERIOD_LABELS[period]}".</p> : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.serviceId} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i < 3 ? 'border border-white/10 bg-white/[0.06]' : ''}`}>
              <span className={`w-6 shrink-0 text-center text-sm font-extrabold tabular-nums ${MEDAL[i] ?? 'text-white/40'}`}>{i + 1}</span>
              <span className={`min-w-0 flex-1 truncate text-sm ${i < 3 ? 'font-bold text-white' : 'font-medium text-white/75'}`}>{nameOf(r.serviceId)}</span>
              <span className={`shrink-0 text-sm font-extrabold tabular-nums ${by === 'revenue' ? 'text-emerald-300' : 'text-white'}`}>
                {by === 'count' ? `${r.count} ${r.count === 1 ? 'pedido' : 'pedidos'}` : formatMoney(r.revenue)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

/** Dois rankings independentes por serviço, sobre os pedidos concluídos do Financeiro (valor = totalPaid, data = evento). */
export const FinanceLeaderboard: React.FC<{ entries: RevenueEntry[]; nameOf: (serviceId: string) => string }> = ({ entries, nameOf }) => (
  <div className="space-y-4">
    <p className="text-xs text-white/50">Considera pedidos concluídos, pela data do evento. Faturamento é o valor registrado nos pedidos, sem despesas.</p>
    <div className="grid gap-6 lg:grid-cols-2">
      <Ranking title="Ranking serviço mais pedido" by="count" entries={entries} nameOf={nameOf} />
      <Ranking title="Ranking de faturamento" by="revenue" entries={entries} nameOf={nameOf} />
    </div>
  </div>
);
