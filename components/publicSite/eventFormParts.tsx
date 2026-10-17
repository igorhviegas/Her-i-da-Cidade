import React, { useEffect, useMemo, useState } from 'react';
import { Award, Car, Check, Clock, Gift, Info, Mic, Moon, PlayCircle, Star, Sun, UserRound, Video, X } from 'lucide-react';
import { Link } from '../../lib/router';
import { phoneCountryOptions } from '../../services/phoneCountries.js';
import { parseThankYouVideo } from '../../services/clientsPage.js';

// Peças dos formulários públicos (/formulario-evento e /agendar-chamada) com tema claro (padrão) e escuro (classe `dark` na raiz da página).

const THEME_KEY = 'hdc.formulario.tema';

/** Tema claro por padrão; o escuro fica lembrado no aparelho (vale para os dois formulários). */
export function useFormTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* sem armazenamento: vale só nesta visita */ }
  };
  return { theme, toggle, rootClass: theme === 'dark' ? 'dark' : 'form-light' };
}

export const pageBg = 'min-h-screen bg-gradient-to-b from-sky-50 via-white to-white px-4 pb-10 pt-5 text-slate-900 dark:from-black dark:via-[#07101d] dark:to-[#0B1929] dark:text-white';

/** Marca (link para o site) e botão de tema. */
export const FormHeader: React.FC<{ theme: 'light' | 'dark'; onToggle: () => void }> = ({ theme, onToggle }) => (
  <header className="mb-4 flex items-center justify-between">
    <Link href="/" aria-label="Herói da Cidade: ir para o site" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0072d2] shadow-lg shadow-blue-600/30">
        <img src="/images/logo-128.webp" alt="" className="h-full w-full scale-125 object-cover" />
      </span>
      <span className="text-base font-bold tracking-tight">Herói da Cidade</span>
    </Link>
    <button type="button" onClick={onToggle} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  </header>
);

/** "Passo X de N", barra de progresso, título e subtítulo da tela. */
export const StepHeader: React.FC<{ index: number; total: number; title: string; subtitle: string }> = ({ index, total, title, subtitle }) => (
  <div className="mb-6">
    <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Passo {index + 1} de {total}</span>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} aria-label="Progresso do formulário">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
    </div>
    <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
    <p className="mt-1 text-sm text-slate-700 dark:text-white/75">{subtitle}</p>
  </div>
);

export const alertBox = 'rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200';

export const ui = {
  card: 'rounded-[2rem] border border-slate-200 bg-white p-5 text-left shadow-xl shadow-slate-200/60 sm:p-8 dark:border-white/10 dark:bg-[#0B1929]/70 dark:shadow-black/40',
  input: 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-[#070B14] dark:text-white dark:placeholder:text-white/30',
  label: 'block text-sm font-semibold text-slate-700 dark:text-white/75',
  hint: 'mt-1 block text-xs font-normal text-slate-500 dark:text-white/45',
  muted: 'text-slate-500 dark:text-white/50',
  body: 'text-slate-700 dark:text-white/75',
  primary: 'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-blue-500 disabled:opacity-60',
  secondary: 'flex min-h-12 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10',
  panel: 'rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5',
};
export const field = `mt-1.5 ${ui.input}`;
export const choice = (active: boolean) => `flex min-h-12 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors ${active
  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-white'
  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10'}`;

/** Ícone de cada item do pacote, pelo texto (os itens são editáveis no CRM; sem correspondência, um "check"). */
export function itemIcon(item: string) {
  const t = item.toLowerCase();
  if (/participa|hora|min/.test(t)) return Clock;
  if (/deslocamento/.test(t)) return Car;
  if (/som|microfone/.test(t)) return Mic;
  if (/monitor|agente/.test(t)) return UserRound;
  if (/certificado/.test(t)) return Award;
  if (/brinde/.test(t)) return Gift;
  if (/v[ií]deo/.test(t)) return Video;
  if (/experi[eê]ncia|atua/.test(t)) return Star;
  return Check;
}

export const PackageItems: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
    {items.map((item) => {
      const Icon = itemIcon(item);
      return (
        <li key={item} className="flex items-start gap-2 text-sm text-slate-700 dark:text-white/75">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"><Icon className="h-3.5 w-3.5" aria-hidden /></span>
          {item}
        </li>
      );
    })}
  </ul>
);

