import React, { useMemo } from 'react';
import { isValidTimeZone } from '../../functions/video-call-time.js';
import { ddiOf, phoneCountryOptions } from '../../services/phoneCountries.js';

export interface Day { date: string; times: string[] }
export interface Booked { date: string; time: string; whatsappUrl: string | null }
export interface PublicConfig { priceLabel: string; durationMinutes: number; paymentDeadlineHours: number; texts: { info: string; confirm: string; security: string } }
export type Step = 'slot' | 'info' | 'form';
export interface BookingValues { name: string; email: string; whatsapp: string; callWhatsapp: string; childName: string; childAge: string; theme: string; details: string }

export const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const brDate = (key: string) => key.split('-').reverse().join('/');
// As chaves 'YYYY-MM-DD' já são datas de parede (de Brasília ou do cliente): formatar em UTC só evita que o fuso do aparelho as desloque.
export const longDate = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
export const shortDay = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));

/**
 * Fuso do aparelho do cliente (identificador IANA do navegador). Vazio se o navegador não informar: aí a página mostra só Brasília.
 * `?fuso=Europe/Lisbon` na URL simula outro fuso, para conferir o que um cliente de fora vê sem mudar o relógio do aparelho.
 */
export function detectTimeZone(): string {
  try {
    const simulated = new URLSearchParams(window.location.search).get('fuso');
    if (simulated && isValidTimeZone(simulated)) return simulated;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(detected) ? detected : '';
  } catch {
    return '';
  }
}

export const inputBase = 'rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none';
export const field = `mt-1.5 w-full ${inputBase}`;
export const label = 'block text-xs font-semibold text-white/70';
export const hint = 'mt-1 block text-xs font-normal text-white/40';
export const heading = 'text-xs font-black uppercase tracking-[0.2em] text-blue-400';
export const primary = 'min-h-12 w-full rounded-xl bg-blue-600 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-blue-500 disabled:opacity-60';
export const box = 'rounded-[2rem] border border-white/10 bg-[#0B1929]/60 p-5 text-left shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-8';

/** Trechos entre ** viram negrito (textos configuráveis no admin). */
export const renderBold = (text: string) => text.split('**').map((part, i) => (i % 2 ? <strong key={i} className="font-bold text-white">{part}</strong> : part));

/** Texto configurável no admin: parágrafos separados por linha em branco e **negrito**. */
export const Rich: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div className={`space-y-3 text-sm leading-relaxed text-white/75 ${className ?? ''}`}>
    {text.split(/\n\s*\n/).map((paragraph, i) => (
      <p key={i} className="whitespace-pre-line">
        {renderBold(paragraph)}
      </p>
    ))}
  </div>
);

/** Telefone em duas partes: país (DDI, Brasil por padrão) e número. O servidor junta os dois no formato internacional. */
export const PhoneField: React.FC<{ title: string; note?: string; country: string; number: string; onCountry: (iso: string) => void; onNumber: (value: string) => void; autoComplete?: string }> = ({ title, note, country, number, onCountry, onNumber, autoComplete }) => {
  const options = useMemo(() => phoneCountryOptions(), []);
  return (
    <div>
      <span className={label}>{title}</span>
      <div className="mt-1.5 flex gap-2">
        <select aria-label={`${title}: país (DDI)`} value={country} onChange={(e) => onCountry(e.target.value)} className={`w-[7.25rem] shrink-0 ${inputBase} px-2`}>
          {options.map((option) => <option key={option.iso} value={option.iso}>{option.label}</option>)}
        </select>
        <input required type="tel" inputMode="tel" autoComplete={autoComplete} aria-label={`${title}: número`} placeholder={country === 'BR' ? '(31) 99999-0000' : 'Número com código de área'} value={number} onChange={(e) => onNumber(e.target.value)} className={`min-w-0 flex-1 ${inputBase}`} />
      </div>
      {note && <span className={hint}>{note}</span>}
    </div>
  );
};

interface BookingBodyInput {
  values: BookingValues;
  country: string;
  callCountry: string;
  sameNumber: boolean;
  timeZone: string;
  date: string;
  time: string;
}

/** Corpo do POST de agendamento. */
export const buildBookingBody = ({ values, country, callCountry, sameNumber, timeZone, date, time }: BookingBodyInput) => ({
  ...values, ddi: ddiOf(country), callDdi: ddiOf(callCountry), callWhatsapp: sameNumber ? '' : values.callWhatsapp,
  timezone: timeZone, slot: { date, time }, // o horário enviado é sempre o de Brasília; o fuso vai só como informação
});
