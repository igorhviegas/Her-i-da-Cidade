import React from 'react';
import { PRESETS, type Preset } from '../../../services/reports.js';

const LABEL: Record<Preset, string> = { month: 'Este mês', '90d': 'Últimos 90 dias', year: 'Este ano', all: 'Tudo' };

/** Recorte de período das seções de rentabilidade e operação. */
export const PresetChips: React.FC<{ value: Preset; onChange: (preset: Preset) => void }> = ({ value, onChange }) => (
  <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Período">
    {PRESETS.map((p) => (
      <button key={p} type="button" aria-pressed={value === p} onClick={() => onChange(p)}
        className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value === p ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{LABEL[p]}</button>
    ))}
  </div>
);