/** "i" clicável ao lado de um rótulo, com a explicação logo abaixo. */
export const InfoTip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`Mais informações: ${label}`}
        className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 align-[-3px] text-blue-700 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-200">
        <Info className="h-3 w-3" aria-hidden />
      </button>
      {open && <span className="mt-1.5 block rounded-lg bg-blue-50 p-2.5 text-xs font-normal text-blue-800 dark:bg-blue-500/10 dark:text-blue-100">{children}</span>}
    </>
  );
};

/** Telefone em duas partes (DDI + número), como no agendamento da vídeo chamada, com as cores do tema. */
export const PhoneInput: React.FC<{ title: string; note?: string; country: string; number: string; onCountry: (iso: string) => void; onNumber: (value: string) => void; required?: boolean; autoComplete?: string }> = ({ title, note, country, number, onCountry, onNumber, required, autoComplete = 'tel' }) => {
  const options = useMemo(() => phoneCountryOptions(), []);
  const selected = options.find((option) => option.iso === country);
  return (
    <div>
      <span className={ui.label}>{title}</span>
      <div className="mt-1.5 flex gap-2">
        {/* DDI compacto: mostra só bandeira + código; o select invisível por cima abre a lista completa (com o nome dos países). */}
        <div className="relative flex w-[5.75rem] shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white text-base text-slate-900 focus-within:border-blue-500 dark:border-white/10 dark:bg-[#070B14] dark:text-white">
          <span aria-hidden>{selected?.flag}</span><span aria-hidden className="font-semibold">+{selected?.ddi}</span>
          <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 opacity-50"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          <select aria-label={`${title}: país (DDI)`} value={country} onChange={(e) => onCountry(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
            {options.map((option) => <option key={option.iso} value={option.iso}>{option.label}</option>)}
          </select>
        </div>
        <input required={required} type="tel" inputMode="tel" autoComplete={autoComplete} aria-label={`${title}: número`} placeholder={country === 'BR' ? '(31) 99999-0000' : 'Número com código de área'} value={number} onChange={(e) => onNumber(e.target.value)} className={`min-w-0 flex-1 ${ui.input}`} />
      </div>
      {note && <span className={ui.hint}>{note}</span>}
    </div>
  );
};

/** Cartão de um adicional: imagem, descrição e o que preencher quando marcado. */
export const AddonCard: React.FC<{ image: string; title: string; price: string; text: string; checked: boolean; video?: string; onChange?: (value: boolean) => void; control?: React.ReactNode; children?: React.ReactNode }> = ({ image, title, price, text, checked, video, onChange, control, children }) => (
  <article className={`overflow-hidden rounded-2xl border transition-colors ${checked ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-slate-200 dark:border-white/10'} bg-white dark:bg-white/5`}>
    <img src={image} alt={title} loading="lazy" className="aspect-video w-full object-cover" />
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{price}</p>
        </div>
        {onChange && (
          <label className={`${choice(checked)} min-h-10 flex-none cursor-pointer gap-2 px-3`}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            {checked ? 'Adicionado' : 'Adicionar'}
          </label>
        )}
      </div>
      <p className={`text-sm leading-relaxed ${ui.body}`}>{text} <span className={ui.muted}>Desconto válido só junto do pacote presencial.</span></p>
      {video && <ExampleVideo url={video} title={title} />}
      {control}
      {checked && children}
    </div>
  </article>
);

/** "Ver exemplar": toca o vídeo de exemplo numa janela sobre a página (YouTube sem cookies ou arquivo), sem sair do formulário. */
const ExampleVideo: React.FC<{ url: string; title: string }> = ({ url, title }) => {
  const [open, setOpen] = useState(false);
  const video = useMemo(() => parseThankYouVideo(url), [url]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  if (!video) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-500 dark:text-blue-300">
        <PlayCircle className="h-4 w-4" aria-hidden />Ver exemplar
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={`Exemplo: ${title}`} onClick={() => setOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div onClick={(event) => event.stopPropagation()} className="relative aspect-[9/16] h-[min(80vh,640px)] max-w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
            {video.kind === 'youtube'
              ? <iframe src={video.embedUrl} title={`Exemplo: ${title}`} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              : <video src={video.src} controls autoPlay playsInline className="h-full w-full object-contain" />}
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar vídeo" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>
        </div>
      )}
    </>
  );
};
