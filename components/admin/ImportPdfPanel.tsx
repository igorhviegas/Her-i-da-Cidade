import React, { useRef, useState } from 'react';
import { AlertCircle, FileUp, Loader2, ScanText, X } from 'lucide-react';
import { PdfImportError, readPdfFile, type PdfProgress, type PdfTextResult } from '../../services/pdfImportBrowser';
import { findOrderByImportFingerprint } from '../../services/ordersService';
import { importFingerprint, parseFormText, toOrderFormValues, FIELD_DEFS, type Confidence, type ParsedField, type ParsedForm } from '../../services/pdfFormParser.js';
import { formatOrderReference } from '../../services/orderReference.js';

export interface ImportedValues { name: string; whatsapp: string; eventDate: string; content: string }

const BADGE: Record<Confidence, string> = {
  high: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300', medium: 'border-amber-500/30 bg-amber-500/15 text-amber-300', low: 'border-red-500/30 bg-red-500/15 text-red-300',
};
const clip = (text: string) => (text.length > 200 ? `${text.slice(0, 200)}…` : text);
const BADGE_LABEL: Record<Confidence, string> = { high: 'Reconhecido', medium: 'Conferir', low: 'Baixa confiança' };

type State =
  | { kind: 'idle' }
  | { kind: 'working'; progress: PdfProgress | null }
  | { kind: 'error'; message: string }
  | { kind: 'review'; result: PdfTextResult; parsed: ParsedForm; fingerprint: string };

/**
 * Importação assistida: lê o PDF no navegador (texto nativo ou OCR), mostra o que foi reconhecido e só preenche o
 * formulário quando o usuário pede. Nada é criado aqui: o pedido só nasce no botão "Criar pedido" do formulário.
 */
