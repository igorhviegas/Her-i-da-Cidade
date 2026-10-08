import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, History, Loader2, Minus, Pencil, Plus, Save, Send, X } from 'lucide-react';
import { ClientHistoryList } from './orders/ClientHistoryList';
import type { OrderView } from './orders/orderView';

const MAX_FONT = 64;
const MIN_FONT = 22;
const MIN_MANUAL_FONT = 14; // o ajuste manual pode ir além do mínimo automático, para textos muito extensos
const FONT_STEP = 2;
const ONE_COLUMN_MIN_FONT = 30; // no automático, uma coluna só é trocada por duas se exigir fonte menor que isto
const TWO_COLUMNS_MIN_WIDTH = 640; // abaixo disso (celular) duas colunas ficam estreitas demais

type Layout = { size: number; columns: 1 | 2; scroll: boolean };

interface Props {
  title: string;
  text: string;
  canSendToEditing: boolean;
  sending: boolean;
  error?: string;
  /** Outros pedidos do mesmo cliente. */
  history: OrderView[];
  onSaveText: (text: string) => Promise<void>;
  onBack: () => void;
  onSendToEditing: () => void;
}

/**
 * Uma coluna sempre que o texto couber sem rolar; duas só quando uma exigiria rolagem (ou, no automático, fonte menor que
 * ONE_COLUMN_MIN_FONT). Com `manualSize`, só esse tamanho é tentado. Se não couber, mantém o máximo de colunas com rolagem
 * vertical (nada é cortado).
 */
function fitLayout(box: HTMLElement, manualSize: number | null): Layout {
  const layout = chooseLayout(box, manualSize);
  // O React não reaplica estilos iguais ao render anterior: deixa o DOM já no estado final.
  box.style.fontSize = `${layout.size}px`;
  box.style.columnCount = String(layout.columns);
  box.style.flex = layout.scroll ? '0 0 auto' : '1 1 0';
  return layout;
}

/** Tamanhos de fonte tentados: só o manual, ou do máximo ao mínimo automático. */
function candidateSizes(manualSize: number | null): number[] {
  return manualSize ? [manualSize] : Array.from({ length: (MAX_FONT - MIN_FONT) / FONT_STEP + 1 }, (_, i) => MAX_FONT - i * FONT_STEP);
}

function chooseLayout(box: HTMLElement, manualSize: number | null): Layout {
  // Sem espaço, as colunas transbordam para a direita (scrollWidth) ou o conteúdo estoura a altura.
  const fits = (size: number, columns: 1 | 2) => {
    box.style.fontSize = `${size}px`;
    box.style.columnCount = String(columns);
    return box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1;
  };
  const maxColumns = box.clientWidth >= TWO_COLUMNS_MIN_WIDTH ? 2 : 1;
  const sizes = candidateSizes(manualSize);
  const oneColumn = sizes.find((size) => fits(size, 1));
  if (oneColumn && (manualSize || oneColumn >= ONE_COLUMN_MIN_FONT || maxColumns === 1)) return { size: oneColumn, columns: 1, scroll: false };
  if (maxColumns === 2) {
    const twoColumns = sizes.find((size) => fits(size, 2));
    // Duas colunas só valem se permitirem fonte maior que a de uma coluna.
    if (twoColumns && (!oneColumn || twoColumns > oneColumn)) return { size: twoColumns, columns: 2, scroll: false };
  }
  // Uma coluna coube só em fonte pequena e duas não ajudam: fica com ela.
  if (oneColumn) return { size: oneColumn, columns: 1, scroll: false };
  return { size: manualSize ?? MIN_FONT, columns: maxColumns, scroll: true };
}

