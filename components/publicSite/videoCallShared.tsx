import React from 'react';
import { isValidTimeZone } from '../../functions/video-call-time.js';
import { ddiOf } from '../../services/phoneCountries.js';

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

/** Trechos entre ** viram negrito (textos configuráveis no admin). O padrão é para fundo escuro; os formulários com tema passam a cor do tema. */
export const renderBold = (text: string, strong = 'font-bold text-white') => text.split('**').map((part, i) => (i % 2 ? <strong key={i} className={strong}>{part}</strong> : part));
const themedStrong = 'font-bold text-slate-900 dark:text-white';

/** Texto configurável no admin: parágrafos separados por linha em branco e **negrito**. */
export const Rich: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div className={`space-y-3 text-sm leading-relaxed text-slate-700 dark:text-white/75 ${className ?? ''}`}>
    {text.split(/\n\s*\n/).map((paragraph, i) => (
      <p key={i} className="whitespace-pre-line">
        {renderBold(paragraph, themedStrong)}
      </p>
    ))}
  </div>
);

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