export const ImportPdfPanel: React.FC<{ disabled?: boolean; onApply: (values: ImportedValues, fingerprint: string) => void; onClear: () => void; applied: boolean }> = ({ disabled, onApply, onClear, applied }) => {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [use, setUse] = useState<Record<string, boolean>>({});
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setState({ kind: 'idle' }); if (input.current) input.current.value = ''; onClear(); };

  const handleFile = async (file: File) => {
    setState({ kind: 'working', progress: null });
    try {
      const result = await readPdfFile(file, (progress) => setState({ kind: 'working', progress }));
      const fingerprint = await importFingerprint(result.text);
      const existing = await findOrderByImportFingerprint(fingerprint);
      if (existing) {
        setState({ kind: 'error', message: `Este formulário já foi importado no pedido ${formatOrderReference(existing)}. Para evitar duplicidade, a importação foi cancelada; se for outro pedido, preencha manualmente.` });
        return;
      }
      const parsed = parseFormText(result.text, { ocr: result.method !== 'text' });
      // Em OCR, o que não foi reconhecido costuma ser ruído: começa desmarcado (o usuário pode marcar).
      setUse(Object.fromEntries([// Campos que exigem formato (telefone, data, horário) e não foram validados começam desmarcados.
        ...(Object.entries(parsed.fields) as [string, ParsedField][]).map(([k, f]) => [k, !(['whatsapp', 'eventDate', 'eventTime'].includes(k) && !f.parsed)]), ...parsed.others.map((_, i) => [`other:${i}`, result.method === 'text'])]));
      setState({ kind: 'review', result, parsed, fingerprint });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof PdfImportError ? error.message : 'Não foi possível ler o PDF. Preencha manualmente ou tente outro arquivo.' });
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const apply = () => {
    if (state.kind !== 'review') return;
    const { parsed, fingerprint } = state;
    const filtered: ParsedForm = {
      ...parsed,
      fields: Object.fromEntries(Object.entries(parsed.fields).filter(([key]) => use[key])) as ParsedForm['fields'],
      others: parsed.others.filter((_, i) => use[`other:${i}`]),
    };
    onApply(toOrderFormValues(filtered), fingerprint);
    setState({ kind: 'idle' });
  };

  const progressText = (p: PdfProgress | null) => (!p ? 'Abrindo o PDF…'
    : p.stage === 'ocr' ? `OCR (leitura de imagem) · página ${p.page} de ${p.pages}${p.progress ? ` · ${Math.round(p.progress * 100)}%` : ''}. A primeira vez pode demorar mais, pois baixa o idioma.`
      : `Lendo o texto do PDF · página ${p.page} de ${p.pages}`);

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300"><FileUp className="h-3.5 w-3.5" />Importar PDF do Google Forms</h3>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" id="import-pdf" disabled={disabled || state.kind === 'working'}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file); }} />
        <div className="flex gap-2">
          {applied && <button type="button" onClick={reset} disabled={disabled} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/5">Descartar importação</button>}
          <label htmlFor="import-pdf" className={`cursor-pointer rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 ${disabled || state.kind === 'working' ? 'pointer-events-none opacity-50' : ''}`}>Selecionar PDF</label>
        </div>
      </div>
      {state.kind === 'idle' && <p className="text-xs text-white/45">{applied ? 'Dados importados aplicados ao formulário. Revise e corrija antes de criar o pedido.' : 'Opcional. O PDF é lido no seu navegador (não é enviado a nenhum serviço) e você revisa tudo antes de criar o pedido.'}</p>}
      {state.kind === 'working' && <p role="status" className="flex items-start gap-2 text-xs text-blue-200"><Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />{progressText(state.progress)}</p>}
      {state.kind === 'error' && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{state.message}</p>}

      {state.kind === 'review' && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs text-white/60">
            {state.result.method === 'text' ? <FileUp className="h-3.5 w-3.5" /> : <ScanText className="h-3.5 w-3.5 text-amber-300" />}
            {state.result.method === 'text' ? 'Texto lido direto do PDF.' : state.result.method === 'ocr' ? 'Documento digitalizado: texto lido por OCR (pode haver erros de leitura).' : 'Parte do documento lida por OCR (pode haver erros nessas páginas).'}
          </p>
          {state.parsed.warnings.map((w) => <p key={w} className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-xs text-amber-200">{w}</p>)}
          {Object.keys(state.parsed.fields).length === 0 && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200">Nenhum campo foi reconhecido{state.result.method !== 'text' ? ': a leitura por OCR provavelmente falhou por baixa qualidade da imagem. Tente um arquivo mais nítido' : ''}. Veja o texto lido abaixo ou preencha manualmente.</p>}
          <ul className="space-y-2">
            {(Object.entries(state.parsed.fields) as [string, ParsedField][]).map(([key, field]) => (
              <li key={key} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={use[key] ?? true} onChange={(e) => setUse({ ...use, [key]: e.target.checked })} />
                  <span className="min-w-0 flex-1"><span className="font-semibold text-white/80">{FIELD_DEFS.find((d) => d.key === key)?.label}</span> <span className={`ml-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${BADGE[field.confidence]}`}>{BADGE_LABEL[field.confidence]}</span>
                    <span className="mt-0.5 block break-words text-white">{field.value}</span>
                    {field.notes.map((n) => <span key={n} className="block text-[11px] text-amber-200/80">{n}</span>)}
                  </span>
                </label>
              </li>
            ))}
            {state.parsed.others.map((o, i) => (
              <li key={`o${i}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={use[`other:${i}`] ?? true} onChange={(e) => setUse({ ...use, [`other:${i}`]: e.target.checked })} />
                  <span className="min-w-0 flex-1"><span className="font-semibold text-white/80">{o.label}</span> <span className="ml-1 rounded-full border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/60">Não mapeado: vai para o conteúdo</span>
                    <span className="mt-0.5 block break-words text-white">{clip(o.value) || '—'}</span></span>
                </label>
              </li>
            ))}
          </ul>
          <details className="text-xs text-white/50"><summary className="cursor-pointer">Ver texto lido</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-[11px] text-white/60">{state.result.text}</pre></details>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"><X className="h-3.5 w-3.5" />Cancelar importação</button>
            <button type="button" onClick={apply} disabled={!Object.values(use).some(Boolean)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40">Aplicar ao formulário</button>
          </div>
          <p className="text-[11px] text-white/40">Aplicar apenas preenche o formulário abaixo. Nenhum pedido é criado até você confirmar em "Criar pedido".</p>
        </div>
      )}
    </section>
  );
};