export const TeleprompterModal: React.FC<Props> = ({ title, text, canSendToEditing, sending, error, history, onSaveText, onBack, onSendToEditing }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [manualSize, setManualSize] = useState<number | null>(null); // null = ajuste automático
  const [layout, setLayout] = useState<Layout>({ size: MIN_FONT, columns: 1, scroll: false });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const paragraphs = text.split(/\n+/).filter((p) => p.trim());

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = textRef.current;
    if (!box || !inner || !paragraphs.length) return;
    const run = () => {
      inner.style.flex = '1 1 0';
      setLayout(fitLayout(inner, manualSize));
    };
    run();
    // O Tailwind (CDN) gera as classes do modal depois deste efeito, e o ResizeObserver só dispara com a página sendo desenhada:
    // remedir logo após o estilo chegar evita ficar com o ajuste calculado sobre um layout sem estilo.
    const timers = [setTimeout(run, 0), setTimeout(run, 300)];
    const observer = new ResizeObserver(run);
    observer.observe(box);
    return () => { timers.forEach(clearTimeout); observer.disconnect(); };
  }, [text, manualSize, paragraphs.length, editing]);

  useEffect(() => {
    // Esc fecha primeiro a janela mais interna (histórico, depois a edição) e só então o teleprompter.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || sending || saving) return;
      if (historyOpen) setHistoryOpen(false);
      else if (editing) setEditing(false);
      else onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, sending, saving, historyOpen, editing]);

  const startEditing = () => { setDraft(text); setSaveError(''); setEditing(true); };
  const save = async () => {
    setSaving(true);
    setSaveError('');
    try { await onSaveText(draft); setEditing(false); } catch (saveFailure) { setSaveError(saveFailure instanceof Error ? saveFailure.message : 'Não foi possível salvar o texto.'); } finally { setSaving(false); }
  };

  const adjust = (delta: number) => setManualSize(Math.min(MAX_FONT, Math.max(MIN_MANUAL_FONT, layout.size + delta)));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-2 sm:p-4">
      <section role="dialog" aria-modal="true" aria-label={`Teleprompter: ${title}`} className="flex h-full max-h-[98vh] w-full max-w-[1800px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070B14] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">Teleprompter</p>
            <h2 className="truncate text-sm font-bold text-white">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setHistoryOpen(true)} aria-label="Ver histórico do cliente" title="Ver histórico do cliente" className="rounded-lg border border-white/10 p-1.5 text-white/70 hover:bg-white/10"><History className="h-4 w-4" /></button>
            <button type="button" onClick={startEditing} disabled={editing || sending} aria-label="Editar texto" title="Editar texto" className="rounded-lg border border-white/10 p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-30"><Pencil className="h-4 w-4" /></button>
          {paragraphs.length > 0 && !editing && (
            <div className="ml-2 flex items-center gap-1" role="group" aria-label="Tamanho da fonte">
              <button type="button" onClick={() => adjust(-FONT_STEP)} disabled={layout.size <= MIN_MANUAL_FONT} aria-label="Diminuir fonte" title="Diminuir fonte" className="rounded-lg border border-white/10 p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
              <button type="button" onClick={() => setManualSize(null)} disabled={manualSize === null} title={manualSize === null ? 'Ajuste automático' : 'Voltar ao ajuste automático'} className="min-w-[4.5rem] rounded-lg px-2 py-1 text-center text-xs font-semibold text-white/70 enabled:hover:bg-white/10 disabled:cursor-default">
                {layout.size}px{manualSize === null && <span className="ml-1 text-[10px] font-bold uppercase text-blue-300/80">auto</span>}
              </button>
              <button type="button" onClick={() => adjust(FONT_STEP)} disabled={layout.size >= MAX_FONT} aria-label="Aumentar fonte" title="Aumentar fonte" className="rounded-lg border border-white/10 p-1.5 text-white/70 hover:bg-white/10 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
            </div>
          )}
          </div>
        </header>

        {editing ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-8">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={saving}
              autoFocus
              aria-label="Texto do teleprompter"
              className="min-h-0 flex-1 resize-none rounded-xl border border-white/15 bg-[#0D1527] p-4 text-lg leading-relaxed text-white outline-none focus:border-blue-400/60 disabled:opacity-60"
            />
            {saveError && <p role="alert" className="text-sm text-red-200">{saveError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={() => void save()} disabled={saving || !draft.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar texto
              </button>
            </div>
          </div>
        ) : (
        <div ref={boxRef} className={`flex min-h-0 flex-1 flex-col px-6 py-5 sm:px-10 ${layout.scroll ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <div
            ref={textRef}
            style={{ fontSize: layout.size, columnCount: layout.columns, columnGap: '4rem', columnFill: 'balance', lineHeight: 1.35, flex: layout.scroll ? '0 0 auto' : '1 1 0', minHeight: 0 }}
          >
            {paragraphs.length ? paragraphs.map((p, i) => (
              <p key={i} className="mb-[0.7em] break-words font-semibold text-white" style={{ breakInside: layout.scroll ? 'auto' : 'avoid-column' }}>{p}</p>
            )) : <p className="text-base text-white/50">Este pedido não possui texto disponível para o teleprompter.</p>}
          </div>
        </div>
        )}

        {error && <p role="alert" className="shrink-0 border-t border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</p>}
        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 px-4 py-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onBack} disabled={sending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button type="button" onClick={onSendToEditing} disabled={sending || editing || !canSendToEditing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar pra edição
          </button>
        </footer>
      </section>
      {historyOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Histórico do cliente" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-bold text-white">Histórico do cliente ({history.length})</h3>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Fechar histórico" title="Fechar" className="rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </header>
            <div className="overflow-y-auto p-4"><ClientHistoryList views={history} /></div>
          </section>
        </div>
      )}
    </div>
  );
};
