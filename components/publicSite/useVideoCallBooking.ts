import { useCallback, useEffect, useMemo, useState } from 'react';
import { localSlot } from '../../functions/video-call-time.js';
import { DEFAULT_PHONE_COUNTRY } from '../../services/phoneCountries.js';
import type { BookingValues, Day, PublicConfig } from './videoCallShared';

/** Carrega os dias/horários disponíveis e a configuração pública da vídeo chamada. */
export function useVideoCallAvailability(onConfig?: (config: PublicConfig) => void) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [month, setMonth] = useState<string>(''); // 'YYYY-MM'

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const response = await fetch('/api/video-call');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'Não foi possível carregar os horários.');
      setDays(data.days);
      setConfig(data.config);
      onConfig?.(data.config);
      setMonth((current) => current || data.days[0]?.date.slice(0, 7) || '');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os horários.');
    }
  }, [onConfig]);
  useEffect(() => { load(); }, [load]);

  return { days, config, loadError, month, setMonth, load };
}

/** Estado do formulário de dados (responsável, telefones, criança, tema). */
export function useBookingFormState() {
  const [values, setValues] = useState<BookingValues>({ name: '', email: '', whatsapp: '', callWhatsapp: '', childName: '', childAge: '', theme: '', details: '' });
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [callCountry, setCallCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [sameNumber, setSameNumber] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  return { values, setValues, country, setCountry, callCountry, setCallCountry, sameNumber, setSameNumber, submitting, setSubmitting };
}

export type BookingFormState = ReturnType<typeof useBookingFormState>;

export interface CalendarData {
  available: Map<string, string[]>;
  months: string[];
  showLocal: boolean;
  grid: (string | null)[];
}

/** Derivados do calendário: dias disponíveis, meses, se mostra horário local e a grade do mês. */
export function useCalendarData(days: Day[] | null, month: string, timeZone: string): CalendarData {
  const available = useMemo(() => new Map((days ?? []).map((d) => [d.date, d.times])), [days]);
  const months = useMemo(() => [...new Set((days ?? []).map((d) => d.date.slice(0, 7)))], [days]);
  // A agenda é sempre a de Brasília. O horário local só aparece para quem está em um fuso em que ele difere (cliente no Brasil vê a tela limpa).
  const showLocal = useMemo(() => !!timeZone && (days ?? []).some((d) => d.times.some((t) => !localSlot(d.date, t, timeZone).same)), [days, timeZone]);

  const grid = useMemo(() => {
    if (!month) return [];
    const [year, monthNumber] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)] as (string | null)[];
  }, [month]);

  return { available, months, showLocal, grid };
}
