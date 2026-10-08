import React from 'react';
import type { ImportResult } from '../../../services/fitRideService';

/** Resultado da última importação de arquivos FIT: importados, repetidos e falhas. */
export const RideImportBanners: React.FC<{ results: ImportResult[] }> = ({ results }) => {
  const imported = results.filter((r) => r.status === 'imported').length;
  const duplicates = results.filter((r) => r.status === 'duplicate').length;
  const failures = results.filter((r) => r.status === 'error');

  return (
    <>
      {(imported > 0 || duplicates > 0) && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">
          {imported > 0 && `${imported} ${imported === 1 ? 'treino importado' : 'treinos importados'}.`}{imported > 0 && duplicates > 0 && ' '}{duplicates > 0 && `${duplicates} já ${duplicates === 1 ? 'estava importado' : 'estavam importados'}.`}
        </p>
      )}
      {failures.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {failures.map((f) => <p key={f.name}><span className="font-semibold">{f.name}:</span> {f.message}</p>)}
        </div>
      )}
    </>
  );
};
