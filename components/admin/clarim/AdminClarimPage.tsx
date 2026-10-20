import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Loader2, Newspaper, Plus } from 'lucide-react';
import { addDays } from '../../../functions/missions-core.js';
import { editionTitle, previousWeek } from '../../../services/clarim.js';
import { createEdition, listEditions, type ClarimEdition } from '../../../services/clarimService';
import { cardClass, ErrorNote, ghostButton, inputClass, labelClass, primaryButton } from '../missionsUi';
import { ClarimEditionView } from './ClarimEditionView';
import { todayKey } from './useClarimData';

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** Clarim Semanal (Espaço Criativo): edições semanais montadas a partir de templates, aprovadas e baixadas página a página. */
export const AdminClarimPage: React.FC = () => {
  const [editions, setEditions] = useState<ClarimEdition[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [period, setPeriod] = useState(() => previousWeek(todayKey()));
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    listEditions().then(setEditions).catch((e) => setError(errorText(e, 'Não foi possível carregar as edições.')));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = editions?.find((e) => e.id === openId);
  if (open) {
    return (
      <ClarimEditionView
        edition={open}
        onBack={() => setOpenId(null)}
        onChange={(next) => setEditions((list) => list?.map((e) => (e.id === next.id ? next : e)) ?? null)}
        onDeleted={() => { setEditions((list) => list?.filter((e) => e.id !== open.id) ?? null); setOpenId(null); }}
      />
    );
  }

  const create = async () => {
    if (period.start > period.end) { setError('O início do período precisa ser antes do fim.'); return; }
    setBusy(true);
    setError('');
    try {
      const edition = await createEdition(period, editions ?? []);
      setEditions((list) => [edition, ...(list ?? [])]);
      setCreating(false);
      setOpenId(edition.id);
    } catch (e) {
      setError(errorText(e, 'Não foi possível criar a edição.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl"><Newspaper className="h-5 w-5 text-blue-400" />Clarim Semanal</h2>
          <p className="text-xs text-white/50">O jornal da semana nos Stories: escolha as páginas, complete, aprove e baixe cada uma.</p>
        </div>
        {!creating && <button type="button" className={primaryButton} onClick={() => { setPeriod(previousWeek(todayKey())); setCreating(true); }}><Plus className="h-4 w-4" />Nova edição</button>}
      </div>

      {creating && (
        <section className={`${cardClass} space-y-3`} aria-labelledby="clarim-new">
          <h3 id="clarim-new" className="text-sm font-bold text-white">Nova edição</h3>
          <p className="text-xs text-white/50">Padrão: segunda a domingo da semana passada. Os eventos e vídeos importados vêm deste período.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass} htmlFor="clarim-start">Início
              <input id="clarim-start" type="date" className={inputClass} value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} />
            </label>
            <label className={labelClass} htmlFor="clarim-end">Fim
              <input id="clarim-end" type="date" className={inputClass} value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} />
            </label>
          </div>
          {period.start && period.end && period.start <= period.end && <p className="text-sm font-semibold text-white">{editionTitle(period)}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButton} disabled={busy || !period.start || !period.end} onClick={create}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Criar edição</button>
            <button type="button" className={ghostButton} onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        </section>
      )}

      <ErrorNote message={error || null} />

      {editions === null && !error && <p className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando edições…</p>}
      {editions?.length === 0 && !creating && (
        <div className={`${cardClass} text-sm text-white/60`}>Nenhuma edição ainda. Toda segunda, crie a edição da semana anterior em <strong className="text-white">Nova edição</strong>.</div>
      )}
      {!!editions?.length && (
        <ul className="grid gap-2">
          {editions.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setOpenId(e.id)} className={`${cardClass} flex w-full items-center justify-between gap-3 text-left transition-colors hover:border-blue-500/40`}>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-white/50">Edição nº {e.number}</span>
                  <span className="block truncate text-sm font-bold text-white">{editionTitle({ start: e.periodStart, end: e.periodEnd })}</span>
                  <span className="block text-[11px] text-white/40">Semana de {e.periodStart.split('-').reverse().join('/')} a {e.periodEnd.split('-').reverse().join('/')} · publica em {addDays(e.periodEnd, 1).split('-').reverse().join('/')}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.status === 'published' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/60'}`}>{e.status === 'published' ? 'Publicada' : 'Rascunho'}</span>
                  <ChevronRight className="h-4 w-4 text-white/40" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
