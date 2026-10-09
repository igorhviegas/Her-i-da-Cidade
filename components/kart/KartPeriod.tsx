import React from 'react';
import type { KartScope } from '../../services/kartRanking.js';

export type ScopeKey = 'recent' | 'all' | `y${number}`;

export const toScope = (key: ScopeKey): KartScope => (key === 'recent' ? { type: 'recent' } : key === 'all' ? { type: 'all' } : { type: 'year', year: Number(key.slice(1)) });

/** "Últimas 10 corridas", "Todo o período" ou "Temporada 2025" (para títulos e imagens). */
export const periodText = (key: ScopeKey, recentCount: number) => (key === 'recent' ? `Últimas ${recentCount} corridas` : key === 'all' ? 'Todo o período' : `Temporada ${key.slice(1)}`);

const Pill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-white text-[#070B14]' : 'border border-white/15 text-white/70 hover:text-white'}`}>{children}</button>
);

/** Botões de período: últimas 10, todo o período e um por ano. */
export const PeriodPills: React.FC<{ value: ScopeKey; onChange: (key: ScopeKey) => void; years: number[] }> = ({ value, onChange, years }) => (
  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Período">
    <Pill active={value === 'recent'} onClick={() => onChange('recent')}>Últimas 10</Pill>
    <Pill active={value === 'all'} onClick={() => onChange('all')}>Todo o período</Pill>
    {years.map((y) => <Pill key={y} active={value === `y${y}`} onClick={() => onChange(`y${y}`)}>{y}</Pill>)}
  </div>
);
