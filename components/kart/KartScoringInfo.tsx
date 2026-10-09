import React, { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { MIN_OFFICIAL_PILOTS, pointsFor } from '../../services/kart.js';
import { RECENT_RACES } from '../../services/kartRanking.js';
import { MEDAL_STYLE, type Medal } from './kartUi';

const POSITIONS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Ícone "i" que abre a explicação da pontuação, com a tabela de pontos por posição (gerada de `pointsFor`, sempre igual à regra real). */
export const KartScoringInfo: React.FC = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Como funciona a pontuação" className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="kart-scoring-title" onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0D1527] p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="kart-scoring-title" className="text-xl font-black italic">Como funciona a pontuação</h2>
              <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <ul className="space-y-2.5 text-sm leading-relaxed text-white/80">
              <li><b className="text-white">Só pilotos inscritos pontuam.</b> Na bateria aberta há gente de fora do campeonato: essas pessoas são ignoradas.</li>
              <li><b className="text-white">A posição conta só entre os inscritos.</b> Se você terminou em P9 na bateria, mas foi o 1º entre os inscritos, é P1 e leva 25 pontos.</li>
              <li><b className="text-white">Vale como corrida do campeonato</b> a bateria com {MIN_OFFICIAL_PILOTS} ou mais pilotos inscritos.</li>
              <li><b className="text-white">Ranking padrão:</b> soma das últimas {RECENT_RACES} corridas do campeonato, para ninguém ficar com uma pontuação inalcançável. Também dá para ver todo o período ou um ano.</li>
              <li><b className="text-white">Desempate:</b> mais vitórias; persistindo, a melhor volta.</li>
              <li><b className="text-white">Corridas fora do campeonato</b> não dão pontos (valem só para o recorde de melhor volta).</li>
            </ul>

            <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest text-white/50">Pontos por posição entre os inscritos</h3>
            <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {POSITIONS.map((pos) => (
                <li key={pos} className="flex items-baseline justify-between rounded-lg bg-black/30 px-3 py-2">
                  <span className={`text-sm font-black italic ${pos <= 3 ? MEDAL_STYLE[pos as Medal].text : 'text-white/60'}`}>P{pos}</span>
                  <span className="font-black tabular-nums">{pointsFor(pos)}<span className="ml-1 text-[10px] font-normal text-white/40">pts</span></span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-white/45">Depois do P20: P21 = {pointsFor(21)}, P22 = {pointsFor(22)} e, a partir do P23, 0.</p>
          </div>
        </div>
      )}
    </>
  );
};
