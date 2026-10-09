import React, { useRef, useState } from 'react';
import { CloudRain, FileUp, Loader2, Sun, TriangleAlert, X } from 'lucide-react';
import { MIN_OFFICIAL_PILOTS, buildResults, formatLap, parseTimingReport, type KartResult } from '../../../services/kart.js';
import { readPdfText } from '../../../services/pdfImportBrowser';
import { raceDocId, saveKartRace, type KartPilot, type KartRace } from '../../../services/kartService';
import { card, input, type Run } from './agentShared';

interface Draft {
  key: string;
  file: string;
  error?: string;
  date: string;
  heat: string;
  time: string;
  weather: 'dry' | 'rain';
  results: KartResult[];
  outsiders: string[];
}

async function readDraft(file: File, pilots: KartPilot[]): Promise<Draft> {
  const base = { key: `${file.name}-${file.size}`, file: file.name, date: '', heat: '', time: '', weather: 'dry' as const, results: [], outsiders: [] };
  try {
    const report = parseTimingReport(await readPdfText(file));
    if (!report) return { ...base, error: 'Este PDF não parece um relatório de cronometragem do kartódromo.' };
    return { ...base, date: report.date, heat: report.heat, time: report.time, ...buildResults(report.rows, pilots) };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : 'Não foi possível ler o PDF.' };
  }
}

const DraftCard: React.FC<{ draft: Draft; exists: boolean; onChange: (d: Draft) => void; onRemove: () => void }> = ({ draft, exists, onChange, onRemove }) => {
  const official = draft.results.length >= MIN_OFFICIAL_PILOTS;
  return (
    <div className={`${card} space-y-3 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-white/40">{draft.file}</p>
          {draft.error ? <p className="mt-1 flex items-center gap-2 text-sm text-red-300"><TriangleAlert className="h-4 w-4 shrink-0" />{draft.error}</p>
            : <p className="mt-1 font-bold text-white">{draft.heat} · {draft.results.length} inscrito(s) de {draft.results.length + draft.outsiders.length} pilotos</p>}
        </div>
        <button type="button" onClick={onRemove} aria-label="Remover este arquivo" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      {!draft.error && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-white/50">Data da corrida<input type="date" value={draft.date} onChange={(e) => onChange({ ...draft, date: e.target.value })} className={`${input} mt-1`} /></label>
            <fieldset className="text-xs text-white/50">Pista
              <div className="mt-1 grid grid-cols-2 gap-1">
                {([['dry', 'Seco', Sun], ['rain', 'Chuva', CloudRain]] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => onChange({ ...draft, weather: id })} aria-pressed={draft.weather === id} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${draft.weather === id ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60'}`}><Icon className="h-4 w-4" />{label}</button>
                ))}
              </div>
            </fieldset>
          </div>

          {!official && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Só {draft.results.length} inscrito(s): precisa de {MIN_OFFICIAL_PILOTS} ou mais para valer como corrida oficial. Se faltou alguém, cadastre o piloto (ou o apelido dele) na aba Pilotos e importe de novo.</p>}
          {exists && official && <p className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-200">Esta corrida já está salva: salvar de novo substitui o resultado.</p>}

          <ol className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {draft.results.map((r) => (
              <li key={r.pilotId} className="flex items-baseline gap-2"><span className="w-6 text-right font-black tabular-nums text-white/50">{r.pos}</span><span className="min-w-0 flex-1 truncate">{r.name}</span><span className="text-xs tabular-nums text-white/45">P{r.racePos ?? 'NC'} · {formatLap(r.bestLapMs)}</span></li>
            ))}
          </ol>
          {draft.outsiders.length > 0 && (
            <details className="text-xs text-white/45">
              <summary className="cursor-pointer select-none hover:text-white/70">{draft.outsiders.length} fora do campeonato (descartados) — confira se falta alguém</summary>
              <p className="mt-2 leading-relaxed">{draft.outsiders.join(' · ')}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
};

export const KartImport: React.FC<{ pilots: KartPilot[]; races: KartRace[]; run: Run }> = ({ pilots, races, run }) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true);
    const read = await Promise.all([...files].map((f) => readDraft(f, pilots)));
    setDrafts((prev) => [...prev.filter((p) => !read.some((r) => r.key === p.key)), ...read].sort((a, b) => a.date.localeCompare(b.date)));
    setReading(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const ready = drafts.filter((d) => !d.error && d.date && d.results.length >= MIN_OFFICIAL_PILOTS);
  const idOf = (d: Draft) => raceDocId(d.date, d.time);
  const saveAll = async () => {
    const ok = await run(async () => { for (const d of ready) await saveKartRace({ id: idOf(d), date: d.date, heat: d.heat, weather: d.weather, results: d.results }); }, `${ready.length} corrida(s) salva(s).`);
    if (ok) setDrafts((prev) => prev.filter((d) => !ready.includes(d)));
  };

  return (
    <section className="space-y-3">
      <div className={`${card} flex flex-wrap items-center gap-3 p-4`}>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">Importar resultado da corrida (PDF)</p>
          <p className="text-sm text-white/55">Suba um ou vários relatórios do kartódromo. Só os pilotos inscritos entram, reclassificados entre si. Você confere antes de salvar.</p>
        </div>
        <input ref={fileInput} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <button type="button" disabled={reading || pilots.length === 0} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40">
          {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}Escolher PDFs
        </button>
        {pilots.length === 0 && <p className="w-full text-sm text-amber-200">Cadastre os pilotos inscritos antes de importar (aba Pilotos).</p>}
      </div>

      {drafts.map((d) => (
        <DraftCard key={d.key} draft={d} exists={!!d.date && races.some((r) => r.id === idOf(d))} onChange={(next) => setDrafts((prev) => prev.map((x) => (x.key === d.key ? next : x)))} onRemove={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))} />
      ))}

      {ready.length > 0 && (
        <button type="button" onClick={saveAll} className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500">Salvar {ready.length} corrida(s) no campeonato</button>
      )}
    </section>
  );
};
