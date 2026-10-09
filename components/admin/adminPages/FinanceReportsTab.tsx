import React, { useEffect, useState } from 'react';
import type { Client, Order, Service } from '../../../types';
import type { FixedExpense, RevenueEntry } from '../../../services/financeCalculations.js';
import type { Lookup } from './financePageHooks';
import { ReportsClients } from './ReportsClients';
import { ReportsMonthly } from './ReportsMonthly';
import { ReportsOperations } from './ReportsOperations';
import { ReportsPeriod } from './ReportsPeriod';
import { ReportsProfitability } from './ReportsProfitability';
import { ReportsSeasonality } from './ReportsSeasonality';

type Section = 'period' | 'monthly' | 'profitability' | 'operations' | 'seasonality' | 'clients';
const SECTIONS: { id: Section; label: string }[] = [{ id: 'period', label: 'Dia, semana e mês' }, { id: 'monthly', label: 'Relatório mensal' }, { id: 'profitability', label: 'Rentabilidade' }, { id: 'operations', label: 'Operação' }, { id: 'seasonality', label: 'Sazonalidade' }, { id: 'clients', label: 'Clientes' }];

interface Props { entries: RevenueEntry[]; costs: RevenueEntry[]; orders: Order[]; expenses: FixedExpense[]; clients: Lookup<Client>; services: Lookup<Service>; /** 'AAAA-MM' vindo do aviso do sino: abre o relatório mensal desse mês. */ openMonth?: string | null }

/** Relatórios do Financeiro. Só dinheiro e clientes: missões e XP ficam de fora de propósito. */
export const FinanceReportsTab: React.FC<Props> = ({ entries, costs, orders, expenses, clients, services, openMonth }) => {
  const [section, setSection] = useState<Section>(openMonth ? 'monthly' : 'period');
  useEffect(() => { if (openMonth) setSection('monthly'); }, [openMonth]);
  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Relatórios">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={section === s.id} onClick={() => setSection(s.id)}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-semibold transition ${section === s.id ? 'border-blue-500/60 bg-blue-500/15 text-blue-200' : 'border-white/10 text-white/60 hover:text-white'}`}>{s.label}</button>
        ))}
      </div>
      {section === 'period' && <ReportsPeriod entries={entries} costs={costs} expenses={expenses} clients={clients} services={services} />}
      {section === 'monthly' && <ReportsMonthly entries={entries} costs={costs} orders={orders} expenses={expenses} clients={clients} services={services} openMonth={openMonth} />}
      {section === 'profitability' && <ReportsProfitability entries={entries} costs={costs} clients={clients} services={services} />}
      {section === 'operations' && <ReportsOperations completed={orders} clients={clients} services={services} />}
      {section === 'seasonality' && <ReportsSeasonality entries={entries} />}
      {section === 'clients' && <ReportsClients entries={entries} clients={clients} />}
    </div>
  );
};
