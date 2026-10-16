import React, { useMemo, useState } from 'react';
import { Award, Car, Check, Clock, Gift, Info, Mic, Star, UserRound, Video } from 'lucide-react';
import { phoneCountryOptions } from '../../services/phoneCountries.js';

// Peças do formulário do evento (/formulario-evento) com tema claro (padrão) e escuro (classe `dark` na raiz da página).

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
export const PhoneInput: React.FC<{ title: string; note?: string; country: string; number: string; onCountry: (iso: string) => void; onNumber: (value: string) => void }> = ({ title, note, country, number, onCountry, onNumber }) => {
  const options = useMemo(() => phoneCountryOptions(), []);
  return (
    <div>
      <span className={ui.label}>{title}</span>
      <div className="mt-1.5 flex gap-2">
        <select aria-label={`${title}: país (DDI)`} value={country} onChange={(e) => onCountry(e.target.value)} className={`w-[7.25rem] shrink-0 ${ui.input} px-2`}>
          {options.map((option) => <option key={option.iso} value={option.iso}>{option.label}</option>)}
        </select>
        <input type="tel" inputMode="tel" autoComplete="tel" aria-label={`${title}: número`} placeholder={country === 'BR' ? '(31) 99999-0000' : 'Número com código de área'} value={number} onChange={(e) => onNumber(e.target.value)} className={`min-w-0 flex-1 ${ui.input}`} />
      </div>
      {note && <span className={ui.hint}>{note}</span>}
    </div>
  );
};

/** Cartão de um adicional: imagem, descrição e o que preencher quando marcado. */
export const AddonCard: React.FC<{ image: string; title: string; price: string; text: string; checked: boolean; onChange?: (value: boolean) => void; control?: React.ReactNode; children?: React.ReactNode }> = ({ image, title, price, text, checked, onChange, control, children }) => (
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
      {control}
      {checked && children}
    </div>
  </article>
);
