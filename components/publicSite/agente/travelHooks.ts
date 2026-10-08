import { useMemo, useState } from 'react';
import type { TravelResult } from '../../../services/travelService';
import { parseKm, summarizeTrip, travelWhatsAppText } from '../../../services/travelCost.js';

/** Km corrigidos à mão (legKey -> km) e o trecho em edição. */
export function useKmEditing() {
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);

  const saveKm = () => {
    if (!editing) return;
    const km = parseKm(editing.value);
    if (km === null) return;
    setOverrides((o) => ({ ...o, [editing.key]: km }));
    setEditing(null);
  };
  const restoreKm = (key: string) => setOverrides((o) => { const { [key]: _removed, ...rest } = o; return rest; });

  return { overrides, setOverrides, editing, setEditing, saveKm, restoreKm };
}

/** Resumo (soma dos dias) com os ajustes de km aplicados e o texto correspondente. */
export function useTripSummary(result: TravelResult | null, overrides: Record<string, number>) {
  const summary = useMemo(() => (result ? summarizeTrip(result, overrides) : null), [result, overrides]);
  const text = useMemo(() => (summary ? travelWhatsAppText(summary) : ''), [summary]);
  return { summary, text };
}

/** Copia o texto para a área de transferência e mostra "Copiado!" por 2 segundos. */
export function useCopyText(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem área de transferência: o texto está visível abaixo */ }
  };
  return { copied, copy };
}
