import React, { useRef, useState } from 'react';
import { CloudRain, FileUp, Loader2, Sun, TriangleAlert, UserPlus, X } from 'lucide-react';
import { MIN_OFFICIAL_PILOTS, buildResults, formatLap, parseTimingReport, type TimingRow } from '../../../services/kart.js';
import { pilotId } from '../../../services/kartPilots.js';
import { readPdfText } from '../../../services/pdfImportBrowser';
import { raceDocId, saveKartPilot, saveKartRace, type KartPilot, type KartRace } from '../../../services/kartService';
import { card, input, type Run } from './agentShared';

interface Draft {
  key: string;
  file: string;
  error?: string;
  date: string;
  heat: string;
  time: string;
  weather: 'dry' | 'rain';
  /** Fora do campeonato: não pontua, vale só para o recorde de volta. null = automático (menos de 3 inscritos). */
  extra: boolean | null;
  /** Linhas do relatório; os inscritos são calculados com a lista de pilotos atual, então inscrever alguém atualiza a prévia. */
  rows: TimingRow[];
}

const isExtra = (d: Draft, results: unknown[]) => d.extra ?? results.length < MIN_OFFICIAL_PILOTS;

/** Nome do relatório (CAIXA ALTA) em formato de cadastro: "Salun Marvin Pires Bento". */
const titleCase = (name: string) => name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

async function readDraft(file: File): Promise<Draft> {
  const base = { key: `${file.name}-${file.size}`, file: file.name, date: '', heat: '', time: '', weather: 'dry' as const, extra: null, rows: [] };
  try {
    const report = parseTimingReport(await readPdfText(file));
    if (!report) return { ...base, error: 'Este PDF não parece um relatório de cronometragem do kartódromo.' };
    return { ...base, date: report.date, heat: report.heat, time: report.time, rows: report.rows };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : 'Não foi possível ler o PDF.' };
  }
}

/** Pilotos do relatório que não são inscritos, cada um com a opção de inscrever na hora (nome editável: pode ser mais curto que o do relatório). */
const Outsiders: React.FC<{ names: string[]; pilots: KartPilot[]; run: Run }> = ({ names, pilots, run }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const id = pilotId(name);
  const taken = !!id && pilots.some((p) => p.id === id);
  const enroll = async () => {
    if (await run(() => saveKartPilot({ id, name: name.trim(), aliases: [], active: true }), `${name.trim()} inscrito.`)) setEditing(null);
  };
  return (
    <details className="text-xs text-white/45">
      <summary className="cursor-pointer select-none hover:text-white/70">{names.length} fora do campeonato (descartados): confira se falta alguém ou inscreva</summary>
      <ul className="mt-2 space-y-1">
        {names.map((n) => (
          <li key={n}>
            {editing === n ? (
              <div className="flex flex-wrap items-center gap-2">
                <input aria-label="Nome do piloto a inscrever" value={name} onChange={(e) => setName(e.target.value)} className={`${input} max-w-xs`} />
                <button type="button" disabled={!name.trim() || taken} onClick={enroll} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Inscrever</button>
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-2 py-2 text-white/60 hover:text-white">Cancelar</button>
                {taken && <span className="text-amber-200">Já existe um piloto com esse nome.</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{n}</span>
                <button type="button" onClick={() => { setEditing(n); setName(titleCase(n)); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/5 px-2 py-1 font-semibold text-white/70 hover:bg-white/10 hover:text-white"><UserPlus className="h-3.5 w-3.5" />Inscrever</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
};

const DraftCard: React.FC<{ draft: Draft; pilots: KartPilot[]; exists: boolean; run: Run; onChange: (d: Draft) => void; onRemove: () => void }> = ({ draft, pilots, exists, run, onChange, onRemove }) => {
  const { results, outsiders } = buildResults(draft.rows, pilots);
  const extra = isExtra(draft, results);
  return (
    <div className={`${card} space-y-3 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-white/40">{draft.file}</p>
          {draft.error ? <p className="mt-1 flex items-center gap-2 text-sm text-red-300"><TriangleAlert className="h-4 w-4 shrink-0" />{draft.error}</p>
            : <p className="mt-1 font-bold text-white">{draft.heat} · {results.length} inscrito(s) de {draft.rows.length} pilotos</p>}
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

          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${extra ? 'border-red-500/60 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
            <input type="checkbox" checked={extra} onChange={(e) => onChange({ ...draft, extra: e.target.checked })} className="mt-0.5 h-4 w-4 accent-red-600" />
            <span><b className="text-white">Corrida fora do campeonato</b><span className="block text-white/60">Não pontua; vale só para o recorde de melhor volta.{results.length < MIN_OFFICIAL_PILOTS && ` Só ${results.length} inscrito(s): para valer pontos precisa de ${MIN_OFFICIAL_PILOTS} ou mais (se faltou alguém, inscreva abaixo, em "fora do campeonato").`}</span></span>
          </label>
          {exists && <p className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-200">Esta corrida já está salva: salvar de novo substitui o resultado.</p>}

          <ol className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {results.map((r) => (
              <li key={r.pilotId} className="flex items-baseline gap-2"><span className="w-6 text-right font-black tabular-nums text-white/50">{r.pos}</span><span className="min-w-0 flex-1 truncate">{r.name}</span><span className="text-xs tabular-nums text-white/45">P{r.racePos ?? 'NC'} · {formatLap(r.bestLapMs)}</span></li>
            ))}
          </ol>
          {outsiders.length > 0 && <Outsiders names={outsiders} pilots={pilots} run={run} />}
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
    const read = await Promise.all([...files].map(readDraft));
    setDrafts((prev) => [...prev.filter((p) => !read.some((r) => r.key === p.key)), ...read].sort((a, b) => a.date.localeCompare(b.date)));
    setReading(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  // Cada rascunho com o resultado calculado agora (inscrever um piloto novo já entra aqui).
  const computed = drafts.map((d) => { const { results } = buildResults(d.rows, pilots); return { d, results, extra: isExtra(d, results) }; });
  const ready = computed.filter(({ d, results, extra }) => !d.error && d.date && results.length >= (extra ? 1 : MIN_OFFICIAL_PILOTS));
  const idOf = (d: Draft, extra: boolean) => (extra ? `extra-${d.date}-${d.time.replace(':', '') || 'x'}` : raceDocId(d.date, d.time));
  const saveAll = async () => {
    const ok = await run(async () => { for (const { d, results, extra } of ready) await saveKartRace({ id: idOf(d, extra), date: d.date, heat: d.heat, weather: d.weather, extra, results }); }, `${ready.length} corrida(s) salva(s).`);
    if (ok) setDrafts((prev) => prev.filter((d) => !ready.some((r) => r.d === d)));
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

      {computed.map(({ d, extra }) => (
        <DraftCard key={d.key} draft={d} pilots={pilots} run={run} exists={!!d.date && races.some((r) => r.id === idOf(d, extra))} onChange={(next) => setDrafts((prev) => prev.map((x) => (x.key === d.key ? next : x)))} onRemove={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))} />
      ))}

      {ready.length > 0 && (
        <button type="button" onClick={saveAll} className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500">Salvar {ready.length} corrida(s) no campeonato</button>
      )}
    </section>
  );
};
